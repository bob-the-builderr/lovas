import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useLovasTheme } from '@/components/ui/theme-context';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'caption' | 'button';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
}

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  const { theme } = useLovasTheme();
  const baseStyle =
    variant === 'h1'
      ? { fontSize: 34, lineHeight: 40, fontWeight: '800' as const }
      : variant === 'h2'
        ? { fontSize: 26, lineHeight: 32, fontWeight: '700' as const }
        : variant === 'h3'
          ? { fontSize: 21, lineHeight: 28, fontWeight: '600' as const }
          : variant === 'bodyStrong'
            ? { fontSize: 16, lineHeight: 24, fontWeight: '600' as const }
            : variant === 'caption'
              ? { fontSize: 13, lineHeight: 18, fontWeight: '400' as const }
              : variant === 'button'
                ? { fontSize: 16, lineHeight: 22, fontWeight: '600' as const }
                : { fontSize: 16, lineHeight: 24, fontWeight: '400' as const };

  return <RNText style={[baseStyle, { color: color ?? theme.text }, style]} {...rest} />;
}

export const themeStyles = StyleSheet.create({});
