// D:\.openclaw\app\web-dashboard\src\components\LogsTab.tsx
import { FileText } from 'lucide-react';

export interface Log {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface LogsTabProps {
  logs: Log[];
}

export default function LogsTab({ logs }: LogsTabProps) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="font-bold text-slate-200 flex items-center gap-2 mb-4">
        <FileText size={18} /> System Logs
      </h3>
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Level</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 text-slate-400 text-sm">{log.timestamp}</td>
                  <td className={`px-6 py-4 font-bold text-sm ${
                    log.level === 'info' ? 'text-blue-400' :
                    log.level === 'warn' ? 'text-amber-400' : 'text-red-400'
                  }`}>{log.level.toUpperCase()}</td>
                  <td className="px-6 py-4 text-slate-200 text-sm">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}