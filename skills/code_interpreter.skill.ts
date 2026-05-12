import type { Skill, SkillContext, SkillResult } from '../kernel/types/skill';
import type { GlideEvent } from '../kernel/event-bus/event-contract';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE = path.resolve(process.cwd());
const TEMP_DIR = path.join(WORKSPACE, 'temp');
const execPromise = promisify(exec);

// 确保临时目录存在
await fs.mkdir(TEMP_DIR, { recursive: true });

export const skill: Skill = {
  name: 'code_interpreter',
  description: 'Executes JavaScript code to answer questions when no existing skill can.',
  keywords: ['code', 'javascript', 'execute', 'compute'],

  canExist(event: GlideEvent): boolean {
    // 仅当用户输入明确要求执行代码或携带 code 字段时显现
    if (event.type !== 'input.user') return false;
    const msg = String(event.payload?.input?.message ?? '');
    return /\b(?:execute|run|code|compute|calculate|javascript)\b/i.test(msg);
  },

  async handler(input: any, _context?: SkillContext): Promise<SkillResult> {
    const code = typeof input === 'string' ? input : input.code ?? input.input?.code;
    if (!code) {
      return {
        state: 'partial',
        confidence: 0,
        phase: 'analysis',
        fragments: [],
      };
    }

    const tempFile = path.join(TEMP_DIR, `temp_${Date.now()}.js`);
    const wrappedCode = `
      const fs = require('fs');
      const path = require('path');
      const WORKSPACE = '${WORKSPACE}';
      function readJSON(filePath) {
        try {
          const fullPath = path.join(WORKSPACE, 'indexes', filePath);
          return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        } catch(e) { return null; }
      }
      (async () => {
        try {
          ${code}
        } catch(err) {
          console.error(err);
        }
      })();
    `;

    await fs.writeFile(tempFile, wrappedCode);
    try {
      const { stdout, stderr } = await execPromise(`node ${tempFile}`);
      if (stderr) console.warn('Code interpreter stderr:', stderr);
      const output = stdout.trim() || 'Code executed successfully (no output).';
      return {
        state: 'emitted',
        confidence: 1.0,
        phase: 'analysis',
        fragments: [{
          type: 'data',
          name: 'code_result',
          value: output,
          role: 'primary',
          confidence: 1.0,
          source: 'code_interpreter.skill',
          phase: 'analysis',
        }],
      };
    } catch (err: any) {
      return {
        state: 'failed',
        confidence: 0,
        phase: 'analysis',
        fragments: [{
          type: 'data',
          name: 'code_error',
          value: String(err),
          source: 'code_interpreter.skill',
          phase: 'analysis',
          confidence: 1.0,
        }],
      };
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  },
};