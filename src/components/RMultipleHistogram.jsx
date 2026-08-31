import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layers, Activity, HelpCircle, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { calculateRMultipleDistribution } from '../utils/edgeAnalytics';
import { SectionLabel } from './SectionLabel';

export function RMultipleHistogram({ trades = [] }) {
  const rData = useMemo(() => {
    return calculateRMultipleDistribution(trades);
  }, [trades]);

  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262B30] pb-3">
        <div>
          <SectionLabel right={
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-bold flex items-center gap-1 ${
              rData.skewness > 0.3
                ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#152E25] dark:text-[#3FA88C] border border-emerald-500/30 dark:border-[#3FA88C]/40'
                : rData.skewness < -0.3
                ? 'bg-rose-500/15 text-rose-700 dark:bg-[#4A2A1E] dark:text-[#C1502E] border border-rose-500/30 dark:border-[#C1502E]/40'
                : 'bg-slate-100 dark:bg-[#1B1F23] text-slate-600 dark:text-[#8B8D91] border border-slate-200 dark:border-[#262B30]'
            }`}>
              {rData.skewness > 0.3 ? <ShieldCheck size={11} /> : rData.skewness < -0.3 ? <AlertTriangle size={11} /> : null}
              {rData.skewnessType}
            </span>
          }>
            R-Multiple Distribution &amp; Asymmetry Histogram
          </SectionLabel>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Distribution of trade outcomes measured in standardized risk units (R = PnL / Risk).
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3 text-xs font-mono-num">
          <div className="flex flex-col items-end">
            <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>Avg Win R</span>
            <span className="font-bold text-emerald-600 dark:text-[#3FA88C]">+{rData.avgWinR}R</span>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-[#262B30]" />
          <div className="flex flex-col items-end">
            <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>Avg Loss R</span>
            <span className="font-bold text-rose-600 dark:text-[#C1502E]">{rData.avgLossR}R</span>
          </div>
        </div>
      </div>

      {rData.tradesWithR.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-xs gap-2" style={{ color: 'var(--color-text-muted)' }}>
          <Layers size={24} style={{ color: 'var(--color-text-dim)' }} />
          <span>Record closed trades to view your R-multiple outcome histogram.</span>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={rData.buckets} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid stroke="var(--color-border-soft)" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                axisLine={{ stroke: 'var(--color-border-soft)' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--color-text-dim)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
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
                        <div className="font-bold" style={{ color: 'var(--color-text-main)' }}>Bucket: {data.range}</div>
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ color: 'var(--color-text-muted)' }}>Trade Count:</span>
                          <span className="font-bold text-amber-600 dark:text-[#C9A227]">{data.count} trade(s)</span>
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                          {data.isWin ? 'Profitable outcome zone' : data.isLoss ? 'Loss zone' : 'Breakeven zone'}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {rData.buckets.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Skewness Diagnostic Advice */}
          <div className="p-3 rounded-xl border flex items-start gap-2.5 text-xs leading-relaxed" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <Activity size={16} className={rData.skewness >= 0 ? 'text-emerald-600 dark:text-[#3FA88C] mt-0.5 shrink-0' : 'text-rose-600 dark:text-[#C1502E] mt-0.5 shrink-0'} />
            <div>
              <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>Trade Management Diagnostic: </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{rData.skewnessDesc}</span>
              {rData.skewness < -0.3 && (
                <span className="block text-rose-600 dark:text-[#C1502E] font-medium mt-1">
                  ⚠ Actionable Fix: Do not close winning trades prematurely at +0.3R when your stop is full -1.0R. Hold for designated target levels or trail stops behind structural pivots.
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
