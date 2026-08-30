import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertOctagon, TrendingDown, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { calculateUnderwaterDrawdown } from '../utils/edgeAnalytics';
import { SectionLabel } from './SectionLabel';

export function UnderwaterDrawdownChart({ trades = [], initialBalance = 10000, circuitBreakerPct = 10 }) {
  const ddData = useMemo(() => {
    return calculateUnderwaterDrawdown(trades, initialBalance, circuitBreakerPct);
  }, [trades, initialBalance, circuitBreakerPct]);

  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262B30] pb-3">
        <div>
          <SectionLabel right={
            ddData.circuitBreakerHit ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#4A2A1E] text-[#C1502E] border border-[#C1502E]/40 font-bold flex items-center gap-1 animate-pulse">
                <AlertOctagon size={11} /> Circuit Breaker Tripped (&gt;{circuitBreakerPct}%)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#152E25] text-[#3FA88C] border border-[#3FA88C]/40 font-bold flex items-center gap-1">
                <CheckCircle2 size={11} /> Within Risk Budget
              </span>
            )
          }>
            Underwater Equity Curve &amp; Drawdown Duration
          </SectionLabel>
          <p className="text-xs text-[#8B8D91] mt-0.5">
            Real-time percentage drawdown from equity peak with a hard -{circuitBreakerPct}% capital preservation circuit breaker.
          </p>
        </div>

        {/* Current Drawdown KPI */}
        <div className="flex items-center gap-3 font-mono-num text-xs">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#5A5D61]">Current Drawdown</span>
            <span className={`font-bold ${ddData.currentDrawdownPct > 5 ? 'text-[#C1502E]' : 'text-[#EDEAE3]'}`}>
              -{ddData.currentDrawdownPct}%
            </span>
          </div>
          <div className="h-6 w-px bg-[#262B30]" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#5A5D61]">Max Historical DD</span>
            <span className="font-bold text-[#C1502E]">-{ddData.maxDrawdownPct}%</span>
          </div>
        </div>
      </div>

      {ddData.points.length <= 1 ? (
        <div className="h-52 flex flex-col items-center justify-center text-xs text-[#8B8D91] gap-2">
          <TrendingDown size={24} className="text-[#5A5D61]" />
          <span>No drawdown records available yet. Keep discipline high!</span>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ddData.points} margin={{ left: -15, right: 15, top: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="underwaterGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C1502E" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#C1502E" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1E2226" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#5A5D61', fontSize: 10 }}
                axisLine={{ stroke: '#1E2226' }}
                tickLine={false}
              />
              <YAxis
                domain={[-Math.max(15, Math.ceil(ddData.maxDrawdownPct / 5) * 5), 0]}
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
                      <div className="bg-[#1B1F23] border border-[#262B30] rounded-lg p-2.5 shadow-xl text-xs font-mono-num space-y-1">
                        <div className="font-bold text-[#EDEAE3]">Date: {data.date} (Trade #{data.tradeIndex})</div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#8B8D91]">Drawdown:</span>
                          <span className="font-bold text-[#C1502E]">{data.drawdownPct}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#8B8D91]">Drawdown ($):</span>
                          <span className="text-[#C1502E]">-${data.drawdownDollar}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#8B8D91]">Peak Equity:</span>
                          <span className="text-[#3FA88C]">${data.peak}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#8B8D91]">Running Equity:</span>
                          <span className="text-[#EDEAE3]">${data.balance}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* 0% Baseline */}
              <ReferenceLine y={0} stroke="#3FA88C" strokeWidth={1} />
              {/* Hard Red -10% Circuit Breaker Line */}
              <ReferenceLine
                y={-circuitBreakerPct}
                stroke="#C1502E"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: `Circuit Breaker -${circuitBreakerPct}%`,
                  fill: '#C1502E',
                  position: 'right',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />
              <Area
                type="monotone"
                dataKey="drawdownPct"
                stroke="#C1502E"
                strokeWidth={2}
                fill="url(#underwaterGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Drawdown Episodes & Recovery Log */}
          {ddData.episodes.length > 0 && (
            <div className="pt-3 border-t border-[#1E2226] space-y-2">
              <div className="flex items-center justify-between text-xs text-[#8B8D91]">
                <span className="font-semibold text-[#EDEAE3] flex items-center gap-1.5">
                  <Clock size={13} className="text-[#C9A227]" />
                  Drawdown Duration &amp; Recovery Episodes
                </span>
                <span className="font-mono-num text-[10px]">
                  {ddData.episodes.filter(e => e.recovered).length} recovered · {ddData.episodes.filter(e => !e.recovered).length} ongoing
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ddData.episodes.slice(0, 3).map((ep, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] text-xs font-mono-num space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#C1502E] font-bold">-{Math.round(ep.maxDepthPct * 10) / 10}%</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        ep.recovered ? 'bg-[#152E25] text-[#3FA88C]' : 'bg-[#4A2A1E] text-[#C1502E] animate-pulse'
                      }`}>
                        {ep.recovered ? 'Recovered' : 'Ongoing'}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8B8D91] flex items-center justify-between">
                      <span>Start: {ep.startDate}</span>
                      <span>{ep.recoveryDate ? `End: ${ep.recoveryDate}` : ''}</span>
                    </div>
                    <div className="text-[10px] text-[#5A5D61]">
                      Duration: {ep.durationTrades} trade(s) · Depth: -${Math.round(ep.maxDepthDollar)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
