// tools/migrate-to-knowledge-os.ts
// 运行: npx tsx tools/migrate-to-knowledge-os.ts

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RULES: { match: RegExp; dest: string }[] = [
  { match: /identity|soul|agents|heartbeat/i,         dest: 'constitution' },
  { match: /user|charles|owner/i,                     dest: 'knowledge/user' },
  { match: /memory|tools/i,                           dest: 'constitution' },
  { match: /astrion|roscard|iremote|remote|product/i, dest: 'knowledge/business/products' },
  { match: /marketing|brand/i,                        dest: 'knowledge/business' },
  { match: /support/i,                                dest: 'knowledge/business' },
  { match: /sales/i,                                  dest: 'knowledge/business' },
];

async function ensureDirs() {
  const dirs = [
    'constitution', 'knowledge/project', 'knowledge/user/sessions',
    'knowledge/business/products', 'knowledge/business/customers',
    'knowledge/decisions', 'knowledge/failures', 'knowledge/_archive',
    'memory/conversations', 'memory/vectors',
  ];
  for (const d of dirs) await fs.mkdir(path.join(ROOT, d), { recursive: true });
  console.log('✅  Directories created\n');
}

async function copy(src: string, destDir: string) {
  const dest = path.join(destDir, path.basename(src));
  if (existsSync(dest)) { console.log(`  ⏭  exists: ${path.relative(ROOT, dest)}`); return; }
  await fs.copyFile(src, dest);
  console.log(`  ✅  ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
}

async function main() {
  console.log('🔄  Glide Knowledge OS migration\n');
  await ensureDirs();

  const brain = path.join(ROOT, 'memory', 'brain');
  if (existsSync(brain)) {
    for (const f of await fs.readdir(brain)) {
      if (!f.endsWith('.md') && !f.endsWith('.txt')) continue;
      const rule = RULES.find(r => r.match.test(f));
      await copy(path.join(brain, f), path.join(ROOT, rule?.dest ?? 'knowledge/_archive'));
    }
  }

  const forum = path.join(ROOT, 'memory', 'brain', 'forum');
  if (existsSync(forum)) {
    console.log('\n📂  Forum posts...');
    for (const f of await fs.readdir(forum))
      if (f.endsWith('.txt') || f.endsWith('.md'))
        await copy(path.join(forum, f), path.join(ROOT, 'knowledge/business/customers'));
  }

  const oldVec = path.join(ROOT, 'memory', 'indexes', 'vectors.json');
  if (existsSync(oldVec)) await copy(oldVec, path.join(ROOT, 'memory/vectors'));

  console.log('\n✅  Done. Next steps:');
  console.log('    1. Review knowledge/ and constitution/');
  console.log('    2. Edit knowledge/user/charles.md');
  console.log('    3. Put product .md files in knowledge/business/products/');
  console.log('    4. npx tsx tools/build-knowledge-index.ts');
}

main().catch(console.error);
