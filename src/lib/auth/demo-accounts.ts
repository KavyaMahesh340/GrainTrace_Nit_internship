import { landingPathFor, ROLE_LABELS, type RoleName } from "./permissions";

export const DEMO_ACCOUNTS = [
  { role: "owner", email: "owner@graintrace.local", password: "Owner!2026" },
  { role: "admin", email: "admin@graintrace.local", password: "Admin!2026" },
  { role: "salesman", email: "salesman@graintrace.local", password: "Sales!2026" },
  { role: "production", email: "production@graintrace.local", password: "Production!2026" },
  { role: "accountant", email: "accountant@graintrace.local", password: "Accounts!2026" },
] as const satisfies readonly {
  role: RoleName;
  email: string;
  password: string;
}[];

export function demoAccountView() {
  return DEMO_ACCOUNTS.map((account) => ({
    role: ROLE_LABELS[account.role],
    email: account.email,
    password: account.password,
    landingPath: landingPathFor(account.role),
  }));
}
