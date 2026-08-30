import React from 'react';

const TONE_MAP = {
  gold: { color: '#C9A227', bg: 'rgba(201, 162, 39, 0.12)', border: 'rgba(201, 162, 39, 0.3)' },
  profit: { color: '#3FA88C', bg: 'rgba(63, 168, 140, 0.12)', border: 'rgba(63, 168, 140, 0.3)' },
  loss: { color: '#C1502E', bg: 'rgba(193, 80, 46, 0.12)', border: 'rgba(193, 80, 46, 0.3)' },
  neutral: { color: '#8B8D91', bg: 'rgba(139, 141, 145, 0.12)', border: 'rgba(139, 141, 145, 0.25)' },
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
  const activeSparkColor = sparklineColor || (tone === 'profit' ? '#3FA88C' : tone === 'loss' ? '#C1502E' : '#C9A227');

  // Generate SVG polyline points if sparkline data is provided and has >1 item
  const hasSparkline = Array.isArray(sparklineData) && sparklineData.length > 1;
  const svgWidth = 140;
  const svgHeight = 24;
  let points = '';

  if (hasSparkline) {
    const minVal = Math.min(...sparklineData);
    const maxVal = Math.max(...sparklineData);
    const range = maxVal - minVal || 1;

    points = sparklineData
      .map((val, i) => {
        const x = (i / (sparklineData.length - 1)) * svgWidth;
        const y = svgHeight - ((val - minVal) / range) * (svgHeight - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  return (
    <div className="terminal-card p-4 flex flex-col justify-between hover:border-[#3A4048] transition-all relative overflow-hidden group shadow-sm">
      <div className="flex items-start justify-between gap-2 z-10">
        <div className="space-y-1">
          <span className="text-xs font-medium text-[#8B8D91] block">
            {label}
          </span>
          <div className="text-2xl font-bold font-mono-num tracking-tight" style={{ color: valueColor || '#EDEAE3' }}>
            {value}
          </div>
        </div>

        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105"
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

      <div className="mt-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-1 text-xs font-mono-num">
          {deltaType === 'up' && (
            <span className="text-[#3FA88C] font-semibold flex items-center gap-0.5">
              ▲ {delta}
            </span>
          )}
          {deltaType === 'down' && (
            <span className="text-[#C1502E] font-semibold flex items-center gap-0.5">
              ▼ {delta}
            </span>
          )}
          {deltaType === 'neutral' && (
            <span className="text-[#8B8D91]">
              {delta || sub}
            </span>
          )}
        </div>
      </div>

      {/* Mini SVG Sparkline */}
      {hasSparkline && (
        <div className="mt-2.5 pt-1 w-full h-6 overflow-hidden opacity-75 group-hover:opacity-100 transition-opacity">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
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
