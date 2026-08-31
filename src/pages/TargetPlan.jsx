import React, { useState, useMemo } from 'react';
import {
  Target,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  Calculator,
  ChevronRight,
  DollarSign,
  Percent,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { useTrade } from '../context/TradeContext';
import { PLAN_PRESETS, createTargetPlan } from '../types/planSchema';
import { calculateNextTradeSize } from '../utils/planCalculations';

export function TargetPlan() {
  const {
    targetPlans,
    activePlan,
    activePlanMetrics,
    activePlanId,
    setActivePlanId,
    createTargetPlan: addPlan,
    updateTargetPlan: editPlan,
    deleteTargetPlan: removePlan,
    resetTargetPlan: resetPlan,
    tradingAccounts,
    setTradeDraft,
    setActivePage,
    liveGoldPrice,
    settings,
  } = useTrade();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPlanData, setEditingPlanData] = useState(null);
  const [customStopLossPoints, setCustomStopLossPoints] = useState(2.0); // $2.00 = 20 pips
  const [selectedPresetId, setSelectedPresetId] = useState('preset_micro_doubler');

  // Form State for Create/Edit Modal
  const [formState, setFormState] = useState({
    name: 'Small Account Doubler ($50 ➔ $100)',
    accountId: 'all',
    startingBalance: 50,
    targetBalance: 100,
    riskPerTradePct: 2.0,
    targetRR: 2.0,
    maxDailyLossPct: 4.0,
    drawdownFloor: 40,
    maxOpenTrades: 1,
    milestoneStages: 4,
  });

  const handleOpenCreateModal = (presetId = 'preset_micro_doubler') => {
    const preset = PLAN_PRESETS.find((p) => p.id === presetId) || PLAN_PRESETS[0];
    setSelectedPresetId(presetId);
    setEditingPlanData(null);
    setFormState({
      name: preset.name,
      accountId: 'all',
      startingBalance: preset.startingBalance,
      targetBalance: preset.targetBalance,
      riskPerTradePct: preset.riskPerTradePct,
      targetRR: preset.targetRR,
      maxDailyLossPct: preset.maxDailyLossPct,
      drawdownFloor: preset.drawdownFloor,
      maxOpenTrades: preset.maxOpenTrades,
      milestoneStages: preset.milestoneStages,
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (!activePlan) return;
    setEditingPlanData(activePlan);
    setFormState({
      name: activePlan.name,
      accountId: activePlan.accountId || 'all',
      startingBalance: activePlan.startingBalance,
      targetBalance: activePlan.targetBalance,
      riskPerTradePct: activePlan.riskPerTradePct,
      targetRR: activePlan.targetRR,
      maxDailyLossPct: activePlan.maxDailyLossPct,
      drawdownFloor: activePlan.drawdownFloor,
      maxOpenTrades: activePlan.maxOpenTrades,
      milestoneStages: activePlan.milestoneStages,
    });
    setIsCreateModalOpen(true);
  };

  const handleApplyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setFormState((prev) => ({
      ...prev,
      name: preset.name,
      startingBalance: preset.startingBalance,
      targetBalance: preset.targetBalance,
      riskPerTradePct: preset.riskPerTradePct,
      targetRR: preset.targetRR,
      maxDailyLossPct: preset.maxDailyLossPct,
      drawdownFloor: preset.drawdownFloor,
      maxOpenTrades: preset.maxOpenTrades,
      milestoneStages: preset.milestoneStages,
    }));
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (editingPlanData) {
      await editPlan(editingPlanData.id, formState);
    } else {
      await addPlan(formState);
    }
    setIsCreateModalOpen(false);
  };

  const metrics = activePlanMetrics;

  // Custom Next Trade Sizing based on user's current custom stop loss points
  const liveSizing = useMemo(() => {
    if (!activePlan || !metrics) return null;
    return calculateNextTradeSize(
      activePlan,
      metrics.currentEquity,
      customStopLossPoints,
      settings.contractSize || 100
    );
  }, [activePlan, metrics, customStopLossPoints, settings.contractSize]);

  // Bridge to Add Trade Form
  const handleSendToTrade = () => {
    if (!liveSizing) return;
    const entry = liveGoldPrice ? parseFloat(liveGoldPrice.toFixed(2)) : 2700.0;
    const sl = parseFloat((entry - liveSizing.stopDist).toFixed(2));
    const tp = parseFloat((entry + liveSizing.targetDistancePoints).toFixed(2));

    setTradeDraft({
      side: 'Buy',
      entryPrice: entry.toFixed(2),
      stopLoss: sl.toFixed(2),
      takeProfit: tp.toFixed(2),
      lotSize: liveSizing.lotSize.toString(),
      strategy: 'Breakout',
      accountId: activePlan.accountId !== 'all' ? activePlan.accountId : null,
      notes: `Target Plan: ${activePlan.name} | Planned Risk: $${liveSizing.riskDollar} (${liveSizing.riskPct}%)`,
    });
    setActivePage('add');
  };

  // Bridge to Risk Calculator
  const handleOpenInRiskCalc = () => {
    setActivePage('risk');
  };

  // Rule checkbox toggle
  const handleToggleRule = async (ruleId) => {
    if (!activePlan) return;
    const updatedRules = (activePlan.rules || []).map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    await editPlan(activePlan.id, { rules: updatedRules });
  };

  if (!activePlan || !metrics) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center space-y-4 animate-fade-in">
        <Target size={48} className="mx-auto text-[#C9A227] animate-pulse" />
        <h2 className="text-xl font-bold text-[#EDEAE3]">No Target Plan Active</h2>
        <p className="text-xs text-[#8B8D91] max-w-md mx-auto">
          Start your account growth roadmap. Build a disciplined plan from \$50 to \$100 with institutional risk rules.
        </p>
        <button
          onClick={() => handleOpenCreateModal('preset_micro_doubler')}
          className="px-4 py-2.5 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs inline-flex items-center gap-2 transition-all shadow-md"
        >
          <Plus size={16} /> Create \$50 ➔ \$100 Target Plan
        </button>
      </div>
    );
  }

  const isAchieved = metrics.status === 'achieved';
  const isFloorBreached = metrics.status === 'floor_breached';
  const isDrawdown = metrics.status === 'drawdown';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Top Header & Plan Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-num uppercase tracking-wider bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30 flex items-center gap-1">
              <Target size={12} /> Target Planner &amp; Risk Guard
            </span>
            {isAchieved && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-num bg-[#3FA88C]/20 text-[#3FA88C] border border-[#3FA88C]/40 animate-pulse flex items-center gap-1">
                <CheckCircle2 size={12} /> Target Achieved
              </span>
            )}
            {isFloorBreached && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-num bg-[#C1502E]/20 text-[#C1502E] border border-[#C1502E]/40 animate-pulse flex items-center gap-1">
                <AlertTriangle size={12} /> Safety Floor Breached
              </span>
            )}
            {isDrawdown && !isFloorBreached && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono-num bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/30 flex items-center gap-1">
                Drawdown Recovery
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
            {activePlan.name}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Compounding account growth roadmap from ${activePlan.startingBalance.toFixed(2)} to ${activePlan.targetBalance.toFixed(2)} with mathematical risk guardrails.
          </p>
        </div>

        {/* Plan Switcher & Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {targetPlans.length > 1 && (
            <select
              value={activePlanId || activePlan.id}
              onChange={(e) => setActivePlanId(e.target.value)}
              aria-label="Switch active target plan"
              className="px-3 py-2 rounded-lg text-xs font-mono-num terminal-select"
            >
              {targetPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => handleOpenCreateModal('preset_micro_doubler')}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus size={14} /> New Plan
          </button>

          <button
            onClick={handleOpenEditModal}
            className="p-2 rounded-lg border transition-colors hover:opacity-80"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
            title="Edit Plan Parameters"
            aria-label="Edit Plan Parameters"
          >
            <Edit2 size={15} />
          </button>

          <button
            onClick={() => resetPlan(activePlan.id)}
            className="p-2 rounded-lg border transition-colors hover:opacity-80"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
            title="Reset Plan"
            aria-label="Reset Plan"
          >
            <RotateCcw size={15} />
          </button>

          {targetPlans.length > 1 && (
            <button
              onClick={() => {
                if (window.confirm(`Delete plan "${activePlan.name}"?`)) {
                  removePlan(activePlan.id);
                }
              }}
              className="p-2 rounded-lg border transition-colors text-rose-500 hover:bg-rose-500/10"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
              title="Delete Plan"
              aria-label="Delete Plan"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Safety Floor Breach Warning Banner */}
      {isFloorBreached && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs flex items-start gap-3 shadow-lg animate-pulse" style={{ color: 'var(--color-text-main)' }}>
          <AlertTriangle size={20} className="text-rose-600 dark:text-[#C1502E] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-rose-600 dark:text-[#C1502E]">🚨 CAPITAL PRESERVATION FLOOR BREACHED</h4>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Your balance has fallen to <strong>${metrics.currentEquity.toFixed(2)}</strong>, below your hard stop floor of <strong>${activePlan.drawdownFloor.toFixed(2)}</strong>.
              Stop taking new positions immediately. Conduct a post-mortem review of recent trades to prevent further capital erosion.
            </p>
          </div>
        </div>
      )}

      {/* Daily Loss Breached Warning Banner */}
      {metrics.dailyRisk.isDailyLimitBreached && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-3 shadow-lg">
          <AlertCircle size={20} className="text-amber-600 dark:text-[#C9A227] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-600 dark:text-[#C9A227]">⚠️ DAILY LOSS LIMIT REACHED TODAY</h4>
            <p style={{ color: 'var(--color-text-muted)' }}>
              You have accumulated <strong>-${Math.abs(metrics.dailyRisk.todayPnl).toFixed(2)}</strong> in losses today, exceeding your daily circuit breaker of <strong>${metrics.dailyRisk.maxAllowedDailyLoss.toFixed(2)}</strong> ({activePlan.maxDailyLossPct}%).
              Trading is blocked by rule. Log off and return tomorrow refreshed.
            </p>
          </div>
        </div>
      )}

      {/* HERO SECTION: Goal Progress & Capital Meter */}
      <div className="terminal-card p-6 border-l-4 border-l-[#C9A227] space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono-num uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>
              Current Capital vs Target Goal
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-3xl md:text-4xl font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>
                ${metrics.currentEquity.toFixed(2)}
              </span>
              <span className="text-xs font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                from <strong style={{ color: 'var(--color-text-main)' }}>${activePlan.startingBalance.toFixed(2)}</strong>
              </span>
              <ArrowRight size={14} style={{ color: 'var(--color-text-dim)' }} />
              <span className="text-lg font-bold font-mono-num text-amber-600 dark:text-[#C9A227]">
                Target: ${activePlan.targetBalance.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="text-[11px] block" style={{ color: 'var(--color-text-dim)' }}>Total Target Gain</span>
              <span className="text-sm font-bold font-mono-num text-emerald-600 dark:text-[#3FA88C]">
                +${metrics.totalTargetGain.toFixed(2)} (+{metrics.targetRoiPct}%)
              </span>
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--color-border-soft)' }} />
            <div>
              <span className="text-[11px] block" style={{ color: 'var(--color-text-dim)' }}>Remaining Needed</span>
              <span className="text-sm font-bold font-mono-num text-amber-600 dark:text-[#C9A227]">
                ${metrics.remainingGain.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono-num">
            <span style={{ color: 'var(--color-text-muted)' }}>
              Roadmap Progress: <strong className="text-amber-600 dark:text-[#C9A227]">{metrics.progressPct}%</strong>
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Net Plan P&amp;L:{' '}
              <strong className={metrics.realizedPnl >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}>
                {metrics.realizedPnl >= 0 ? '+' : ''}${metrics.realizedPnl.toFixed(2)} ({metrics.currentRoiPct}%)
              </strong>
            </span>
          </div>

          <div
            className="h-3 w-full rounded-full overflow-hidden p-0.5 border relative"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isAchieved
                  ? 'bg-gradient-to-r from-[#3FA88C] to-[#C9A227]'
                  : isFloorBreached
                  ? 'bg-[#C1502E]'
                  : isDrawdown
                  ? 'bg-[#E5A93C]'
                  : 'bg-gradient-to-r from-[#C9A227] to-[#3FA88C]'
              }`}
              style={{ width: `${Math.max(2, Math.min(100, metrics.progressPct))}%` }}
            />
          </div>

          {/* Progress checkpoints */}
          <div className="flex justify-between text-[10px] font-mono-num px-1" style={{ color: 'var(--color-text-dim)' }}>
            <span>Start: ${activePlan.startingBalance}</span>
            <span>25%: ${(activePlan.startingBalance + metrics.totalTargetGain * 0.25).toFixed(1)}</span>
            <span>50%: ${(activePlan.startingBalance + metrics.totalTargetGain * 0.50).toFixed(1)}</span>
            <span>75%: ${(activePlan.startingBalance + metrics.totalTargetGain * 0.75).toFixed(1)}</span>
            <span className="text-amber-600 dark:text-[#C9A227] font-bold">Goal: ${activePlan.targetBalance}</span>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <span className="text-[10px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Planned Risk / Trade</span>
            <span className="text-base font-bold font-mono-num text-amber-600 dark:text-[#C9A227]">
              {activePlan.riskPerTradePct}% (${metrics.riskAmount.toFixed(2)})
            </span>
            <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Dynamically sized</span>
          </div>

          <div className="p-3 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <span className="text-[10px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Daily Max Loss</span>
            <span className="text-base font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>
              {activePlan.maxDailyLossPct}% (${metrics.dailyLossLimit.toFixed(2)})
            </span>
            <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Circuit breaker</span>
          </div>

          <div className="p-3 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <span className="text-[10px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Preservation Floor</span>
            <span className="text-base font-bold font-mono-num text-rose-600 dark:text-[#C1502E]">
              ${activePlan.drawdownFloor.toFixed(2)}
            </span>
            <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Cushion: +${metrics.drawdownCushion.toFixed(2)} ({metrics.drawdownCushionPct}%)
            </span>
          </div>

          <div className="p-3 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <span className="text-[10px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Target Min R:R</span>
            <span className="text-base font-bold font-mono-num text-emerald-600 dark:text-[#3FA88C]">
              1:{activePlan.targetRR.toFixed(1)}
            </span>
            <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Positive expectancy</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMNS: Next Trade Sizing Assistant & Institutional Risk Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Trade Sizing Engine */}
        <div className="terminal-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-[#C9A227] flex items-center gap-2">
              <Calculator size={16} /> Next Trade Position Sizing
            </h3>
            <span
              className="text-[10px] font-mono-num px-2 py-0.5 rounded border"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
            >
              Equity: ${metrics.currentEquity.toFixed(2)}
            </span>
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Based on your active plan's risk budget ({activePlan.riskPerTradePct}%), here is your exact position sizing for your immediate next setup.
          </p>

          <div className="grid grid-cols-2 gap-3 font-mono-num text-xs">
            <div className="p-3 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <span className="block text-[11px]" style={{ color: 'var(--color-text-dim)' }}>Maximum Allowed Risk</span>
              <span className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>${liveSizing?.riskDollar.toFixed(2)}</span>
              <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{activePlan.riskPerTradePct}% of ${metrics.currentEquity.toFixed(2)}</span>
            </div>

            <div className="p-3 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <span className="block text-[11px]" style={{ color: 'var(--color-text-dim)' }}>Target Profit (1:{activePlan.targetRR})</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-[#3FA88C]">+${liveSizing?.targetDollar.toFixed(2)}</span>
              <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Reward goal</span>
            </div>
          </div>

          {/* Interactive Stop Loss Distance adjuster */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold uppercase text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Stop Loss Distance ($ Points / Pips)
              </label>
              <span className="font-mono-num font-bold" style={{ color: 'var(--color-text-main)' }}>
                ${customStopLossPoints.toFixed(2)} ({Math.round(customStopLossPoints * 10)} pips)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1.5, 2.0, 2.5, 3.0].map((pts) => {
                const isSelected = customStopLossPoints === pts;
                return (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setCustomStopLossPoints(pts)}
                    className={`py-1.5 rounded-lg text-xs font-mono-num border transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] font-bold border-amber-500 shadow-sm'
                        : 'border-[var(--color-border-soft)] hover:opacity-80'
                    }`}
                    style={!isSelected ? { background: 'var(--color-elevated)', color: 'var(--color-text-muted)' } : undefined}
                  >
                    ${pts.toFixed(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recommended Lot Size Output */}
          <div className="p-4 rounded-xl border space-y-2" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>
                  Recommended XAU/USD Lot Size
                </span>
                <span className="text-2xl font-bold font-mono-num text-amber-600 dark:text-[#C9A227]">
                  {liveSizing?.lotSize} Lots
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] block" style={{ color: 'var(--color-text-dim)' }}>Min Lot Risk</span>
                <span className="text-xs font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>
                  ${liveSizing?.actualRiskAtMinLot.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Overleveraged warning for micro accounts */}
            {liveSizing?.isOverleveragedForSmallBalance && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-start gap-2" style={{ color: 'var(--color-text-main)' }}>
                <Info size={14} className="text-amber-600 dark:text-[#C9A227] shrink-0 mt-0.5" />
                <p style={{ color: 'var(--color-text-muted)' }}>
                  <strong style={{ color: 'var(--color-text-main)' }}>Micro Account Notice:</strong> On standard broker accounts, the smallest order is 0.01 lot ($1/point move). A ${customStopLossPoints} stop risks ${liveSizing.actualRiskAtMinLot.toFixed(2)}, slightly higher than your safe ${liveSizing.riskDollar.toFixed(2)} target. Consider a cent account or wider timeframes.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons to Trade Form */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleSendToTrade}
              className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <span>Send to Add Trade</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={handleOpenInRiskCalc}
              className="py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors hover:opacity-80"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
            >
              <Calculator size={14} className="text-amber-500 dark:text-[#C9A227]" />
              <span>Full Calculator</span>
            </button>
          </div>
        </div>

        {/* Institutional Risk Guardrails Matrix */}
        <div className="terminal-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-[#3FA88C] flex items-center gap-2">
              <Shield size={16} /> Risk Management Guardrails
            </h3>
            <span className="text-[10px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>
              Rule Enforcement: Strict
            </span>
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Small accounts grow through mathematical defense, not big bets. These guardrails protect you from blowing the account during losing streaks.
          </p>

          <div className="space-y-3 text-xs">
            {/* Risk per trade rule */}
            <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <div className="space-y-0.5">
                <span className="font-bold block" style={{ color: 'var(--color-text-main)' }}>Max Risk Per Trade</span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Never risk more than {activePlan.riskPerTradePct}% per setup</span>
              </div>
              <div className="text-right font-mono-num">
                <span className="font-bold text-amber-600 dark:text-[#C9A227]">{activePlan.riskPerTradePct}%</span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-dim)' }}>(${metrics.riskAmount.toFixed(2)})</span>
              </div>
            </div>

            {/* Daily loss limit */}
            <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <div className="space-y-0.5">
                <span className="font-bold block" style={{ color: 'var(--color-text-main)' }}>Daily Circuit Breaker</span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Lock trading if daily loss reaches {activePlan.maxDailyLossPct}%</span>
              </div>
              <div className="text-right font-mono-num">
                <span className={`font-bold ${metrics.dailyRisk.isDailyLimitBreached ? 'text-rose-600 dark:text-[#C1502E]' : ''}`} style={!metrics.dailyRisk.isDailyLimitBreached ? { color: 'var(--color-text-main)' } : undefined}>
                  ${Math.abs(metrics.dailyRisk.todayPnl).toFixed(2)} / ${metrics.dailyRisk.maxAllowedDailyLoss.toFixed(2)}
                </span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-dim)' }}>
                  {metrics.dailyRisk.remainingDailyRisk > 0 ? `$${metrics.dailyRisk.remainingDailyRisk} cushion` : 'Limit reached'}
                </span>
              </div>
            </div>

            {/* Safety Floor */}
            <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <div className="space-y-0.5">
                <span className="font-bold block" style={{ color: 'var(--color-text-main)' }}>Capital Preservation Floor</span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Hard account floor to prevent total liquidation</span>
              </div>
              <div className="text-right font-mono-num">
                <span className="font-bold text-rose-600 dark:text-[#C1502E]">${activePlan.drawdownFloor.toFixed(2)}</span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-dim)' }}>+{metrics.drawdownCushionPct}% cushion</span>
              </div>
            </div>

            {/* Max concurrent positions */}
            <div className="p-3 rounded-xl border flex items-center justify-between" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <div className="space-y-0.5">
                <span className="font-bold block" style={{ color: 'var(--color-text-main)' }}>Max Concurrent Trades</span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Avoid margin over-extension</span>
              </div>
              <div className="text-right font-mono-num">
                <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{activePlan.maxOpenTrades} Position Max</span>
                <span className="text-[10px] block" style={{ color: 'var(--color-text-dim)' }}>Focus &amp; clarity</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MILESTONE LADDER: Step-by-Step Pathway */}
      <div className="terminal-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
              <TrendingUp size={16} className="text-amber-500 dark:text-[#C9A227]" /> Milestone Pathway (4 Stages)
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Break down the ${activePlan.startingBalance} ➔ ${activePlan.targetBalance} journey into achievable incremental milestones.
            </p>
          </div>
          <span className="text-xs font-mono-num text-amber-600 dark:text-[#C9A227] font-bold">
            {metrics.milestones.filter((m) => m.isCompleted).length} of {metrics.milestones.length} Cleared
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.milestones.map((m) => {
            let cardClasses = 'border opacity-80';
            let cardStyles = { background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' };
            let badgeClasses = 'border text-slate-600 dark:text-[#8B8D91] border-slate-300 dark:border-[#262B30]';
            let statusText = 'Upcoming';

            if (m.isCompleted) {
              cardClasses = 'bg-emerald-500/10 border-emerald-500/30 shadow-sm';
              cardStyles = {};
              badgeClasses = 'bg-emerald-500/20 text-emerald-700 dark:text-[#3FA88C] border-emerald-500/30 font-semibold';
              statusText = 'Completed ✓';
            } else if (m.isActive) {
              cardClasses = 'border-amber-500 ring-1 ring-amber-500/30 shadow-md';
              badgeClasses = 'bg-amber-500 text-[#080A0D] font-bold';
              statusText = 'Active Target';
            }

            return (
              <div
                key={m.stage}
                className={`p-4 rounded-xl transition-all flex flex-col justify-between space-y-3 ${cardClasses}`}
                style={cardStyles}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>
                      {m.title}
                    </span>
                    <span className="text-xl font-bold font-mono-num block mt-0.5" style={{ color: 'var(--color-text-main)' }}>
                      ${m.stageTarget.toFixed(2)}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono-num uppercase ${badgeClasses}`}>
                    {statusText}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono-num border-t pt-2" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}>
                  <div className="flex justify-between">
                    <span>Target Range:</span>
                    <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>${m.stageStart.toFixed(1)} - ${m.stageTarget.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stage Gain:</span>
                    <span className="text-emerald-600 dark:text-[#3FA88C]">+{((m.stageGain / m.stageStart) * 100).toFixed(0)}% (+${m.stageGain})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Risk / Trade:</span>
                    <span className="text-amber-600 dark:text-[#C9A227] font-semibold">${m.stageRiskAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recommended Lot:</span>
                    <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{m.recommendedLot} Lots</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPOUNDING PROJECTION CHART (Recharts) */}
      <div className="terminal-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
              <Sparkles size={16} className="text-amber-500 dark:text-[#C9A227]" /> Compounding Trajectory vs Actual Equity
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Planned roadmap compounding curve at 1:{activePlan.targetRR} Risk/Reward compared to your actual trade execution curve.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono-num">
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-[#C9A227]">
              <span className="w-3 h-0.5 bg-amber-500 dark:bg-[#C9A227] inline-block" /> Planned Compounding
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-[#3FA88C]">
              <span className="w-3 h-0.5 bg-emerald-500 dark:bg-[#3FA88C] inline-block" /> Actual Equity Path
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={metrics.projection} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" opacity={0.5} />
              <XAxis dataKey="tradeIndex" stroke="var(--color-text-dim)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--color-text-dim)" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border-soft)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: 'var(--color-text-main)',
                }}
                formatter={(val, name) => [
                  `$${Number(val).toFixed(2)}`,
                  name === 'plannedEquity' ? 'Planned Curve' : name === 'actualEquity' ? 'Actual Equity' : 'Target',
                ]}
              />
              <ReferenceLine y={activePlan.targetBalance} stroke="#C9A227" strokeDasharray="3 3" label={{ value: `Goal $${activePlan.targetBalance}`, fill: '#C9A227', fontSize: 10, position: 'top' }} />
              <ReferenceLine y={activePlan.drawdownFloor} stroke="#C1502E" strokeDasharray="3 3" label={{ value: `Stop Floor $${activePlan.drawdownFloor}`, fill: '#C1502E', fontSize: 10, position: 'bottom' }} />

              <Area type="monotone" dataKey="plannedEquity" fill="rgba(201, 162, 39, 0.08)" stroke="#C9A227" strokeWidth={2} />
              <Line type="monotone" dataKey="actualEquity" stroke="#3FA88C" strokeWidth={2.5} dot={{ fill: '#3FA88C', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DISCIPLINE & RULES OF ENGAGEMENT CHECKLIST */}
      <div className="terminal-card p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-[#3FA88C]" /> Daily Discipline Rules of Engagement
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Trading psychology and capital discipline. Every successful micro-account challenge is won by honoring these commitments.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(activePlan.rules || []).map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() => handleToggleRule(rule.id)}
              className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-colors ${
                rule.enabled
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'border-[var(--color-border-soft)] opacity-60 hover:opacity-80'
              }`}
              style={rule.enabled ? { color: 'var(--color-text-main)' } : { background: 'var(--color-elevated)', color: 'var(--color-text-muted)' }}
            >
              <div
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  rule.enabled ? 'bg-emerald-500 border-emerald-500 text-white dark:text-[#0A0C0E]' : 'border-slate-400 dark:border-[#8B8D91]'
                }`}
              >
                {rule.enabled && <Check size={12} strokeWidth={3} />}
              </div>
              <span className="text-xs font-medium">{rule.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CREATE / EDIT PLAN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="terminal-card w-full max-w-xl p-6 space-y-5 animate-scale-up border-amber-500/40 my-8">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border-soft)' }}>
              <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                <Target size={18} className="text-amber-500 dark:text-[#C9A227]" />
                {editingPlanData ? 'Edit Target Plan Parameters' : 'Create New Target Plan'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="hover:opacity-80 text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Preset Selector buttons if creating */}
            {!editingPlanData && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
                  Quick Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PLAN_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        selectedPresetId === preset.id
                          ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-[#C9A227]'
                          : 'border-[var(--color-border-soft)] hover:border-amber-500/50'
                      }`}
                      style={selectedPresetId !== preset.id ? { background: 'var(--color-elevated)', color: 'var(--color-text-muted)' } : {}}
                    >
                      <span className="font-bold block truncate">{preset.name}</span>
                      <span className="text-[10px] block mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                        ${preset.startingBalance} ➔ ${preset.targetBalance} ({preset.riskPerTradePct}% Risk)
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Plan Title</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg terminal-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Starting Capital ($)</label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    required
                    value={formState.startingBalance}
                    onChange={(e) => {
                      const start = parseFloat(e.target.value) || 0;
                      setFormState({
                        ...formState,
                        startingBalance: start,
                        drawdownFloor: Math.round(start * 0.8 * 100) / 100,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg font-mono-num terminal-input"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Target Capital ($)</label>
                  <input
                    type="number"
                    step="1"
                    min={formState.startingBalance + 1}
                    required
                    value={formState.targetBalance}
                    onChange={(e) => setFormState({ ...formState, targetBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg text-amber-600 dark:text-[#C9A227] font-mono-num font-bold terminal-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Risk / Trade (%)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="10"
                    value={formState.riskPerTradePct}
                    onChange={(e) => setFormState({ ...formState, riskPerTradePct: parseFloat(e.target.value) || 2.0 })}
                    className="w-full px-3 py-2 rounded-lg font-mono-num terminal-input"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Target R:R</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1.0"
                    max="10"
                    value={formState.targetRR}
                    onChange={(e) => setFormState({ ...formState, targetRR: parseFloat(e.target.value) || 2.0 })}
                    className="w-full px-3 py-2 rounded-lg text-emerald-600 dark:text-[#3FA88C] font-mono-num font-bold terminal-input"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Daily Max Loss (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1.0"
                    max="20"
                    value={formState.maxDailyLossPct}
                    onChange={(e) => setFormState({ ...formState, maxDailyLossPct: parseFloat(e.target.value) || 4.0 })}
                    className="w-full px-3 py-2 rounded-lg font-mono-num terminal-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Safety Floor ($ Hard Stop)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max={formState.startingBalance - 1}
                    value={formState.drawdownFloor}
                    onChange={(e) => setFormState({ ...formState, drawdownFloor: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg text-rose-600 dark:text-[#C1502E] font-mono-num font-bold terminal-input"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase block mb-1" style={{ color: 'var(--color-text-muted)' }}>Linked Account</label>
                  <select
                    value={formState.accountId}
                    onChange={(e) => setFormState({ ...formState, accountId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg font-mono-num terminal-select"
                  >
                    <option value="all">All Accounts (Total Portfolio)</option>
                    {tradingAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (${acc.initialBalance})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--color-border-soft)' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border transition-colors hover:opacity-80"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold transition-all shadow-md"
                >
                  {editingPlanData ? 'Save Changes' : 'Activate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
