import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Award, Zap, AlertTriangle, ShieldCheck, TrendingUp, Calendar, Percent, Activity, Sliders, Layers, Clock, Heart, Filter } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { StatCard } from '../components/StatCard';
import { SectionLabel } from '../components/SectionLabel';
import { RollingWinRateChart } from '../components/RollingWinRateChart';
import { RMultipleHistogram } from '../components/RMultipleHistogram';
import { UnderwaterDrawdownChart } from '../components/UnderwaterDrawdownChart';
import { TimeOfDayHeatMap } from '../components/TimeOfDayHeatMap';
import { PsychologyCorrelationWidget } from '../components/PsychologyCorrelationWidget';
import { calculateExpectancy, calculateSharpeRatio } from '../utils/edgeAnalytics';

export function Analytics() {
  const { trades, filteredTrades: contextFilteredTrades, stats, settings } = useTrade();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'edge' | 'drawdown' | 'heatmap' | 'psychology'
  const [selectedStrategy, setSelectedStrategy] = useState('All');

  const baseTrades = contextFilteredTrades || trades;

  // Extract distinct strategies for segmentation
  const availableStrategies = useMemo(() => {
    const set = new Set(baseTrades.map((t) => t.strategy).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [baseTrades]);

  // Apply strategy segmentation filter
  const activeTrades = useMemo(() => {
    if (selectedStrategy === 'All') return baseTrades;
    return baseTrades.filter((t) => (t.strategy || '').toLowerCase() === selectedStrategy.toLowerCase());
  }, [baseTrades, selectedStrategy]);

  // Institutional Dollar Expectancy: (Win% * Avg Win) - (Loss% * Avg Loss)
  const expectancyData = useMemo(() => {
    return calculateExpectancy(activeTrades);
  }, [activeTrades]);

  // Sharpe Ratio with 30-trade minimum guardrail
  const sharpeData = useMemo(() => {
    return calculateSharpeRatio(activeTrades, 0.02, 30);
  }, [activeTrades]);

  // Win rate & PnL by Day of Week
  const dayOfWeekStats = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const map = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };

    activeTrades.forEach((t) => {
      if (!t.date) return;
      const dateObj = new Date(t.date);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      if (map[dayName]) {
        map[dayName].push(t);
      }
    });

    return days.map((day) => {
      const dayTrades = map[day];
      const wins = dayTrades.filter((t) => t.pnl > 0).length;
      const pnl = dayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = dayTrades.length > 0 ? Math.round((wins / dayTrades.length) * 100) : 0;
      return { day, count: dayTrades.length, winRate, pnl, fill: pnl >= 0 ? '#3FA88C' : '#C1502E' };
    });
  }, [activeTrades]);

  // Streak Analysis
  const streakStats = useMemo(() => {
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    const sorted = [...activeTrades].sort((a, b) => new Date(a.timestamp || a.date) - new Date(b.timestamp || b.date));

    sorted.forEach((t) => {
      if (t.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (t.pnl < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      }
    });

    return { maxWinStreak, maxLossStreak };
  }, [activeTrades]);

  // Dynamic Behavioral & Quantitative Insights
  const insights = useMemo(() => {
    if (!activeTrades || activeTrades.length === 0) {
      return {
        strengths: ['Log your first trade to generate quantitative edge and session insights.'],
        vulnerabilities: ['No trading vulnerabilities detected yet. Keep discipline high!'],
      };
    }

    const strengths = [];
    const vulnerabilities = [];

    // 1. Best / Worst Day of Week
    const daysWithTrades = dayOfWeekStats.filter((d) => d.count > 0);
    if (daysWithTrades.length > 0) {
      const bestDay = [...daysWithTrades].sort((a, b) => b.pnl - a.pnl)[0];
      if (bestDay && bestDay.pnl > 0) {
        strengths.push(`${bestDay.day} is your highest profitability day (+ $${bestDay.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })} across ${bestDay.count} trades, ${bestDay.winRate}% win rate).`);
      }

      const worstDay = [...daysWithTrades].sort((a, b) => a.pnl - b.pnl)[0];
      if (worstDay && worstDay.pnl < 0) {
        vulnerabilities.push(`${worstDay.day} is your biggest loss day (- $${Math.abs(worstDay.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}, ${worstDay.winRate}% win rate). Consider reviewing setups taken on this day.`);
      }
    }

    // 2. Expectancy Sizing Note
    if (expectancyData.expectancy > 0) {
      strengths.push(`Positive mathematical expectancy of +$${expectancyData.expectancy} per trade based on ${expectancyData.winRatePct}% win rate ($${expectancyData.avgWin} avg win vs $${expectancyData.avgLoss} avg loss).`);
    } else if (expectancyData.expectancy < 0) {
      vulnerabilities.push(`Expectancy is currently negative (-$${Math.abs(expectancyData.expectancy)}/trade). Recommendation: ${expectancyData.sizingDesc}`);
    }

    // 3. Discipline Impact
    const mistakeTrades = activeTrades.filter((t) => t.mistakes && t.mistakes.length > 0);
    const cleanTrades = activeTrades.filter((t) => !t.mistakes || t.mistakes.length === 0);

    if (cleanTrades.length > 0) {
      const cleanWins = cleanTrades.filter((t) => (t.pnl || 0) > 0).length;
      const cleanWinRate = Math.round((cleanWins / cleanTrades.length) * 100);
      strengths.push(`Clean, disciplined trades achieve a ${cleanWinRate}% win rate.`);
    }

    if (mistakeTrades.length > 0) {
      const mistakeLoss = mistakeTrades.reduce((sum, t) => sum + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0);
      vulnerabilities.push(`Flagged discipline breaches account for -$${mistakeLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} in avoidable losses.`);
    }

    if (strengths.length === 0) strengths.push('Maintain disciplined plan execution to build your sample size.');
    if (vulnerabilities.length === 0) vulnerabilities.push('Zero major behavioral vulnerabilities detected in current sample.');

    return { strengths, vulnerabilities };
  }, [activeTrades, dayOfWeekStats, expectancyData]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header with Strategy Segmentation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--color-border-soft)' }}>
        <div>
          <h1 className="text-xl font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
            Performance Analytics &amp; Quantitative Edge
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Institutional-grade statistical modeling: rolling win rates, R-multiple distributions, underwater drawdowns, and session heat maps.
          </p>
        </div>

        {/* Strategy Segmentation Filter */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <Filter size={13} className="text-amber-500 dark:text-[#C9A227]" />
          <span style={{ color: 'var(--color-text-dim)' }}>Strategy:</span>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="bg-transparent font-semibold outline-none cursor-pointer"
            style={{ color: 'var(--color-text-main)' }}
          >
            {availableStrategies.map((s) => (
              <option key={s} value={s} style={{ background: 'var(--color-surface)', color: 'var(--color-text-main)' }}>
                {s === 'All' ? 'All Strategies (Aggregate)' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary KPI Row: Dollar Expectancy, Sharpe Ratio with Guardrail, Profit Factor, Streaks */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Dollar Expectancy / Trade"
          value={`${expectancyData.expectancy >= 0 ? '+' : ''}$${expectancyData.expectancy}`}
          sub={expectancyData.sizingAdvice}
          icon={Zap}
          tone={expectancyData.expectancy >= 0 ? 'gold' : 'loss'}
        />

        <StatCard
          label="Sharpe Ratio (30+ Guardrail)"
          value={sharpeData.isSampleBuilding ? `${sharpeData.count}/30 Trades` : `${sharpeData.sharpeRatio}`}
          sub={sharpeData.isSampleBuilding ? 'Sample Building (Filter noise)' : sharpeData.tier}
          icon={Activity}
          tone={sharpeData.isSampleBuilding ? 'neutral' : sharpeData.sharpeRatio >= 1.5 ? 'profit' : 'gold'}
        />

        <StatCard
          label="Profit Factor"
          value={`${stats.profitFactor}`}
          sub="Gross Profit / Gross Loss"
          icon={Award}
          tone={stats.profitFactor >= 1.5 ? 'profit' : 'loss'}
        />

        <StatCard
          label="Max Win Streak"
          value={`${streakStats.maxWinStreak} consecutive`}
          sub={`Max loss streak: ${streakStats.maxLossStreak}`}
          icon={ShieldCheck}
          tone="profit"
        />
      </div>

      {/* Modular Tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b pb-2 text-xs select-none" style={{ borderColor: 'var(--color-border-soft)' }}>
        {[
          { id: 'overview', label: 'Overview & Day Stats', icon: Calendar },
          { id: 'edge', label: 'Rolling Win Rate & R-Histogram', icon: TrendingUp },
          { id: 'drawdown', label: 'Drawdown & Circuit Breaker', icon: AlertTriangle },
          { id: 'heatmap', label: 'Time-of-Day Heat Map', icon: Clock },
          { id: 'psychology', label: 'Psychology & Leaks', icon: Heart },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shrink-0 ${
                isActive
                  ? 'bg-amber-500/15 text-amber-700 dark:text-[#C9A227] border border-amber-500/40 shadow-sm'
                  : 'hover:opacity-80 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={!isActive ? { color: 'var(--color-text-muted)' } : undefined}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Day of Week Chart */}
          <div className="terminal-card p-5 space-y-4">
            <SectionLabel right={<span className="text-xs text-[#8B8D91] font-mono-num">Mon – Fri Breakdown</span>}>
              Performance &amp; Win Rate by Day of Week
            </SectionLabel>

            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={dayOfWeekStats} margin={{ left: -10, right: 10 }}>
                <CartesianGrid stroke="#1E2226" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#8B8D91', fontSize: 11 }} axisLine={{ stroke: '#1E2226' }} tickLine={false} />
                <YAxis tick={{ fill: '#5A5D61', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1B1F23', border: '1px solid #262B30', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {dayOfWeekStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Key Strengths & Vulnerabilities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="terminal-card p-5 space-y-3 border-l-4 border-l-[#3FA88C]">
              <h3 className="text-sm font-bold font-display text-[#3FA88C] flex items-center gap-2">
                <TrendingUp size={16} /> Key Edges &amp; Strengths
              </h3>
              <ul className="space-y-2 text-xs text-[#8B8D91] font-body leading-relaxed">
                {insights.strengths.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#3FA88C] font-bold">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="terminal-card p-5 space-y-3 border-l-4 border-l-[#C1502E]">
              <h3 className="text-sm font-bold font-display text-[#C1502E] flex items-center gap-2">
                <AlertTriangle size={16} /> Vulnerability &amp; Risk Audit
              </h3>
              <ul className="space-y-2 text-xs text-[#8B8D91] font-body leading-relaxed">
                {insights.vulnerabilities.map((v, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#C1502E] font-bold">•</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Quantitative Edge (Rolling Win Rate & R-Multiple Histogram) */}
      {activeTab === 'edge' && (
        <div className="space-y-6 animate-fade-in">
          <RollingWinRateChart trades={activeTrades} defaultBaseline={50} />
          <RMultipleHistogram trades={activeTrades} />
        </div>
      )}

      {/* Tab 3: Drawdown & Circuit Breaker */}
      {activeTab === 'drawdown' && (
        <div className="space-y-6 animate-fade-in">
          <UnderwaterDrawdownChart
            trades={activeTrades}
            initialBalance={settings?.accountBalance || 10000}
            circuitBreakerPct={10}
          />
        </div>
      )}

      {/* Tab 4: Time-of-Day Matrix */}
      {activeTab === 'heatmap' && (
        <div className="space-y-6 animate-fade-in">
          <TimeOfDayHeatMap trades={activeTrades} />
        </div>
      )}

      {/* Tab 5: Psychology & Behavioral Correlation */}
      {activeTab === 'psychology' && (
        <div className="space-y-6 animate-fade-in">
          <PsychologyCorrelationWidget trades={activeTrades} />
        </div>
      )}
    </div>
  );
}
