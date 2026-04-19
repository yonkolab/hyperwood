import { defineConfig, defineProject } from "vitest/config";

const dbBackedProject = {
  environment: "node" as const,
  fileParallelism: false,
  globalSetup: ["./tests/setup/db.global.ts"],
  hookTimeout: 120_000,
  isolate: false,
  maxWorkers: 1,
  minWorkers: 1,
  setupFiles: ["./tests/setup/db.setup.ts"],
  testTimeout: 120_000,
};

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "dist/**",
        "docs/**",
        "drizzle/**",
        "scripts/**",
        "tests/**",
        "vitest.config.mts",
      ],
    },
    projects: [
      defineProject({
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["./tests/setup/unit.setup.ts"],
        },
      }),
      defineProject({
        test: {
          ...dbBackedProject,
          name: "api",
          include: ["tests/api/**/*.test.ts"],
        },
      }),
      defineProject({
        test: {
          ...dbBackedProject,
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
        },
      }),
    ],
  },
});
