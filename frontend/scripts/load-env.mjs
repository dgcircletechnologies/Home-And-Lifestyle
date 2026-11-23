import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
export function loadFrontendEnvironment() {
  const path = fileURLToPath(new URL('../../.env', import.meta.url));
  if (!existsSync(path)) return;
  const values = parseEnv(readFileSync(path, 'utf8'));
  // Explicit allowlist: backend secrets never enter the Next process.
  for (const key of ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_RAZORPAY_KEY_ID', 'NEXT_PUBLIC_RAZORPAY_CHECKOUT_SCRIPT_URL', 'FRONTEND_PORT']) {
    if (process.env[key] === undefined && values[key] !== undefined) process.env[key] = values[key];
  }
}
