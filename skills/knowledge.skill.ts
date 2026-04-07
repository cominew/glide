// skills/knowledge.skill.ts
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Skill, SkillContext, SkillResult } from '../kernel/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(PROJECT_ROOT, 'memory', 'brain');

export const skill: Skill = {
  name: 'knowledge_retrieval',
  description: 'Searches the knowledge base (memory/brain)',
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const query = typeof input === 'string' ? input : (input.query || context.originalQuery);
    if (!query) return { success: false, error: 'No question provided' };

    async function readAllFiles(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(entries.map(async (entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return readAllFiles(full);
        if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
          const content = await fs.readFile(full, 'utf-8');
          return [`# ${path.relative(BRAIN_DIR, full)}\n${content}`];
        }
        return [];
      }));
      return files.flat();
    }

    let docs: string[] = [];
    try {
      docs = await readAllFiles(BRAIN_DIR);
    } catch (err) {
      return { success: false, error: `Knowledge base not found at ${BRAIN_DIR}` };
    }

    if (!docs.length) {
      return { success: false, error: 'No documentation found.' };
    }

    const lowerQuery = query.toLowerCase();
    const relevant = docs.filter(doc => doc.toLowerCase().includes(lowerQuery));
    if (relevant.length === 0) {
      const snippets = docs.slice(0, 2).map(d => d.slice(0, 300));
      return {
        success: true,
        output: {
          type: 'knowledge_answer',
          answer: `I couldn't find exact information about "${query}". Here are some available documents:\n${snippets.join('\n\n---\n\n')}`
        }
      };
    }
    const answer = relevant[0].slice(0, 1500);
    return { success: true, output: { type: 'knowledge_answer', answer } };
  }
};