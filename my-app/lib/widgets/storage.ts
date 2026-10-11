import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtensionStorage } from '@bacons/apple-targets';
import { LOCAL_WIDGET_CONTENT_KEY, WIDGET_APP_GROUP, WIDGET_CONTENT_KEY } from './constants';
import { DEFAULT_WIDGET_CONTENT, type WidgetContent } from './types';

let storageInstance: ExtensionStorage | null = null;
function getStorage(): ExtensionStorage | null {
  if (Platform.OS !== 'ios') return null;
  if (!storageInstance) {
    try {
      storageInstance = new ExtensionStorage(WIDGET_APP_GROUP);
    } catch {
      storageInstance = null;
    }
  }
  return storageInstance;
}

/**
 * Persist a raw object to the App Group defaults as a JSON *string*, which is
 * exactly what the native widget (UserDefaults.string(forKey:)) expects.
 */
function setJson(key: string, value: unknown) {
  try {
    const storage = getStorage();
    if (storage) {
      storage.set(key, JSON.stringify(value));
    }
  } catch {
    // Non-fatal on simulator or devices without App Group provisioning
  }
}

/** Refresh the widget extension so it repaints from the newest content. */
export function reloadWidget() {
  try {
    if (Platform.OS === 'ios') {
      ExtensionStorage.reloadWidget();
    }
  } catch {
    // Non-fatal
  }
}

/** Write the current widget content to the App Group and reload the widget. */
export async function syncWidgetContent(content: WidgetContent): Promise<void> {
  setJson(WIDGET_CONTENT_KEY, content);
  reloadWidget();
  await AsyncStorage.setItem(LOCAL_WIDGET_CONTENT_KEY, JSON.stringify(content)).catch(() => {});
}

/**
 * Serializes the whiteboard drawings directly to the iOS Home Screen widget
 * so whatever is drawn on the board is live on the widget.
 */
export async function syncBoardToWidget(
  boardId: string,
  boardName: string,
  strokes: { points: { x: number; y: number }[]; color: string; strokeWidth: number }[],
  canvasWidth: number = 360,
  canvasHeight: number = 360
): Promise<void> {
  const widgetStrokes = strokes.map(s => ({
    points: s.points.map(p => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
    color: s.color,
    strokeWidth: s.strokeWidth,
  }));

  const payload: WidgetContent = {
    boardId,
    title: boardName || 'Our Board',
    message: '',
    accentColor: '#FF5A79',
    variant: 'heartTitle',
    strokes: widgetStrokes,
    canvasWidth,
    canvasHeight,
    updatedAt: Date.now(),
  };

  await syncWidgetContent(payload);
}

/** Load the last-saved widget content (device copy), falling back to defaults. */
export async function loadWidgetContent(): Promise<WidgetContent> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_WIDGET_CONTENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetContent;
      return { ...DEFAULT_WIDGET_CONTENT, ...parsed };
    }
  } catch {
    // ignore corrupt cache
  }
  return DEFAULT_WIDGET_CONTENT;
}
