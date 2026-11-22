import { getDb } from "@/lib/db";
import { seedDatabase } from "@/lib/db/seed";

let ready = false;

export function prepareDatabase() {
  if (!ready) {
    seedDatabase();
    ready = true;
  }

  return getDb();
}
