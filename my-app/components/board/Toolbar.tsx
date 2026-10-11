import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useLovasTheme } from '@/components/ui/theme-context';
import type { StrokeTool } from '@/types';

export const PALETTE_COLORS = [
  '#FF5A79', // Rose
  '#9B6BFF', // Lilac
  '#FFB84D', // Amber
  '#2FA36B', // Mint
  '#4A90E2', // Sky
  '#3A2A2F', // Charcoal
];

export const BRUSH_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 6 },
  { label: 'L', size: 12 },
];

interface ToolbarProps {
  activeColor: string;
  onSelectColor: (color: string) => void;
  activeStrokeWidth: number;
  onSelectStrokeWidth: (width: number) => void;
  activeTool: StrokeTool;
  onSelectTool: (tool: StrokeTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export function Toolbar({
  activeColor,
  onSelectColor,
  activeStrokeWidth,
  onSelectStrokeWidth,
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}: ToolbarProps) {
  const { theme } = useLovasTheme();
  const [showPalette, setShowPalette] = useState(false);

  const handleClearPress = () => {
    Alert.alert(
      'Clear Whiteboard?',
      'This will remove all drawings for both you and your partner.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: onClear },
      ]
    );
  };

  return (
    <>
      {/* Backdrop to dismiss palette when tapping outside */}
      {showPalette && (
        <TouchableWithoutFeedback onPress={() => setShowPalette(false)}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      )}

      <View style={styles.wrapper} pointerEvents="box-none">
        {/* Expanded color palette row */}
        {showPalette && activeTool === 'pen' && (
          <View
            style={[styles.paletteRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            {PALETTE_COLORS.map(color => (
              <TouchableOpacity
                key={color}
                onPress={() => {
                  onSelectColor(color);
                  setShowPalette(false);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  activeColor === color && styles.swatchActive,
                ]}
              />
            ))}

            <View style={styles.divider} />

            {BRUSH_SIZES.map(b => (
              <TouchableOpacity
                key={b.size}
                onPress={() => {
                  onSelectStrokeWidth(b.size);
                }}
                style={[
                  styles.sizeBtn,
                  activeStrokeWidth === b.size && {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.sizeDot,
                    {
                      width: b.size * 1.4,
                      height: b.size * 1.4,
                      borderRadius: (b.size * 1.4) / 2,
                      backgroundColor: activeColor,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Main control bar */}
        <View style={[styles.bar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Pen Tool */}
          <TouchableOpacity
            onPress={() => {
              if (activeTool !== 'pen') {
                onSelectTool('pen');
              } else {
                setShowPalette(prev => !prev);
              }
            }}
            style={[
              styles.toolBtn,
              activeTool === 'pen' && {
                backgroundColor: theme.surfaceAlt,
                borderWidth: 1.5,
                borderColor: theme.primary,
              },
            ]}
          >
            <View style={[styles.toolIndicator, { backgroundColor: activeColor }]} />
            <Text variant="caption" style={{ fontSize: 16 }}>
              ✏️
            </Text>
          </TouchableOpacity>

          {/* Eraser Tool */}
          <TouchableOpacity
            onPress={() => {
              onSelectTool('eraser');
              setShowPalette(false);
            }}
            style={[
              styles.toolBtn,
              activeTool === 'eraser' && {
                backgroundColor: theme.surfaceAlt,
                borderWidth: 1.5,
                borderColor: theme.primary,
              },
            ]}
          >
            <Text variant="caption" style={{ fontSize: 16 }}>
              🧹
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Undo */}
          <TouchableOpacity
            onPress={onUndo}
            disabled={!canUndo}
            style={[styles.actionBtn, !canUndo && styles.disabledBtn]}
          >
            <Text variant="caption" style={{ fontSize: 16, opacity: canUndo ? 1 : 0.35 }}>
              ↩️
            </Text>
          </TouchableOpacity>

          {/* Redo */}
          <TouchableOpacity
            onPress={onRedo}
            disabled={!canRedo}
            style={[styles.actionBtn, !canRedo && styles.disabledBtn]}
          >
            <Text variant="caption" style={{ fontSize: 16, opacity: canRedo ? 1 : 0.35 }}>
              ↪️
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Clear */}
          <TouchableOpacity onPress={handleClearPress} style={styles.actionBtn}>
            <Text variant="caption" style={{ fontSize: 16 }}>
              🗑️
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
    gap: 10,
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  swatchActive: {
    borderWidth: 2.5,
    borderColor: '#3A2A2F',
    transform: [{ scale: 1.15 }],
  },
  sizeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sizeDot: {},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  toolIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 12,
    height: 3,
    borderRadius: 1.5,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#F3E1E5',
  },
});
