import fs from 'fs/promises';
import path from 'path';
import { Skill, SkillContext, SkillResult } from '../../framework/core/types.js';

export const skill: Skill = {
  name: 'knowledge_retrieval',
  description: 'Searches the knowledge base (Markdown/txt files in workspace/brain and workspace/brain/forum) for product features, technical documentation, forum posts, and support replies.',
  keywords: ['how to', 'manual', 'specifications', 'datasheet', 'install', 'configure', 'what is', 'feature', 'forum', 'post'],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const query = typeof input === 'string' ? input : (input.query || context.originalQuery);
    if (!query) return { success: false, output: { error: 'No question provided' } };

    const brainDir = path.join(context.workspace, 'brain');
    const forumDir = path.join(context.workspace, 'brain', 'forum');
    const docs: string[] = [];

    for (const dir of [brainDir, forumDir]) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('.md') || file.endsWith('.txt')) {
            const content = await fs.readFile(path.join(dir, file), 'utf-8');
            docs.push(`# ${path.basename(dir)}/${file}\n${content}`);
          }
        }
      } catch (err) {
        // 目录不存在时忽略
      }
    }

    if (!docs.length) {
      return { success: false, output: { error: 'No documentation or forum data found.' } };
    }

    const lowerQuery = query.toLowerCase();
    const relevant = docs.filter(doc => doc.toLowerCase().includes(lowerQuery));
    if (relevant.length === 0) {
      const snippets = docs.slice(0, 2).map(d => d.slice(0, 500));
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