import { defineConfig } from "vitest/config";

// Served from https://farhangkhanjani.github.io/ai-form-coach/ (GitHub Pages project site).
export default defineConfig({
  base: "/ai-form-coach/",
  server: { host: true },
  test: { include: ["src/**/*.test.ts"] }
});
