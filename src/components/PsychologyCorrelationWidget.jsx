import React, { useMemo } from 'react';
import { Heart, AlertTriangle, ShieldCheck, TrendingDown, DollarSign } from 'lucide-react';
import { calculatePsychologyStats } from '../utils/edgeAnalytics';
import { SectionLabel } from './SectionLabel';
import { Pill } from './Pill';

export function PsychologyCorrelationWidget({ trades = [] }) {
  const psychData = useMemo(() => {
    return calculatePsychologyStats(trades);
  }, [trades]);

  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262B30] pb-3">
        <div>
          <SectionLabel right={
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-bold flex items-center gap-1 ${
              psychData.isDisciplinedDominant
                ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#152E25] dark:text-[#3FA88C] border border-emerald-500/30 dark:border-[#3FA88C]/40'
                : 'bg-rose-500/15 text-rose-700 dark:bg-[#4A2A1E] dark:text-[#C1502E] border border-rose-500/30 dark:border-[#C1502E]/40'
            }`}>
              {psychData.isDisciplinedDominant ? <ShieldCheck size={11} /> : <AlertTriangle size={11} />}
              {psychData.isDisciplinedDominant ? 'Discipline Ahead' : 'Behavioral Leak Detected'}
            </span>
          }>
            Psychology &amp; Behavioral P&amp;L Correlation
          </SectionLabel>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Compare returns between planned executions and emotional trading states (FOMO, Revenge, Impulsive).
          </p>
        </div>

        {psychData.totalEmotionalPnl < 0 && (
          <div className="text-right">
            <span className="text-[10px] block" style={{ color: 'var(--color-text-dim)' }}>Cost of Emotional Leaks</span>
            <span className="text-xs font-bold font-mono-num text-rose-600 dark:text-[#C1502E]">
              -${Math.abs(psychData.totalEmotionalPnl).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {psychData.emotionList.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-xs gap-2" style={{ color: 'var(--color-text-muted)' }}>
          <Heart size={24} style={{ color: 'var(--color-text-dim)' }} />
          <span>Tag your trades with emotional states (Planned, FOMO, Revenge) to unlock psychology analytics.</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {psychData.emotionList.map((item) => {
            const isPlanned = item.emotion.toLowerCase().includes('plan');
            const isProfit = item.totalPnl >= 0;

            return (
              <div
                key={item.emotion}
                className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors hover:border-emerald-500/30"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${isPlanned ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div>
                    <div className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                      <span>{item.emotion}</span>
                      {isPlanned && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-700 dark:bg-[#152E25] dark:text-[#3FA88C] font-mono-num">
                          Rule-Compliant
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                      {item.count} trade(s) · {item.winRate}% win rate ({item.wins}W / {item.losses}L)
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono-num">
                  <div className="text-right">
                    <span className="text-[10px] text-[#5A5D61] block">Avg / Trade</span>
                    <span className={`font-semibold ${item.avgPnl >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                      {item.avgPnl >= 0 ? '+' : ''}${item.avgPnl}
                    </span>
                  </div>

                  <div className="text-right min-w-20">
                    <span className="text-[10px] text-[#5A5D61] block">Net P&amp;L</span>
                    <span className={`text-sm font-bold ${isProfit ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                      {isProfit ? '+' : ''}${item.totalPnl.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
