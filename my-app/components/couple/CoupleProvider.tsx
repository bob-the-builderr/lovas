import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import type { Couple } from '@/types';
import { getLocalCouple, storeLocalCouple, clearLocalCouple, LocalCouple } from '@/lib/storage';
import { disconnectDevice, getPartnerDeviceId } from '@/lib/supabase';
import { getDeviceId } from '@/lib/device';

interface BoardInfo {
  boardId: string;
  boardName: string;
}

interface CoupleContextValue {
  couple: Couple | null;
  local: LocalCouple | null;
  paired: boolean;
  loading: boolean;
  savePairing: (couple: Couple, board: BoardInfo, partnerDeviceId?: string) => Promise<void>;
  refreshPartner: () => Promise<string | null>;
  disconnect: () => Promise<void>;
}

const CoupleContext = createContext<CoupleContextValue>({
  couple: null,
  local: null,
  paired: false,
  loading: true,
  savePairing: async () => {},
  refreshPartner: async () => null,
  disconnect: async () => {},
});

export function CoupleProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<LocalCouple | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep a ref in sync so async flows (e.g. the onboarding hand-off timer)
  // never persist against a stale snapshot of `local`.
  const localRef = useRef<LocalCouple | null>(null);
  localRef.current = local;

  const persist = useCallback(async (next: LocalCouple) => {
    await storeLocalCouple(next);
    setLocal(next);
  }, []);

  const refreshPartner = useCallback(async (): Promise<string | null> => {
    const current = localRef.current;
    if (!current?.coupleId) return null;
    try {
      const myDeviceId = await getDeviceId();
      if (!myDeviceId) return null;
      const partner = await getPartnerDeviceId(current.coupleId, myDeviceId);
      if (partner && partner !== current.partnerDeviceId) {
        const updated = { ...current, partnerDeviceId: partner };
        await persist(updated);
        return partner;
      }
      return partner;
    } catch {
      return null;
    }
  }, [persist]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await getLocalCouple();
        if (mounted) {
          setLocal(stored);
          // If paired but partner device ID not yet known, discover in background
          if (stored && !stored.partnerDeviceId) {
            const myDeviceId = await getDeviceId();
            if (myDeviceId) {
              getPartnerDeviceId(stored.coupleId, myDeviceId)
                .then(partner => {
                  if (partner && mounted) {
                    const updated = { ...stored, partnerDeviceId: partner };
                    persist(updated);
                  }
                })
                .catch(() => {});
            }
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [persist]);

  const savePairing = useCallback(
    async (couple: Couple, board: BoardInfo, partnerDeviceId?: string) => {
      const next: LocalCouple = {
        coupleId: couple.id,
        boardId: board.boardId,
        boardName: board.boardName,
        pairCode: couple.pairCode,
        partnerDeviceId: partnerDeviceId ?? localRef.current?.partnerDeviceId,
      };
      await persist(next);
    },
    [persist]
  );

  const disconnect = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        await disconnectDevice(deviceId);
      }
    } catch (e) {
      console.warn('Failed to disconnect device on server', e);
    }
    await clearLocalCouple();
    setLocal(null);
  }, []);

  const couple: Couple | null = local
    ? { id: local.coupleId, pairCode: local.pairCode, createdBy: '', createdAt: '' }
    : null;

  return (
    <CoupleContext.Provider
      value={{
        couple,
        local,
        paired: Boolean(local),
        loading,
        savePairing,
        refreshPartner,
        disconnect,
      }}
    >
      {children}
    </CoupleContext.Provider>
  );
}

export function useCoupleContext(): CoupleContextValue {
  return useContext(CoupleContext);
}
