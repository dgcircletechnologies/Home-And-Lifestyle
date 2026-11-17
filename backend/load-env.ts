import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
// Source runs from backend/; compiled output runs from backend/dist/.
const rootEnv = resolve(__dirname, existsSync(resolve(__dirname, 'package.json')) ? '../.env' : '../../.env');
config({ path: rootEnv, override: false, quiet: true });
