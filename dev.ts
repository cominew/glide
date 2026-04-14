// dev.ts
// This file is used to start the development environment for the project.
// It starts the backend, frontend, and kernel processes in parallel.
// To run this file, use the following command:
//   npm run dev
// Make sure to have the necessary dependencies installed before running this file.
// Note: This file is not intended to be used in production. It is only for development purposes.
// The TypeScript version used in this project is : 6.0.2
// The TypeScript module system used in this project is : ESNext
// The TypeScript module resolution strategy used in this project is : Bundler
// The target version of JavaScript for this project is : ES2022  


import { spawn } from 'child_process';

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
// frontend only
// ========================
startProcess(
  'frontend',
  'npm run dev -- --host',
  './apps/dashboard'
);

// ========================
// kernel ONLY (backend included inside)
// ========================
startProcess(
  'kernel',
  'npx tsx start.ts'
);