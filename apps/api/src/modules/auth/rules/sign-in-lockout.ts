/** PRD §9.7: 5 failed sign-ins per account within 15 minutes lock it for 15 minutes. */
export const MAX_FAILED_SIGN_INS = 5;
export const FAILED_SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface LockoutState {
  failedAttempts: number;
  firstFailedAt: Date | null;
  lockedUntil: Date | null;
}

export function isLocked(state: Pick<LockoutState, 'lockedUntil'>, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

/** Next state after a wrong password. A failure outside the window starts a new count. */
export function afterFailedSignIn(state: LockoutState, now: Date): LockoutState {
  const windowExpired =
    state.firstFailedAt === null ||
    now.getTime() - state.firstFailedAt.getTime() > FAILED_SIGN_IN_WINDOW_MS;
  const failedAttempts = windowExpired ? 1 : state.failedAttempts + 1;
  const firstFailedAt = windowExpired ? now : state.firstFailedAt;

  if (failedAttempts >= MAX_FAILED_SIGN_INS) {
    return {
      failedAttempts: 0,
      firstFailedAt: null,
      lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
    };
  }
  return { failedAttempts, firstFailedAt, lockedUntil: null };
}

export const CLEARED_LOCKOUT: LockoutState = {
  failedAttempts: 0,
  firstFailedAt: null,
  lockedUntil: null,
};
