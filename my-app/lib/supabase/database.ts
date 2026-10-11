import { requireSupabase } from './client';
import type { Board, Couple, Stroke, StrokeInput, StrokeTool } from '@/types';

interface CoupleRow {
  id: string;
  pair_code: string;
  created_by: string;
  created_at: string;
}

interface BoardRow {
  id: string;
  couple_id: string;
  name: string;
  message?: string;
  accent_color?: string;
  variant?: string;
  created_at: string;
  updated_at: string;
}

interface StrokeRow {
  id: string;
  board_id: string;
  device_id: string;
  points: { x: number; y: number }[];
  color: string;
  stroke_width: number;
  tool: string;
  sequence: number | string;
  created_at: string;
}

const toCouple = (row: CoupleRow): Couple => ({
  id: row.id,
  pairCode: row.pair_code,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const toBoard = (row: BoardRow): Board => ({
  id: row.id,
  coupleId: row.couple_id,
  name: row.name,
  message: row.message ?? '',
  accentColor: row.accent_color ?? '#FF5A79',
  variant: (row.variant as Board['variant']) ?? 'heartTitle',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toStroke = (row: StrokeRow): Stroke => ({
  id: row.id,
  boardId: row.board_id,
  deviceId: row.device_id,
  points: row.points ?? [],
  color: row.color,
  strokeWidth: Number(row.stroke_width),
  tool: (row.tool as StrokeTool) ?? 'pen',
  sequence: Number(row.sequence),
  createdAt: row.created_at,
});

// -------- schema probe (dormant until migration is applied) --------

let boardContentReady: boolean | null = null;

/**
 * Whether the `boards` row carries the widget content columns.
 */
export async function boardContentEnabled(): Promise<boolean> {
  if (boardContentReady !== null) return boardContentReady;
  try {
    const db = requireSupabase();
    const { data, error } = await db.rpc('board_content_columns_exist');
    boardContentReady = !error && data === true;
  } catch {
    boardContentReady = false;
  }
  return boardContentReady;
}

// -------- devices --------

export async function registerDevice(deviceId: string): Promise<void> {
  const db = requireSupabase();
  await db.rpc('register_device', { p_device_id: deviceId });
}

export async function disconnectDevice(deviceId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('disconnect_device', { p_device_id: deviceId });
  if (error) console.warn('disconnectDevice RPC failed', error);
}

// -------- couples --------

export async function createCouple(deviceId: string, pairCode: string): Promise<Couple> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('create_couple', {
    p_created_by: deviceId,
    p_pair_code: pairCode,
  });
  if (error) throw error;

  const coupleId = data as string;
  const couple = (await db
    .from('couples')
    .select('*')
    .eq('id', coupleId)
    .single()
    .then(r => r.data)) as CoupleRow;

  return toCouple(couple);
}

export async function joinCouple(deviceId: string, pairCode: string): Promise<Couple> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('join_couple', {
    p_device_id: deviceId,
    p_pair_code: pairCode,
  });
  if (error) throw error;

  const coupleId = data as string;
  const { data: couple, error: coupleError } = await db
    .from('couples')
    .select('*')
    .eq('id', coupleId)
    .single();
  if (coupleError) throw coupleError;

  return toCouple(couple as CoupleRow);
}

export async function getPartnerDeviceId(
  coupleId: string,
  myDeviceId: string
): Promise<string | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('couple_members')
    .select('device_id')
    .eq('couple_id', coupleId)
    .neq('device_id', myDeviceId);
  if (error) return null;
  return (data?.[0]?.device_id as string | undefined) ?? null;
}

// -------- boards --------

export async function getBoardId(coupleId: string): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('get_board_id', { p_couple_id: coupleId });
  if (error) throw error;
  return data as string;
}

export async function getBoards(coupleId: string): Promise<Board[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('get_boards', { p_couple_id: coupleId });
  if (error) throw error;
  return ((data as BoardRow[]) ?? []).map(toBoard);
}

export async function getFirstBoard(coupleId: string): Promise<Board | null> {
  const boards = await getBoards(coupleId);
  return boards[0] ?? null;
}

// -------- whiteboard strokes --------

export async function getStrokes(boardId: string): Promise<Stroke[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('get_strokes', { p_board_id: boardId });
  if (error) throw error;
  return ((data as StrokeRow[]) ?? []).map(toStroke);
}

export async function addStroke(stroke: StrokeInput): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('add_stroke', {
    p_id: stroke.id,
    p_board_id: stroke.boardId,
    p_device_id: stroke.deviceId,
    p_tool: stroke.tool,
    p_points: stroke.points,
    p_color: stroke.color,
    p_stroke_width: stroke.strokeWidth,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteStroke(strokeId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('delete_stroke', { p_stroke_id: strokeId });
  if (error) throw error;
}

export async function restoreStroke(stroke: Stroke): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('restore_stroke', {
    p_id: stroke.id,
    p_board_id: stroke.boardId,
    p_device_id: stroke.deviceId,
    p_tool: stroke.tool,
    p_points: stroke.points,
    p_color: stroke.color,
    p_stroke_width: stroke.strokeWidth,
    p_sequence: stroke.sequence,
    p_created_at: stroke.createdAt,
  });
  if (error) throw error;
}

export async function clearBoard(boardId: string, deviceId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('clear_board', {
    p_board_id: boardId,
    p_device_id: deviceId,
  });
  if (error) throw error;
}

// -------- widget content --------

/** Fetch the shared board content for the widget. Null when not migrated. */
export async function getBoardContent(boardId: string, deviceId: string): Promise<Board | null> {
  if (!(await boardContentEnabled())) return null;
  try {
    const db = requireSupabase();
    const { data, error } = await db.rpc('get_board_content', {
      p_board_id: boardId,
      p_device_id: deviceId,
    });
    if (error || !data || (data as BoardRow[]).length === 0) return null;
    return toBoard((data as BoardRow[])[0]);
  } catch {
    return null;
  }
}

/** Persist widget content and board title edits to the shared board. */
export async function updateBoardContent(
  boardId: string,
  deviceId: string,
  content: Partial<Pick<Board, 'name' | 'message' | 'accentColor' | 'variant'>>
): Promise<boolean> {
  if (!(await boardContentEnabled())) return false;
  try {
    const db = requireSupabase();
    const { error } = await db.rpc('update_board_content', {
      p_board_id: boardId,
      p_device_id: deviceId,
      p_message: content.message ?? '',
      p_accent_color: content.accentColor ?? '#FF5A79',
      p_variant: content.variant ?? 'heartTitle',
      p_name: content.name ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}
