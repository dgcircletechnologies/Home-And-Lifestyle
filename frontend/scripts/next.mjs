import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadFrontendEnvironment } from './load-env.mjs';
loadFrontendEnvironment();
const args = process.argv.slice(2);
if (['dev', 'start'].includes(args[0])) {
  const port = Number(process.env.FRONTEND_PORT ?? 5007);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('FRONTEND_PORT must be 1–65535.');
  if (!args.includes('--port') && !args.includes('-p')) args.push('--port', String(port));
}
const child = spawn(process.execPath, [createRequire(import.meta.url).resolve('next/dist/bin/next'), ...args], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
