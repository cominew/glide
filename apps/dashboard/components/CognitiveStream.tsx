// apps/dashboard/components/CognitiveStream.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, Zap, Sparkles, Brain } from 'lucide-react';

export interface TimelineStep {
  skill: string;
  input: any;
  output: any;
  duration: number;
  thoughtBefore?: string;
  thoughtAfter?: string;
}

export interface Timeline {
  plan: { steps: any[]; raw: string };
  steps: TimelineStep[];
  finalAnswer: string;
}

export const CognitiveStream: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const [expanded, setExpanded] = useState(true);
  const totalMs = timeline.steps.reduce((s, t) => s + (t.duration || 0), 0);

  return (
    <div className="mb-3 rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-2 text-slate-400">
          <Cpu size={11} className="text-blue-400" />
          <span className="font-mono font-bold">
            {timeline.plan.steps.length} skill{timeline.plan.steps.length !== 1 ? 's' : ''}
            {' · '}{totalMs}ms
          </span>
        </div>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50">
          {/* 原始计划 */}
          {timeline.plan.raw && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-400 uppercase tracking-widest">
                <Brain size={9} /> Planning (raw)
              </div>
              <pre className="mt-1 p-2 bg-slate-900/60 rounded-md text-[11px] text-slate-300 overflow-x-auto font-mono whitespace-pre-wrap">
                {timeline.plan.raw.slice(0, 500)}
              </pre>
            </div>
          )}

          {/* 执行步骤（含思考） */}
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              <Zap size={9} /> Execution
            </div>
            <div className="space-y-2">
              {timeline.steps.filter(s => s.skill !== 'aggregator').map((step, i) => (
  <div key={i} className="p-2 bg-slate-800/40 rounded-md">
    <div className="flex items-center gap-2">
      <span className="w-4 text-slate-600">{i+1}</span>
      <span className="font-mono text-blue-300">{step.skill}</span>
      <span className="text-slate-600">({step.duration}ms)</span>
      <span className="ml-auto text-emerald-400 text-[10px]">{step.output?.type || 'done'}</span>
    </div>
    {step.thoughtBefore && (
      <div className="mt-1 text-[11px] text-purple-300 border-l-2 border-purple-500/50 pl-2">
        💭 {step.thoughtBefore}
      </div>
    )}
    {/* 显示输入参数 */}
    {step.input && Object.keys(step.input).length > 0 && (
      <div className="mt-1 text-[11px] text-slate-400 border-l-2 border-slate-600/50 pl-2">
        📥 Input: {JSON.stringify(step.input, null, 2).slice(0, 200)}
      </div>
    )}
    {/* 显示输出摘要 */}
    {step.output && (
      <div className="mt-1 text-[11px] text-slate-400 border-l-2 border-slate-600/50 pl-2">
        📤 Output: {JSON.stringify(step.output, null, 2).slice(0, 200)}
      </div>
    )}
    {step.thoughtAfter && (
      <div className="mt-1 text-[11px] text-emerald-300 border-l-2 border-emerald-500/50 pl-2">
        ✅ {step.thoughtAfter}
      </div>
    )}
  </div>
))}
            </div>
          </div>

          {/* 聚合 */}
          {timeline.steps.some(s => s.skill === 'aggregator') && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-400 uppercase tracking-widest">
                <Sparkles size={9} /> Aggregation
              </div>
              <div className="text-slate-400 text-[11px] mt-1">
                {timeline.steps.find(s => s.skill === 'aggregator')?.thoughtAfter || 'Generating final answer...'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};