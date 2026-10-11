import type { BoardContentVariant } from '@/types';

// Data contract shared with the native widget extension (targets/widget).
// Mirror this shape in targets/widget/widgets.swift (WidgetContent Codable).

export type WidgetVariant = BoardContentVariant;

export interface WidgetPoint {
  x: number;
  y: number;
}

export interface WidgetStroke {
  points: WidgetPoint[];
  color: string;
  strokeWidth: number;
}

export interface WidgetContent {
  boardId: string;
  title: string;
  /** Optional love note; empty string when unset. */
  message: string;
  /** Hex like "#FF5A79". */
  accentColor: string;
  variant: WidgetVariant;
  /** The vector strokes on the drawing whiteboard */
  strokes?: WidgetStroke[];
  /** Reference canvas dimensions so the widget scales strokes proportionally */
  canvasWidth?: number;
  canvasHeight?: number;
  updatedAt: number; // epoch ms, for "last updated" bookkeeping
}

export const DEFAULT_WIDGET_CONTENT: WidgetContent = {
  boardId: '',
  title: 'Our Board',
  message: '',
  accentColor: '#FF5A79',
  variant: 'heartTitle',
  strokes: [],
  canvasWidth: 360,
  canvasHeight: 360,
  updatedAt: 0,
};
