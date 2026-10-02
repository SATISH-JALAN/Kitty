import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // The program tests share one chain and run in order.
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
