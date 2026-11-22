import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    env: {
      DATABASE_URL: ":memory:",
    },
    globals: false,
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/tests/server-only.ts"),
    },
  },
});
