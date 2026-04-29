// kernel/loader.ts
// ─────────────────────────────────────────────────────────────
// Skill Loader — boots all skills from /skills directory
// ─────────────────────────────────────────────────────────────

import { SkillRegistry } from './registry.js';
import fs             from 'fs';
import path           from 'path';
import { pathToFileURL } from 'url';

export interface LoadedSkill {
  // Identity
  name?:    string;
  id?:      string;

  // Emergence model
  match?:   (event: any) => boolean;
  guard?:   (event: any) => boolean;
  observe?: (event: any) => any;
  execute?: (obs: any, ctx: any) => Promise<any[]>;
  emit?:    (fragments: any[]) => any;

  // Legacy model
  handler?:  (input: any, ctx?: any) => Promise<any>;
  onLoad?:   (bus: any, ctx?: any) => void;
  keywords?: string[];
  description?: string;
  domain?:   string;
  presence?: (event: any) => boolean;
  evidence?: (context: any) => boolean;
  act?:      (event: any, context: any, emit: (frag: any) => void) => void;
  inputs?:   string[];
  outputs?:  string[];
}

function isValidSkill(v: unknown): v is LoadedSkill {
  if (!v || typeof v !== 'object') return false;
  const s = v as any;
  const hasIdentity = typeof s.name === 'string' || typeof s.id === 'string';
  if (!hasIdentity) return false;
  const hasLegacy    = typeof s.handler === 'function';
  const hasEmergence = typeof s.match === 'function' && typeof s.execute === 'function';
  const hasOnLoad    = typeof s.onLoad === 'function';
  const hasPresence  = typeof s.presence === 'function';
  return hasLegacy || hasEmergence || hasOnLoad || hasPresence;
}

export async function awakenCapabilities(skillsDir: string, registry: SkillRegistry): Promise<LoadedSkill[]> {
  if (!fs.existsSync(skillsDir)) {
    console.warn(`[Loader] Skills directory not found: ${skillsDir}`);
    return [];
  }

  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.skill.ts'));
  const loaded: LoadedSkill[] = [];

  for (const file of files) {
    try {
      const url      = pathToFileURL(path.join(skillsDir, file)).href;
      const imported = await import(url);

      const candidates = [
        imported.skill,
        imported.default,
        ...Object.values(imported).filter(v => v !== imported.skill && v !== imported.default),
      ];

      const found = candidates.find(v => isValidSkill(v)) as LoadedSkill | undefined;

      if (found) {
        console.log(`👁 witnessing capability: ${file}`);
        loaded.push(found);
        // 注册到 SkillRegistry（兼容旧接口）
        const name = found.name ?? found.id?.replace('.skill', '') ?? file.replace('.skill.ts', '');
        registry.register({
          name,
          description: found.description ?? '',
          inputs: found.inputs ?? [],
          outputs: found.outputs ?? ['fragments'],
          handler: found.handler,
          presence: found.match ?? found.presence,
          evidence: found.guard ?? found.evidence,
          act: found.act,
        } as any);
      } else {
        console.warn(`[Loader] No valid skill export found in ${file}`);
      }
    } catch (err) {
      console.error(`[Loader] Failed to load ${file}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log('[Loader] Capability field awakened.');
  return loaded;
}