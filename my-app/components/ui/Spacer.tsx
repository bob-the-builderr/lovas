import React from 'react';
import { View } from 'react-native';

interface SpacerProps {
  size?: number;
  horizontal?: boolean;
}

export function Spacer({ size = 16, horizontal = false }: SpacerProps) {
  return horizontal ? <View style={{ width: size }} /> : <View style={{ height: size }} />;
}
