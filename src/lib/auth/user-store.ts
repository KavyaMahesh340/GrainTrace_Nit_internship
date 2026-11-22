import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { roles, users } from "@/lib/db/schema";
import { roleNameSchema } from "./validation";
import type { ActiveUserRecord } from "./types";

export function findActiveUserByEmail(email: string): ActiveUserRecord | undefined {
  const row = getDb()
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
      role: roles.name,
      status: users.status,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .get();

  if (!row || row.status !== "active") {
    return undefined;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    passwordHash: row.passwordHash,
    role: roleNameSchema.parse(row.role),
  };
}

export function touchLogin(userId: number) {
  getDb()
    .update(users)
    .set({ lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
    .run();
}
