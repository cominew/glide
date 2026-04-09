// tools/migrate-knowledge-structure.ts
//
// One-time migration: moves existing memory/brain/ files into the new
// knowledge/ + constitution/ structure.
//
// Run: npx tsx tools/migrate-knowledge-structure.ts

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Directory map: source → destination ──────────────────────────────────────

const MOVES: { src: string; dest: string; condition?: (name: string) => boolean }[] = [
  // Constitution files (currently in memory/brain/)
  {
    src:  path.join(ROOT, 'memory', 'brain'),
    dest: path.join(ROOT, 'constitution'),
    condition: (name) => ['IDENTITY.md','SOUL.md','AGENTS.md','USER.md','HEARTBEAT.md'].includes(name.toUpperCase()) ||
                          ['identity','soul','agents','user','heartbeat','memory','tools'].includes(name.toLowerCase().replace('.md','')),
  },
  // Product docs (currently in memory/brain/)
  {
    src:  path.join(ROOT, 'memory', 'brain'),
    dest: path.join(ROOT, 'knowledge', 'products'),
    condition: (name) => /astrion|roscard|iremote|remote|product/i.test(name),
  },
  // Marketing / company docs
  {
    src:  path.join(ROOT, 'memory', 'brain'),
    dest: path.join(ROOT, 'knowledge', 'company'),
    condition: (name) => /marketing|brand|company|about/i.test(name),
  },
  // Customer forum posts
  {
    src:  path.join(ROOT, 'memory', 'brain', 'forum'),
    dest: path.join(ROOT, 'knowledge', 'customers'),
    condition: () => true,
  },
  // Support docs
  {
    src:  path.join(ROOT, 'memory', 'brain'),
    dest: path.join(ROOT, 'knowledge', 'company'),
    condition: (name) => /support/i.test(name),
  },
];

// ── Create directory structure ────────────────────────────────────────────────

const NEW_DIRS = [
  path.join(ROOT, 'constitution'),
  path.join(ROOT, 'knowledge'),
  path.join(ROOT, 'knowledge', 'products'),
  path.join(ROOT, 'knowledge', 'company'),
  path.join(ROOT, 'knowledge', 'customers'),
  path.join(ROOT, 'knowledge', 'decisions'),
  path.join(ROOT, 'knowledge', 'failures'),
  path.join(ROOT, 'knowledge', '_archive'),
  path.join(ROOT, 'memory', 'conversations'),
  path.join(ROOT, 'memory', 'vectors'),
];

async function main() {
  console.log('🔄 Migrating Glide knowledge structure...\n');

  // Create new directories
  for (const dir of NEW_DIRS) {
    await fs.mkdir(dir, { recursive: true });
    console.log(`✅ Created: ${path.relative(ROOT, dir)}/`);
  }

  console.log('\n📁 Scanning files to migrate...\n');

  let moved = 0;
  let skipped = 0;

  for (const rule of MOVES) {
    if (!existsSync(rule.src)) {
      console.log(`⚠️  Source not found: ${path.relative(ROOT, rule.src)}`);
      continue;
    }

    const files = await fs.readdir(rule.src);
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;
      if (file.startsWith('_')) continue;
      if (rule.condition && !rule.condition(file)) continue;

      const src  = path.join(rule.src, file);
      const dest = path.join(rule.dest, file);

      // Don't overwrite existing files
      if (existsSync(dest)) {
        console.log(`⏭️  Skip (exists): ${path.relative(ROOT, dest)}`);
        skipped++;
        continue;
      }

      // Copy (not move) to preserve originals during transition
      await fs.copyFile(src, dest);
      console.log(`  ${path.relative(ROOT, src)}`);
      console.log(`  → ${path.relative(ROOT, dest)}`);
      moved++;
    }
  }

  // Move vectors.json to memory/vectors/
  const oldVectors = path.join(ROOT, 'memory', 'indexes', 'vectors.json');
  const newVectors = path.join(ROOT, 'memory', 'vectors', 'knowledge.json');
  if (existsSync(oldVectors) && !existsSync(newVectors)) {
    await fs.copyFile(oldVectors, newVectors);
    console.log(`\n📊 Moved vectors.json → memory/vectors/knowledge.json`);
  }

  console.log(`\n✅ Migration complete. Moved: ${moved}, Skipped: ${skipped}`);
  console.log('\n⚠️  Original files in memory/brain/ are preserved.');
  console.log('   Review the new structure, then manually remove originals when ready.');
  console.log('\n📝 Next steps:');
  console.log('   1. Review knowledge/ and constitution/ contents');
  console.log('   2. Add product .md files to knowledge/products/');
  console.log('   3. Update knowledge/_MANIFEST.md file index');
  console.log('   4. Run: npx tsx tools/build-knowledge-index.ts');
}

main().catch(console.error);
