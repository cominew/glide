// D:\.openclaw\app\web-dashboard\src\tabs\SettingsTab.tsx

import React from 'react';
import { Settings, Sun, Moon, Monitor, ToggleRight } from 'lucide-react';
import { Lang } from '../types/chat';

interface SettingsTabProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  notifs: boolean;
  setNotifs: (n: boolean) => void;
  t: any;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ lang, setLang, theme, setTheme, notifs, setNotifs, t }) => {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-slate-200 text-lg mb-5 flex items-center gap-2">
          <Settings size={22} className="text-slate-500" /> {t.config}
        </h3>
        <div className="space-y-5 max-w-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="font-semibold text-slate-300 text-sm">{t.language}</div>
              <div className="text-xs text-slate-500">Interface language</div>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="bg-slate-800 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="font-semibold text-slate-300 text-sm">{t.theme}</div>
              <div className="text-xs text-slate-500">Appearance</div>
            </div>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((m, i) => (
                <button
                  key={m}
                  onClick={() => setTheme(m)}
                  className={`p-2 rounded-lg transition ${
                    theme === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {[<Sun size={16} />, <Moon size={16} />, <Monitor size={16} />][i]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="font-semibold text-slate-300 text-sm">{t.notifications}</div>
              <div className="text-xs text-slate-500">System alerts</div>
            </div>
            <button
              onClick={() => setNotifs(!notifs)}
              className={`transition ${notifs ? 'text-blue-400' : 'text-slate-500'}`}
            >
              <ToggleRight size={24} />
            </button>
          </div>

          <button className="px-5 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 transition">
            {t.saveSettings}
          </button>
        </div>
      </div>
    </div>
  );
};