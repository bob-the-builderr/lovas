import type { RealtimeChannel } from '@supabase/supabase-js';
import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { BoardPresence } from '@/types';
import type { RealtimeStatusHandler } from './channels';

export type PresenceHandler = (presence: Record<string, BoardPresence>) => void;

function flatten(state: Record<string, BoardPresence[]>): Record<string, BoardPresence> {
  const flat: Record<string, BoardPresence> = {};
  Object.entries(state).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0 && value[0]) {
      flat[key] = value[0] as BoardPresence;
    }
  });
  return flat;
}

/**
 * Tracks who (which device) is currently viewing a board.
 * Uses Supabase presence; returns an unsubscribe fn.
 */
export function subscribeToPresence(
  boardId: string,
  deviceId: string,
  onPresence: PresenceHandler,
  onStatus?: RealtimeStatusHandler
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const db = requireSupabase();

  const channel: RealtimeChannel = db.channel(`presence:${boardId}`, {
    config: { presence: { key: deviceId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      onPresence(flatten(channel.presenceState<BoardPresence>()));
    })
    .on('presence', { event: 'join' }, () => {
      onPresence(flatten(channel.presenceState<BoardPresence>()));
    })
    .on('presence', { event: 'leave' }, () => {
      onPresence(flatten(channel.presenceState<BoardPresence>()));
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        onStatus?.(true);
        channel.track({
          deviceId,
          lastSeenAt: Date.now(),
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        onStatus?.(false);
      }
    });

  return () => {
    db.removeChannel(channel).catch(() => {});
  };
}
