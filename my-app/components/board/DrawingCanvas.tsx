import React, { memo, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Circle, Defs, Pattern, Rect } from 'react-native-svg';
import type { Stroke, StrokePoint, StrokeTool } from '@/types';

interface DrawingCanvasProps {
  strokes: Stroke[];
  activeColor: string;
  activeStrokeWidth: number;
  activeTool: StrokeTool;
  canvasBackground?: string;
  showGrid?: boolean;
  onStrokeComplete: (stroke: {
    points: StrokePoint[];
    color: string;
    strokeWidth: number;
    tool: StrokeTool;
  }) => void;
  onEraseStroke?: (strokeId: string) => void;
  onEraseStrokes?: (strokeIds: string[]) => void;
  style?: StyleProp<ViewStyle>;
}

const ERASER_RADIUS = 22;

/**
 * Calculates squared distance from point (px, py) to line segment (x1, y1) -> (x2, y2).
 */
function distanceToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const dpx = px - x1;
    const dpy = py - y1;
    return dpx * dpx + dpy * dpy;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const dpx = px - projX;
  const dpy = py - projY;
  return dpx * dpx + dpy * dpy;
}

/**
 * Vector intersection: checks if stroke path passes within radius of circle (cx, cy).
 */
export function strokeIntersectsCircle(
  stroke: Stroke,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const rSq = radius * radius;
  const pts = stroke.points;
  if (!pts || pts.length === 0) return false;

  // Quick bounding box rejection
  let minX = pts[0].x;
  let maxX = pts[0].x;
  let minY = pts[0].y;
  let maxY = pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < minX) minX = pts[i].x;
    if (pts[i].x > maxX) maxX = pts[i].x;
    if (pts[i].y < minY) minY = pts[i].y;
    if (pts[i].y > maxY) maxY = pts[i].y;
  }
  if (cx < minX - radius || cx > maxX + radius || cy < minY - radius || cy > maxY + radius) {
    return false;
  }

  // Single dot check
  if (pts.length === 1) {
    const dx = cx - pts[0].x;
    const dy = cy - pts[0].y;
    return dx * dx + dy * dy <= rSq;
  }

  // Check each line segment
  for (let i = 0; i < pts.length - 1; i++) {
    if (distanceToSegmentSquared(cx, cy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= rSq) {
      return true;
    }
  }
  return false;
}

/**
 * Converts a sequence of points into a smooth vector SVG path using quadratic bezier curves.
 */
