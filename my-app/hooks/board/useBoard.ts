import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { Stroke, StrokePoint, StrokeTool } from '@/types';
import { subscribeToStrokes, subscribeToPresence } from '@/lib/realtime';
import { getStrokes, addStroke, deleteStroke, restoreStroke, clearBoard } from '@/lib/supabase';
import { enqueueMutation } from '@/lib/storage';

export type BoardAction =
  | { type: 'draw'; stroke: Stroke }
  | { type: 'erase'; strokes: Stroke[] }
  | { type: 'clear'; previousStrokes: Stroke[] };

interface UseBoardOptions {
  boardId: string;
  deviceId: string;
  enabled?: boolean;
}

function getCacheKey(boardId: string) {
  return `@lovas/cached-strokes-${boardId}`;
}

async function cacheStrokesLocally(boardId: string, strokes: Stroke[]) {
  try {
    await AsyncStorage.setItem(getCacheKey(boardId), JSON.stringify(strokes));
  } catch {}
}

async function loadCachedStrokes(boardId: string): Promise<Stroke[]> {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(boardId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useBoard({ boardId, deviceId, enabled = true }: UseBoardOptions) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoStack, setUndoStack] = useState<BoardAction[]>([]);
  const [redoStack, setRedoStack] = useState<BoardAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverConnected, setServerConnected] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);

  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;

  const undoStackRef = useRef<BoardAction[]>([]);
  undoStackRef.current = undoStack;

  const redoStackRef = useRef<BoardAction[]>([]);
  redoStackRef.current = redoStack;

  // Load strokes from server and cache locally
  const refreshStrokes = useCallback(async () => {
    if (!boardId) return;
    try {
      const remote = await getStrokes(boardId);
      setStrokes(remote);
      strokesRef.current = remote;
      cacheStrokesLocally(boardId, remote);
    } catch (e) {
      console.warn('Failed to load strokes from server', e);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  // Initial load: instant local-first cache, then server sync
  useEffect(() => {
    if (!enabled || !boardId) return;
    let alive = true;

    (async () => {
      const cached = await loadCachedStrokes(boardId);
      if (alive && cached.length > 0) {
        setStrokes(cached);
        strokesRef.current = cached;
        setLoading(false);
      }
      refreshStrokes();
    })();

    return () => {
      alive = false;
    };
  }, [enabled, boardId, refreshStrokes]);

  // App resume: refresh strokes if in background
  useEffect(() => {
    if (!enabled || !boardId) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshStrokes();
      }
    });
    return () => sub.remove();
  }, [enabled, boardId, refreshStrokes]);

  // Realtime subscription for strokes and partner presence
  useEffect(() => {
    if (!enabled || !boardId || !deviceId) return;
    let alive = true;

    const unsubStrokes = subscribeToStrokes(
      boardId,
      // onInsert
      newStroke => {
        if (!alive) return;
        setStrokes(prev => {
          const exists = prev.some(s => s.id === newStroke.id);
          let next: Stroke[];
          if (exists) {
            next = prev.map(s => (s.id === newStroke.id ? newStroke : s));
          } else {
            next = [...prev, newStroke].sort((a, b) => a.sequence - b.sequence);
          }
          cacheStrokesLocally(boardId, next);
          return next;
        });
      },
      // onDelete
      deletedId => {
        if (!alive) return;
        setStrokes(prev => {
          const next = prev.filter(s => s.id !== deletedId);
          cacheStrokesLocally(boardId, next);
          return next;
        });
      },
      up => {
        if (!alive) return;
        setServerConnected(up);
      }
    );

    const unsubPresence = subscribeToPresence(boardId, deviceId, presence => {
      if (!alive) return;
      const others = Object.values(presence).filter(p => Boolean(p && p.deviceId && p.deviceId !== deviceId));
      setPartnerOnline(others.length > 0);
    });

    return () => {
      alive = false;
      unsubStrokes();
      unsubPresence();
    };
  }, [enabled, boardId, deviceId]);

  // Submit stroke drawn locally
  const submitStroke = useCallback(
    async (input: {
      points: StrokePoint[];
      color: string;
      strokeWidth: number;
      tool: StrokeTool;
    }) => {
      if (!boardId || !deviceId || input.points.length === 0) return;

      const strokeId = Crypto.randomUUID();
      const optimisticStroke: Stroke = {
        id: strokeId,
        boardId,
        deviceId,
        points: input.points,
        color: input.color,
        strokeWidth: input.strokeWidth,
        tool: input.tool,
        sequence: Date.now(),
        createdAt: new Date().toISOString(),
      };

      // 1. Optimistic render
      setStrokes(prev => {
        const next = [...prev, optimisticStroke];
        cacheStrokesLocally(boardId, next);
        return next;
      });
      setUndoStack(prev => [...prev, { type: 'draw', stroke: optimisticStroke }]);
      setRedoStack([]); // new action clears redo stack

      // 2. Persist to server in background (or enqueue if offline)
      try {
        await addStroke({
          id: strokeId,
          boardId,
          deviceId,
          points: input.points,
          color: input.color,
          strokeWidth: input.strokeWidth,
          tool: input.tool,
        });
      } catch (e) {
        console.warn('Failed to persist stroke immediately, enqueuing offline', e);
        await enqueueMutation({
          type: 'stroke',
          payload: {
            id: strokeId,
            boardId,
            deviceId,
            points: input.points,
            color: input.color,
            strokeWidth: input.strokeWidth,
            tool: input.tool,
          },
        });
      }
    },
    [boardId, deviceId]
  );

  // Vector erase one or multiple strokes (batched swipe)
  const eraseStrokes = useCallback(
    async (strokeIds: string[]) => {
      if (!boardId || strokeIds.length === 0) return;
      const current = strokesRef.current;
      const toErase = current.filter(s => strokeIds.includes(s.id));
      if (toErase.length === 0) return;

      // Optimistic removal
      setStrokes(prev => {
        const next = prev.filter(s => !strokeIds.includes(s.id));
        cacheStrokesLocally(boardId, next);
        return next;
      });
      setUndoStack(prev => [...prev, { type: 'erase', strokes: toErase }]);
      setRedoStack([]);

      // Persist delete to server
      for (const s of toErase) {
        deleteStroke(s.id).catch(e => console.warn('Failed to delete erased stroke on server', e));
      }
    },
    [boardId]
  );

  // Single stroke convenience wrapper
  const eraseStroke = useCallback(
    (strokeId: string) => {
      eraseStrokes([strokeId]);
    },
    [eraseStrokes]
  );

  // Formal Undo
  const undo = useCallback(async () => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;

    const action = stack[stack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);

    if (action.type === 'draw') {
      setStrokes(prev => {
        const next = prev.filter(s => s.id !== action.stroke.id);
        cacheStrokesLocally(boardId, next);
        return next;
      });
      try {
        await deleteStroke(action.stroke.id);
      } catch (e) {
        console.warn('Undo draw delete failed', e);
      }
    } else if (action.type === 'erase') {
      setStrokes(prev => {
        const next = [...prev, ...action.strokes].sort((a, b) => a.sequence - b.sequence);
        cacheStrokesLocally(boardId, next);
        return next;
      });
      for (const s of action.strokes) {
        restoreStroke(s).catch(e => console.warn('Undo erase restore failed', e));
      }
    } else if (action.type === 'clear') {
      setStrokes(prev => {
        const next = [...action.previousStrokes].sort((a, b) => a.sequence - b.sequence);
        cacheStrokesLocally(boardId, next);
        return next;
      });
      for (const s of action.previousStrokes) {
        restoreStroke(s).catch(e => console.warn('Undo clear restore failed', e));
      }
    }
  }, [boardId]);

  // Formal Redo
  const redo = useCallback(async () => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;

    const action = stack[stack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);

    if (action.type === 'draw') {
      setStrokes(prev => {
        const next = [...prev, action.stroke].sort((a, b) => a.sequence - b.sequence);
        cacheStrokesLocally(boardId, next);
        return next;
      });
      try {
        await restoreStroke(action.stroke);
      } catch (e) {
        console.warn('Redo draw restore failed', e);
      }
    } else if (action.type === 'erase') {
      const idsToErase = action.strokes.map(s => s.id);
      setStrokes(prev => {
        const next = prev.filter(s => !idsToErase.includes(s.id));
        cacheStrokesLocally(boardId, next);
        return next;
      });
      for (const s of action.strokes) {
        deleteStroke(s.id).catch(e => console.warn('Redo erase delete failed', e));
      }
    } else if (action.type === 'clear') {
      setStrokes(prev => {
        cacheStrokesLocally(boardId, []);
        return [];
      });
      try {
        await clearBoard(boardId, deviceId);
      } catch (e) {
        console.warn('Redo clear failed', e);
      }
    }
  }, [boardId, deviceId]);

  // Clear board with undo preservation
  const clear = useCallback(async () => {
    if (!boardId || !deviceId) return;
    const current = strokesRef.current;
    if (current.length === 0) return;

    setUndoStack(prev => [...prev, { type: 'clear', previousStrokes: current }]);
    setRedoStack([]);
    setStrokes([]);
    cacheStrokesLocally(boardId, []);

    try {
      await clearBoard(boardId, deviceId);
    } catch (e) {
      console.warn('Clear board failed', e);
    }
  }, [boardId, deviceId]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return {
    strokes,
    loading,
    serverConnected,
    partnerOnline,
    canUndo,
    canRedo,
    submitStroke,
    eraseStroke,
    eraseStrokes,
    undo,
    redo,
    clear,
  };
}
