import type { Permission, RoleName } from "./permissions";

export type SessionUser = {
  id: number;
  email: string;
  fullName: string;
  role: RoleName;
  roleLabel: string;
  permissions: Permission[];
  landingPath: string;
};

export type ActiveUserRecord = {
  id: number;
  email: string;
  fullName: string;
  passwordHash: string;
  role: RoleName;
};
