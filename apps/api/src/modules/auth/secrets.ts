import { createHash, randomBytes } from 'node:crypto';

/** 256-bit random token, URL-safe (refresh tokens, reset and invitation links). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored only as SHA-256 hashes (ARCHITECTURE §12). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
