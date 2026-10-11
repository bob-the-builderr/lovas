import type { RealtimeChannel } from '@supabase/supabase-js';
import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Stroke, StrokeTool } from '@/types';
import type { RealtimeStatusHandler } from './channels';

/**
 * Subscribes to INSERT and DELETE events on the `strokes` table for the given board.
 * Incoming INSERT strokes merge into the client's board; DELETE strokes remove undone operations.
 */
export function subscribeToStrokes(
  boardId: string,
  onInsert: (stroke: Stroke) => void,
  onDelete: (strokeId: string) => void,
  onStatus?: RealtimeStatusHandler
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const db = requireSupabase();

  const channel: RealtimeChannel = db
    .channel(`strokes:${boardId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'strokes',
        filter: `board_id=eq.${boardId}`,
      },
      payload => {
        if (!payload.new) return;
        const row = payload.new as {
          id: string;
          board_id: string;
          device_id: string;
          points: { x: number; y: number }[];
          color: string;
          stroke_width: number;
          tool: string;
          sequence: number | string;
          created_at: string;
        };

        onInsert({
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
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'strokes',
      },
      payload => {
        if (payload.old && (payload.old as { id?: string }).id) {
          onDelete((payload.old as { id: string }).id);
        }
      }
    );

  channel.subscribe(status => {
    switch (status) {
      case 'SUBSCRIBED':
        onStatus?.(true);
        break;
      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
      case 'CLOSED':
        onStatus?.(false);
        break;
      default:
        break;
    }
  });

  return () => {
    db.removeChannel(channel).catch(() => {});
  };
}
