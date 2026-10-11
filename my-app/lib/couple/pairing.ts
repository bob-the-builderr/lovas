import * as Crypto from 'expo-crypto';
import {
  registerDevice,
  createCouple,
  joinCouple,
  getFirstBoard,
  getBoardId,
  getPartnerDeviceId,
} from '@/lib/supabase';
import type { Couple } from '@/types';

export interface BoardInfo {
  boardId: string;
  boardName: string;
}

const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // unambiguous (no I/O)
const CODE_DIGITS = '23456789'; // unambiguous (no 0/1)

function randomChars(alphabet: string, length: number): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function generatePairCode(): string {
  // 8 characters in WORD-NNNN form, e.g. BLUE-4829 — memorable and readable.
  return `${randomChars(CODE_LETTERS, 4)}-${randomChars(CODE_DIGITS, 4)}`;
}

export function formatPairCodeInput(input: string): string {
  // If the user pasted a full share message, extract the CODE-1234 pattern:
  // e.g. "Join me on Lovas! Our private couple code is: BLUE-4829"
  const match = input.match(/\b([A-Za-z]{4})[- ]?(\d{4})\b/);
  if (match) {
    return `${match[1].toUpperCase()}-${match[2]}`;
  }

  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (cleaned.length <= 4) return cleaned;
  return cleaned.slice(0, 4) + '-' + cleaned.slice(4);
}

export function isValidPairCode(input: string): boolean {
  const cleaned = input.replace('-', '').replace(/[^A-Z0-9]/g, '');
  return cleaned.length === 8 && /^[A-Z]{4}\d{4}$/.test(cleaned);
}

async function resolveBoardInfo(coupleId: string): Promise<BoardInfo> {
  const board = await getFirstBoard(coupleId);
  const boardId = board?.id ?? (await getBoardId(coupleId));
  return { boardId, boardName: board?.name ?? 'Our First Board ❤️' };
}

export async function setupNewCouple(
  myDeviceId: string,
  initialCode: string
): Promise<{ couple: Couple; board: BoardInfo }> {
  await registerDevice(myDeviceId);
  let code = initialCode;
  let attempts = 0;
  while (attempts < 3) {
    try {
      const couple = await createCouple(myDeviceId, code);
      const board = await resolveBoardInfo(couple.id);
      return { couple, board };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('couples_pair_code_key') ||
        msg.includes('unique constraint') ||
        msg.includes('duplicate key')
      ) {
        attempts++;
        code = generatePairCode();
      } else {
        throw err;
      }
    }
  }
  throw new Error('Could not generate unique couple code. Please try again.');
}

export async function setupJoinCouple(
  myDeviceId: string,
  code: string
): Promise<{ couple: Couple; board: BoardInfo }> {
  await registerDevice(myDeviceId);
  const couple = await joinCouple(myDeviceId, code);
  const board = await resolveBoardInfo(couple.id);
  return { couple, board };
}

export async function resolvePartnerDeviceId(
  coupleId: string,
  myDeviceId: string
): Promise<string | null> {
  return getPartnerDeviceId(coupleId, myDeviceId);
}
