import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, TrendingUp, CheckCircle2, Sliders } from 'lucide-react';
import { calculateRollingWinRate } from '../utils/edgeAnalytics';
import { SectionLabel } from './SectionLabel';

export function RollingWinRateChart({ trades = [], defaultBaseline = 50 }) {
  const [windowSize, setWindowSize] = useState(20);
  const [baseline, setBaseline] = useState(defaultBaseline);

  const rollingData = useMemo(() => {
    return calculateRollingWinRate(trades, windowSize, baseline);
  }, [trades, windowSize, baseline]);

  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--color-border-soft)' }}>
        <div>
          <SectionLabel right={
            rollingData.hasAlert ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-bold flex items-center gap-1 animate-pulse bg-rose-500/15 text-rose-700 dark:bg-[#4A2A1E] dark:text-[#C1502E] border border-rose-500/30 dark:border-[#C1502E]/40">
                <AlertTriangle size={11} /> Edge Degradation Alert ({rollingData.belowBaselineStreak} dips)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-bold flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:bg-[#152E25] dark:text-[#3FA88C] border border-emerald-500/30 dark:border-[#3FA88C]/40">
                <CheckCircle2 size={11} /> Edge Healthy
              </span>
            )
          }>
            Rolling {windowSize}-Trade Win Rate (Real-Time Edge)
          </SectionLabel>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Detects real-time edge degradation before cumulative metrics catch on.
          </p>
        </div>

        {/* Controls: Window Size & Baseline */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg border text-[10px] font-mono-num" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <span className="px-1.5" style={{ color: 'var(--color-text-dim)' }}>Window:</span>
            {[10, 20, 30].map((w) => (
              <button
                key={w}
                onClick={() => setWindowSize(w)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  windowSize === w
                    ? 'bg-amber-500 text-slate-900 font-bold shadow-sm'
                    : 'hover:opacity-80'
                }`}
                style={{ color: windowSize === w ? undefined : 'var(--color-text-muted)' }}
              >
                {w}T
              </button>
            ))}
          </div>

          <div className="flex items-center px-2 py-1 rounded-lg border text-[10px] font-mono-num" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}>
            <span>Target:</span>
            <input
              type="number"
              min="30"
              max="90"
              value={baseline}
              onChange={(e) => setBaseline(Number(e.target.value) || 50)}
              className="w-10 bg-transparent text-amber-600 dark:text-[#C9A227] font-bold text-center outline-none"
            />
            <span>%</span>
          </div>
        </div>
      </div>

      {rollingData.points.length < 5 ? (
        <div className="h-52 flex flex-col items-center justify-center text-xs text-[#8B8D91] gap-2">
          <TrendingUp size={24} className="text-[#5A5D61]" />
          <span>Log at least 5 closed trades to initialize the rolling win rate curve.</span>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rollingData.points} margin={{ left: -15, right: 15, top: 10, bottom: 5 }}>
              <CartesianGrid stroke="#1E2226" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#5A5D61', fontSize: 10 }}
                axisLine={{ stroke: '#1E2226' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: '#5A5D61', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div
                        className="rounded-xl p-2.5 shadow-xl text-xs font-mono-num space-y-1 border"
                        style={{
                          background: 'var(--color-surface)',
                          borderColor: 'var(--color-border-soft)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <div className="font-bold" style={{ color: 'var(--color-text-main)' }}>Trade #{data.tradeNumber} ({data.date})</div>
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ color: 'var(--color-text-muted)' }}>Rolling {windowSize}T Win Rate:</span>
                          <span className={`font-bold ${data.rollingWinRate >= baseline ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {data.rollingWinRate}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ color: 'var(--color-text-muted)' }}>Target Baseline:</span>
                          <span className="text-amber-500 font-semibold">{baseline}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ color: 'var(--color-text-muted)' }}>Trade Outcome:</span>
                          <span className={data.pnl >= 0 ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                            {data.pnl >= 0 ? '+' : ''}${data.pnl}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Baseline Reference Line */}
              <ReferenceLine
                y={baseline}
                stroke="#C9A227"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Baseline ${baseline}%`,
                  fill: '#C9A227',
                  position: 'right',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />
              {/* 50% Breakeven Mark */}
              {baseline !== 50 && (
                <ReferenceLine y={50} stroke="#5A5D61" strokeDasharray="2 2" />
              )}
              <Line
                type="monotone"
                dataKey="rollingWinRate"
                stroke={rollingData.hasAlert ? '#C1502E' : '#3FA88C'}
                strokeWidth={2.5}
                dot={{
                  r: 3,
                  fill: '#131619',
                  stroke: rollingData.hasAlert ? '#C1502E' : '#3FA88C',
                  strokeWidth: 2,
                }}
                activeDot={{ r: 5, fill: '#C9A227' }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Real-Time Edge Audit Summary */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-[#1E2226] text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#8B8D91]">Current Rolling Win Rate:</span>
              <span className={`text-base font-bold font-mono-num ${
                rollingData.currentRollingWinRate >= baseline ? 'text-[#3FA88C]' : 'text-[#C1502E]'
              }`}>
                {rollingData.currentRollingWinRate}%
              </span>
              <span className="text-[10px] text-[#5A5D61] font-mono-num">
                (Last {Math.min(windowSize, rollingData.points.length)} trades)
              </span>
            </div>

            {rollingData.hasAlert ? (
              <span className="text-[#C1502E] font-medium flex items-center gap-1.5">
                <AlertTriangle size={13} />
                Edge degraded below {baseline}% for {rollingData.belowBaselineStreak} trades. Review recent trade management!
              </span>
            ) : (
              <span className="text-[#3FA88C] font-medium flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Edge holding above baseline target.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
