import React from 'react';

export function StatCard({
  label,
  value,
  sub,
  delta,
  deltaType = 'neutral', // 'up' | 'down' | 'neutral'
  valueColor,
  sparklineData = [10, 15, 12, 18, 22, 20, 25, 28],
  sparklineColor = '#3FA88C',
}) {
  // Generate SVG polyline points from sparklineData
  const svgWidth = 140;
  const svgHeight = 26;
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData);
  const range = maxVal - minVal || 1;

  const points = sparklineData
    .map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * svgWidth;
      const y = svgHeight - ((val - minVal) / range) * (svgHeight - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="bg-[#131619] border border-[#262B30] rounded-xl p-4 flex flex-col justify-between hover:border-[#3A4048] transition-all relative overflow-hidden group shadow-sm">
      <div className="space-y-1.5 z-10">
        <span className="text-xs font-medium text-[#8B8D91] block">
          {label}
        </span>

        <div className="text-2xl font-bold font-mono-num tracking-tight" style={{ color: valueColor || '#EDEAE3' }}>
          {value}
        </div>

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

      {/* Mini SVG Sparkline at bottom */}
      <div className="mt-3 pt-1 w-full h-7 overflow-hidden">
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          <polyline
            fill="none"
            stroke={sparklineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
}
