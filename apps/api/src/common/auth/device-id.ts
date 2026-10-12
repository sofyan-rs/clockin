import { createHash } from 'node:crypto';

/** ARCHITECTURE §11: the server only stores sha256(deviceId + pepper). */
export function hashDeviceId(deviceId: string, pepper: string): string {
  return createHash('sha256').update(`${deviceId}${pepper}`).digest('hex');
}

export const DEVICE_ID_HEADER = 'x-device-id';
