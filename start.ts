// start.ts — Glide (鼠脑) boot script

import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PATHS = {
  brain:     path.join(__dirname, 'memory', 'brain'),
  indexes:   path.join(__dirname, 'memory', 'indexes'),
  server:    path.join(__dirname, 'apps', 'server', 'http-server.ts'),
  dashboard: path.join(__dirname, 'apps', 'dashboard'),
};

console.clear();
console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[32m%s\x1b[0m', '🟢  BOOTING GLIDE (鼠脑) ENVIRONMENT');
console.log('\x1b[36m%s\x1b[0m', '==========================================================');

function runHealthCheck() {
  console.log('[Kernel] Running pre-flight checks...');
  [PATHS.brain, PATHS.indexes].forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.warn(`[Warning] Missing directory: ${dir}. AI might lack context.`);
    } else {
      const count = fs.readdirSync(dir).length;
      console.log(`[Check] ${path.basename(dir)}: OK (${count} assets found)`);
    }
  });
  try {
    const out   = execSync('ollama list', { encoding: 'utf8' });
    const lines = out.trim().split('\n');
    const count = lines.length > 1 ? lines.length - 1 : 0;
    console.log(`[Ollama] Detected ${count} active models.`);
  } catch {
    console.error('[Ollama] Error: Ollama is not running or not in PATH.');
  }
}

const activeProcesses: ChildProcess[] = [];

// Pass a single command string to avoid Windows DEP0190 warning
function startService(name: string, command: string, cwd?: string) {
  const proc = spawn(command, {
    cwd:   cwd ?? __dirname,
    stdio: 'inherit',
    shell: true,
  });
  proc.on('error', err => console.error(`[${name}] Failed to start:`, err));
  proc.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`[${name}] Exited with code ${code}`);
    }
  });
  activeProcesses.push(proc);
  console.log(`[Kernel] \x1b[34m${name}\x1b[0m service initiated.`);
  return proc;
}

runHealthCheck();

startService('Backend', `npx tsx "${PATHS.server}"`);

setTimeout(() => {
  // --host forces Vite to bind 0.0.0.0 so browser can always reach it on Windows
  startService('Frontend', 'npx vite --host', PATHS.dashboard);
}, 1500);

function shutdown() {
  console.log('\n\x1b[31m%s\x1b[0m', '🔴  SHUTTING DOWN GLIDE...');
  activeProcesses.forEach(proc => {
    if (!proc.pid) return;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {}
  });
  setTimeout(() => { console.log('👋  Goodbye.'); process.exit(0); }, 500);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', err => console.error('[Fatal]', err));
