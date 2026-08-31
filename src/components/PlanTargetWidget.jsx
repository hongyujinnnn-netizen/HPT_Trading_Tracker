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
  PlusCircle,
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#161B20] via-[#121518] to-[#0E1013] border border-[#262B30] p-5 shadow-2xl transition-all duration-300 hover:border-[#C9A227]/40 group">
      {/* Top subtle golden highlight line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#C9A227]/50 to-transparent" />

      {/* Ambient background glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#C9A227]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#C9A227]/8 transition-all duration-500" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#3FA88C]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Card Content */}
      <div className="relative z-10 space-y-5">
        {/* Top Header: Badge, Title, Status, CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-num uppercase tracking-wider bg-[#C9A227]/10 text-[#C9A227] border border-[#C9A227]/25 flex items-center gap-1">
                <Target size={11} className="text-[#C9A227]" />
                Micro Account Roadmap
              </span>

              {isAchieved && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-num bg-[#3FA88C]/15 text-[#3FA88C] border border-[#3FA88C]/30 flex items-center gap-1 animate-pulse">
                  <CheckCircle2 size={11} />
                  Goal Reached!
                </span>
              )}
              {isFloorBreached && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono-num bg-[#C1502E]/20 text-[#C1502E] border border-[#C1502E]/40 flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={11} />
                  Floor Breached
                </span>
              )}
              {isDrawdown && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-num bg-[#E5A93C]/10 text-[#E5A93C] border border-[#E5A93C]/20 flex items-center gap-1">
                  Recovery Phase
                </span>
              )}
              {!isAchieved && !isFloorBreached && !isDrawdown && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-num text-[#3FA88C] bg-[#3FA88C]/10 border border-[#3FA88C]/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3FA88C] animate-ping" />
                  On Track
                </span>
              )}
            </div>

            <h3 className="text-base font-bold font-display text-[#EDEAE3] tracking-tight group-hover:text-[#F3E7C4] transition-colors flex items-center gap-2">
              {activePlan.name}
            </h3>
          </div>

          {/* Top-Right Action Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePage('targetplan')}
              className="px-3.5 py-1.5 rounded-xl bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#C9A227]/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Manage Plan</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Center: Live Capital Figures & Progress Gauge */}
        <div className="bg-[#12161A]/80 border border-[#20252A] rounded-xl p-4 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            {/* Main Capital Figure */}
            <div>
              <span className="text-[11px] font-mono-num text-[#8B8D91] uppercase tracking-wider block">
                Current Capital / Target Goal
              </span>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-bold font-mono-num text-[#EDEAE3] tracking-tight">
                  ${m.currentEquity.toFixed(2)}
                </span>
                <span className="text-xs font-mono-num text-[#8B8D91]">
                  / <strong className="text-[#C9A227]">${activePlan.targetBalance.toFixed(2)}</strong>
                </span>
                <span
                  className={`text-xs font-mono-num font-bold px-1.5 py-0.5 rounded ${
                    m.realizedPnl >= 0
                      ? 'bg-[#3FA88C]/15 text-[#3FA88C]'
                      : 'bg-[#C1502E]/15 text-[#C1502E]'
                  }`}
                >
                  {m.realizedPnl >= 0 ? '+' : ''}${m.realizedPnl.toFixed(2)} ({m.currentRoiPct}%)
                </span>
              </div>
            </div>

            {/* Quick Distance Pill */}
            <div className="text-left sm:text-right font-mono-num">
              <span className="text-[11px] text-[#8B8D91] block">Remaining Distance</span>
              <span className="text-sm font-bold text-[#C9A227]">
                ${m.remainingGain.toFixed(2)} to double
              </span>
            </div>
          </div>

          {/* Modern Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full bg-[#0A0C0E] rounded-full overflow-hidden p-0.5 border border-[#262B30] relative">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isAchieved
                    ? 'bg-gradient-to-r from-[#3FA88C] to-[#C9A227]'
                    : isFloorBreached
                    ? 'bg-[#C1502E]'
                    : isDrawdown
                    ? 'bg-[#E5A93C]'
                    : 'bg-gradient-to-r from-[#C9A227] via-[#E4C468] to-[#3FA88C]'
                }`}
                style={{ width: `${Math.max(3, Math.min(100, m.progressPct))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono-num text-[#8B8D91]">
              <span>Start: ${activePlan.startingBalance}</span>
              <span className="text-[#C9A227] font-bold">{m.progressPct}% Achieved</span>
              <span>Goal: ${activePlan.targetBalance}</span>
            </div>
          </div>

          {/* 4-Stage Milestone Stepper */}
          <div className="pt-2 border-t border-[#1E2328] grid grid-cols-4 gap-1 sm:gap-2">
            {m.milestones.map((stg) => {
              const isDone = stg.isCompleted;
              const isCurrent = stg.isActive;

              return (
                <div
                  key={stg.stage}
                  className={`p-2 rounded-lg text-center transition-all ${
                    isDone
                      ? 'bg-[#15231E]/70 border border-[#265C50]/50 text-[#3FA88C]'
                      : isCurrent
                      ? 'bg-[#2A2311]/80 border border-[#C9A227] text-[#EDEAE3] ring-1 ring-[#C9A227]/30'
                      : 'bg-[#161A1E]/40 border border-[#20252A] text-[#8B8D91] opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono-num ${
                        isDone
                          ? 'bg-[#3FA88C] text-[#0A0C0E]'
                          : isCurrent
                          ? 'bg-[#C9A227] text-[#0A0C0E]'
                          : 'bg-[#262B30] text-[#8B8D91]'
                      }`}
                    >
                      {isDone ? '✓' : stg.stage}
                    </span>
                    <span className="text-[10px] font-bold truncate">
                      {stg.stage === m.milestones.length ? 'Goal' : `L${stg.stage}`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono-num font-bold block truncate">
                    ${stg.stageTarget}
                  </span>
                  <span className="text-[9px] font-mono-num text-[#8B8D91] block truncate">
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
          <div className="p-3 rounded-xl bg-[#14181B] border border-[#20252A] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8B8D91] flex items-center gap-1">
                <Zap size={12} className="text-[#C9A227]" /> Next Safe Trade
              </span>
              <button
                onClick={handleSendToTrade}
                title="Send pre-calculated sizing to Add Trade form"
                className="text-[10px] text-[#C9A227] hover:underline font-mono-num flex items-center gap-0.5"
              >
                <span>Use in Form</span>
                <ChevronRight size={11} />
              </button>
            </div>
            <div className="flex items-baseline justify-between font-mono-num">
              <div>
                <span className="text-sm font-bold text-[#EDEAE3]">
                  {m.nextTradeSize.lotSize} Lots
                </span>
                <span className="text-[10px] text-[#8B8D91] block">Gold Micro-Sized</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#C9A227]">
                  ${m.nextTradeSize.riskDollar.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#8B8D91] block">
                  {activePlan.riskPerTradePct}% Risk Budget
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Daily Circuit Breaker */}
          <div className="p-3 rounded-xl bg-[#14181B] border border-[#20252A] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8B8D91] flex items-center gap-1">
                <Clock size={12} className="text-[#8B8D91]" /> Daily Circuit Breaker
              </span>
              <span className="text-[10px] font-mono-num text-[#8B8D91]">
                Max {activePlan.maxDailyLossPct}%
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono-num">
              <div>
                <span
                  className={`text-sm font-bold ${
                    m.dailyRisk.isDailyLimitBreached ? 'text-[#C1502E]' : 'text-[#EDEAE3]'
                  }`}
                >
                  ${Math.abs(m.dailyRisk.todayPnl).toFixed(2)}
                </span>
                <span className="text-[10px] text-[#8B8D91] block">Today Realized</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#EDEAE3]">
                  ${m.dailyRisk.maxAllowedDailyLoss.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#8B8D91] block">
                  {m.dailyRisk.remainingDailyRisk > 0
                    ? `$${m.dailyRisk.remainingDailyRisk} left`
                    : 'Stop limit hit'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Capital Preservation Floor */}
          <div className="p-3 rounded-xl bg-[#14181B] border border-[#20252A] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8B8D91] flex items-center gap-1">
                <Shield size={12} className="text-[#3FA88C]" /> Preservation Floor
              </span>
              <span className="text-[10px] font-mono-num text-[#3FA88C]">
                +{m.drawdownCushionPct}% Cushion
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono-num">
              <div>
                <span className="text-sm font-bold text-[#C1502E]">
                  ${activePlan.drawdownFloor.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#8B8D91] block">Hard Stop Level</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#3FA88C]">
                  +${m.drawdownCushion.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#8B8D91] block">Above Stop Floor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
