import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { BoardContentVariant } from '@/types';
import { subscribeToBoardContent, subscribeToPresence } from '@/lib/realtime';
import { getBoardContent, updateBoardContent } from '@/lib/supabase';
import { buildWidgetContent } from '@/lib/widgets/content';
import { loadWidgetContent, syncWidgetContent } from '@/lib/widgets/storage';
import { enqueueMutation } from '@/lib/storage';
import { DEFAULT_WIDGET_CONTENT, type WidgetContent } from '@/lib/widgets/types';

interface UseBoardContentOptions {
  boardId: string;
  boardName: string;
  deviceId: string;
  enabled?: boolean;
}

const SERVER_PUSH_DEBOUNCE_MS = 500;

/**
 * Owns the widget's content for the active board.
 *
 * Local-first and dormant-safe:
 *  - content is always applied to the App Group so the widget is never empty
 *  - the server push/subscribe only activates once the SQL migration is run
 *    (getBoardContent/updateBoardContent no-op safely before that)
 *  - partner edits arrive via realtime and repaint this device's widget too
 */
export function useBoardContent({
  boardId,
  boardName,
  deviceId,
  enabled = true,
}: UseBoardContentOptions) {
  const [content, setContent] = useState<WidgetContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverConnected, setServerConnected] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);

  const contentRef = useRef<WidgetContent | null>(null);
  contentRef.current = content;

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyContent = useCallback((next: WidgetContent) => {
    contentRef.current = next;
    setContent(next);
    syncWidgetContent(next).catch(() => {});
  }, []);

  // Initial load: device copy first (instant), then server truth if migrated.
  useEffect(() => {
    if (!enabled || !boardId) return;
    let alive = true;

    (async () => {
      const local = await loadWidgetContent();
      const seeded: WidgetContent = {
        ...DEFAULT_WIDGET_CONTENT,
        ...local,
        boardId,
        title:
          local.boardId === boardId && local.title
            ? local.title
            : boardName || DEFAULT_WIDGET_CONTENT.title,
      };
      if (alive) applyContent(seeded);

      const server = await getBoardContent(boardId, deviceId);
      if (alive && server) {
        applyContent(buildWidgetContent({ ...server, name: server.name || seeded.title }));
      }
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [boardId, boardName, deviceId, enabled, applyContent]);

  // Realtime: partner edits + channel status + partner presence.
  useEffect(() => {
    if (!enabled || !boardId) return;
    let alive = true;
    let cleanup: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      cleanup?.();

      const unsubscribeContent = subscribeToBoardContent(
        boardId,
        update => {
          if (!alive) return;
          const prev = contentRef.current ?? DEFAULT_WIDGET_CONTENT;
          applyContent({
            ...prev,
            boardId,
            title: update.name ?? prev.title,
            message: update.message ?? prev.message,
            accentColor: update.accentColor ?? prev.accentColor,
            variant: update.variant ?? (prev.variant as BoardContentVariant),
            updatedAt: Date.now(),
          });
        },
        up => {
          if (!alive) return;
          setServerConnected(up);
          if (!up && retryTimer === null) {
            retryTimer = setTimeout(() => {
              retryTimer = null;
              connect();
            }, 2500);
          }
        }
      );

      const unsubscribePresence = subscribeToPresence(
        boardId,
        deviceId,
        presence => {
          if (!alive) return;
          const others = Object.values(presence).filter(p => Boolean(p && p.deviceId && p.deviceId !== deviceId));
          setPartnerOnline(others.length > 0);
        },
        () => {}
      );

      cleanup = () => {
        unsubscribeContent();
        unsubscribePresence();
      };
    };

    connect();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      cleanup?.();
      setServerConnected(false);
      setPartnerOnline(false);
    };
  }, [boardId, deviceId, enabled, applyContent]);

  // App resumed -> re-fetch the server's truth in case a push was missed.
  useEffect(() => {
    if (!enabled || !boardId) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        getBoardContent(boardId, deviceId).then(server => {
          if (server) {
            applyContent(buildWidgetContent(server));
          }
        });
      }
    });
    return () => sub.remove();
  }, [boardId, deviceId, enabled, applyContent]);

  // Persist local edits: apply to widget immediately, push to server debounced.
  const saveContent = useCallback(
    (patch: Partial<Pick<WidgetContent, 'title' | 'message' | 'accentColor' | 'variant'>>) => {
      const prev = contentRef.current ?? DEFAULT_WIDGET_CONTENT;
      const next: WidgetContent = { ...prev, ...patch, updatedAt: Date.now() };
      applyContent(next);

      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(async () => {
        const payload = {
          name: next.title,
          message: next.message,
          accentColor: next.accentColor,
          variant: next.variant as BoardContentVariant,
        };
        try {
          const ok = await updateBoardContent(boardId, deviceId, payload);
          if (!ok) {
            await enqueueMutation({
              type: 'content',
              payload: { boardId, deviceId, content: payload },
            });
          }
        } catch {
          await enqueueMutation({
            type: 'content',
            payload: { boardId, deviceId, content: payload },
          });
        }
      }, SERVER_PUSH_DEBOUNCE_MS);
    },
    [boardId, deviceId, applyContent]
  );

  return {
    content,
    loading,
    serverConnected,
    partnerOnline,
    saveContent,
  };
}
