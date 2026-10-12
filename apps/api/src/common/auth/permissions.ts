import type { AdminRole } from '@prisma/client';

/** PRD §4.2 permission matrix. Every permission is checked within the admin's scope. */
export const PERMISSIONS = [
  'dashboard.read',
  'reports.read',
  'review.decide',
  'attendance.override',
  'employees.read',
  'employees.write',
  'employees.delete',
  'org.write',
  'settings.write',
  'admin-users.write',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEW: Permission[] = ['dashboard.read', 'reports.read', 'employees.read'];
const HR: Permission[] = [...VIEW, 'review.decide', 'attendance.override'];
const HR_ADMIN: Permission[] = [
  ...HR,
  'employees.write',
  'org.write',
  'settings.write',
  'admin-users.write',
  'audit.read',
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  SUPER_ADMIN: [...HR_ADMIN, 'employees.delete'],
  HR_ADMIN,
  HR,
  MANAGER: VIEW,
  TEAM_LEAD: VIEW,
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
