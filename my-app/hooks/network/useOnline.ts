import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushOfflineQueue } from '@/lib/storage/offlineQueue';

/**
 * Tracks device connectivity, re-renders when it toggles, and flushes any
 * mutations queued while offline.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isUp = state.isConnected !== false && state.isInternetReachable !== false;
      setOnline(isUp);
      if (isUp) {
        flushOfflineQueue().catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  return online;
}
