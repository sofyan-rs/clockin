export type PasswordRule = 'MIN_LENGTH' | 'UPPERCASE' | 'LOWERCASE' | 'DIGIT';

export const PASSWORD_MIN_LENGTH = 10;

/**
 * PRD §9.7: at least 10 characters, upper and lower case, at least one digit.
 * ("Different from the current password" needs the hash, so the service checks it.)
 */
export function findPasswordPolicyViolations(password: string): PasswordRule[] {
  const violations: PasswordRule[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) violations.push('MIN_LENGTH');
  if (!/\p{Lu}/u.test(password)) violations.push('UPPERCASE');
  if (!/\p{Ll}/u.test(password)) violations.push('LOWERCASE');
  if (!/\d/.test(password)) violations.push('DIGIT');
  return violations;
}
