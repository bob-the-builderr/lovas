import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import type { WidgetContent } from '@/lib/widgets/types';

// Heart path in a 24x22 view box — identical geometry to the native widget's
// HeartShape (targets/widget/widgets.swift), so previews match the real thing.
const HEART_D =
  'M12 21.35 L10.55 20.03 C5.4 15.36 2 12.28 2 8.5 C2 5.42 4.42 3 7.5 3 C9.24 3 10.91 3.81 12 5.09 C13.09 3.81 14.76 3 16.5 3 C19.58 3 22 5.42 22 8.5 C22 12.28 18.6 15.36 13.45 20.04 Z';

function HeartMotif({ accent, size }: { accent: string; size: number }) {
  const boxH = size * (22 / 24);
  return (
    <Svg width={size} height={boxH} viewBox="0 0 24 22">
      <G transform="translate(4 -4) scale(0.72)">
        <Path d={HEART_D} fill={accent} fillOpacity={0.22} />
      </G>
      <Path d={HEART_D} fill={accent} />
    </Svg>
  );
}

interface CoupleArtCardProps {
  content: WidgetContent;
  /** Rendered width in the preview container. */
  width: number;
  /** Rendered height in the preview container. */
  height: number;
  circular?: boolean;
  style?: ViewStyle;
}

/**
 * Matches the native heart-card widget: paper background, accent heart motif,
 * optional title + love note per variant. Used for in-app previews.
 */
export function CoupleArtCard({
  content,
  width,
  height,
  circular = false,
  style,
}: CoupleArtCardProps) {
  const accent = content.accentColor || '#FF5A79';
  const title = content.title || 'Our Board';
  const note = content.message || 'Made with 💝 in Lovas';

  const showTitle = content.variant === 'heartTitle' || content.variant === 'heartTitleNote';
  const showNote = content.variant === 'heartNote' || content.variant === 'heartTitleNote';

  const heartSize = Math.max(width, height) * 0.42;
  const compact = width < 180;

  return (
    <View style={[styles.card, { width, height, borderRadius: circular ? height / 2 : 24 }, style]}>
      {showTitle && (
        <Text
          numberOfLines={1}
          style={[styles.title, { color: accent }, compact && styles.titleSmall]}
        >
          {title}
        </Text>
      )}

      <View style={styles.motif}>
        <HeartMotif accent={accent} size={heartSize} />
      </View>

      {showNote && (
        <Text
          numberOfLines={1}
          style={[styles.note, { color: accent }, compact && styles.noteSmall]}
        >
          {note}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E1E5',
    overflow: 'hidden',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motif: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  titleSmall: {
    fontSize: 10,
  },
  note: {
    fontSize: 11,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  noteSmall: {
    fontSize: 9,
  },
});
