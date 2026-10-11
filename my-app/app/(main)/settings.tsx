import { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Screen, Text, Button, Spacer, useLovasTheme } from '@/components/ui';
import { useCoupleContext } from '@/components/couple/CoupleProvider';
import { useDevice } from '@/components/couple/DeviceProvider';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const { couple, local, disconnect } = useCoupleContext();
  const { deviceId } = useDevice();
  const { theme } = useLovasTheme();

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect Space',
      'Are you sure you want to leave this shared space? You will need an invite code to reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnect();
            router.replace('/(onboarding)/welcome');
          },
        },
      ]
    );
  }, [disconnect, router]);

  return (
    <Screen style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Spacer size={16} />
        <Text variant="h2">Settings</Text>
        <Spacer size={24} />

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text variant="bodyStrong">Our pair code</Text>
          <Spacer size={4} />
          <Text variant="h3" color={theme.primary}>
            {couple?.pairCode ?? '—'}
          </Text>
        </View>

        <Spacer size={16} />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text variant="bodyStrong">Whiteboard</Text>
          <Spacer size={4} />
          <Text variant="h3">{local?.boardName ?? 'Our Board ❤️'}</Text>
          <Spacer size={4} />
          <Text variant="caption" color={theme.textMuted}>
            {local?.boardId ? `Board ID: ${local.boardId.slice(0, 8)}…` : 'No board yet'}
          </Text>
        </View>

        <Spacer size={16} />
        {/* Widget installation guide */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text variant="bodyStrong">📱 Add Widget to Home Screen</Text>
          <Spacer size={8} />
          <Text variant="caption" color={theme.textMuted}>
            Whatever you and your partner draw on the board displays live on your Home Screen
            widget:
          </Text>
          <Spacer size={12} />
          <View style={styles.stepRow}>
            <View style={[styles.stepBadge, { backgroundColor: theme.primaryLight }]}>
              <Text variant="caption" color={theme.primary} style={{ fontWeight: '700' }}>
                1
              </Text>
            </View>
            <Text variant="body" style={styles.stepText}>
              Long-press any empty area on your iPhone Home Screen.
            </Text>
          </View>
          <Spacer size={8} />
          <View style={styles.stepRow}>
            <View style={[styles.stepBadge, { backgroundColor: theme.primaryLight }]}>
              <Text variant="caption" color={theme.primary} style={{ fontWeight: '700' }}>
                2
              </Text>
            </View>
            <Text variant="body" style={styles.stepText}>
              Tap the (+) plus button in the top-left corner.
            </Text>
          </View>
          <Spacer size={8} />
          <View style={styles.stepRow}>
            <View style={[styles.stepBadge, { backgroundColor: theme.primaryLight }]}>
              <Text variant="caption" color={theme.primary} style={{ fontWeight: '700' }}>
                3
              </Text>
            </View>
            <Text variant="body" style={styles.stepText}>
              Search for "Lovas" and tap "Add Widget".
            </Text>
          </View>
        </View>

        <Spacer size={16} />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text variant="bodyStrong">About Lovas</Text>
          <Spacer size={4} />
          <Text variant="caption" color={theme.textMuted}>
            A private drawing widget shared by two people. Draw notes, hearts, and doodles together.
          </Text>
          <Spacer size={8} />
          <Text variant="caption" color={theme.textMuted}>
            Device ID: {deviceId?.slice(0, 8)}…
          </Text>
        </View>

        <Spacer size={28} />
        <Button
          title="Disconnect from this space"
          variant="ghost"
          fullWidth
          onPress={handleDisconnect}
        />
        <Spacer size={32} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  scroll: {
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
