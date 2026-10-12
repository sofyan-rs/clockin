import { findPasswordPolicyViolations } from './password-policy';

describe('findPasswordPolicyViolations (PRD §9.7)', () => {
  it('accepts a password meeting every rule', () => {
    expect(findPasswordPolicyViolations('Clockin2026')).toEqual([]);
  });

  it('reports each broken rule', () => {
    expect(findPasswordPolicyViolations('short1A')).toEqual(['MIN_LENGTH']);
    expect(findPasswordPolicyViolations('alllowercase1')).toEqual(['UPPERCASE']);
    expect(findPasswordPolicyViolations('ALLUPPERCASE1')).toEqual(['LOWERCASE']);
    expect(findPasswordPolicyViolations('NoDigitsHere')).toEqual(['DIGIT']);
    expect(findPasswordPolicyViolations('')).toEqual([
      'MIN_LENGTH',
      'UPPERCASE',
      'LOWERCASE',
      'DIGIT',
    ]);
  });

  it('counts exactly 10 characters as long enough', () => {
    expect(findPasswordPolicyViolations('Abcdefgh12')).toEqual([]);
  });
});
