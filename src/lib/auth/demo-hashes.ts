import type { RoleName } from "./permissions";

export const DEMO_PASSWORD_HASHES: Record<RoleName, string> = {
  owner: "$2b$10$zPNkkR1gqsvRDQ/EQryif.33nxkM4QtmWV6pkhcLSMubhWfTB.Rsm",
  admin: "$2b$10$9ZZ9mX0hI0A2WIQfcAwF.uemQpca2s9X5SrALvYEcpZCS8P9a7thO",
  salesman: "$2b$10$pHHjj.P82A6KbTXUfUkeG.xN8F.yfRr0JLlUkKp04odmvWXa8D/wm",
  production: "$2b$10$E8.XTT21ytOl.dL2ywzAXe1bm2Edduey5Evt8LoMvYh7UKTft69d2",
  accountant: "$2b$10$OGVmM.RAQNUpl2TyJN/q5exN8njKccK1mqFZkGJVc9VRynpWPZ/AS",
};

export const DUMMY_PASSWORD_HASH = DEMO_PASSWORD_HASHES.owner;
