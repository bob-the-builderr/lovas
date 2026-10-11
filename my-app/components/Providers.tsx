import React, { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LovasThemeProvider } from '@/components/ui/theme-context';
import { DeviceProvider } from '@/components/couple/DeviceProvider';
import { CoupleProvider } from '@/components/couple/CoupleProvider';
import { useOnline } from '@/hooks/network/useOnline';

function NetworkWatcher({ children }: { children: ReactNode }) {
  useOnline();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LovasThemeProvider>
        <DeviceProvider>
          <CoupleProvider>
            <NetworkWatcher>{children}</NetworkWatcher>
          </CoupleProvider>
        </DeviceProvider>
      </LovasThemeProvider>
    </GestureHandlerRootView>
  );
}
