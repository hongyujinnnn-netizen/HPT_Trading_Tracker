import React from 'react';
import {
  Target,
  ArrowRight,
  Shield,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
  ChevronRight,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';

export function PlanTargetWidget() {
  const {
    activePlan,
    activePlanMetrics,
    setActivePage,
    setTradeDraft,
    liveGoldPrice,
    settings,
  } = useTrade();

  if (!activePlan || !activePlanMetrics) {
    return null;
  }

  const m = activePlanMetrics;
  const isAchieved = m.status === 'achieved';
  const isFloorBreached = m.status === 'floor_breached';
  const isDrawdown = m.status === 'drawdown' && !isFloorBreached;

  const handleSendToTrade = (e) => {
    e.stopPropagation();
    const entry = liveGoldPrice ? parseFloat(liveGoldPrice.toFixed(2)) : 2700.0;
    const stopDist = m.nextTradeSize?.stopDist || 2.0;
    const sl = parseFloat((entry - stopDist).toFixed(2));
    const tp = parseFloat((entry + (m.nextTradeSize?.targetDistancePoints || 4.0)).toFixed(2));

    setTradeDraft({
      side: 'Buy',
      entryPrice: entry.toFixed(2),
      stopLoss: sl.toFixed(2),
      takeProfit: tp.toFixed(2),
      lotSize: m.nextTradeSize?.lotSize?.toString() || '0.01',
      strategy: 'Breakout',
      accountId: activePlan.accountId !== 'all' ? activePlan.accountId : null,
      notes: `Target Plan: ${activePlan.name} | Safe Risk: $${m.nextTradeSize?.riskDollar} (${activePlan.riskPerTradePct}%)`,
    });
    setActivePage('add');
  };

  return (
    <div
      className="terminal-card relative overflow-hidden rounded-2xl p-5 shadow-xl transition-all duration-300 group"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-soft)',
      }}
    >
      {/* Top subtle golden highlight line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#C9A227]/50 to-transparent" />

      {/* Card Content */}
      <div className="relative z-10 space-y-5">
        {/* Top Header: Badge, Title, Status, CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono-num uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-[#E5B83B] border border-amber-500/30 flex items-center gap-1">
                <Target size={11} className="text-amber-500" />
                Micro Account Roadmap
              </span>

              {isAchieved && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono-num bg-emerald-500/15 text-emerald-600 dark:text-[#34D399] border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                  <CheckCircle2 size={11} />
                  Goal Reached!
                </span>
              )}
              {isFloorBreached && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono-num bg-rose-500/15 text-rose-600 dark:text-[#FB7185] border border-rose-500/30 flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={11} />
                  Floor Breached
                </span>
              )}
              {isDrawdown && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-num bg-amber-500/15 text-amber-600 dark:text-[#E5B83B] border border-amber-500/30 flex items-center gap-1">
                  Recovery Phase
                </span>
              )}
              {!isAchieved && !isFloorBreached && !isDrawdown && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-num text-emerald-600 dark:text-[#34D399] bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  On Track
                </span>
              )}
            </div>

            <h3
              className="text-base font-bold font-display tracking-tight transition-colors flex items-center gap-2"
              style={{ color: 'var(--color-text-main)' }}
            >
              {activePlan.name}
            </h3>
          </div>

          {/* Top-Right Action Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePage('targetplan')}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#C9A227] via-[#E4C468] to-[#C9A227] hover:brightness-110 text-[#080A0D] font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#C9A227]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Manage Plan</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Center: Live Capital Figures & Progress Gauge */}
        <div
          className="rounded-xl p-4 space-y-3.5 border shadow-sm"
          style={{
            background: 'var(--color-elevated)',
            borderColor: 'var(--color-border-soft)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            {/* Main Capital Figure */}
            <div>
              <span className="text-[11px] font-mono-num uppercase tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
                Current Capital / Target Goal
              </span>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-bold font-mono-num tracking-tight" style={{ color: 'var(--color-text-main)' }}>
                  ${Number(m.currentEquity ?? m.currentBalance ?? 0).toFixed(2)}
                </span>
                <span className="text-xs font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                  / <strong className="text-amber-600 dark:text-[#E5B83B]">${Number(activePlan.targetBalance ?? 0).toFixed(2)}</strong>
                </span>
                <span
                  className={`text-xs font-mono-num font-bold px-2 py-0.5 rounded-md border ${
                    (m.realizedPnl ?? 0) >= 0
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-[#34D399] border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-[#FB7185] border-rose-500/30'
                  }`}
                >
                  {(m.realizedPnl ?? 0) >= 0 ? '+' : ''}${Number(m.realizedPnl ?? 0).toFixed(2)} ({m.currentRoiPct ?? 0}%)
                </span>
              </div>
            </div>

            {/* Quick Distance Pill */}
            <div className="text-left sm:text-right font-mono-num">
              <span className="text-[11px] block" style={{ color: 'var(--color-text-muted)' }}>Remaining Distance</span>
              <span className="text-sm font-bold text-amber-600 dark:text-[#E5B83B]">
                ${Number(m.remainingGain ?? 0).toFixed(2)} to double
              </span>
            </div>
          </div>

          {/* Modern Progress Bar */}
          <div className="space-y-1.5">
            <div
              className="h-2.5 w-full rounded-full overflow-hidden p-0.5 border relative shadow-inner"
              style={{
                background: 'var(--color-bg)',
                borderColor: 'var(--color-border-soft)',
              }}
            >
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isAchieved
                    ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                    : isFloorBreached
                    ? 'bg-rose-500'
                    : isDrawdown
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-[#C9A227] via-[#E4C468] to-emerald-400'
                }`}
                style={{ width: `${Math.max(3, Math.min(100, m.progressPct))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
              <span>Start: ${activePlan.startingBalance}</span>
              <span className="text-amber-600 dark:text-[#E5B83B] font-bold">{m.progressPct}% Achieved</span>
              <span>Goal: ${activePlan.targetBalance}</span>
            </div>
          </div>

          {/* 4-Stage Milestone Stepper */}
          <div className="pt-2 border-t grid grid-cols-4 gap-1.5 sm:gap-2.5" style={{ borderColor: 'var(--color-border-soft)' }}>
            {m.milestones.map((stg) => {
              const isDone = stg.isCompleted;
              const isCurrent = stg.isActive;

              return (
                <div
                  key={stg.stage}
                  className={`p-2.5 rounded-xl text-center transition-all border shadow-sm ${
                    isDone
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-[#34D399]'
                      : isCurrent
                      ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-[#F3D371] ring-1 ring-amber-500/30'
                      : 'border-transparent opacity-80'
                  }`}
                  style={!isDone && !isCurrent ? {
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border-soft)',
                    color: 'var(--color-text-muted)',
                  } : undefined}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono-num shadow-xs ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D]'
                          : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {isDone ? '✓' : stg.stage}
                    </span>
                    <span className="text-[10px] font-bold truncate">
                      {stg.stage === m.milestones.length ? 'Goal' : `L${stg.stage}`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-num font-bold block truncate" style={{ color: 'var(--color-text-main)' }}>
                    ${stg.stageTarget}
                  </span>
                  <span className="text-[9px] font-mono-num block truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {stg.recommendedLot} lot
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Micro-Metrics & Next-Trade Sizing Shortcut */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Next Trade Sizing */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between space-y-2 shadow-sm"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Zap size={12} className="text-amber-500" /> Next Safe Trade
              </span>
              <button
                onClick={handleSendToTrade}
                title="Send pre-calculated sizing to Add Trade form"
                className="text-[10px] text-amber-600 dark:text-[#E5B83B] hover:underline font-mono-num flex items-center gap-0.5 font-semibold"
              >
                <span>Use in Form</span>
                <ChevronRight size={11} />
              </button>
            </div>
            <div className="flex items-baseline justify-between font-mono-num">
              <div>
                <span className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                  {m.nextTradeSize?.lotSize || '0.01'} Lots
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Gold Micro-Sized</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-amber-600 dark:text-[#E5B83B]">
                  ${Number(m.nextTradeSize?.riskDollar ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>
                  {activePlan?.riskPerTradePct || 2}% Risk Budget
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Daily Circuit Breaker */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between space-y-2 shadow-sm"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Clock size={12} className="text-slate-400" /> Daily Circuit Breaker
              </span>
              <span className="text-[10px] font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                Max {activePlan?.maxDailyLossPct || 4}%
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono-num">
              <div>
                <span
                  className={`text-sm font-bold ${
                    m.dailyRisk?.isDailyLimitBreached
                      ? 'text-rose-600 dark:text-[#FB7185]'
                      : ''
                  }`}
                  style={!m.dailyRisk?.isDailyLimitBreached ? { color: 'var(--color-text-main)' } : undefined}
                >
                  ${Math.abs(Number(m.dailyRisk?.todayPnl ?? 0)).toFixed(2)}
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Today Realized</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                  ${Number(m.dailyRisk?.maxAllowedDailyLoss ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>
                  {(m.dailyRisk?.remainingDailyRisk ?? 0) > 0
                    ? `$${Number(m.dailyRisk.remainingDailyRisk).toFixed(2)} left`
                    : 'Stop limit hit'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Capital Preservation Floor */}
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between space-y-2 shadow-sm"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Shield size={12} className="text-emerald-500" /> Preservation Floor
              </span>
              <span className="text-[10px] font-mono-num text-emerald-600 dark:text-[#34D399] font-bold">
                +{m.drawdownCushionPct || 0}% Cushion
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono-num">
              <div>
                <span className="text-sm font-bold text-rose-600 dark:text-[#FB7185]">
                  ${Number(activePlan?.drawdownFloor ?? m.floor ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Hard Stop Level</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-emerald-600 dark:text-[#34D399]">
                  {(m.drawdownCushion ?? 0) >= 0 ? '+' : ''}${Number(m.drawdownCushion ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Above Stop Floor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
