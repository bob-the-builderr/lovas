import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Screen, Text, Button, Spacer, useLovasTheme } from '@/components/ui';
import { useDevice } from '@/components/couple/DeviceProvider';
import { useCoupleContext } from '@/components/couple/CoupleProvider';
import { formatPairCodeInput, isValidPairCode, setupJoinCouple, BoardInfo } from '@/lib/couple';
import { getOrCreateDeviceId } from '@/lib/device';
import { useRouter } from 'expo-router';
import type { Couple } from '@/types';

export default function JoinCoupleScreen() {
  const router = useRouter();
  const { deviceId } = useDevice();
  const { savePairing } = useCoupleContext();
  const { theme } = useLovasTheme();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<{ couple: Couple; board: BoardInfo } | null>(null);

  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  const handleJoin = useCallback(async () => {
    if (loading || connected) return;
    if (!isValidPairCode(code)) {
      setError('Enter the 8-character code from your partner, e.g. BLUE-4829.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const activeDeviceId = deviceId || (await getOrCreateDeviceId()).deviceId;
      resultRef.current = await setupJoinCouple(activeDeviceId, code);
      setConnected(true);

      // Let the "You're connected" celebration show before entering the app.
      navTimer.current = setTimeout(async () => {
        const result = resultRef.current;
        if (result) {
          await savePairing(result.couple, result.board, result.couple.createdBy);
        }
        router.replace('/(main)/board');
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join. Check the code.');
    } finally {
      setLoading(false);
    }
  }, [deviceId, code, loading, connected, savePairing, router]);

  return (
    <Screen style={styles.container}>
      <Spacer size={24} />

      {connected ? (
        <View style={styles.hero}>
          <Text variant="h2" style={styles.center}>
            You&apos;re connected ❤️
          </Text>
          <Spacer size={8} />
          <Text variant="body" color={theme.textMuted} style={styles.center}>
            Taking you to your whiteboard…
          </Text>
        </View>
      ) : (
        <>
          <Text variant="h2">Enter your partner&apos;s code</Text>
          <Spacer size={8} />
          <Text variant="body" color={theme.textMuted}>
            The code they shared with you opens your shared space.
          </Text>
          <Spacer size={32} />

          <View
            style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={code}
              onChangeText={t => setCode(formatPairCodeInput(t))}
              placeholder="BLUE-4829"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={9}
              textAlign="center"
            />
          </View>

          <Spacer size={16} />
          {error ? (
            <Text variant="caption" color={theme.error} style={styles.center}>
              {error}
            </Text>
          ) : null}

          <Spacer size={24} />
          <Button title="Join Couple" fullWidth loading={loading} onPress={handleJoin} />
          <Spacer size={8} />
          <Button title="Back" variant="ghost" fullWidth onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  inputWrap: {
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  input: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 6,
    paddingVertical: 20,
  },
  center: {
    textAlign: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
