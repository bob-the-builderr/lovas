export type BoardContentVariant = 'heart' | 'heartTitle' | 'heartNote' | 'heartTitleNote';

export interface Board {
  id: string;
  coupleId: string;
  name: string;
  /** Short love note shown on the widget when the variant includes it. */
  message: string;
  /** Accent color used for the widget heart + text, hex like "#FF5A79". */
  accentColor: string;
  variant: BoardContentVariant;
  createdAt: string;
  updatedAt: string;
}

export interface BoardPresence {
  deviceId: string;
  lastSeenAt: number;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export type StrokeTool = 'pen' | 'eraser';

export interface Stroke {
  id: string;
  boardId: string;
  deviceId: string;
  points: StrokePoint[];
  color: string;
  strokeWidth: number;
  tool: StrokeTool;
  sequence: number;
  createdAt: string;
}

export interface StrokeInput {
  id: string;
  boardId: string;
  deviceId: string;
  points: StrokePoint[];
  color: string;
  strokeWidth: number;
  tool: StrokeTool;
}
