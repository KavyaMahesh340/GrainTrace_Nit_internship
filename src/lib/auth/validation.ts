import { z } from "zod";

export const roleNameSchema = z.enum(["owner", "admin", "salesman", "production", "accountant"]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});

export const sessionTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const referenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export type LoginInput = z.infer<typeof loginSchema>;
