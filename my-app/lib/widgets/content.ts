import type { Board } from '@/types';
import { DEFAULT_WIDGET_CONTENT, type WidgetContent } from './types';

/**
 * Build the compact content payload the widget renders from the board record.
 * Board coordinates/points are gone — the card only needs text + theme, so the
 * payload stays tiny and cheap for the extension's process to read.
 */
export function buildWidgetContent(
  board: Pick<Board, 'id' | 'name'> & Partial<Board>
): WidgetContent {
  return {
    boardId: board.id,
    title: board.name || DEFAULT_WIDGET_CONTENT.title,
    message: board.message ?? DEFAULT_WIDGET_CONTENT.message,
    accentColor: board.accentColor || DEFAULT_WIDGET_CONTENT.accentColor,
    variant: board.variant ?? DEFAULT_WIDGET_CONTENT.variant,
    updatedAt: Date.now(),
  };
}
