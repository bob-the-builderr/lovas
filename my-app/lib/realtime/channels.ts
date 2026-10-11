import type { RealtimeChannel } from '@supabase/supabase-js';
import { requireSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { BoardContentVariant } from '@/types';

export type RealtimeStatusHandler = (connected: boolean) => void;

/** Subset of the boards row that can change after pairing. */
export interface BoardContentUpdate {
  id: string;
  name?: string;
  message?: string;
  accentColor?: string;
  variant?: BoardContentVariant;
}

const mapBoardUpdate = (raw: {
  id?: string;
  name?: string;
  message?: string;
  accent_color?: string;
  variant?: string;
}): BoardContentUpdate => ({
  id: raw.id ?? '',
  name: raw.name,
  message: raw.message,
  accentColor: raw.accent_color,
  variant: (raw.variant as BoardContentVariant | undefined) ?? undefined,
});

/**
 * Subscribes to content changes on a board row (title / note / accent / layout
 * edits from either partner). Reports SUBSCRIBED via onStatus. Returns an
 * unsubscribe fn. Safe to call before Supabase is configured.
 */
export function subscribeToBoardContent(
  boardId: string,
  onChange: (update: BoardContentUpdate) => void,
  onStatus?: RealtimeStatusHandler
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const db = requireSupabase();

  const channel: RealtimeChannel = db.channel(`board:${boardId}`).on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'boards',
      filter: `id=eq.${boardId}`,
    },
    payload => {
      if (!payload.new) return;
      onChange(mapBoardUpdate(payload.new as Parameters<typeof mapBoardUpdate>[0]));
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

/**
 * Subscribes to new members joining a couple (e.g. partner joins with pair code).
 */
export function subscribeToCoupleMembers(
  coupleId: string,
  onPartnerJoin: (partnerDeviceId: string) => void
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const db = requireSupabase();

  const channel: RealtimeChannel = db.channel(`couple_members:${coupleId}`).on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'couple_members',
      filter: `couple_id=eq.${coupleId}`,
    },
    payload => {
      if (!payload.new) return;
      const member = payload.new as { device_id?: string };
      if (member.device_id) {
        onPartnerJoin(member.device_id);
      }
    }
  );

  channel.subscribe();

  return () => {
    db.removeChannel(channel).catch(() => {});
  };
}
