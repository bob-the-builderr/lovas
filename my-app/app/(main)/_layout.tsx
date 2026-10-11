import { Tabs } from 'expo-router';
import { Text as RNText, StyleSheet } from 'react-native';
import { useLovasTheme } from '@/components/ui/theme-context';

interface TabIconProps {
  color: string;
  focused: boolean;
}

function BoardIcon({ color, focused }: TabIconProps) {
  return <RNText style={{ fontSize: 20, color, opacity: focused ? 1 : 0.6 }}>🎨</RNText>;
}

function SettingsIcon({ color, focused }: TabIconProps) {
  return <RNText style={{ fontSize: 20, color, opacity: focused ? 1 : 0.6 }}>⚙️</RNText>;
}

export default function MainLayout() {
  const { theme } = useLovasTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen name="board" options={{ title: 'Our Board', tabBarIcon: BoardIcon }} />
      <Tabs.Screen name="widgets" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: SettingsIcon }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
