import { defineConfig } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
if (!/^CONVEX_DEPLOYMENT=local:/m.test(readFileSync('.env.local','utf8'))) throw new Error('Playwright requer Convex local; fixtures não serão executadas em produção.');
mkdirSync("/tmp/hunter-convex", { recursive: true });
export default defineConfig({
  globalSetup: './scripts/playwright-setup.ts',
  testDir: './tests', testMatch: '**/*.spec.ts', workers: 1, fullyParallel: false,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: [
    { command: "npx convex dev", env: { TMPDIR: "/tmp/hunter-convex" }, url: "http://127.0.0.1:3210/version", reuseExistingServer: true, timeout: 120000 },
    { command: 'node tests/mock-linkedin.mjs', url: 'http://127.0.0.1:4400/health', reuseExistingServer: false },
    { command: 'npm run dev -- --port 3100', url: 'http://localhost:3100/signin', timeout: 120000, reuseExistingServer: false,
      env: { NEXT_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210', NEXT_PUBLIC_CONVEX_SITE_URL: 'http://127.0.0.1:3211', LINKEDIN_CLIENT_ID: 'hunter-test-client', LINKEDIN_CLIENT_SECRET: 'hunter-test-secret', LINKEDIN_REDIRECT_URI: 'http://localhost:3100/api/auth/linkedin/callback', LINKEDIN_BRIDGE_SECRET: 'hunter-local-test-only-0000000000000000000000000000000000000000', APP_SESSION_SECRET: 'hunter-local-cookie-test-only-00000000000000000000000000000000', LINKEDIN_TEST_PROVIDER: 'http://127.0.0.1:4400' } },
  ],
});
