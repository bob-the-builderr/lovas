import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Screen, Text, useLovasTheme } from '@/components/ui';
import { useCoupleContext } from '@/components/couple/CoupleProvider';
import { useDevice } from '@/components/couple/DeviceProvider';
import { useBoard } from '@/hooks/board/useBoard';
import { subscribeToBoardContent } from '@/lib/realtime';
import { syncBoardToWidget } from '@/lib/widgets/storage';
import { DrawingCanvas, Toolbar } from '@/components/board';
import type { StrokeTool } from '@/types';

export default function BoardScreen() {
  const { theme } = useLovasTheme();
  const { local, couple, refreshPartner } = useCoupleContext();
  const { deviceId } = useDevice();

  const boardId = local?.boardId ?? '';
  const [boardName, setBoardName] = useState(local?.boardName ?? 'Our Board ❤️');
  const [showGrid, setShowGrid] = useState(true);

  const [activeColor, setActiveColor] = useState('#FF5A79');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(5);
  const [activeTool, setActiveTool] = useState<StrokeTool>('pen');

  // Discover partner if not already known
  useEffect(() => {
    if (!local?.partnerDeviceId) {
      refreshPartner();
    }
  }, [local?.partnerDeviceId, refreshPartner]);

  // Sync board name live if partner updates it in Settings
  useEffect(() => {
    if (!boardId) return;
    const unsub = subscribeToBoardContent(boardId, update => {
      if (update.name) {
        setBoardName(update.name);
      }
    });
    return () => unsub();
  }, [boardId]);

  const {
    strokes,
    loading,
    serverConnected,
    partnerOnline,
    canUndo,
    canRedo,
    submitStroke,
    eraseStroke,
    eraseStrokes,
    undo,
    redo,
    clear,
  } = useBoard({
    boardId,
    deviceId: deviceId ?? '',
    enabled: Boolean(boardId && deviceId),
  });

  // Auto-sync whiteboard to the iOS Home Screen widget so the board IS the widget!
  useEffect(() => {
    if (!boardId) return;
    syncBoardToWidget(boardId, boardName, strokes).catch(() => {});
  }, [boardId, boardName, strokes]);

  const hasPartner = Boolean(local?.partnerDeviceId);

  const handleShareBoard = async () => {
    try {
      await Share.share({
        message: `Draw with me on our shared Lovas whiteboard! Couple Code: ${couple?.pairCode ?? ''}`,
      });
    } catch {
      // dismissed
    }
  };

  const handleWidgetInfo = () => {
    Alert.alert(
      'Live Widget Synced 📱✨',
      'Whatever you and your partner draw on this board appears directly on your iPhone Home Screen & Lock Screen widget!\n\nTo add the widget:\n1. Long-press on your Home Screen\n2. Tap + at the top left\n3. Search for "Lovas"\n4. Tap "Add Widget"',
      [{ text: 'Got it!' }]
    );
  };

  return (
    <Screen style={styles.container}>
      {/* Top status header */}
      <View
        style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}
      >
        <View style={styles.headerLeft}>
          <Text variant="h3" style={styles.title} numberOfLines={1}>
            {boardName}
          </Text>
          <View style={styles.presenceRow}>
            <View
              style={[
                styles.presenceDot,
                {
                  backgroundColor: partnerOnline
                    ? theme.success
                    : hasPartner
                      ? theme.accent
                      : theme.textMuted,
                },
              ]}
            />
            <Text variant="caption" color={theme.textMuted}>
              {partnerOnline
                ? 'Partner is on board ✨'
                : hasPartner
                  ? `Partner offline · ${couple?.pairCode ?? ''}`
                  : serverConnected
                    ? `Waiting for partner · ${couple?.pairCode ?? ''}`
                    : 'Connecting…'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleWidgetInfo}
            style={[
              styles.headerIconBtn,
              { width: 'auto', paddingHorizontal: 10, borderRadius: 16 },
            ]}
          >
            <Text
              variant="caption"
              style={{ fontSize: 12, fontWeight: '700', color: theme.primary }}
            >
              📱 Widget
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowGrid(prev => !prev)}
            style={[styles.headerIconBtn, showGrid && { backgroundColor: theme.surfaceAlt }]}
          >
            <Text variant="caption" style={{ fontSize: 14 }}>
              {showGrid ? '☵' : '▢'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShareBoard} style={styles.headerIconBtn}>
            <Text variant="caption" style={{ fontSize: 14 }}>
              📤
            </Text>
          </TouchableOpacity>

          <Text variant="caption" color={theme.textMuted} style={styles.strokeBadge}>
            {strokes.length}
          </Text>
        </View>
      </View>

      {/* Canvas Area */}
      <View style={styles.canvasContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text variant="caption" color={theme.textMuted} style={{ marginTop: 8 }}>
              Opening your whiteboard…
            </Text>
          </View>
        ) : (
          <DrawingCanvas
            strokes={strokes}
            activeColor={activeColor}
            activeStrokeWidth={activeStrokeWidth}
            activeTool={activeTool}
            canvasBackground={theme.background}
            showGrid={showGrid}
            onStrokeComplete={submitStroke}
            onEraseStroke={eraseStroke}
            onEraseStrokes={eraseStrokes}
          />
        )}

        {/* Floating toolbar */}
        {!loading && (
          <Toolbar
            activeColor={activeColor}
            onSelectColor={setActiveColor}
            activeStrokeWidth={activeStrokeWidth}
            onSelectStrokeWidth={setActiveStrokeWidth}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onClear={clear}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
