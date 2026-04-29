// apps/dashboard/projections/TypewriterText.tsx
import React, { useEffect, useState } from 'react';

export const TypewriterText: React.FC<{ text: string; speed?: number }> = ({ text, speed = 20 }) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <div className="whitespace-pre-wrap">{displayed}<span className="animate-pulse">▊</span></div>;
};