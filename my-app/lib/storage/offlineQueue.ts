import AsyncStorage from '@react-native-async-storage/async-storage';
import { addStroke, updateBoardContent } from '@/lib/supabase';
import type { StrokeInput } from '@/types';

const OFFLINE_QUEUE_KEY = '@lovas/offline-queue';

export type QueuedMutation =
  | { type: 'stroke'; payload: StrokeInput }
  | {
      type: 'content';
      payload: {
        boardId: string;
        deviceId: string;
        content: { name?: string; message?: string; accentColor?: string; variant?: string };
      };
    };

export async function enqueueMutation(mutation: QueuedMutation): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedMutation[] = raw ? JSON.parse(raw) : [];
    queue.push(mutation);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Failed to enqueue offline mutation', e);
  }
}

export async function flushOfflineQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue: QueuedMutation[] = JSON.parse(raw);
    if (queue.length === 0) return;

    // Clear queue before processing to prevent duplicate retries
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);

    for (const item of queue) {
      try {
        if (item.type === 'stroke') {
          await addStroke(item.payload);
        } else if (item.type === 'content') {
          await updateBoardContent(
            item.payload.boardId,
            item.payload.deviceId,
            item.payload.content as any
          );
        }
      } catch (err) {
        console.warn('Failed to replay offline mutation', err);
      }
    }
  } catch (e) {
    console.warn('Error flushing offline queue', e);
  }
}
