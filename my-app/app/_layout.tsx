import { Stack, usePathname, useRouter } from 'expo-router';
import { Providers } from '@/components/Providers';
import { useDevice } from '@/components/couple/DeviceProvider';
import { useCoupleContext } from '@/components/couple/CoupleProvider';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLovasTheme } from '@/components/ui/theme-context';

function RootNavigator() {
  const { ready: deviceReady } = useDevice();
  const { loading: coupleLoading, paired } = useCoupleContext();
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useLovasTheme();

  const booting = !deviceReady || coupleLoading;

  useEffect(() => {
    if (booting) return;

    const inMain =
      pathname.startsWith('/(main)') ||
      pathname === '/board' ||
      pathname === '/widgets' ||
      pathname === '/settings';
    const inActiveOnboarding =
      pathname.includes('create-couple') || pathname.includes('join-couple');

    // Do not disrupt active onboarding screens while user is sharing or connecting
    if (inActiveOnboarding && paired) {
      return;
    }

    if (paired && !inMain) {
      router.replace('/(main)/board');
    } else if (!paired && inMain) {
      router.replace('/(onboarding)/welcome');
    }
  }, [booting, paired, pathname, router]);

  if (booting) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(main)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <RootNavigator />
    </Providers>
  );
}
