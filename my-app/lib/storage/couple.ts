import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './keys';

export interface LocalCouple {
  coupleId: string;
  boardId: string;
  boardName: string;
  pairCode: string;
  partnerDeviceId?: string;
}

export async function getLocalCouple(): Promise<LocalCouple | null> {
  const coupleId = await AsyncStorage.getItem(STORAGE_KEYS.COUPLE_ID);
  const boardId = await AsyncStorage.getItem(STORAGE_KEYS.BOARD_ID);
  const boardName = (await AsyncStorage.getItem(STORAGE_KEYS.BOARD_NAME)) ?? 'Our First Board ❤️';
  const pairCode = await AsyncStorage.getItem(STORAGE_KEYS.PAIR_CODE);
  const partnerDeviceId = (await AsyncStorage.getItem(STORAGE_KEYS.PARTNER_DEVICE_ID)) ?? undefined;

  if (!coupleId || !boardId || !pairCode) return null;

  return { coupleId, boardId, boardName, pairCode, partnerDeviceId };
}

export async function storeLocalCouple(couple: LocalCouple): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.COUPLE_ID, couple.coupleId],
    [STORAGE_KEYS.BOARD_ID, couple.boardId],
    [STORAGE_KEYS.BOARD_NAME, couple.boardName],
    [STORAGE_KEYS.PAIR_CODE, couple.pairCode],
  ]);
  if (couple.partnerDeviceId) {
    await AsyncStorage.setItem(STORAGE_KEYS.PARTNER_DEVICE_ID, couple.partnerDeviceId);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.PARTNER_DEVICE_ID);
  }
}

export async function clearLocalCouple(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.COUPLE_ID,
    STORAGE_KEYS.BOARD_ID,
    STORAGE_KEYS.BOARD_NAME,
    STORAGE_KEYS.PAIR_CODE,
    STORAGE_KEYS.PARTNER_DEVICE_ID,
  ]);
}
