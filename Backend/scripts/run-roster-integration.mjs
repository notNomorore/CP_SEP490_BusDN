import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vitestCli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const child = spawn(process.execPath, [vitestCli, '--run', 'src/modules/shifts/WeeklyRosterService.integration.test.js'], {
  cwd: process.cwd(),
  env: { ...process.env, RUN_TESTCONTAINERS: 'true' },
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
