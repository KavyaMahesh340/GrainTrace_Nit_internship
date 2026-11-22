export const ROLES = ["owner", "admin", "salesman", "production", "accountant", "auditor"] as const;

export type RoleName = (typeof ROLES)[number];

export const PERMISSIONS = [
  "overview:view",
  "orders:view",
  "orders:manage",
  "orders:approve",
  "purchases:view",
  "purchases:manage",
  "inventory:view",
  "inventory:manage",
  "recipes:view",
  "recipes:manage",
  "production:view",
  "production:manage",
  "finishedGoods:view",
  "invoices:view",
  "invoices:manage",
  "payments:view",
  "payments:manage",
  "payments:correct",
  "dispatch:view",
  "dispatch:manage",
  "reports:view",
  "reports:export",
  "audit:view",
  "batchDna:view",
  "users:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  owner: "Owner",
  admin: "Admin",
  salesman: "Salesman",
  production: "Production",
  accountant: "Accountant",
  auditor: "Auditor",
};

const OPERATIONS: readonly Permission[] = [
  "overview:view",
  "orders:view",
  "orders:manage",
  "orders:approve",
  "purchases:view",
  "purchases:manage",
  "inventory:view",
  "inventory:manage",
  "recipes:view",
  "recipes:manage",
  "production:view",
  "production:manage",
  "finishedGoods:view",
  "invoices:view",
  "invoices:manage",
  "payments:view",
  "payments:manage",
  "payments:correct",
  "dispatch:view",
  "dispatch:manage",
  "reports:view",
  "reports:export",
  "audit:view",
  "batchDna:view",
];

const PERMISSION_MATRIX: Record<RoleName, readonly Permission[]> = {
  owner: [...OPERATIONS, "users:manage"],
  admin: [...OPERATIONS, "users:manage"],
  salesman: [
    "overview:view",
    "orders:view",
    "orders:manage",
    "invoices:view",
    "dispatch:view",
    "batchDna:view",
  ],
  production: [
    "overview:view",
    "purchases:view",
    "inventory:view",
    "inventory:manage",
    "recipes:view",
    "recipes:manage",
    "production:view",
    "production:manage",
    "finishedGoods:view",
    "batchDna:view",
  ],
  accountant: [
    "overview:view",
    "orders:view",
    "invoices:view",
    "invoices:manage",
    "payments:view",
    "payments:manage",
    "payments:correct",
    "dispatch:view",
    "reports:view",
    "reports:export",
    "audit:view",
  ],
  auditor: [
    "overview:view",
    "orders:view",
    "invoices:view",
    "payments:view",
    "dispatch:view",
    "reports:view",
    "audit:view",
    "batchDna:view",
  ],
};

const LANDING_PATHS: Record<RoleName, string> = {
  owner: "/",
  admin: "/",
  salesman: "/orders",
  production: "/production",
  accountant: "/invoices",
  auditor: "/audit",
};

export function permissionsFor(role: RoleName): Permission[] {
  return [...PERMISSION_MATRIX[role]];
}

export function hasPermission(role: RoleName, permission: Permission) {
  return PERMISSION_MATRIX[role].includes(permission);
}

export function landingPathFor(role: RoleName) {
  return LANDING_PATHS[role];
}

export function isRoleName(value: string): value is RoleName {
  return (ROLES as readonly string[]).includes(value);
}
