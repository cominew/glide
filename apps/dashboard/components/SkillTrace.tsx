// D:\.openclaw\app\web-dashboard\src\components\SkillTrace.tsx

import React from 'react';

export const SkillTrace: React.FC<{ skillName: string }> = ({ skillName }) => (
  <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
    <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
    Used skill: <span className="font-mono text-blue-400">{skillName}</span>
  </div>
);