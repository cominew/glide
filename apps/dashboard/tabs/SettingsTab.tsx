// apps/dashboard/tabs/SettingsTab.tsx
import React from 'react';
import { Settings, Sun, Moon, Monitor, ToggleRight, ToggleLeft } from 'lucide-react';
import { Lang } from '../types/chat';

interface Props { lang: Lang; setLang: (l: Lang) => void; theme: 'light'|'dark'|'system'; setTheme: (t: 'light'|'dark'|'system') => void; notifs: boolean; setNotifs: (n: boolean) => void; t: any; }

const Row: React.FC<{ label: string; sub: string; right: React.ReactNode }> = ({ label, sub, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '0.5px solid var(--border)' }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
    </div>
    {right}
  </div>
);

export const SettingsTab: React.FC<Props> = ({ lang, setLang, theme, setTheme, notifs, setNotifs, t }) => (
  <div>
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '20px 24px', maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        <Settings size={18} style={{ color: 'var(--text-muted)' }} /> {t.config}
      </div>

      <Row label={t.language} sub="Interface language" right={
        <select value={lang} onChange={e => setLang(e.target.value as Lang)}
          style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}>
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      } />

      <Row label={t.theme} sub="Appearance" right={
        <div style={{ display: 'flex', gap: 6 }}>
          {(['light','dark','system'] as const).map((m, i) => (
            <button key={m} onClick={() => setTheme(m)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '0.5px solid var(--border)', cursor: 'pointer', background: theme === m ? 'var(--accent)' : 'var(--bg-elevated)', color: theme === m ? '#fff' : 'var(--text-secondary)' }}>
              {[<Sun size={15}/>, <Moon size={15}/>, <Monitor size={15}/>][i]}
            </button>
          ))}
        </div>
      } />

      <Row label={t.notifications} sub="System alerts" right={
        <button onClick={() => setNotifs(!notifs)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: notifs ? 'var(--accent)' : 'var(--text-muted)' }}>
          {notifs ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
        </button>
      } />

      <div style={{ paddingTop: 16 }}>
        <button style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {t.saveSettings}
        </button>
      </div>
    </div>
  </div>
);
