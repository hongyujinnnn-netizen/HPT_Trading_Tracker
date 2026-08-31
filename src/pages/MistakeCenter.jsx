import React, { useMemo } from 'react';
import { AlertTriangle, Flame, DollarSign, ShieldAlert, Award, RefreshCw } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from '../components/Pill';
import { StatCard } from '../components/StatCard';
import { SectionLabel } from '../components/SectionLabel';
import { MISTAKE_TYPES } from '../utils/mistakeDetector';

export function MistakeCenter() {
  const { trades, filteredTrades: contextFilteredTrades } = useTrade();

  const activeTrades = contextFilteredTrades || trades;

  // Compute total cost and count of mistakes
  const mistakeAnalysis = useMemo(() => {
    const counts = {
      [MISTAKE_TYPES.NO_STOP_LOSS]: 0,
      [MISTAKE_TYPES.OVERTRADING]: 0,
      [MISTAKE_TYPES.REVENGE_TRADE]: 0,
      [MISTAKE_TYPES.NEWS_GAMBLING]: 0,
      [MISTAKE_TYPES.BAD_ENTRY]: 0,
    };

    let totalMistakeCost = 0;
    let flaggedTradeCount = 0;

    activeTrades.forEach((t) => {
      if (t.mistakes && t.mistakes.length > 0) {
        flaggedTradeCount++;
        if (t.pnl < 0) {
          totalMistakeCost += Math.abs(t.pnl);
        }
        t.mistakes.forEach((m) => {
          if (counts[m] !== undefined) {
            counts[m]++;
          }
        });
      }
    });

    const disciplineScore = activeTrades.length > 0 ? Math.round(((activeTrades.length - flaggedTradeCount) / activeTrades.length) * 100) : 100;

    return { counts, totalMistakeCost, flaggedTradeCount, disciplineScore };
  }, [activeTrades]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display" style={{ color: 'var(--color-text-main)' }}>Mistake Detector &amp; Discipline Center</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Automated rule engine audit identifying your behavioral trading leaks and their dollar cost
        </p>
      </div>

      {/* Discipline Score Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Discipline Score"
          value={`${mistakeAnalysis.disciplineScore}%`}
          sub={`${trades.length - mistakeAnalysis.flaggedTradeCount} of ${trades.length} trades fully compliant`}
          icon={Award}
          tone={mistakeAnalysis.disciplineScore >= 75 ? 'profit' : 'loss'}
        />

        <StatCard
          label="Total Cost of Mistakes"
          value={`-$${mistakeAnalysis.totalMistakeCost.toLocaleString()}`}
          sub="Dollar losses attributed to emotional/flawed entries"
          icon={DollarSign}
          tone="loss"
        />

        <StatCard
          label="Flagged Trades"
          value={`${mistakeAnalysis.flaggedTradeCount} trades`}
          sub="Trades containing 1 or more rule breaches"
          icon={AlertTriangle}
          tone="gold"
        />
      </div>

      {/* Mistake Category Breakdown Grid */}
      <div className="terminal-card p-5 space-y-4">
        <SectionLabel>Mistake Breakdown by Leak Type</SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: MISTAKE_TYPES.NO_STOP_LOSS,
              desc: 'Trade executed without a defined stop loss or SL removed after entry.',
              count: mistakeAnalysis.counts[MISTAKE_TYPES.NO_STOP_LOSS],
            },
            {
              title: MISTAKE_TYPES.OVERTRADING,
              desc: '>3 trades opened within 60 mins or >5 trades executed in a single day.',
              count: mistakeAnalysis.counts[MISTAKE_TYPES.OVERTRADING],
            },
            {
              title: MISTAKE_TYPES.REVENGE_TRADE,
              desc: 'Immediate re-entry within 15 mins after a loss with equal or scaled lot size.',
              count: mistakeAnalysis.counts[MISTAKE_TYPES.REVENGE_TRADE],
            },
            {
              title: MISTAKE_TYPES.NEWS_GAMBLING,
              desc: 'Entry executed within ±15 minutes of a High-Impact USD economic event.',
              count: mistakeAnalysis.counts[MISTAKE_TYPES.NEWS_GAMBLING],
            },
            {
              title: MISTAKE_TYPES.BAD_ENTRY,
              desc: 'Risk-Reward ratio < 1.0 at entry or entry chased beyond strategy trigger.',
              count: mistakeAnalysis.counts[MISTAKE_TYPES.BAD_ENTRY],
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold font-display flex items-center gap-1.5" style={{ color: 'var(--color-text-main)' }}>
                    <AlertTriangle size={14} className="text-rose-600 dark:text-[#C1502E]" /> {item.title}
                  </span>
                  <Pill tone={item.count > 0 ? 'loss' : 'profit'}>{item.count} flagged</Pill>
                </div>
                <p className="text-xs font-body leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
