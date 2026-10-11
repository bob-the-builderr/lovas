import { Screen, Text, Button, Spacer } from '@/components/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useLovasTheme } from '@/components/ui/theme-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const { theme } = useLovasTheme();

  return (
    <Screen style={styles.container}>
      <View style={styles.hero}>
        <View style={[styles.logoBadge, { backgroundColor: theme.primaryLight }]}>
          <Text variant="h1" color={theme.primary}>
            ❤
          </Text>
        </View>
        <Text variant="h1" style={styles.title}>
          Welcome ❤️
        </Text>
        <Text variant="body" color={theme.textMuted} style={styles.subtitle}>
          A private space for you and your partner.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Create a Couple"
          fullWidth
          onPress={() => router.push('/(onboarding)/create-couple')}
        />
        <Spacer size={12} />
        <Button
          title="Join a Couple"
          variant="outline"
          fullWidth
          onPress={() => router.push('/(onboarding)/join-couple')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FF5A79',
  },
  subtitle: {
    textAlign: 'center',
  },
  actions: {
    paddingBottom: 16,
  },
});
