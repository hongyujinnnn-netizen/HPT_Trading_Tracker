import React from 'react';

export function Pill({ children, tone = 'neutral', className = '' }) {
  const toneClasses = {
    profit: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:bg-[#1F4A40] dark:text-[#3FA88C] dark:border-[#265C50]',
    loss: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:bg-[#4A2A1E] dark:text-[#C1502E] dark:border-[#5C3426]',
    gold: 'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-[#2A2311] dark:text-[#C9A227] dark:border-[#42371B]',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#1B1F23] dark:text-[#94A3B8] dark:border-[#262B30]',
    warning: 'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-[#3D2A10] dark:text-[#E4C468] dark:border-[#593F16]',
  };

  const selectedTone = toneClasses[tone] || toneClasses.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono-num font-semibold border transition-colors ${selectedTone} ${className}`}
      style={{ letterSpacing: '0.02em' }}
    >
      {children}
    </span>
  );
}
