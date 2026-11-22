import { seedDatabase } from "../src/lib/db/seed";

seedDatabase();

process.stdout.write("GrainTrace demo data seeded.\n");
