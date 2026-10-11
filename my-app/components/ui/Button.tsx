import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Text } from './Text';
import { useLovasTheme } from './theme-context';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  icon,
}: ButtonProps) {
  const { theme } = useLovasTheme();

  const bgColor =
    variant === 'primary'
      ? theme.primary
      : variant === 'secondary'
        ? theme.secondary
        : variant === 'outline'
          ? 'transparent'
          : 'transparent';

  const textColor = variant === 'outline' || variant === 'ghost' ? theme.primary : theme.white;

  const paddingVertical = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const paddingHorizontal = size === 'sm' ? 16 : size === 'lg' ? 28 : 24;

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={() => {
        if (!isDisabled) onPress();
      }}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          backgroundColor: bgColor,
          paddingVertical,
          paddingHorizontal,
          width: fullWidth ? '100%' : undefined,
          opacity: isDisabled ? 0.5 : 1,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: theme.primary,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text variant="button" color={textColor} style={styles.label}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    textAlign: 'center',
  },
});
