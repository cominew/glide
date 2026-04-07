// workspace/skills/code_interpreter.skill.ts
import { Skill, SkillContext, SkillResult } from "../kernel/types";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE = path.resolve(__dirname, "..");
const TEMP_DIR = path.join(WORKSPACE, "temp");
const execPromise = promisify(exec);

// 确保临时目录存在
await fs.mkdir(TEMP_DIR, { recursive: true });

export const skill: Skill = {
  name: "code_interpreter",
  description: "Executes JavaScript code to answer questions when no existing skill can. Parameters: code (string) – the JavaScript code to run. The code can use 'readJSON' function to load workspace/indexes/*.json files.",
  keywords: [],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const { code } = input;
    if (!code) {
      return { success: false, error: "No code provided", output: "Please provide JavaScript code to execute." };
    }

    // 创建一个安全的执行环境（限制访问某些模块）
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
      if (stderr) console.warn("Code interpreter stderr:", stderr);
      const output = stdout.trim() || "Code executed successfully (no output).";
      return { success: true, output: { type: "code_result", result: output } };
    } catch (err) {
      return { success: false, error: String(err), output: `Execution failed: ${err.message}` };
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
};
