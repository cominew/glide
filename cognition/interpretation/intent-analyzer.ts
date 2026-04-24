// cognition/semantic/intent-analyzer.ts
// ─────────────────────────────────────────────────────────────
// Semantic Capability Inference — Pure Observation, No Identity
//
// - Exists only in the event field (no start/stop)
// - Infers required capabilities from query text
// - Emits proposals with capability requirements (not step plans)
// - Uses LLM as a measurement tool, not a thinker
// - No dependency on concrete skill implementations
//
// Constitution v2 Compliance:
//   - Stateless: no memory between events
//   - Subjectless: no "I" in logs or source
//   - Non-executive: only proposes, never acts
// ─────────────────────────────────────────────────────────────

import { EventBus} from '../../kernel/event-bus/event-bus.js';
import { GlideEvent, E } from '../../kernel/event-bus/event-contract.js';
import { ProposalRegistry } from '../proposals/proposal-registry.js';
import { SkillRegistry } from '../../kernel/registry.js';
import { OllamaClient } from '../../kernel/llm/ollama-client.js';
import { safeJsonParse } from '../../emergence/utils/safe-json.js';

export class IntentAnalyzer {
  constructor(
    private bus: EventBus,
    private proposals: ProposalRegistry,
    private registry: SkillRegistry,
    private llm: OllamaClient,
  ) {
    // Exists only in the event field — no lifecycle
    this.bus.on(E.TASK_CREATED, (event: GlideEvent) => this.observe(event));
    console.log('[cognition] capability-inference registered');
  }

  private async observe(event: GlideEvent) {
    const task = event.payload as any;
    if (!task?.intent) return;

    const taskId = task.id;
    const query = task.intent;

    console.log(`[cognition] task.received ${taskId}`);

    const capabilities = await this.inferCapabilities(taskId, query);

    const proposal = this.proposals.propose({
      category: 'action',
      title: query.slice(0, 60),
      description: capabilities.length > 0
        ? `Required capabilities: ${capabilities.join(', ')}`
        : 'Direct response',
      reasoning: `Capability inference from query text.`,
      impact: capabilities.length > 1 ? 'medium' : 'low',
      source: 'intent.analysis',
      taskId,
      executionIntent: {
        type: 'capability.execution',
        payload: {
          taskId,
          query,
          capabilities,
        },
      },
    });

    // Emit as cognitive event, not actor's action
    this.bus.emitEvent('cognition.capabilities.inferred', {
      taskId,
      capabilities,
      proposalId: proposal.id,
    }, 'COGNITION', taskId);
  }

  private async inferCapabilities(taskId: string, query: string): Promise<string[]> {
    const skills = this.registry.list();
    const capabilitySet = new Set<string>();
    for (const skill of skills) {
      const keywords = skill.keywords ?? [];
      for (const kw of keywords) {
        capabilitySet.add(kw);
      }
    }
    const capabilities = Array.from(capabilitySet).sort();
    
    const capabilityList = capabilities.length > 0
      ? capabilities.map(c => `- ${c}`).join('\n')
      : '- direct_response (fallback)';

    const prompt = [
      `From the user query, infer which capabilities are required.`,
      `Available capabilities:`,
      capabilityList,
      ``,
      `Query: "${query}"`,
      ``,
      `Return ONLY valid JSON: {"capabilities": ["capability.name", ...]}`,
      `If none match, return: {"capabilities": []}`,
    ].join('\n');

    try {
      const raw = await Promise.race([
        this.llm.generate(prompt),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Capability inference timeout')), 25000)
        ),
      ]);
      const parsed = safeJsonParse(raw);
      const inferred = Array.isArray(parsed?.capabilities) ? parsed.capabilities : [];
      
      console.log(`[cognition] capabilities.inferred ${taskId}: ${inferred.join(', ') || 'none'}`);
      return inferred;
    } catch (err) {
      console.warn(`[cognition] capability.inference.failed ${taskId}, fallback empty`);
      return [];
    }
  }
}