// apps/dashboard/components/CognitiveStream.tsx
//
// Displays the AI's reasoning process:
//   1. Thinking  — a paragraph of internal reasoning (typewriter effect)
//   2. Planning  — which skills were selected
//   3. Execution — each skill's input/output and timing
//   4. Aggregation — synthesis step

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Cpu, Zap, Sparkles, Brain } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineStep {
  skill:          string;
  input:          any;
  output:         any;
  duration:       number;
  thoughtBefore?: string;
  thoughtAfter?:  string;
}

export interface Timeline {
  thinking:    string;
  plan:        { steps: any[]; raw: string };
  steps:       TimelineStep[];
  finalAnswer: string;
}

// ── Typewriter hook ───────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18): string {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    indexRef.current = 0;
    if (!text) return;

    const id = setInterval(() => {
      if (indexRef.current >= text.length) {
        clearInterval(id);
        return;
      }
      setDisplayed(text.slice(0, indexRef.current + 1));
      indexRef.current++;
    }, speed);

    return () => clearInterval(id);
  }, [text, speed]);

  return displayed;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ThinkingBlock: React.FC<{ text: string }> = ({ text }) => {
  const displayed = useTypewriter(text, 12);
  const done      = displayed.length >= text.length;

  return (
    <div className="pt-2">
      <div className="flex items-center gap-1.5 text-[10px] font-black text-violet-400 uppercase tracking-widest mb-2">
        <Brain size={9} />
        <span>Thinking</span>
        {!done && (
          <span className="ml-1 flex gap-0.5">
            {[0,1,2].map(i => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        )}
      </div>
      <div className="relative p-3 rounded-lg bg-violet-950/30 border border-violet-800/30">
        {/* Subtle gradient left border */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg bg-gradient-to-b from-violet-500 to-indigo-500" />
        <p className="pl-3 text-[11px] leading-relaxed text-violet-200/80 font-mono whitespace-pre-wrap">
          {displayed}
          {!done && <span className="animate-pulse ml-0.5 text-violet-400">▋</span>}
        </p>
      </div>
    </div>
  );
};

const PlanBlock: React.FC<{ steps: any[] }> = ({ steps }) => (
  <div>
    <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">
      <Zap size={9} /> Planning
    </div>
    <div className="flex flex-wrap gap-1.5">
      {steps.map((s: any, i: number) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20"
        >
          <span className="text-blue-300 font-mono text-[11px] font-bold">{s.skill}</span>
          {s.params && Object.keys(s.params).length > 0 && (
            <span className="text-blue-500/60 text-[10px]">
              ({Object.entries(s.params).map(([k, v]) => `${k}: ${v}`).join(', ')})
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
);

const ExecutionBlock: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
  const skillSteps = steps.filter(s => s.skill !== 'aggregator');

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
        <Cpu size={9} /> Execution
      </div>
      <div className="space-y-2">
        {skillSteps.map((step, i) => {
          const isError = !!step.output?.error;
          return (
            <div
              key={i}
              className="rounded-lg bg-slate-800/40 border border-slate-700/30 overflow-hidden"
            >
              {/* Step header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60">
                <span className="text-[10px] text-slate-600 w-4 text-center font-mono">{i + 1}</span>
                <span className="font-mono font-bold text-[11px] text-blue-300">{step.skill}</span>
                <span className="text-slate-600 text-[10px]">{step.duration}ms</span>
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isError
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {isError ? 'error' : (step.output?.type ?? 'done')}
                </span>
              </div>

              {/* Thought before */}
              {step.thoughtBefore && (
                <div className="px-3 py-1.5 border-t border-slate-700/20 flex gap-2">
                  <span className="text-violet-400 shrink-0">💭</span>
                  <span className="text-[10px] text-violet-300/70">{step.thoughtBefore}</span>
                </div>
              )}

              {/* Input params */}
              {step.input && Object.keys(step.input).filter(k => k !== 'query').length > 0 && (
                <div className="px-3 py-1.5 border-t border-slate-700/20 flex gap-2">
                  <span className="text-slate-500 shrink-0 text-[10px]">in</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Object.entries(step.input)
                      .filter(([k]) => k !== 'query')
                      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                      .join('  ·  ')}
                  </span>
                </div>
              )}

              {/* Output summary */}
              {step.output && !isError && (
                <div className="px-3 py-1.5 border-t border-slate-700/20 flex gap-2">
                  <span className="text-emerald-500 shrink-0 text-[10px]">out</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {step.output.type === 'customer_list'
                      ? `${step.output.data?.length ?? 0} customers`
                      : step.output.type === 'monthly_report'
                      ? `$${(step.output.totalRevenue ?? 0).toFixed(0)} revenue, ${step.output.totalOrders} orders`
                      : step.output.type === 'overview'
                      ? `$${(step.output.revenue ?? 0).toFixed(0)} total revenue`
                      : step.output.type === 'top_customers'
                      ? `${step.output.data?.length ?? 0} customers ranked`
                      : step.output.type ?? JSON.stringify(step.output).slice(0, 60)}
                  </span>
                </div>
              )}

              {/* Thought after */}
              {step.thoughtAfter && (
                <div className="px-3 py-1.5 border-t border-slate-700/20 flex gap-2">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span className="text-[10px] text-emerald-300/70">{step.thoughtAfter}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AggregationBlock: React.FC<{ step: TimelineStep }> = ({ step }) => (
  <div>
    <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5">
      <Sparkles size={9} /> Generating final answer
    </div>
    <div className="text-[10px] text-slate-500 pl-4">
      {step.thoughtBefore ?? 'Aggregating results...'}
    </div>
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────

export const CognitiveStream: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const [expanded, setExpanded] = useState(true);

  const skillSteps = timeline.steps.filter(s => s.skill !== 'aggregator');
  const aggStep    = timeline.steps.find(s => s.skill === 'aggregator');
  const totalMs    = skillSteps.reduce((s, t) => s + (t.duration || 0), 0);

  return (
    <div className="mb-3 rounded-xl border border-slate-700/40 bg-slate-900/30 overflow-hidden text-xs">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-500">
          <Brain size={10} className="text-violet-400" />
          <span className="font-mono text-[11px]">
            {timeline.plan.steps.length} skill{timeline.plan.steps.length !== 1 ? 's' : ''}
            {totalMs > 0 ? ` · ${totalMs}ms` : ''}
          </span>
          {timeline.thinking && (
            <span className="text-violet-500/60 text-[10px] hidden sm:block truncate max-w-[200px]">
              · {timeline.thinking.slice(0, 50)}…
            </span>
          )}
        </div>
        {expanded
          ? <ChevronDown size={12} className="text-slate-600" />
          : <ChevronRight size={12} className="text-slate-600" />
        }
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="px-3 pb-4 space-y-4 border-t border-slate-700/30">
          {/* 1. Thinking */}
          {timeline.thinking && <ThinkingBlock text={timeline.thinking} />}

          {/* 2. Planning */}
          {timeline.plan.steps.length > 0 && <PlanBlock steps={timeline.plan.steps} />}

          {/* 3. Execution */}
          {skillSteps.length > 0 && <ExecutionBlock steps={skillSteps} />}

          {/* 4. Aggregation */}
          {aggStep && <AggregationBlock step={aggStep} />}
        </div>
      )}
    </div>
  );
};
