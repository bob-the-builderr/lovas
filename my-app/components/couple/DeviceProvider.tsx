import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { DeviceIdentity } from '@/types';
import { getOrCreateDeviceId, getDeviceId } from '@/lib/device';

interface DeviceContextValue {
  deviceId: string | null;
  identity: DeviceIdentity | null;
  ready: boolean;
}

const DeviceContext = createContext<DeviceContextValue>({
  deviceId: null,
  identity: null,
  ready: false,
});

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const id = await getDeviceId();
        if (id) {
          if (mounted) {
            setIdentity({ deviceId: id, createdAt: 0 });
            setReady(true);
          }
          return;
        }
        const created = await getOrCreateDeviceId();
        if (mounted) {
          setIdentity(created);
          setReady(true);
        }
      } catch (e) {
        console.warn('Failed to load device identity', e);
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <DeviceContext.Provider value={{ deviceId: identity?.deviceId ?? null, identity, ready }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceContextValue {
  return useContext(DeviceContext);
}
