// start.ts
// This file is used to start the Glide AI OS.
// It starts the kernel and the HTTP server.
// To run this file, use the following command:
//   npm run start
// Make sure to have the necessary dependencies installed before running this file.
// Note: This file is intended to be used in production. It is the entry point for the application.
// The TypeScript version used in this project is : 6.0.2
// The TypeScript module system used in this project is : ESNext
// The TypeScript module resolution strategy used in this project is : Bundler
// The target version of JavaScript for this project is : ES2022  

import { bootstrapGlide } from './kernel/bootstrap';
import { startHttpServer } from './apps/server/http-server';

async function boot() {
  console.log('🚀 Booting Glide AI OS');

  const os = await bootstrapGlide();

  await startHttpServer(os);

  console.log('🧠 Kernel Online');
  console.log('✨ Glide Alive');

  return os;
}

boot().catch(console.error);