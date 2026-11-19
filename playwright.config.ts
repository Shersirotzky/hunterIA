import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  use: { baseURL, serviceWorkers: "block",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  webServer: [
    { command: "node tests/mock-convex.mjs", port: 3210 },
    {
      command: process.env.PLAYWRIGHT_PRODUCTION === "1"
        ? "npm run start -- --hostname 127.0.0.1 --port 3100"
        : "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: baseURL,
      env: { NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210" },
      timeout: 60_000,
    },
  ],
});
