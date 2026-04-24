// kernel/loader.ts
import { SkillRegistry } from './registry.js';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

export async function awakenCapabilities(skillsDir: string, registry: SkillRegistry) {
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.skill.ts'));

  for (const file of files) {
    const modulePath = path.join(skillsDir, file);
    const fileUrl = pathToFileURL(modulePath).href;

    try {
      const imported = await import(fileUrl);

      // 支持旧版 { name, handler } 和新版 { id, match, guard, execute, emit }
      const skill = Object.values(imported).find(
        (v): v is Record<string, any> => v !== null && typeof v === 'object' && ('name' in v || 'id' in v)
      );

      if (!skill) {
        console.warn(`[Loader] No valid skill export found in ${file}`);
        continue;
      }

      console.log(`👁 witnessing capability: ${file}`);

      // 如果是新版接口，包装为旧版兼容格式
      if ('id' in skill && !('name' in skill)) {
        const wrapped = {
          name: skill.id.replace('.skill', ''),
          description: skill.description ?? '',
          keywords: [],
          inputs: [],
          outputs: ['fragments'],
          presence: skill.match,
          evidence: skill.guard,
          act: async (event: any, context: any, emit: any) => {
            const observation = skill.observe(event);
            const fragments = await skill.execute(observation, context);
            for (const frag of fragments) emit(frag);
          },
        };
        registry.register(wrapped as any);
      } else {
        registry.register(skill as any);
      }
    } catch (err) {
      console.error(`[Loader] Failed to load ${file}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log('[Loader] Capability field awakened.');
}