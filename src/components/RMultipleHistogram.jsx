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
                ? 'bg-[#152E25] text-[#3FA88C] border border-[#3FA88C]/40'
                : rData.skewness < -0.3
                ? 'bg-[#4A2A1E] text-[#C1502E] border border-[#C1502E]/40'
                : 'bg-[#1B1F23] text-[#8B8D91] border border-[#262B30]'
            }`}>
              {rData.skewness > 0.3 ? <ShieldCheck size={11} /> : rData.skewness < -0.3 ? <AlertTriangle size={11} /> : null}
              {rData.skewnessType}
            </span>
          }>
            R-Multiple Distribution &amp; Asymmetry Histogram
          </SectionLabel>
          <p className="text-xs text-[#8B8D91] mt-0.5">
            Distribution of trade outcomes measured in standardized risk units (R = PnL / Risk).
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3 text-xs font-mono-num">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#5A5D61]">Avg Win R</span>
            <span className="font-bold text-[#3FA88C]">+{rData.avgWinR}R</span>
          </div>
          <div className="h-6 w-px bg-[#262B30]" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#5A5D61]">Avg Loss R</span>
            <span className="font-bold text-[#C1502E]">{rData.avgLossR}R</span>
          </div>
        </div>
      </div>

      {rData.tradesWithR.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-xs text-[#8B8D91] gap-2">
          <Layers size={24} className="text-[#5A5D61]" />
          <span>Record closed trades to view your R-multiple outcome histogram.</span>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={rData.buckets} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
              <CartesianGrid stroke="#1E2226" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fill: '#8B8D91', fontSize: 10 }}
                axisLine={{ stroke: '#1E2226' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#5A5D61', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#1B1F23] border border-[#262B30] rounded-lg p-2.5 shadow-xl text-xs font-mono-num space-y-1">
                        <div className="font-bold text-[#EDEAE3]">Bucket: {data.range}</div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#8B8D91]">Trade Count:</span>
                          <span className="font-bold text-[#C9A227]">{data.count} trade(s)</span>
                        </div>
                        <div className="text-[10px] text-[#5A5D61]">
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
          <div className="p-3 rounded-lg bg-[#131619] border border-[#262B30] flex items-start gap-2.5 text-xs leading-relaxed">
            <Activity size={16} className={rData.skewness >= 0 ? 'text-[#3FA88C] mt-0.5 shrink-0' : 'text-[#C1502E] mt-0.5 shrink-0'} />
            <div>
              <span className="font-semibold text-[#EDEAE3]">Trade Management Diagnostic: </span>
              <span className="text-[#8B8D91]">{rData.skewnessDesc}</span>
              {rData.skewness < -0.3 && (
                <span className="block text-[#C1502E] font-medium mt-1">
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