export function pointsToSvgPath(points: StrokePoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y + 0.1}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cp = points[i];
    const next = points[i + 1];
    const mx = (cp.x + next.x) / 2;
    const my = (cp.y + next.y) / 2;
    d += ` Q ${cp.x} ${cp.y}, ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Memoized layer for committed static strokes so active gestures don't re-render them.
 */
const StaticStrokesLayer = memo(function StaticStrokesLayer({
  strokes,
  canvasBackground,
}: {
  strokes: Stroke[];
  canvasBackground: string;
}) {
  return (
    <>
      {strokes.map(s => {
        if (s.points.length === 1) {
          const p = s.points[0];
          return (
            <Circle
              key={s.id}
              cx={p.x}
              cy={p.y}
              r={s.strokeWidth / 2}
              fill={s.tool === 'eraser' ? canvasBackground : s.color}
            />
          );
        }
        return (
          <Path
            key={s.id}
            d={pointsToSvgPath(s.points)}
            stroke={s.tool === 'eraser' ? canvasBackground : s.color}
            strokeWidth={s.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      })}
    </>
  );
});

export function DrawingCanvas({
  strokes,
  activeColor,
  activeStrokeWidth,
  activeTool,
  canvasBackground = '#FFF9FA',
  showGrid = true,
  onStrokeComplete,
  onEraseStroke,
  onEraseStrokes,
  style,
}: DrawingCanvasProps) {
  const [activePoints, setActivePoints] = useState<StrokePoint[]>([]);
  const [eraserPoint, setEraserPoint] = useState<StrokePoint | null>(null);
  const [localErasedIds, setLocalErasedIds] = useState<Set<string>>(new Set());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const activePointsRef = useRef<StrokePoint[]>([]);
  activePointsRef.current = activePoints;

  const activeErasedIdsRef = useRef<Set<string>>(new Set());

  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;

  const toolRef = useRef({ activeColor, activeStrokeWidth, activeTool });
  toolRef.current = { activeColor, activeStrokeWidth, activeTool };

  const onEraseRef = useRef(onEraseStroke);
  onEraseRef.current = onEraseStroke;

  const onEraseStrokesRef = useRef(onEraseStrokes);
  onEraseStrokesRef.current = onEraseStrokes;

  const checkAndErase = (x: number, y: number) => {
    const currentStrokes = strokesRef.current;
    let foundNew = false;
    for (const s of currentStrokes) {
      if (!activeErasedIdsRef.current.has(s.id)) {
        if (strokeIntersectsCircle(s, x, y, ERASER_RADIUS)) {
          activeErasedIdsRef.current.add(s.id);
          foundNew = true;
        }
      }
    }
    if (foundNew) {
      setLocalErasedIds(new Set(activeErasedIdsRef.current));
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          const x = Math.round(locationX);
          const y = Math.round(locationY);

          if (toolRef.current.activeTool === 'eraser') {
            activeErasedIdsRef.current = new Set();
            setLocalErasedIds(new Set());
            setEraserPoint({ x, y });
            checkAndErase(x, y);
          } else {
            setActivePoints([{ x, y }]);
          }
        },
        onPanResponderMove: evt => {
          const { locationX, locationY } = evt.nativeEvent;
          const x = Math.round(locationX);
          const y = Math.round(locationY);

          if (toolRef.current.activeTool === 'eraser') {
            setEraserPoint({ x, y });
            checkAndErase(x, y);
          } else {
            const prev = activePointsRef.current;
            const last = prev[prev.length - 1];

            // Smooth minimum sampling distance (2.5px) avoids hand jitter
            if (!last || Math.hypot(x - last.x, y - last.y) >= 2.5) {
              setActivePoints([...prev, { x, y }]);
            }
          }
        },
        onPanResponderRelease: () => {
          if (toolRef.current.activeTool === 'eraser') {
            setEraserPoint(null);
            if (activeErasedIdsRef.current.size > 0) {
              const ids = Array.from(activeErasedIdsRef.current);
              if (onEraseStrokesRef.current) {
                onEraseStrokesRef.current(ids);
              } else if (onEraseRef.current) {
                ids.forEach(id => onEraseRef.current?.(id));
              }
            }
            activeErasedIdsRef.current = new Set();
            setLocalErasedIds(new Set());
          } else {
            const points = activePointsRef.current;
            if (points.length > 0) {
              const { activeColor, activeStrokeWidth } = toolRef.current;
              onStrokeComplete({
                points,
                color: activeColor,
                strokeWidth: activeStrokeWidth,
                tool: 'pen',
              });
            }
            setActivePoints([]);
          }
        },
        onPanResponderTerminate: () => {
          setActivePoints([]);
          setEraserPoint(null);
          activeErasedIdsRef.current = new Set();
          setLocalErasedIds(new Set());
        },
      }),
    [onStrokeComplete]
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setDimensions({ width, height });
  };

  const visibleStrokes = useMemo(() => {
    if (localErasedIds.size === 0) return strokes;
    return strokes.filter(s => !localErasedIds.has(s.id));
  }, [strokes, localErasedIds]);

  const activePathD = useMemo(() => pointsToSvgPath(activePoints), [activePoints]);

  return (
    <View
      style={[styles.container, { backgroundColor: canvasBackground }, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Svg width={dimensions.width} height={dimensions.height} style={StyleSheet.absoluteFill}>
          <Defs>
            {showGrid && (
              <Pattern id="grid-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                <Circle cx="14" cy="14" r="1.1" fill="#F0DFE3" />
              </Pattern>
            )}
          </Defs>

          {showGrid && <Rect width="100%" height="100%" fill="url(#grid-dots)" />}

          {/* Static strokes layer (memoized for 60/120fps smoothness) */}
          <StaticStrokesLayer strokes={visibleStrokes} canvasBackground={canvasBackground} />

          {/* Active in-flight stroke */}
          {activePoints.length > 0 && (
            <Path
              d={activePathD}
              stroke={activeColor}
              strokeWidth={activeStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}

          {/* Visual Vector Eraser Cursor */}
          {eraserPoint && (
            <>
              <Circle
                cx={eraserPoint.x}
                cy={eraserPoint.y}
                r={ERASER_RADIUS}
                fill="#FF5A79"
                fillOpacity={0.16}
                stroke="#FF5A79"
                strokeWidth={1.5}
                strokeDasharray="4,3"
              />
              <Circle cx={eraserPoint.x} cy={eraserPoint.y} r={2.5} fill="#FF5A79" />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
