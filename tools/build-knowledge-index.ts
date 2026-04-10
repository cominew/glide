import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');

const KNOWLEDGE_ROOTS = [
  path.join(PROJECT_ROOT, 'knowledge', 'business'),
  path.join(PROJECT_ROOT, 'knowledge', 'project'),
];
const USER_KNOWLEDGE_ROOT = path.join(PROJECT_ROOT, 'knowledge', 'user');
const SOURCE_DIRS = [
  ...KNOWLEDGE_ROOTS,
  USER_KNOWLEDGE_ROOT,
];
const OUTPUT = path.join(__dirname, '../memory/indexes/knowledge.json'); // 调整输出路径

async function getEmbedding(text: string): Promise<number[]> {
  // 保持不变
  return new Promise((resolve) => {
    const body = JSON.stringify({ model: "nomic-embed-text", prompt: text.slice(0, 2000) });
    const req = http.request({
      hostname: 'localhost',
      port: 11434,
      path: '/api/embeddings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data).embedding || []); } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.write(body);
    req.end();
  });
}

async function extractText(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' || ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

async function main() {
  const index: { id: string; content: string; vector: number[] }[] = [];
  for (const srcDir of SOURCE_DIRS) {
    if (!fs.existsSync(srcDir)) {
      console.warn(`⚠️ 目录不存在，跳过: ${srcDir}`);
      continue;
    }
    const files = fs.readdirSync(srcDir).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.md', '.txt'].includes(ext);
    });
    for (const file of files) {
      const fullPath = path.join(srcDir, file);
      const content = await extractText(fullPath);
      if (!content) continue;
      const textForEmbed = content.slice(0, 2000);
      const vector = await getEmbedding(textForEmbed);
      index.push({
        id: `${path.basename(srcDir)}/${file}`,
        content: textForEmbed,
        vector,
      });
      console.log(`🧠 已嵌入: ${srcDir}/${file}`);
    }
  }
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2));
  console.log(`✅ 知识库索引已生成，共 ${index.length} 个文档块。`);
}

main().catch(console.error);