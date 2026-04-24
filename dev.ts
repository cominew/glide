// dev.ts
// Simple development launcher: kernel + HTTP server → frontend

import { spawn } from 'child_process';
import http from 'http';

// ========================
// Helper: start a process
// ========================
function startProcess(name: string, command: string, cwd?: string) {
  console.log(`🚀 starting ${name}`);

  const proc = spawn(command, {
    shell: true,
    stdio: 'inherit',
    cwd,
  });

  proc.on('exit', code =>
    console.log(`❌ ${name} exited (${code})`)
  );
}

// ========================
// Helper: wait for HTTP server
// ========================
function waitForServer(url: string, timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      http.get(url, res => {
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);

      function retry() {
        if (Date.now() - start > timeout) return reject(new Error('Server did not respond in time'));
        setTimeout(check, 200);
      }
    };

    check();
  });
}

// ========================
// 1️⃣ Start kernel (backend included)
// ========================
startProcess('kernel', 'npx tsx start.ts');

// ========================
// 2️⃣ Wait for HTTP server to be ready
// ========================
waitForServer('http://localhost:3001/api/health', 30000)
  .then(() => {
    // ========================
    // 3️⃣ Start frontend
    // ========================
    startProcess(
      'frontend',
      'npm run dev -- --host',
      './apps/dashboard'
    );
  })
  .catch(err => console.error(err));