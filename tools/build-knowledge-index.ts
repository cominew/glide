import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置：可添加多个源目录
const SOURCE_DIRS = [
  path.join(__dirname, '../brain'),  // 原有的 brain 目录
  'D:/Product testing records/Home Assistant Test/Manual',
  'D:/Product testing records/Home Assistant Test/Datasheet',
  // 可继续添加其他需要的子目录
];
const OUTPUT = path.join(__dirname, '../indexes/knowledge.json');

// 支持的文本文件扩展名
const TEXT_EXTS = ['.md', '.txt', '.docx?', '.pdf']; // 简化处理，暂只支持 .md/.txt
// 如需支持 PDF，取消下面的注释并实现 extractPDFText

async function getEmbedding(text: string): Promise<number[]> {
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

  if (ext === '.pdf') {
  const pdfParse = (await import('pdf-parse')).default;
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
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
      return ['.md', '.txt'].includes(ext); // 可扩展 .pdf
    });
    for (const file of files) {
      const fullPath = path.join(srcDir, file);
      const content = await extractText(fullPath);
      if (!content) continue;
      // 截取前 2000 字符作为嵌入（平衡性能与效果）
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