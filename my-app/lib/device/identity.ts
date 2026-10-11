import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { DeviceIdentity } from '@/types';

const DEVICE_ID_KEY = '@lovas/device-id';

/**
 * Returns the persistent anonymous device ID for this installation.
 *
 * On first launch a random UUID is generated and persisted locally.
 * On every subsequent launch that same ID is returned, so the app
 * always knows "this device = this anonymous user" without any account.
 */
export async function getOrCreateDeviceId(): Promise<DeviceIdentity> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return { deviceId: existing, createdAt: 0 };
  }

  const deviceId = Crypto.randomUUID();
  const identity: DeviceIdentity = { deviceId, createdAt: Date.now() };

  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return identity;
}

export async function getDeviceId(): Promise<string | null> {
  return AsyncStorage.getItem(DEVICE_ID_KEY);
}

export async function clearDeviceId(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_ID_KEY);
}
