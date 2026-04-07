// src/components/LogsPanelRealtime.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Orchestrator } from '../../../runtime/orchestrator/orchestrator';
import { SkillContext } from '../../../kernel/types';
import { UILogs } from '../../../runtime/orchestrator/ui-log';

interface LogsPanelRealtimeProps {
  orchestrator: Orchestrator;
  context: SkillContext;
  query: string;
}

export const LogsPanelRealtime: React.FC<LogsPanelRealtimeProps> = ({ orchestrator, context, query }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [output, setOutput] = useState<string>('Processing...');
  const logsRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const runLogs = async () => {
      const uiLogs = new UILogs(orchestrator);

      // 替换 UILogs 内部 log 保存函数，使每次 log 都更新状态
      const originalPush = uiLogs.logs.push.bind(uiLogs.logs);
      uiLogs.logs.push = (log: any) => {
        originalPush(log);
        logsRef.current.push(log);
        setLogs([...logsRef.current]);
        // 滚动到底部
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      };

      const finalAnswer = await uiLogs.process(query, context);
      setOutput(finalAnswer);
    };

    runLogs();
  }, [query, orchestrator, context]);

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 14 }}>
      <h3>Query:</h3>
      <p>{query}</p>

      <h3>Logs Timeline:</h3>
      <div 
        ref={containerRef} 
        style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #ccc', padding: 8 }}
      >
        {logs.map((log, idx) => (
          <div key={idx} style={{ marginBottom: 12 }}>
            <b>[{log.stepType.toUpperCase()}]{log.skill ? ` ${log.skill}` : ''}</b>
            {log.duration != null && <span> ({log.duration}ms)</span>}
            <div><i>Before:</i> {log.thoughtBefore || '-'}</div>
            <div><i>Input:</i> {JSON.stringify(log.input)}</div>
            <div><i>Output:</i> {JSON.stringify(log.output)}</div>
            <div><i>After:</i> {log.thoughtAfter || '-'}</div>
          </div>
        ))}
      </div>

      <h3>Final Answer:</h3>
      <div style={{ border: '1px solid #000', padding: 8, background: '#f9f9f9' }}>
        {output}
      </div>
    </div>
  );
};