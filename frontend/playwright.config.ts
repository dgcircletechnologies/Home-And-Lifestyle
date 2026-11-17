import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', workers: 1, use: { baseURL: 'http://localhost:3100' }, webServer: { command: 'npm run dev -- --port 3100', url: 'http://localhost:3100', reuseExistingServer: false, env: { NEXT_PUBLIC_API_URL: 'http://localhost:3101/api' } } });
