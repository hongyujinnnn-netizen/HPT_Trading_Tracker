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
          <h1 className="text-2xl font-bold font-display text-[#EDEAE3] flex items-center gap-2">
            {activePlan.name}
          </h1>
          <p className="text-xs text-[#8B8D91]">
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
              className="px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-xs font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227]"
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
            className="px-3 py-2 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] border border-[#262B30] text-xs font-bold text-[#EDEAE3] flex items-center gap-1.5 transition-colors"
          >
            <Plus size={14} className="text-[#C9A227]" /> New Plan
          </button>

          <button
            onClick={handleOpenEditModal}
            className="p-2 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] border border-[#262B30] text-[#8B8D91] hover:text-[#EDEAE3] transition-colors"
            title="Edit Plan Parameters"
            aria-label="Edit Plan Parameters"
          >
            <Edit2 size={15} />
          </button>

          <button
            onClick={() => resetPlan(activePlan.id)}
            className="p-2 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] border border-[#262B30] text-[#8B8D91] hover:text-[#EDEAE3] transition-colors"
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
              className="p-2 rounded-lg bg-[#1B1F23] hover:bg-[#4A2A1E] border border-[#262B30] text-[#C1502E] transition-colors"
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
        <div className="p-4 rounded-xl bg-[#4A2A1E]/80 border border-[#C1502E] text-xs text-[#EDEAE3] flex items-start gap-3 shadow-lg animate-pulse">
          <AlertTriangle size={20} className="text-[#C1502E] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-[#C1502E]">🚨 CAPITAL PRESERVATION FLOOR BREACHED</h4>
            <p className="text-[#D1D5DB]">
              Your balance has fallen to <strong>${metrics.currentEquity.toFixed(2)}</strong>, below your hard stop floor of <strong>${activePlan.drawdownFloor.toFixed(2)}</strong>.
              Stop taking new positions immediately. Conduct a post-mortem review of recent trades to prevent further capital erosion.
            </p>
          </div>
        </div>
      )}

      {/* Daily Loss Breached Warning Banner */}
      {metrics.dailyRisk.isDailyLimitBreached && (
        <div className="p-4 rounded-xl bg-[#2A2311] border border-[#C9A227] text-xs text-[#EDEAE3] flex items-start gap-3 shadow-lg">
          <AlertCircle size={20} className="text-[#C9A227] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-[#C9A227]">⚠️ DAILY LOSS LIMIT REACHED TODAY</h4>
            <p className="text-[#D1D5DB]">
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
            <span className="text-[11px] font-mono-num uppercase tracking-wider text-[#8B8D91] block">
              Current Capital vs Target Goal
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-3xl md:text-4xl font-bold font-mono-num text-[#EDEAE3]">
                ${metrics.currentEquity.toFixed(2)}
              </span>
              <span className="text-xs font-mono-num text-[#8B8D91]">
                from <strong className="text-[#EDEAE3]">${activePlan.startingBalance.toFixed(2)}</strong>
              </span>
              <ArrowRight size={14} className="text-[#8B8D91]" />
              <span className="text-lg font-bold font-mono-num text-[#C9A227]">
                Target: ${activePlan.targetBalance.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="text-[11px] text-[#8B8D91] block">Total Target Gain</span>
              <span className="text-sm font-bold font-mono-num text-[#3FA88C]">
                +${metrics.totalTargetGain.toFixed(2)} (+{metrics.targetRoiPct}%)
              </span>
            </div>
            <div className="h-8 w-px bg-[#262B30]" />
            <div>
              <span className="text-[11px] text-[#8B8D91] block">Remaining Needed</span>
              <span className="text-sm font-bold font-mono-num text-[#C9A227]">
                ${metrics.remainingGain.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono-num">
            <span className="text-[#8B8D91]">
              Roadmap Progress: <strong className="text-[#C9A227]">{metrics.progressPct}%</strong>
            </span>
            <span className="text-[#8B8D91]">
              Net Plan P&amp;L:{' '}
              <strong className={metrics.realizedPnl >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}>
                {metrics.realizedPnl >= 0 ? '+' : ''}${metrics.realizedPnl.toFixed(2)} ({metrics.currentRoiPct}%)
              </strong>
            </span>
          </div>

          <div className="h-3 w-full bg-[#1B1F23] rounded-full overflow-hidden p-0.5 border border-[#262B30] relative">
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
          <div className="flex justify-between text-[10px] font-mono-num text-[#8B8D91] px-1">
            <span>Start: ${activePlan.startingBalance}</span>
            <span>25%: ${(activePlan.startingBalance + metrics.totalTargetGain * 0.25).toFixed(1)}</span>
            <span>50%: ${(activePlan.startingBalance + metrics.totalTargetGain * 0.50).toFixed(1)}</span>
            <span>75%: ${(activePlan.startingBalance + metrics.totalTargetGain * 0.75).toFixed(1)}</span>
            <span className="text-[#C9A227] font-bold">Goal: ${activePlan.targetBalance}</span>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-[#14181B] border border-[#262B30]">
            <span className="text-[10px] text-[#8B8D91] uppercase tracking-wider block">Planned Risk / Trade</span>
            <span className="text-base font-bold font-mono-num text-[#C9A227]">
              {activePlan.riskPerTradePct}% (${metrics.riskAmount.toFixed(2)})
            </span>
            <span className="text-[10px] text-[#8B8D91] block mt-0.5">Dynamically sized</span>
          </div>

          <div className="p-3 rounded-lg bg-[#14181B] border border-[#262B30]">
            <span className="text-[10px] text-[#8B8D91] uppercase tracking-wider block">Daily Max Loss</span>
            <span className="text-base font-bold font-mono-num text-[#EDEAE3]">
              {activePlan.maxDailyLossPct}% (${metrics.dailyLossLimit.toFixed(2)})
            </span>
            <span className="text-[10px] text-[#8B8D91] block mt-0.5">Circuit breaker</span>
          </div>

          <div className="p-3 rounded-lg bg-[#14181B] border border-[#262B30]">
            <span className="text-[10px] text-[#8B8D91] uppercase tracking-wider block">Preservation Floor</span>
            <span className="text-base font-bold font-mono-num text-[#C1502E]">
              ${activePlan.drawdownFloor.toFixed(2)}
            </span>
            <span className="text-[10px] text-[#8B8D91] block mt-0.5">
              Cushion: +${metrics.drawdownCushion.toFixed(2)} ({metrics.drawdownCushionPct}%)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#14181B] border border-[#262B30]">
            <span className="text-[10px] text-[#8B8D91] uppercase tracking-wider block">Target Min R:R</span>
            <span className="text-base font-bold font-mono-num text-[#3FA88C]">
              1:{activePlan.targetRR.toFixed(1)}
            </span>
            <span className="text-[10px] text-[#8B8D91] block mt-0.5">Positive expectancy</span>
          </div>
        </div>
      </div>

      {/* TWO COLUMNS: Next Trade Sizing Assistant & Institutional Risk Guardrails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Trade Sizing Engine */}
        <div className="terminal-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#C9A227] flex items-center gap-2">
              <Calculator size={16} /> Next Trade Position Sizing
            </h3>
            <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-[#1B1F23] border border-[#262B30] text-[#8B8D91]">
              Equity: ${metrics.currentEquity.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-[#8B8D91]">
            Based on your active plan's risk budget ({activePlan.riskPerTradePct}%), here is your exact position sizing for your immediate next setup.
          </p>

          <div className="grid grid-cols-2 gap-3 font-mono-num text-xs">
            <div className="p-3 rounded-lg bg-[#1B1F23] border border-[#262B30]">
              <span className="text-[#8B8D91] block text-[11px]">Maximum Allowed Risk</span>
              <span className="text-lg font-bold text-[#EDEAE3]">${liveSizing?.riskDollar.toFixed(2)}</span>
              <span className="text-[10px] text-[#8B8D91] block mt-0.5">{activePlan.riskPerTradePct}% of ${metrics.currentEquity.toFixed(2)}</span>
            </div>

            <div className="p-3 rounded-lg bg-[#1B1F23] border border-[#262B30]">
              <span className="text-[#8B8D91] block text-[11px]">Target Profit (1:{activePlan.targetRR})</span>
              <span className="text-lg font-bold text-[#3FA88C]">+${liveSizing?.targetDollar.toFixed(2)}</span>
              <span className="text-[10px] text-[#8B8D91] block mt-0.5">Reward goal</span>
            </div>
          </div>

          {/* Interactive Stop Loss Distance adjuster */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="text-[#8B8D91] font-bold uppercase text-[11px]">
                Stop Loss Distance ($ Points / Pips)
              </label>
              <span className="font-mono-num text-[#EDEAE3] font-bold">
                ${customStopLossPoints.toFixed(2)} ({Math.round(customStopLossPoints * 10)} pips)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1.5, 2.0, 2.5, 3.0].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setCustomStopLossPoints(pts)}
                  className={`py-1.5 rounded text-xs font-mono-num border transition-all ${
                    customStopLossPoints === pts
                      ? 'bg-[#C9A227] text-[#0A0C0E] font-bold border-[#C9A227]'
                      : 'bg-[#1B1F23] text-[#8B8D91] border-[#262B30] hover:text-[#EDEAE3]'
                  }`}
                >
                  ${pts.toFixed(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Recommended Lot Size Output */}
          <div className="p-4 rounded-xl bg-[#14181B] border border-[#262B30] space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#8B8D91] tracking-wider block">
                  Recommended XAU/USD Lot Size
                </span>
                <span className="text-2xl font-bold font-mono-num text-[#C9A227]">
                  {liveSizing?.lotSize} Lots
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#8B8D91] block">Min Lot Risk</span>
                <span className="text-xs font-bold font-mono-num text-[#EDEAE3]">
                  ${liveSizing?.actualRiskAtMinLot.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Overleveraged warning for micro accounts */}
            {liveSizing?.isOverleveragedForSmallBalance && (
              <div className="p-2.5 rounded-lg bg-[#2A2311] border border-[#C9A227]/40 text-[11px] text-[#EDEAE3] flex items-start gap-2">
                <Info size={14} className="text-[#C9A227] shrink-0 mt-0.5" />
                <p>
                  <strong>Micro Account Notice:</strong> On standard broker accounts, the smallest order is 0.01 lot ($1/point move). A ${customStopLossPoints} stop risks ${liveSizing.actualRiskAtMinLot.toFixed(2)}, slightly higher than your safe ${liveSizing.riskDollar.toFixed(2)} target. Consider a cent account or wider timeframes.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons to Trade Form */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleSendToTrade}
              className="py-2.5 px-3 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <span>Send to Add Trade</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={handleOpenInRiskCalc}
              className="py-2.5 px-3 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] border border-[#262B30] text-[#EDEAE3] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Calculator size={14} className="text-[#C9A227]" />
              <span>Full Calculator</span>
            </button>
          </div>
        </div>

        {/* Institutional Risk Guardrails Matrix */}
        <div className="terminal-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3FA88C] flex items-center gap-2">
              <Shield size={16} /> Risk Management Guardrails
            </h3>
            <span className="text-[10px] text-[#8B8D91] font-mono-num">
              Rule Enforcement: Strict
            </span>
          </div>

          <p className="text-xs text-[#8B8D91]">
            Small accounts grow through mathematical defense, not big bets. These guardrails protect you from blowing the account during losing streaks.
          </p>

          <div className="space-y-3 text-xs">
            {/* Risk per trade rule */}
            <div className="p-3 rounded-lg bg-[#1B1F23] border border-[#262B30] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-[#EDEAE3] block">Max Risk Per Trade</span>
                <span className="text-[11px] text-[#8B8D91]">Never risk more than {activePlan.riskPerTradePct}% per setup</span>
              </div>
              <div className="text-right font-mono-num">
                <span className="font-bold text-[#C9A227]">{activePlan.riskPerTradePct}%</span>
                <span className="text-[10px] text-[#8B8D91] block">(${metrics.riskAmount.toFixed(2)})</span>
              </div>
            </div>

            {/* Daily loss limit */}
            <div className="p-3 rounded-lg bg-[#1B1F23] border border-[#262B30] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-[#EDEAE3] block">Daily Circuit Breaker</span>
                <span className="text-[11px] text-[#8B8D91]">Lock trading if daily loss reaches {activePlan.maxDailyLossPct}%</span>
              </div>
              <div className="text-right font-mono-num">
                <span className={`font-bold ${metrics.dailyRisk.isDailyLimitBreached ? 'text-[#C1502E]' : 'text-[#EDEAE3]'}`}>
                  ${Math.abs(metrics.dailyRisk.todayPnl).toFixed(2)} / ${metrics.dailyRisk.maxAllowedDailyLoss.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#8B8D91] block">
                  {metrics.dailyRisk.remainingDailyRisk > 0 ? `$${metrics.dailyRisk.remainingDailyRisk} cushion` : 'Limit reached'}
                </span>
              </div>
            </div>

            {/* Safety Floor */}
            <div className="p-3 rounded-lg bg-[#1B1F23] border border-[#262B30] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-[#EDEAE3] block">Capital Preservation Floor</span>
                <span className="text-[11px] text-[#8B8D91]">Hard account floor to prevent total liquidation</span>
              </div>
              <div className="text-right font-mono-num">
                <span className="font-bold text-[#C1502E]">${activePlan.drawdownFloor.toFixed(2)}</span>
                <span className="text-[10px] text-[#8B8D91] block">+{metrics.drawdownCushionPct}% cushion</span>
              </div>
            </div>

            {/* Max concurrent positions */}
            <div className="p-3 rounded-lg bg-[#1B1F23] border border-[#262B30] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold text-[#EDEAE3] block">Max Concurrent Trades</span>
                <span className="text-[11px] text-[#8B8D91]">Avoid margin over-extension</span>
              </div>
              <div className="text-right font-mono-num">
                <span className="font-bold text-[#EDEAE3]">{activePlan.maxOpenTrades} Position Max</span>
                <span className="text-[10px] text-[#8B8D91] block">Focus &amp; clarity</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MILESTONE LADDER: Step-by-Step Pathway */}
      <div className="terminal-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#EDEAE3] flex items-center gap-2">
              <TrendingUp size={16} className="text-[#C9A227]" /> Milestone Pathway (4 Stages)
            </h3>
            <p className="text-xs text-[#8B8D91] mt-0.5">
              Break down the ${activePlan.startingBalance} ➔ ${activePlan.targetBalance} journey into achievable incremental milestones.
            </p>
          </div>
          <span className="text-xs font-mono-num text-[#C9A227] font-bold">
            {metrics.milestones.filter((m) => m.isCompleted).length} of {metrics.milestones.length} Cleared
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.milestones.map((m) => {
            let cardStyle = 'bg-[#14181B] border-[#262B30] opacity-70';
            let badgeStyle = 'bg-[#1B1F23] text-[#8B8D91] border-[#262B30]';
            let statusText = 'Upcoming';

            if (m.isCompleted) {
              cardStyle = 'bg-[#141E1B] border-[#265C50] shadow-sm';
              badgeStyle = 'bg-[#1F4A40] text-[#3FA88C] border-[#265C50]';
              statusText = 'Completed ✓';
            } else if (m.isActive) {
              cardStyle = 'bg-[#1F1B0E] border-[#C9A227] ring-1 ring-[#C9A227]/30 shadow-md';
              badgeStyle = 'bg-[#C9A227] text-[#0A0C0E] font-bold';
              statusText = 'Active Target';
            }

            return (
              <div
                key={m.stage}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${cardStyle}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B8D91] block">
                      {m.title}
                    </span>
                    <span className="text-xl font-bold font-mono-num text-[#EDEAE3] block mt-0.5">
                      ${m.stageTarget.toFixed(2)}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono-num uppercase border ${badgeStyle}`}>
                    {statusText}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono-num border-t border-[#262B30]/60 pt-2 text-[#8B8D91]">
                  <div className="flex justify-between">
                    <span>Target Range:</span>
                    <span className="text-[#EDEAE3]">${m.stageStart.toFixed(1)} - ${m.stageTarget.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stage Gain:</span>
                    <span className="text-[#3FA88C]">+{((m.stageGain / m.stageStart) * 100).toFixed(0)}% (+${m.stageGain})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Risk / Trade:</span>
                    <span className="text-[#C9A227]">${m.stageRiskAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recommended Lot:</span>
                    <span className="text-[#EDEAE3] font-bold">{m.recommendedLot} Lots</span>
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#EDEAE3] flex items-center gap-2">
              <Sparkles size={16} className="text-[#C9A227]" /> Compounding Trajectory vs Actual Equity
            </h3>
            <p className="text-xs text-[#8B8D91]">
              Planned roadmap compounding curve at 1:{activePlan.targetRR} Risk/Reward compared to your actual trade execution curve.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono-num">
            <span className="flex items-center gap-1.5 text-[#C9A227]">
              <span className="w-3 h-0.5 bg-[#C9A227] inline-block" /> Planned Compounding
            </span>
            <span className="flex items-center gap-1.5 text-[#3FA88C]">
              <span className="w-3 h-0.5 bg-[#3FA88C] inline-block" /> Actual Equity Path
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={metrics.projection} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262B30" opacity={0.5} />
              <XAxis dataKey="tradeIndex" stroke="#8B8D91" fontSize={11} tickLine={false} />
              <YAxis stroke="#8B8D91" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#14181B',
                  border: '1px solid #262B30',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#EDEAE3] flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#3FA88C]" /> Daily Discipline Rules of Engagement
        </h3>
        <p className="text-xs text-[#8B8D91]">
          Trading psychology and capital discipline. Every successful micro-account challenge is won by honoring these commitments.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(activePlan.rules || []).map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() => handleToggleRule(rule.id)}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-colors ${
                rule.enabled
                  ? 'bg-[#141E1B] border-[#265C50] text-[#EDEAE3]'
                  : 'bg-[#1B1F23] border-[#262B30] text-[#8B8D91] opacity-60'
              }`}
            >
              <div
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  rule.enabled ? 'bg-[#3FA88C] border-[#3FA88C] text-[#0A0C0E]' : 'border-[#8B8D91]'
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
          <div className="terminal-card w-full max-w-xl p-6 space-y-5 animate-scale-up border-[#C9A227]/40 my-8">
            <div className="flex items-center justify-between border-b border-[#262B30] pb-3">
              <h3 className="text-base font-bold text-[#EDEAE3] flex items-center gap-2">
                <Target size={18} className="text-[#C9A227]" />
                {editingPlanData ? 'Edit Target Plan Parameters' : 'Create New Target Plan'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#8B8D91] hover:text-[#EDEAE3] text-sm"
              >
                ✕
              </button>
            </div>

            {/* Preset Selector buttons if creating */}
            {!editingPlanData && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#8B8D91] block">
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
                          ? 'bg-[#2A2311] border-[#C9A227] text-[#C9A227]'
                          : 'bg-[#1B1F23] border-[#262B30] text-[#8B8D91] hover:text-[#EDEAE3]'
                      }`}
                    >
                      <span className="font-bold block truncate">{preset.name}</span>
                      <span className="text-[10px] text-[#8B8D91] block mt-0.5">
                        ${preset.startingBalance} ➔ ${preset.targetBalance} ({preset.riskPerTradePct}% Risk)
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="text-[#8B8D91] font-bold uppercase block mb-1">Plan Title</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#EDEAE3] outline-none focus:border-[#C9A227]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#8B8D91] font-bold uppercase block mb-1">Starting Capital ($)</label>
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
                    className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#EDEAE3] font-mono-num outline-none focus:border-[#C9A227]"
                  />
                </div>

                <div>
                  <label className="text-[#8B8D91] font-bold uppercase block mb-1">Target Capital ($)</label>
                  <input
                    type="number"
                    step="1"
                    min={formState.startingBalance + 1}
                    required
                    value={formState.targetBalance}
                    onChange={(e) => setFormState({ ...formState, targetBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#C9A227] font-mono-num font-bold outline-none focus:border-[#C9A227]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[#8B8D91] font-bold uppercase block mb-1">Risk / Trade (%)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="10"
                    value={formState.riskPerTradePct}
                    onChange={(e) => setFormState({ ...formState, riskPerTradePct: parseFloat(e.target.value) || 2.0 })}
                    className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#EDEAE3] font-mono-num outline-none focus:border-[#C9A227]"
                  />
                </div>

                <div>
                  <label className="text-[#8B8D91] font-bold uppercase block mb-1">Target R:R</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1.0"
                    max="10"
                    value={formState.targetRR}
                    onChange={(e) => setFormState({ ...formState, targetRR: parseFloat(e.target.value) || 2.0 })}
                    className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#3FA88C] font-mono-num font-bold outline-none focus:border-[#3FA88C]"
                  />
                </div>

                <div>
                  <label className="text-[#8B8D91] font-bold uppercase block mb-1">Daily Max Loss (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1.0"
                    max="20"
                    value={formState.maxDailyLossPct}
                    onChange={(e) => setFormState({ ...formState, maxDailyLossPct: parseFloat(e.target.value) || 4.0 })}
                    className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#EDEAE3] font-mono-num outline-none focus:border-[#C9A227]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[#8B8D91] font-bold uppercase block mb-1">Safety Floor ($ Hard Stop)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max={formState.startingBalance - 1}
                    value={formState.drawdownFloor}
                    onChange={(e) => setFormState({ ...formState, drawdownFloor: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#C1502E] font-mono-num font-bold outline-none focus:border-[#C1502E]"
                  />
                </div>

                <div>
                  <label className="text-[#8B8D91] font-bold uppercase block mb-1">Linked Account</label>
                  <select
                    value={formState.accountId}
                    onChange={(e) => setFormState({ ...formState, accountId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-[#EDEAE3] font-mono-num outline-none focus:border-[#C9A227]"
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

              <div className="pt-4 border-t border-[#262B30] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] text-[#8B8D91] hover:text-[#EDEAE3] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold transition-colors shadow-md"
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
