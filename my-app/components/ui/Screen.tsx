import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLovasTheme } from './theme-context';

interface ScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  safe?: boolean;
}

export function Screen({ children, style, safe = true }: ScreenProps) {
  const { theme } = useLovasTheme();

  if (!safe) {
    return <View style={[{ flex: 1, backgroundColor: theme.background }, style]}>{children}</View>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
