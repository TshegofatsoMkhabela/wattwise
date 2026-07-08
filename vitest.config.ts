import { defineConfig } from "vitest/config";

// Standalone test config: the pure helpers under test need no DOM or the app's
// Vite plugins, so we run them in a plain node environment for speed/isolation.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
