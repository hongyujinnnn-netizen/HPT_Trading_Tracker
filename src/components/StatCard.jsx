import React, { useId } from 'react';

const TONE_MAP = {
  gold: { color: '#E5B83B', bg: 'rgba(201, 162, 39, 0.12)', border: 'rgba(201, 162, 39, 0.3)', glow: 'rgba(201, 162, 39, 0.25)' },
  profit: { color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.3)', glow: 'rgba(52, 211, 153, 0.25)' },
  loss: { color: '#FB7185', bg: 'rgba(251, 113, 133, 0.12)', border: 'rgba(251, 113, 133, 0.3)', glow: 'rgba(251, 113, 133, 0.25)' },
  neutral: { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.22)', glow: 'transparent' },
};

export function StatCard({
  label,
  value,
  sub,
  delta,
  deltaType = 'neutral', // 'up' | 'down' | 'neutral'
  valueColor,
  icon: Icon,
  tone = 'neutral',
  sparklineData,
  sparklineColor,
}) {
  const toneCfg = TONE_MAP[tone] || TONE_MAP.neutral;
  const gradientId = useId();

  const activeSparkColor = sparklineColor || (tone === 'profit' ? '#34D399' : tone === 'loss' ? '#FB7185' : '#E5B83B');

  // Generate SVG polyline points and area polygon points if sparkline data is provided
  const hasSparkline = Array.isArray(sparklineData) && sparklineData.length > 1;
  const svgWidth = 140;
  const svgHeight = 28;
  let points = '';
  let areaPoints = '';

  if (hasSparkline) {
    const minVal = Math.min(...sparklineData);
    const maxVal = Math.max(...sparklineData);
    const range = maxVal - minVal || 1;

    const coords = sparklineData.map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * svgWidth;
      const y = svgHeight - ((val - minVal) / range) * (svgHeight - 6) - 3;
      return { x, y };
    });

    points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    areaPoints = `0,${svgHeight} ` + points + ` ${svgWidth},${svgHeight}`;
  }

  return (
    <div className="terminal-card p-4 flex flex-col justify-between group relative overflow-hidden transition-all duration-300">
      {/* Top subtle corner highlight */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-15 pointer-events-none transition-opacity group-hover:opacity-35"
        style={{ background: toneCfg.color }}
      />

      <div className="flex items-start justify-between gap-2 z-10">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] block">
            {label}
          </span>
          <div
            className="text-2xl lg:text-[26px] font-extrabold font-mono-num tracking-tight drop-shadow-sm transition-colors"
            style={{ color: valueColor || 'var(--color-text-main)' }}
          >
            {value}
          </div>
        </div>

        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm"
            style={{
              background: toneCfg.bg,
              borderColor: toneCfg.border,
              color: toneCfg.color,
            }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between z-10">
        {deltaType === 'up' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono-num font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[#10B981]/12 dark:text-[#34D399] dark:border-[#10B981]/25 shadow-sm">
            <span>▲</span>
            <span>{delta}</span>
          </span>
        )}
        {deltaType === 'down' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono-num font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-[#F43F5E]/12 dark:text-[#FB7185] dark:border-[#F43F5E]/25 shadow-sm">
            <span>▼</span>
            <span>{delta}</span>
          </span>
        )}
        {deltaType === 'neutral' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono-num font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/[0.04] dark:text-[#94A3B8] dark:border-white/[0.08]">
            <span>{delta || sub}</span>
          </span>
        )}
      </div>

      {/* Modern Glowing SVG Sparkline with Area Fill */}
      {hasSparkline && (
        <div className="mt-3 pt-1 w-full h-7 overflow-hidden opacity-75 group-hover:opacity-100 transition-opacity duration-300">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeSparkColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={activeSparkColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <polygon fill={`url(#${gradientId})`} points={areaPoints} />
            <polyline
              fill="none"
              stroke={activeSparkColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      )}
    </div>
  );
}
