import { afterFailedSignIn, CLEARED_LOCKOUT, isLocked, type LockoutState } from './sign-in-lockout';

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 12, 8, 0) + minutes * 60_000);

function failTimes(minutes: number[]): LockoutState {
  return minutes.reduce((state, m) => afterFailedSignIn(state, at(m)), CLEARED_LOCKOUT);
}

describe('sign-in lockout (PRD §9.7)', () => {
  it('counts failures inside the 15-minute window', () => {
    expect(failTimes([0, 1, 2])).toMatchObject({
      failedAttempts: 3,
      firstFailedAt: at(0),
      lockedUntil: null,
    });
  });

  it('locks for 15 minutes on the fifth failure', () => {
    const state = failTimes([0, 1, 2, 3, 4]);
    expect(state.lockedUntil).toEqual(at(19));
    expect(isLocked(state, at(18))).toBe(true);
    expect(isLocked(state, at(19))).toBe(false);
  });

  it('starts a new count when the window has passed', () => {
    expect(failTimes([0, 1, 2, 3, 16])).toMatchObject({ failedAttempts: 1, firstFailedAt: at(16) });
  });

  it('is not locked without a lock time', () => {
    expect(isLocked(CLEARED_LOCKOUT, at(0))).toBe(false);
  });
});
