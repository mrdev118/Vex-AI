const FUN_COOLDOWN_MS = 4000;

const funCooldownMap = new Map<string, number>();

interface FunCooldownResult {
  allowed: boolean;
  waitMs: number;
}

export const checkFunCooldown = (userID: string, now: number = Date.now()): FunCooldownResult => {
  const last = funCooldownMap.get(userID);
  if (last && now - last < FUN_COOLDOWN_MS) {
    return {
      allowed: false,
      waitMs: FUN_COOLDOWN_MS - (now - last)
    };
  }

  funCooldownMap.set(userID, now);
  return { allowed: true, waitMs: 0 };
};

export const clearFunCooldown = (userID: string): void => {
  funCooldownMap.delete(userID);
};

export const getFunCooldownMs = (): number => FUN_COOLDOWN_MS;
