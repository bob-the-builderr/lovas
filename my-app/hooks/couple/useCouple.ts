import { useCallback, useState } from 'react';
import { generatePairCode, setupNewCouple, setupJoinCouple, BoardInfo } from '@/lib/couple';
import { useCoupleContext } from '@/components/couple/CoupleProvider';
import type { Couple } from '@/types';

interface UseCoupleResult {
  creating: boolean;
  joining: boolean;
  error: string | null;
  createCoupleSpace: (deviceId: string) => Promise<{ couple: Couple; board: BoardInfo }>;
  joinCoupleSpace: (
    deviceId: string,
    code: string
  ) => Promise<{ couple: Couple; board: BoardInfo }>;
  resetError: () => void;
}

/**
 * Couple-level operations: create or join a shared space, then persist it.
 * Wraps the pure pairing lib so screens get loading/error state for free.
 */
export function useCouple(): UseCoupleResult {
  const { savePairing } = useCoupleContext();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commitSpace = useCallback(
    async (couple: Couple, board: BoardInfo) => {
      await savePairing(couple, board);
    },
    [savePairing]
  );

  const createCoupleSpace = useCallback(
    async (deviceId: string) => {
      setCreating(true);
      setError(null);
      try {
        const code = generatePairCode();
        const result = await setupNewCouple(deviceId, code);
        await commitSpace(result.couple, result.board);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create the space.');
        throw e;
      } finally {
        setCreating(false);
      }
    },
    [commitSpace]
  );

  const joinCoupleSpace = useCallback(
    async (deviceId: string, code: string) => {
      setJoining(true);
      setError(null);
      try {
        const result = await setupJoinCouple(deviceId, code);
        await commitSpace(result.couple, result.board);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not join that space.');
        throw e;
      } finally {
        setJoining(false);
      }
    },
    [commitSpace]
  );

  const resetError = useCallback(() => setError(null), []);

  return {
    creating,
    joining,
    error,
    createCoupleSpace,
    joinCoupleSpace,
    resetError,
  };
}
