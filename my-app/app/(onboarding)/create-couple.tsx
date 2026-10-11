import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Screen, Text, Button, Spacer, useLovasTheme } from '@/components/ui';
import { useDevice } from '@/components/couple/DeviceProvider';
import { useCoupleContext } from '@/components/couple/CoupleProvider';
import { generatePairCode, setupNewCouple, BoardInfo } from '@/lib/couple';
import { subscribeToCoupleMembers } from '@/lib/realtime';
import { getPartnerDeviceId } from '@/lib/supabase';
import { getOrCreateDeviceId } from '@/lib/device';
import { useRouter } from 'expo-router';
import type { Couple } from '@/types';

export default function CreateCoupleScreen() {
  const router = useRouter();
  const { deviceId } = useDevice();
  const { savePairing } = useCoupleContext();
  const { theme } = useLovasTheme();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCouple, setCreatedCouple] = useState<{ couple: Couple; board: BoardInfo } | null>(
    null
  );
  const [partnerJoined, setPartnerJoined] = useState(false);

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCode(generatePairCode());
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  // Listen for partner joining via realtime + fallback polling once the couple is created
  useEffect(() => {
    if (!createdCouple) return;
    let alive = true;

    const checkPartner = async () => {
      if (!createdCouple || !deviceId) return;
      try {
        const partner = await getPartnerDeviceId(createdCouple.couple.id, deviceId);
        if (partner && alive) {
          setPartnerJoined(true);
          if (!navTimer.current) {
            navTimer.current = setTimeout(async () => {
              await savePairing(createdCouple.couple, createdCouple.board, partner);
              router.replace('/(main)/board');
            }, 1200);
          }
        }
      } catch {
        // ignore network hiccups
      }
    };

    // Immediate check upon state change
    checkPartner();

    // Polling fallback every 2.5s
    const pollInterval = setInterval(checkPartner, 2500);

    const unsub = subscribeToCoupleMembers(createdCouple.couple.id, partnerId => {
      if (partnerId !== deviceId && alive) {
        setPartnerJoined(true);
        if (!navTimer.current) {
          navTimer.current = setTimeout(async () => {
            await savePairing(createdCouple.couple, createdCouple.board, partnerId);
            router.replace('/(main)/board');
          }, 1200);
        }
      }
    });

    return () => {
      alive = false;
      clearInterval(pollInterval);
      unsub();
    };
  }, [createdCouple, deviceId, savePairing, router]);

  const handleCreateAndShare = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const activeDeviceId = deviceId || (await getOrCreateDeviceId()).deviceId;
      const result = await setupNewCouple(activeDeviceId, code);
      setCreatedCouple(result);
      await savePairing(result.couple, result.board);

      // Trigger native share sheet
      try {
        await Share.share({
          message: `Join me on Lovas! Our private couple code is: ${code}`,
        });
      } catch {
        // User cancelled share
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the space.');
    } finally {
      setLoading(false);
    }
  }, [deviceId, code, loading, savePairing]);

  const handleEnterNow = useCallback(async () => {
    if (createdCouple) {
      await savePairing(createdCouple.couple, createdCouple.board);
    }
    router.replace('/(main)/board');
  }, [createdCouple, savePairing, router]);

  return (
    <Screen style={styles.container}>
      <Spacer size={24} />

      {partnerJoined ? (
        <View style={styles.hero}>
          <Text variant="h1" style={styles.center}>
            ❤️
          </Text>
          <Spacer size={12} />
          <Text variant="h2" style={styles.center}>
            Partner Connected!
          </Text>
          <Spacer size={8} />
          <Text variant="body" color={theme.textMuted} style={styles.center}>
            Opening your shared whiteboard…
          </Text>
        </View>
      ) : createdCouple ? (
        <View style={styles.hero}>
          <Text variant="h2" style={styles.center}>
            Waiting for Partner
          </Text>
          <Spacer size={8} />
          <Text variant="body" color={theme.textMuted} style={styles.center}>
            Share this code with your partner. When they join, you'll be connected automatically.
          </Text>
          <Spacer size={32} />

          <View
            style={[styles.codeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text variant="caption" color={theme.textMuted}>
              Your Couple Code
            </Text>
            <Spacer size={8} />
            <Text variant="h1" style={styles.code} color={theme.primary}>
              {code}
            </Text>
          </View>

          <Spacer size={24} />

          <Button
            title="Share Code Again"
            variant="outline"
            fullWidth
            onPress={async () => {
              await Share.share({
                message: `Join me on Lovas! Our private couple code is: ${code}`,
              });
            }}
          />
          <Spacer size={12} />
          <Button title="Start Drawing Now" fullWidth onPress={handleEnterNow} />
        </View>
      ) : (
        <>
          <Text variant="h2">Create a Couple</Text>
          <Spacer size={8} />
          <Text variant="body" color={theme.textMuted}>
            We made a code for your couple — share it with your partner to start drawing.
          </Text>
          <Spacer size={32} />

          <View
            style={[styles.codeCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text variant="caption" color={theme.textMuted}>
              Your Couple Code
            </Text>
            <Spacer size={8} />
            <Text variant="h1" style={styles.code} color={theme.primary}>
              {code}
            </Text>
          </View>

          <Spacer size={16} />
          <Text variant="body" color={theme.textMuted} style={styles.center}>
            Your private space connects automatically when your partner joins.
          </Text>

          {error ? (
            <>
              <Spacer size={16} />
              <Text variant="caption" color={theme.error} style={styles.center}>
                {error}
              </Text>
            </>
          ) : null}

          <Spacer size={24} />
          <Button
            title="Share Code & Continue"
            fullWidth
            loading={loading}
            onPress={handleCreateAndShare}
          />
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
  codeCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  code: {
    letterSpacing: 4,
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
