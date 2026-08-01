import React from 'react';

export function Pill({ children, tone = 'neutral', className = '' }) {
  const map = {
    profit: { bg: '#1F4A40', fg: '#3FA88C', border: '#265C50' },
    loss: { bg: '#4A2A1E', fg: '#C1502E', border: '#5C3426' },
    gold: { bg: '#2A2311', fg: '#C9A227', border: '#42371B' },
    neutral: { bg: '#1B1F23', fg: '#8B8D91', border: '#262B30' },
    warning: { bg: '#3D2A10', fg: '#E4C468', border: '#593F16' },
  };

  const t = map[tone] || map.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono-num font-medium border ${className}`}
      style={{ background: t.bg, color: t.fg, borderColor: t.border, letterSpacing: '0.02em' }}
    >
      {children}
    </span>
  );
}
