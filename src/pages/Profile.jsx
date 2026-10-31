import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Shield,
  Cloud,
  LogOut,
  TrendingUp,
  Target,
  Activity,
  Award,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Trophy,
  Star,
  ChevronRight,
  Edit3,
  Copy,
  Check,
  Share2,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  X,
  Briefcase,
  Compass,
  Sliders,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import { useTrade } from '../context/TradeContext';
import { SectionLabel } from '../components/SectionLabel';
import { Pill } from '../components/Pill';
import { LogoIcon } from '../components/LogoIcon';
import { ProfileFormModal } from '../components/ProfileDirectoryAndModal';
import { calculateExpectancy, calculateSharpeRatio } from '../utils/edgeAnalytics';

const PROFILE_META_KEY = 'tradepulse_trader_profile_meta';

const TRADING_STYLES = [
  'ICT / Smart Money',
  'Session Breakout',
  'Intraday Scalper',
  'Price Action & Structure',
  'Macro / News Momentum',
  'Swing & Position',
];

const RISK_PROFILES = ['Conservative (0.5%–1%)', 'Balanced Institutional (1%–2%)', 'Aggressive Growth (2%+)'];

function loadProfileMeta(defaultName) {
  try {
    const raw = localStorage.getItem(PROFILE_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        displayName: parsed.displayName || defaultName,
        handle: parsed.handle || `@${defaultName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'xautrader'}`,
        style: parsed.style || TRADING_STYLES[0],
        riskProfile: parsed.riskProfile || RISK_PROFILES[1],
        motto:
          parsed.motto ||
          'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
      };
    }
  } catch (_e) {
    // ignore storage parse errors
  }
  return {
    displayName: defaultName,
    handle: `@${defaultName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'xautrader'}`,
    style: TRADING_STYLES[0],
    riskProfile: RISK_PROFILES[1],
    motto: 'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
  };
}

// ── Reusable Subcomponents ───────────────────────────────────────────
function StatRow({ label, value, sub, tone = 'default' }) {
  const valueColor =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
      ? 'var(--color-loss)'
      : tone === 'gold'
      ? 'var(--color-accent)'
      : 'var(--color-text-main)';

  return (
    <div
      className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor: 'var(--color-border-soft)' }}
    >
      <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
        {label}
      </span>
      <div className="text-right">
        <span className="text-xs font-bold font-mono-num" style={{ color: valueColor }}>
          {value}
        </span>
        {sub && (
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBar({ pct, color = 'var(--color-accent)' }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-elevated)' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}

// ── Achievement Catalog (both unlocked & locked with progress) ───────
function evaluateAchievements(stats, trades, longestStreak) {
  const cleanCount = trades.filter((t) => !t.mistakes || t.mistakes.length === 0).length;
  const cleanRatio = trades.length > 0 ? Math.round((cleanCount / trades.length) * 100) : 100;

  return [
    {
      id: 'first_blood',
      icon: Star,
      title: 'Verified XAU/USD Desk',
      desc: 'Log at least 10 closed gold trades in your journal',
      unlocked: stats.totalTrades >= 10,
      progress: `${Math.min(stats.totalTrades, 10)} / 10 trades`,
      pct: Math.min(100, (stats.totalTrades / 10) * 100),
      tone: 'gold',
    },
    {
      id: 'veteran_50',
      icon: Trophy,
      title: 'Half-Century Club',
      desc: 'Complete 50+ logged trades with full audit trail',
      unlocked: stats.totalTrades >= 50,
      progress: `${Math.min(stats.totalTrades, 50)} / 50 trades`,
      pct: Math.min(100, (stats.totalTrades / 50) * 100),
      tone: 'gold',
    },
    {
      id: 'pf_master',
      icon: Zap,
      title: 'Profit Factor 2.0+',
      desc: 'Maintain gross profit at least 2× gross loss',
      unlocked: stats.profitFactor >= 2.0 && stats.totalTrades >= 5,
      progress: `PF ${stats.profitFactor.toFixed(2)} / 2.00`,
      pct: Math.min(100, (stats.profitFactor / 2.0) * 100),
      tone: 'profit',
    },
    {
      id: 'sniper_wr',
      icon: Flame,
      title: 'Precision Sniper (60%+)',
      desc: 'Sustain a 60%+ win rate across 10+ trades',
      unlocked: stats.winRate >= 60 && stats.totalTrades >= 10,
      progress: `${stats.winRate}% / 60% WR`,
      pct: Math.min(100, (stats.winRate / 60) * 100),
      tone: 'profit',
    },
    {
      id: 'rr_architect',
      icon: Target,
      title: 'Asymmetric R:R (2.0R+)',
      desc: 'Achieve an average realized Risk:Reward of at least 1 : 2.0',
      unlocked: stats.avgRR >= 2.0 && stats.totalTrades >= 5,
      progress: `${stats.avgRR}R / 2.0R`,
      pct: Math.min(100, (stats.avgRR / 2.0) * 100),
      tone: 'gold',
    },
    {
      id: 'ironclad_dd',
      icon: Shield,
      title: 'Capital Guardian (<5% DD)',
      desc: 'Keep maximum drawdown under 5% over 10+ trades',
      unlocked: stats.maxDrawdownPct < 5 && stats.totalTrades >= 10,
      progress: stats.totalTrades < 10 ? `${stats.totalTrades}/10 trades` : `Max DD ${stats.maxDrawdownPct.toFixed(1)}%`,
      pct: stats.totalTrades < 10 ? (stats.totalTrades / 10) * 100 : Math.max(0, 100 - stats.maxDrawdownPct * 10),
      tone: 'profit',
    },
    {
      id: 'hot_streak',
      icon: Flame,
      title: '5-Win Momentum Streak',
      desc: 'Chain 5 consecutive winning XAU/USD executions',
      unlocked: longestStreak >= 5,
      progress: `${Math.min(longestStreak, 5)} / 5 wins`,
      pct: Math.min(100, (longestStreak / 5) * 100),
      tone: 'gold',
    },
    {
      id: 'zero_leak',
      icon: Award,
      title: 'Institutional Discipline (85%+)',
      desc: 'Execute 85%+ of trades with zero rule violations',
      unlocked: cleanRatio >= 85 && trades.length >= 10,
      progress: `${cleanRatio}% clean setups`,
      pct: Math.min(100, (cleanRatio / 85) * 100),
      tone: 'profit',
    },
  ];
}

// ── 5-Axis Radar Profile Score ───────────────────────────────────────
function computeProfileScore(stats, cleanPct) {
  const dimensions = [
    {
      axis: 'Win Rate',
      label: 'Win Rate Edge',
      score: Math.round(Math.min(100, Math.max(0, (stats.winRate / 65) * 100))),
      value: `${stats.winRate}%`,
      target: '65%',
    },
    {
      axis: 'Profit Factor',
      label: 'Profit Factor',
      score: Math.round(Math.min(100, Math.max(0, (stats.profitFactor / 2.5) * 100))),
      value: stats.profitFactor.toFixed(2),
      target: '2.50',
    },
    {
      axis: 'R:R Payoff',
      label: 'Avg R:R Payoff',
      score: Math.round(Math.min(100, Math.max(0, (stats.avgRR / 2.5) * 100))),
      value: `1 : ${stats.avgRR}`,
      target: '1 : 2.5',
    },
    {
      axis: 'Risk Control',
      label: 'Drawdown Control',
      score: Math.round(Math.min(100, Math.max(0, 100 - stats.maxDrawdownPct * 5))),
      value: `-${stats.maxDrawdownPct.toFixed(1)}%`,
      target: '< 5%',
    },
    {
      axis: 'Discipline',
      label: 'Rule Discipline',
      score: Math.round(Math.min(100, Math.max(0, cleanPct))),
      value: `${cleanPct}%`,
      target: '90%+',
    },
  ];
  const overall = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  return { dimensions, overall };
}

const RANK_TIERS = [
  { min: 0, max: 29, label: 'Novice Desk', nextLabel: 'Developing', color: '#94A3B8' },
  { min: 30, max: 49, label: 'Developing Trader', nextLabel: 'Intermediate', color: '#E5B83B' },
  { min: 50, max: 69, label: 'Intermediate Quant', nextLabel: 'Advanced', color: '#38BDF8' },
  { min: 70, max: 84, label: 'Advanced Prop Trader', nextLabel: 'Institutional Elite', color: '#3FA88C' },
  { min: 85, max: 100, label: 'Institutional Elite', nextLabel: null, color: '#C9A227' },
];

function getRankInfo(score) {
  const tier = RANK_TIERS.find((t) => score >= t.min && score <= t.max) || RANK_TIERS[0];
  const pointsToNext = tier.nextLabel ? tier.max + 1 - score : 0;
  const tierSpan = tier.max - tier.min + 1;
  const tierProgressPct = tier.nextLabel ? Math.round(((score - tier.min) / tierSpan) * 100) : 100;
  return { ...tier, pointsToNext, tierProgressPct };
}

// ── Session breakdown ────────────────────────────────────────────────
function computeSessionStats(trades) {
  const map = {};
  for (const t of trades) {
    if (!t.session) continue;
    if (!map[t.session]) map[t.session] = { trades: 0, pnl: 0, wins: 0 };
    map[t.session].trades++;
    map[t.session].pnl += Number(t.pnl) || 0;
    if ((Number(t.pnl) || 0) > 0) map[t.session].wins++;
  }
  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      trades: d.trades,
      pnl: Math.round(d.pnl * 100) / 100,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

// ── Emotion / psychology breakdown ───────────────────────────────────
function computeEmotionStats(trades) {
  const map = {};
  for (const t of trades) {
    const e = t.emotion || 'Planned';
    if (!map[e]) map[e] = { trades: 0, pnl: 0, wins: 0 };
    map[e].trades++;
    map[e].pnl += Number(t.pnl) || 0;
    if ((Number(t.pnl) || 0) > 0) map[e].wins++;
  }
  return Object.entries(map)
    .map(([emotion, d]) => ({
      emotion,
      trades: d.trades,
      totalPnl: Math.round(d.pnl * 100) / 100,
      avgPnl: d.trades > 0 ? Math.round((d.pnl / d.trades) * 100) / 100 : 0,
      winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0,
    }))
    .sort((a, b) => b.avgPnl - a.avgPnl);
}

// ── Best / Worst day ─────────────────────────────────────────────────
function computeDayStats(trades) {
  const byDay = {};
  for (const t of trades) {
    const d = (t.date || t.timestamp || '').slice(0, 10);
    if (!d) continue;
    if (!byDay[d]) byDay[d] = 0;
    byDay[d] += Number(t.pnl) || 0;
  }
  const days = Object.entries(byDay).map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 100) / 100 }));
  if (!days.length) return { best: null, worst: null, profitableDays: 0, totalDays: 0 };
  const profitableDays = days.filter((x) => x.pnl > 0).length;
  return {
    best: days.reduce((a, b) => (b.pnl > a.pnl ? b : a)),
    worst: days.reduce((a, b) => (b.pnl < a.pnl ? b : a)),
    profitableDays,
    totalDays: days.length,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function Profile() {
  const {
    userSession,
    stats,
    trades,
    filteredTrades,
    tradingAccounts,
    activeAccountId,
    setActiveAccountId,
    targetPlans,
    activePlan,
    settings,
    updateSettings,
    signOut,
    isDemoMode,
    isCloudActive,
    setActivePage,
    activeProfile,
    updateTraderProfile,
  } = useTrade();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'psychology' | 'accounts'
  const [privacyMode, setPrivacyMode] = useState(false); // hides $ amounts and shows R-multiples
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfileTarget, setEditingProfileTarget] = useState(null);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [copiedShareSummary, setCopiedShareSummary] = useState(false);

  const email = userSession?.user?.email || (isDemoMode ? 'demo@tradepulsegold.app' : 'trader@tradepulsegold.app');
  const defaultName = activeProfile?.name || settings?.displayName || email.split('@')[0] || 'Trader';
  const userId = userSession?.user?.id || '';
  const joinedDate = userSession?.user?.created_at
    ? new Date(userSession.user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Demo Desk';

  const profileMeta = useMemo(() => {
    if (activeProfile) {
      return {
        id: activeProfile.id,
        displayName: activeProfile.name || defaultName,
        handle: activeProfile.handle || `@${defaultName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'xautrader'}`,
        imageProfile: activeProfile.imageProfile || '',
        tag: activeProfile.tag || 'XAU/USD Specialist',
        tags: Array.isArray(activeProfile.tags) ? activeProfile.tags : ['XAU/USD', 'London Session', 'ICT / SMC'],
        style: activeProfile.tradingStyle || TRADING_STYLES[0],
        riskProfile: activeProfile.riskProfile || RISK_PROFILES[1],
        preferredSession: activeProfile.preferredSession || 'London & NY Overlap',
        location: activeProfile.location || 'Global Trading Desk',
        experienceLevel: activeProfile.experienceLevel || 'Intermediate (1–3 yrs)',
        motto:
          activeProfile.motto ||
          'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
        encryptionFingerprint: activeProfile.encryptionFingerprint || 'TP256-VAULT',
      };
    }
    return {
      ...loadProfileMeta(defaultName),
      imageProfile: '',
      tag: 'XAU/USD Specialist',
      tags: ['XAU/USD', 'London Session', 'ICT / SMC'],
      preferredSession: 'London & NY Overlap',
      location: 'Global Trading Desk',
      experienceLevel: 'Intermediate (1–3 yrs)',
      encryptionFingerprint: 'TP256-VAULT',
    };
  }, [activeProfile, defaultName]);

  const handleOpenEditProfile = (targetProf = activeProfile) => {
    setEditingProfileTarget(targetProf || activeProfile);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfileModal = async (formData) => {
    const updated = await updateTraderProfile(editingProfileTarget?.id || activeProfile?.id, formData);
    if (updated && typeof updateSettings === 'function') {
      updateSettings({ ...settings, displayName: updated.name });
    }
  };

  const activeTrades = filteredTrades || trades;
  const closedTrades = useMemo(
    () => activeTrades.filter((t) => t.status === 'closed' || (t.pnl !== undefined && t.pnl !== null)),
    [activeTrades]
  );

  // Clean setup ratio (trades without mistakes)
  const cleanSetupStats = useMemo(() => {
    if (closedTrades.length === 0) return { cleanCount: 0, flaggedCount: 0, cleanPct: 100, mistakeCost: 0 };
    let cleanCount = 0;
    let flaggedCount = 0;
    let mistakeCost = 0;
    for (const t of closedTrades) {
      const hasMistake = (t.mistakes && t.mistakes.length > 0) || ['Revenge Trade', 'FOMO', 'Overtrading'].includes(t.emotion);
      if (hasMistake) {
        flaggedCount++;
        if ((Number(t.pnl) || 0) < 0) {
          mistakeCost += Math.abs(Number(t.pnl) || 0);
        }
      } else {
        cleanCount++;
      }
    }
    const cleanPct = Math.round((cleanCount / closedTrades.length) * 100);
    return { cleanCount, flaggedCount, cleanPct, mistakeCost: Math.round(mistakeCost * 100) / 100 };
  }, [closedTrades]);

  const expectancy = useMemo(() => calculateExpectancy(closedTrades), [closedTrades]);
  const sharpe = useMemo(() => calculateSharpeRatio(closedTrades, 0.02, 30), [closedTrades]);
  const profileScore = useMemo(
    () => computeProfileScore(stats, cleanSetupStats.cleanPct),
    [stats, cleanSetupStats.cleanPct]
  );
  const rank = useMemo(() => getRankInfo(profileScore.overall), [profileScore.overall]);

  // Longest win & loss streaks
  const streakStats = useMemo(() => {
    const sorted = [...closedTrades].sort(
      (a, b) => new Date(a.exitTime || a.timestamp || a.date) - new Date(b.exitTime || b.timestamp || b.date)
    );
    let maxWin = 0;
    let maxLoss = 0;
    let curWin = 0;
    let curLoss = 0;
    for (const t of sorted) {
      const p = Number(t.pnl) || 0;
      if (p > 0) {
        curWin++;
        curLoss = 0;
        maxWin = Math.max(maxWin, curWin);
      } else if (p < 0) {
        curLoss++;
        curWin = 0;
        maxLoss = Math.max(maxLoss, curLoss);
      }
    }
    return { maxWin, maxLoss, currentStreak: curWin > 0 ? `+${curWin}W` : curLoss > 0 ? `-${curLoss}L` : 'Flat' };
  }, [closedTrades]);

  const achievements = useMemo(
    () => evaluateAchievements(stats, closedTrades, streakStats.maxWin),
    [stats, closedTrades, streakStats.maxWin]
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const sessionStats = useMemo(() => computeSessionStats(closedTrades), [closedTrades]);
  const emotionStats = useMemo(() => computeEmotionStats(closedTrades), [closedTrades]);
  const dayStats = useMemo(() => computeDayStats(closedTrades), [closedTrades]);

  // Cumulative R & $ Equity Curve for the Passport mini-chart
  const cumulativeSeries = useMemo(() => {
    const sorted = [...closedTrades].sort(
      (a, b) => new Date(a.exitTime || a.timestamp || a.date) - new Date(b.exitTime || b.timestamp || b.date)
    );
    let cumPnl = 0;
    let cumR = 0;
    const pts = [{ label: 'Start', pnl: 0, r: 0 }];
    sorted.forEach((t, idx) => {
      const p = Number(t.pnl) || 0;
      const rVal = t.rr != null && Number.isFinite(Number(t.rr)) ? (p >= 0 ? Number(t.rr) : -1) : p >= 0 ? 1 : -1;
      cumPnl += p;
      cumR += rVal;
      pts.push({
        label: t.date || `#${idx + 1}`,
        pnl: Math.round(cumPnl * 100) / 100,
        r: Math.round(cumR * 10) / 10,
      });
    });
    return pts;
  }, [closedTrades]);

  const totalRealizedR = cumulativeSeries[cumulativeSeries.length - 1]?.r || 0;

  const bestSessionName = sessionStats[0]?.name ? `${sessionStats[0].name} Specialist` : 'Multi-Session Desk';

  const copyId = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyShareSummary = () => {
    const summaryText = [
      `TradePulse Gold — Verified XAU/USD Trader Passport`,
      `Trader: ${profileMeta.displayName} (${profileMeta.handle})`,
      `Rank: ${rank.label} (Score ${profileScore.overall}/100)`,
      `Win Rate: ${stats.winRate}% | Profit Factor: ${stats.profitFactor.toFixed(2)} | Avg R:R: 1:${stats.avgRR}`,
      `Max Drawdown: -${stats.maxDrawdownPct.toFixed(1)}% | Discipline: ${cleanSetupStats.cleanPct}% (${closedTrades.length} trades)`,
    ].join('\n');
    navigator.clipboard.writeText(summaryText);
    setCopiedShareSummary(true);
    setTimeout(() => setCopiedShareSummary(false), 1800);
  };

  const formatMoney = (amount, showPlus = true) => {
    const n = Number(amount) || 0;
    if (privacyMode) {
      return '••••';
    }
    const prefix = showPlus && n > 0 ? '+' : n < 0 ? '-' : '';
    return `${prefix}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* ── Top Page Header & Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            Institutional Trader Passport
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Verified XAU/USD performance rating, 5-axis edge pentagon, psychological audit, and capital allocation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sub-account scope selector */}
          <select
            aria-label="Select account scope for profile metrics"
            value={activeAccountId}
            onChange={(e) => setActiveAccountId(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold terminal-select"
          >
            <option value="all">All Trading Accounts ({trades.length} trades)</option>
            {tradingAccounts
              .filter((a) => !a.isArchived)
              .map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.broker})
                </option>
              ))}
          </select>

          {/* Privacy Mode Toggle ($ vs R) */}
          <button
            type="button"
            onClick={() => setPrivacyMode((p) => !p)}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:opacity-85"
            style={{
              background: 'var(--color-elevated)',
              borderColor: privacyMode ? 'var(--color-accent)' : 'var(--color-border-soft)',
              color: privacyMode ? 'var(--color-accent)' : 'var(--color-text-main)',
            }}
            title="Toggle dollar balance privacy"
          >
            {privacyMode ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{privacyMode ? 'Balances Hidden' : 'Hide $ Amounts'}</span>
          </button>

          {/* Edit Single Encrypted Profile */}
          <button
            type="button"
            onClick={() => handleOpenEditProfile(activeProfile)}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:border-amber-500/50"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
              color: 'var(--color-text-main)',
            }}
          >
            <Edit3 size={13} className="text-amber-500 dark:text-[#C9A227]" /> Edit Profile
          </button>

          {/* Share Verified Card */}
          <button
            type="button"
            onClick={() => setIsShareCardOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Share2 size={13} /> Share Trader Card
          </button>
        </div>
      </div>

      {/* ── Institutional Passport Hero Banner ── */}
      <div className="terminal-card overflow-hidden">
        <div className="p-6 lg:p-7 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: Avatar + Trader Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0 flex-1">
            <div className="relative shrink-0 group">
              {profileMeta.imageProfile ? (
                <img
                  src={profileMeta.imageProfile}
                  alt={profileMeta.displayName}
                  onClick={() => handleOpenEditProfile(activeProfile)}
                  className="w-20 h-20 rounded-2xl object-cover shadow-xl border border-amber-400/40 cursor-pointer transition-transform group-hover:scale-[1.02]"
                  title="Click to change profile image"
                />
              ) : (
                <div
                  onClick={() => handleOpenEditProfile(activeProfile)}
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold font-display text-[#080A0D] shadow-xl border border-amber-400/40 cursor-pointer transition-transform group-hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, #F3D371 0%, #C9A227 55%, #8A7332 100%)',
                  }}
                  title="Click to upload profile image"
                >
                  {(profileMeta.displayName || defaultName).charAt(0).toUpperCase()}
                </div>
              )}
              <div
                className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono-num font-bold border shadow-sm"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border-dark)',
                  color: rank.color,
                }}
              >
                LVL {Math.max(1, Math.ceil(profileScore.overall / 20))}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold font-display truncate" style={{ color: 'var(--color-text-main)' }}>
                  {profileMeta.displayName}
                </h2>
                <span className="text-xs font-mono-num" style={{ color: 'var(--color-text-dim)' }}>
                  {profileMeta.handle}
                </span>
                <Pill tone="gold">{profileMeta.tag || rank.label}</Pill>
                {isCloudActive && (
                  <Pill tone="profit">
                    <Shield size={11} /> Verified Cloud Desk
                  </Pill>
                )}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono-num font-bold border bg-emerald-500/10 text-emerald-700 dark:text-[#3FA88C] border-emerald-500/30"
                  title={`All profile attributes are encrypted at rest (enc:tp256:v1) • Fingerprint: #${profileMeta.encryptionFingerprint}`}
                >
                  <Lock size={10} /> AES-256 Encrypted • #{profileMeta.encryptionFingerprint.slice(0, 8)}
                </span>
              </div>

              <p className="text-xs leading-relaxed max-w-2xl" style={{ color: 'var(--color-text-muted)' }}>
                “{profileMeta.motto}”
              </p>

              {/* Tag Chips Row */}
              {profileMeta.tags && profileMeta.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {profileMeta.tags.map((tg) => (
                    <span
                      key={tg}
                      className="px-2 py-0.5 rounded-md text-[10px] font-mono-num font-semibold border bg-amber-500/10 text-amber-700 dark:text-[#E5B83B] border-amber-500/25"
                    >
                      #{tg}
                    </span>
                  ))}
                </div>
              )}

              {/* Metadata Pills */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs" style={{ color: 'var(--color-text-dim)' }}>
                <span className="inline-flex items-center gap-1.5">
                  <Compass size={12} className="text-amber-500 dark:text-[#C9A227]" />
                  <strong style={{ color: 'var(--color-text-main)' }}>{profileMeta.style}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sliders size={12} className="text-emerald-500 dark:text-[#3FA88C]" />
                  <span>{profileMeta.riskProfile}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>{profileMeta.preferredSession || bestSessionName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>Joined {joinedDate}</span>
                </span>
                {userId && (
                  <button
                    type="button"
                    onClick={copyId}
                    className="inline-flex items-center gap-1 font-mono-num hover:opacity-80 transition-opacity"
                    title="Copy Trader UID"
                  >
                    <span>UID: {userId.slice(0, 8)}…</span>
                    {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenEditProfile(activeProfile)}
                  className="inline-flex items-center gap-1 text-amber-600 dark:text-[#E5B83B] font-semibold hover:underline"
                >
                  <Edit3 size={11} /> Edit Profile
                </button>
              </div>
            </div>
          </div>

          {/* Right: Trader Score Gauge & Next Rank Progress */}
          <div
            className="w-full lg:w-72 p-4 rounded-xl border flex items-center gap-4 shrink-0"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `conic-gradient(${rank.color} ${profileScore.overall * 3.6}deg, var(--color-border-soft) 0deg)`,
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex flex-col items-center justify-center"
                style={{ background: 'var(--color-surface)' }}
              >
                <span className="text-base font-bold font-mono-num leading-none" style={{ color: rank.color }}>
                  {profileScore.overall}
                </span>
                <span className="text-[9px] font-mono-num mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                  /100
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display truncate" style={{ color: 'var(--color-text-main)' }}>
                  Edge Rating
                </span>
                <span className="text-[11px] font-mono-num font-semibold" style={{ color: rank.color }}>
                  {unlockedCount}/{achievements.length} Badges
                </span>
              </div>
              <MiniBar pct={profileScore.overall} color={rank.color} />
              <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {rank.nextLabel
                  ? `${rank.pointsToNext} pts to unlock ${rank.nextLabel}`
                  : 'Top Institutional Tier Unlocked'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Encrypted Single Profile Modal ── */}
      <ProfileFormModal
        isOpen={isProfileModalOpen}
        mode="edit"
        initialProfile={editingProfileTarget || activeProfile}
        userId={userId}
        tradingAccounts={tradingAccounts}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfileModal}
      />

      {/* ── Navigation Tabs ── */}
      <div
        className="flex gap-1 p-1 rounded-xl border w-full sm:w-fit"
        style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
      >
        {[
          { key: 'overview', label: 'Edge & Performance', icon: TrendingUp },
          { key: 'psychology', label: 'Psychology & Discipline Audit', icon: Shield },
          { key: 'accounts', label: 'Capital, Plans & Security', icon: Briefcase },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] font-bold shadow-sm'
                  : 'hover:opacity-80'
              }`}
              style={!isActive ? { color: 'var(--color-text-muted)' } : undefined}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: EDGE & PERFORMANCE (2-Column Institutional Bento Grid)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Primary 6-Metric Executive Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {[
              {
                label: 'Net Realized P&L',
                value: formatMoney(stats.totalPnl),
                sub: `${totalRealizedR >= 0 ? '+' : ''}${totalRealizedR}R cumulative`,
                color: stats.totalPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
              },
              {
                label: 'Win Rate',
                value: `${stats.winRate}%`,
                sub: `${stats.wins}W · ${stats.losses}L · ${stats.breakevens}BE`,
                color: 'var(--color-accent)',
              },
              {
                label: 'Profit Factor',
                value: stats.profitFactor.toFixed(2),
                sub: stats.profitFactor >= 1.5 ? 'Institutional edge' : 'Target ≥ 1.50',
                color: stats.profitFactor >= 1.5 ? 'var(--color-profit)' : 'var(--color-text-main)',
              },
              {
                label: 'Avg Realized R:R',
                value: `1 : ${stats.avgRR}`,
                sub: `Expectancy ${formatMoney(expectancy.expectancy)}`,
                color: 'var(--color-profit)',
              },
              {
                label: 'Max Drawdown',
                value: `-${stats.maxDrawdownPct.toFixed(1)}%`,
                sub: privacyMode ? '•••• peak-to-valley' : `$${stats.maxDrawdownDollar.toFixed(2)} peak drop`,
                color: stats.maxDrawdownPct > 10 ? 'var(--color-loss)' : 'var(--color-text-main)',
              },
              {
                label: 'Rule Discipline',
                value: `${cleanSetupStats.cleanPct}%`,
                sub: `${cleanSetupStats.cleanCount}/${closedTrades.length} clean setups`,
                color: cleanSetupStats.cleanPct >= 80 ? 'var(--color-profit)' : 'var(--color-accent)',
              },
            ].map((kpi) => (
              <div key={kpi.label} className="terminal-card p-4 flex flex-col justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                  {kpi.label}
                </span>
                <div className="text-xl font-bold font-mono-num" style={{ color: kpi.color }}>
                  {kpi.value}
                </div>
                <span className="text-[11px] font-mono-num truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {kpi.sub}
                </span>
              </div>
            ))}
          </div>

          {/* 12-Column Bento Grid: Left (5 cols Radar Pentagon) | Right (7 cols Cumulative Curve + Executive Ledger) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 5 Cols: 5-Axis Edge Pentagon Radar */}
            <div className="lg:col-span-5 terminal-card p-5 flex flex-col justify-between space-y-4">
              <SectionLabel
                right={
                  <span className="text-xs font-mono-num font-bold" style={{ color: rank.color }}>
                    {profileScore.overall} / 100 PTS
                  </span>
                }
              >
                5-Axis Trader Edge Pentagon
              </SectionLabel>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="74%" data={profileScore.dimensions}>
                    <PolarGrid stroke="var(--color-border-dark)" />
                    <PolarAngleAxis
                      dataKey="axis"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Trader Edge"
                      dataKey="score"
                      stroke="#C9A227"
                      strokeWidth={2}
                      fill="#C9A227"
                      fillOpacity={0.28}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-dark)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--color-text-main)',
                      }}
                      formatter={(val) => [`${val} / 100 pts`, 'Score']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Dimension Breakdown Bars */}
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--color-border-soft)' }}>
                {profileScore.dimensions.map((d) => (
                  <div key={d.axis} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>
                        {d.label}
                      </span>
                      <div className="flex items-center gap-2 font-mono-num">
                        <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>
                          {d.value}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                          (target {d.target})
                        </span>
                        <span
                          className="font-bold w-10 text-right"
                          style={{
                            color:
                              d.score >= 70
                                ? 'var(--color-profit)'
                                : d.score >= 45
                                ? 'var(--color-accent)'
                                : 'var(--color-loss)',
                          }}
                        >
                          {d.score}p
                        </span>
                      </div>
                    </div>
                    <MiniBar
                      pct={d.score}
                      color={
                        d.score >= 70
                          ? 'var(--color-profit)'
                          : d.score >= 45
                          ? 'var(--color-accent)'
                          : 'var(--color-loss)'
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right 7 Cols: Cumulative R / $ Curve + Detailed Financial Audit */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Cumulative Performance Curve */}
              <div className="terminal-card p-5 space-y-3">
                <SectionLabel
                  right={
                    <span className="text-xs font-mono-num font-semibold" style={{ color: 'var(--color-profit)' }}>
                      {privacyMode
                        ? `${totalRealizedR >= 0 ? '+' : ''}${totalRealizedR}R Cumulative`
                        : `${formatMoney(stats.totalPnl)} (${totalRealizedR >= 0 ? '+' : ''}${totalRealizedR}R)`}
                    </span>
                  }
                >
                  {privacyMode ? 'Cumulative R-Multiple Trajectory' : 'Cumulative Realized P&L Trajectory'}
                </SectionLabel>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulativeSeries} margin={{ left: -15, right: 8, top: 6, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profileEqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3FA88C" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#3FA88C" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--color-border-soft)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--color-border-soft)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-dark)',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--color-text-main)',
                        }}
                        formatter={(val) => [
                          privacyMode ? `${val}R` : `$${Number(val).toLocaleString()}`,
                          privacyMode ? 'Cumulative R' : 'Cumulative P&L',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey={privacyMode ? 'r' : 'pnl'}
                        stroke="#3FA88C"
                        strokeWidth={2.2}
                        fill="url(#profileEqGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two-column Executive Ledger */}
              <div className="terminal-card p-5">
                <SectionLabel>Institutional Execution Ledger</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mt-3">
                  <div>
                    <StatRow
                      label="Gross Winning Trades"
                      value={`${stats.wins} trades`}
                      sub={`Avg Win ${formatMoney(stats.avgWin, false)}`}
                      tone="profit"
                    />
                    <StatRow
                      label="Gross Losing Trades"
                      value={`${stats.losses} trades`}
                      sub={`Avg Loss ${formatMoney(stats.avgLoss, false)}`}
                      tone={stats.losses > stats.wins ? 'loss' : 'default'}
                    />
                    <StatRow
                      label="Expectancy per Trade"
                      value={formatMoney(expectancy.expectancy)}
                      sub={expectancy.sizingAdvice || 'Expected return per execution'}
                      tone={expectancy.expectancy >= 0 ? 'profit' : 'loss'}
                    />
                    <StatRow
                      label="Sharpe Ratio (Annualized)"
                      value={sharpe?.sharpeRatio ? sharpe.sharpeRatio.toFixed(2) : '—'}
                      sub={sharpe?.sampleSize >= 30 ? `${sharpe.sampleSize} trades sample` : 'Requires 30+ closed trades'}
                      tone={sharpe?.sharpeRatio >= 1 ? 'gold' : 'default'}
                    />
                  </div>
                  <div>
                    <StatRow
                      label="Win / Loss Streak Record"
                      value={`${streakStats.maxWin}W / ${streakStats.maxLoss}L`}
                      sub={`Current: ${streakStats.currentStreak}`}
                      tone="gold"
                    />
                    <StatRow
                      label="Profitable Trading Days"
                      value={`${dayStats.profitableDays} / ${dayStats.totalDays} days`}
                      sub={
                        dayStats.totalDays > 0
                          ? `${Math.round((dayStats.profitableDays / dayStats.totalDays) * 100)}% green days`
                          : 'No active days yet'
                      }
                      tone="profit"
                    />
                    <StatRow
                      label="Best Single Day"
                      value={dayStats.best ? formatMoney(dayStats.best.pnl) : '—'}
                      sub={dayStats.best?.date}
                      tone="profit"
                    />
                    <StatRow
                      label="Worst Single Day"
                      value={dayStats.worst ? formatMoney(dayStats.worst.pnl) : '—'}
                      sub={dayStats.worst?.date}
                      tone="loss"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Edge & Milestones Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Session Edge (5 cols) */}
            <div className="lg:col-span-5 terminal-card p-5 space-y-4">
              <SectionLabel right={<span className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>24H GMT</span>}>
                Session Edge Specialization
              </SectionLabel>
              {sessionStats.length === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  Log trades to unlock session specialization metrics.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {sessionStats.map((s) => {
                    const maxPnl = Math.max(...sessionStats.map((x) => Math.abs(x.pnl)), 1);
                    const isPos = s.pnl >= 0;
                    return (
                      <div key={s.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: isPos ? 'var(--color-profit)' : 'var(--color-loss)' }}
                            />
                            <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>
                              {s.name}
                            </span>
                            <span className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>
                              {s.trades} trades
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono-num">
                            <span style={{ color: 'var(--color-text-muted)' }}>{s.winRate}% WR</span>
                            <span
                              className="font-bold"
                              style={{ color: isPos ? 'var(--color-profit)' : 'var(--color-loss)' }}
                            >
                              {formatMoney(s.pnl)}
                            </span>
                          </div>
                        </div>
                        <MiniBar
                          pct={(Math.abs(s.pnl) / maxPnl) * 100}
                          color={isPos ? 'var(--color-profit)' : 'var(--color-loss)'}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Achievement Trophy Case (7 cols) */}
            <div className="lg:col-span-7 terminal-card p-5 space-y-4">
              <SectionLabel
                right={
                  <span className="text-xs font-mono-num font-bold text-amber-600 dark:text-[#C9A227]">
                    {unlockedCount} / {achievements.length} Unlocked
                  </span>
                }
              >
                Verified Trader Milestones &amp; Badges
              </SectionLabel>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements.map((ach) => {
                  const Icon = ach.icon;
                  return (
                    <div
                      key={ach.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                        ach.unlocked ? '' : 'opacity-65'
                      }`}
                      style={{
                        background: 'var(--color-elevated)',
                        borderColor: ach.unlocked ? 'rgba(201, 162, 39, 0.4)' : 'var(--color-border-soft)',
                      }}
                    >
                      <div
                        className={`p-2.5 rounded-xl border shrink-0 flex items-center justify-center ${
                          ach.unlocked
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-[#E5B83B]'
                            : ''
                        }`}
                        style={
                          !ach.unlocked
                            ? {
                                background: 'var(--color-surface)',
                                borderColor: 'var(--color-border-soft)',
                                color: 'var(--color-text-dim)',
                              }
                            : undefined
                        }
                      >
                        {ach.unlocked ? <Icon size={16} /> : <Lock size={15} />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                            {ach.title}
                          </span>
                          <span
                            className="text-[10px] font-mono-num font-semibold shrink-0"
                            style={{
                              color: ach.unlocked ? 'var(--color-profit)' : 'var(--color-text-dim)',
                            }}
                          >
                            {ach.unlocked ? 'UNLOCKED' : ach.progress}
                          </span>
                        </div>
                        <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                          {ach.desc}
                        </p>
                        <MiniBar
                          pct={ach.pct}
                          color={ach.unlocked ? 'var(--color-profit)' : 'var(--color-accent)'}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: PSYCHOLOGY & DISCIPLINE AUDIT
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'psychology' && (
        <div className="space-y-6">
          {/* Top Summary Cards: Discipline Score, Clean Setups, Cost of Mistakes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="terminal-card p-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Execution Discipline Score
              </span>
              <div className="text-2xl font-bold font-mono-num" style={{ color: 'var(--color-profit)' }}>
                {cleanSetupStats.cleanPct}%
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {cleanSetupStats.cleanCount} of {closedTrades.length} trades executed without rule violations or impulsive tags.
              </p>
            </div>

            <div className="terminal-card p-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Cost of Discipline Leaks
              </span>
              <div className="text-2xl font-bold font-mono-num" style={{ color: 'var(--color-loss)' }}>
                {formatMoney(-cleanSetupStats.mistakeCost, false)}
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Realized losses on trades flagged with Revenge, FOMO, Overtrading, or rule mistakes.
              </p>
            </div>

            <div className="terminal-card p-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Optimal Mental State
              </span>
              <div className="text-2xl font-bold font-display text-amber-600 dark:text-[#E5B83B]">
                {emotionStats[0]?.emotion || 'Planned'}
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {emotionStats[0]
                  ? `Yields ${formatMoney(emotionStats[0].avgPnl)} avg per trade (${emotionStats[0].winRate}% win rate).`
                  : 'Log trade emotions to identify your peak psychological state.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Emotion vs Avg P&L Chart & Table (7 cols) */}
            <div className="lg:col-span-7 terminal-card p-5 space-y-4">
              <SectionLabel>Mental State vs. Average P&amp;L per Trade</SectionLabel>

              {emotionStats.length === 0 ? (
                <p className="text-xs py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  No emotion data logged yet.
                </p>
              ) : (
                <>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={emotionStats} layout="vertical" margin={{ left: 10, right: 16 }}>
                        <CartesianGrid stroke="var(--color-border-soft)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="emotion"
                          tick={{ fill: 'var(--color-text-main)', fontSize: 11, fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                          width={105}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-dark)',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'var(--color-text-main)',
                          }}
                          formatter={(val) => [`$${val}/trade`, 'Avg P&L']}
                        />
                        <Bar dataKey="avgPnl" radius={[0, 4, 4, 0]}>
                          {emotionStats.map((entry, idx) => (
                            <Cell key={idx} fill={entry.avgPnl >= 0 ? '#3FA88C' : '#C1502E'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div
                    className="p-3.5 rounded-xl border text-xs leading-relaxed"
                    style={{
                      background: 'var(--color-elevated)',
                      borderColor: 'var(--color-border-soft)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <strong style={{ color: 'var(--color-profit)' }}>Behavioral Edge Insight:</strong>{' '}
                    Executing in a <strong>{emotionStats[0]?.emotion}</strong> state averages{' '}
                    <strong>{formatMoney(emotionStats[0]?.avgPnl)}/trade</strong>.
                    {emotionStats[emotionStats.length - 1]?.avgPnl < 0 && (
                      <>
                        {' '}
                        Eliminating <strong>{emotionStats[emotionStats.length - 1]?.emotion}</strong> setups (
                        {formatMoney(emotionStats[emotionStats.length - 1]?.avgPnl)}/trade) is your fastest path to
                        boosting expectancy.
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Discipline Audit & Mistake Frequency (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div className="terminal-card p-5 space-y-3">
                <SectionLabel
                  right={
                    <button
                      onClick={() => setActivePage('mistakes')}
                      className="text-xs text-amber-600 dark:text-[#C9A227] hover:underline flex items-center gap-1"
                    >
                      Mistake Center <ChevronRight size={12} />
                    </button>
                  }
                >
                  Behavioral Tag Breakdown
                </SectionLabel>

                {[
                  {
                    label: 'Planned Playbook Setups',
                    value: closedTrades.filter((t) => t.emotion === 'Planned').length,
                    warn: false,
                    icon: CheckCircle2,
                    note: 'Executed according to pre-session rules',
                  },
                  {
                    label: 'Revenge Trades',
                    value: closedTrades.filter((t) => t.emotion === 'Revenge Trade').length,
                    warn: true,
                    icon: AlertTriangle,
                    note: 'Entered within 15m of a prior losing trade',
                  },
                  {
                    label: 'FOMO / Chasing Price',
                    value: closedTrades.filter((t) => t.emotion === 'FOMO').length,
                    warn: true,
                    icon: Zap,
                    note: 'Impulsive entry after impulse candle expansion',
                  },
                  {
                    label: 'Late / Sub-1R Entries',
                    value: closedTrades.filter((t) => t.emotion === 'Late Entry').length,
                    warn: true,
                    icon: Clock,
                    note: 'Compromised stop-loss distance and R:R',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-2.5 border-b last:border-0"
                    style={{ borderColor: 'var(--color-border-soft)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon
                        size={14}
                        style={{ color: item.warn ? 'var(--color-loss)' : 'var(--color-profit)' }}
                      />
                      <div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                          {item.label}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          {item.note}
                        </div>
                      </div>
                    </div>
                    <span
                      className="text-sm font-bold font-mono-num"
                      style={{
                        color:
                          item.warn && item.value > 0
                            ? 'var(--color-loss)'
                            : item.warn
                            ? 'var(--color-text-muted)'
                            : 'var(--color-profit)',
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rule Mistakes */}
              <div className="terminal-card p-5 space-y-3">
                <SectionLabel>Automated Rule Violations</SectionLabel>
                {(() => {
                  const mistakeMap = {};
                  for (const t of closedTrades) {
                    for (const m of t.mistakes || []) {
                      mistakeMap[m] = (mistakeMap[m] || 0) + 1;
                    }
                  }
                  const entries = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]);
                  if (entries.length === 0) {
                    return (
                      <div
                        className="text-xs py-4 text-center flex items-center justify-center gap-2"
                        style={{ color: 'var(--color-profit)' }}
                      >
                        <CheckCircle2 size={15} /> Zero rule violations detected. Clean institutional journal!
                      </div>
                    );
                  }
                  const maxCount = entries[0][1];
                  return entries.map(([mistake, count]) => (
                    <div key={mistake} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>
                          {mistake}
                        </span>
                        <span className="font-bold font-mono-num" style={{ color: 'var(--color-loss)' }}>
                          {count}×
                        </span>
                      </div>
                      <MiniBar pct={(count / maxCount) * 100} color="var(--color-loss)" />
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3: CAPITAL, PLANS & SECURITY
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 Cols: Sub-Accounts & Target Plans */}
          <div className="lg:col-span-7 space-y-5">
            {/* Trading Sub-Accounts with Live Realized Equity */}
            <div className="terminal-card p-5 space-y-4">
              <SectionLabel
                right={
                  <span className="text-xs font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                    {tradingAccounts.filter((a) => !a.isArchived).length} Active Desks
                  </span>
                }
              >
                Trading Sub-Accounts &amp; Live Equity
              </SectionLabel>

              {tradingAccounts.length === 0 ? (
                <div className="text-xs py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  No sub-accounts configured.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tradingAccounts.map((acc) => {
                    const accTrades = trades.filter((t) => t.accountId === acc.id || (!t.accountId && acc.isDefault));
                    const accPnl = accTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
                    const initBal = Number(acc.initialBalance) || 0;
                    const curEquity = initBal + accPnl;
                    const retPct = initBal > 0 ? ((accPnl / initBal) * 100).toFixed(1) : '0.0';

                    return (
                      <div
                        key={acc.id}
                        className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border ${
                          acc.isArchived ? 'opacity-45' : ''
                        }`}
                        style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-[#080A0D] shrink-0 shadow-sm"
                            style={{ background: acc.colorHex || '#C9A227' }}
                          >
                            {(acc.broker || acc.name || 'MT').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold truncate" style={{ color: 'var(--color-text-main)' }}>
                                {acc.name}
                              </span>
                              {acc.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-[#C9A227] rounded font-bold">
                                  PRIMARY
                                </span>
                              )}
                              {acc.isArchived && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                  style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                                >
                                  ARCHIVED
                                </span>
                              )}
                            </div>
                            <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                              {acc.broker} · {acc.accountType?.toUpperCase()} · {acc.leverage} · {accTrades.length} trades
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono-num">
                          <div className="text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                            {formatMoney(curEquity, false)}{' '}
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: accPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
                            >
                              ({accPnl >= 0 ? '+' : ''}
                              {retPct}%)
                            </span>
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                            Initial: {formatMoney(initBal, false)} {acc.currency}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Target Plans with Accurate Realized Equity Progress */}
            <div className="terminal-card p-5 space-y-4">
              <SectionLabel
                right={
                  <button
                    onClick={() => setActivePage('targetplan')}
                    className="text-xs text-amber-600 dark:text-[#C9A227] hover:underline flex items-center gap-1"
                  >
                    Open Growth Planner <ChevronRight size={12} />
                  </button>
                }
              >
                Capital Growth Plans
              </SectionLabel>

              {targetPlans.length === 0 ? (
                <div className="text-xs py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  No target plans configured yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {targetPlans.map((plan) => {
                    const planTrades =
                      !plan.accountId || plan.accountId === 'all'
                        ? trades
                        : trades.filter((t) => !t.accountId || t.accountId === plan.accountId);
                    const realizedPnl = planTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
                    const targetGain = Math.max(1, (Number(plan.targetBalance) || 0) - (Number(plan.startingBalance) || 0));
                    const progress = Math.min(100, Math.max(0, (realizedPnl / targetGain) * 100));
                    const isActive = plan.id === activePlan?.id;

                    return (
                      <div
                        key={plan.id}
                        className={`p-4 rounded-xl border ${isActive ? 'border-amber-500/60' : ''}`}
                        style={{
                          background: 'var(--color-elevated)',
                          borderColor: !isActive ? 'var(--color-border-soft)' : undefined,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                                {plan.name}
                              </span>
                              {isActive && <Pill tone="gold">ACTIVE</Pill>}
                            </div>
                            <div className="text-[11px] mt-0.5 font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                              {formatMoney(plan.startingBalance, false)} ➔ {formatMoney(plan.targetBalance, false)} ·{' '}
                              {plan.riskPerTradePct}% risk · 1:{plan.targetRR} RR
                            </div>
                          </div>
                          <Pill tone={plan.status === 'active' ? 'profit' : 'neutral'}>
                            {(plan.status || 'active').toUpperCase()}
                          </Pill>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            <span>
                              Realized Plan Gain: <strong style={{ color: 'var(--color-text-main)' }}>{formatMoney(realizedPnl)}</strong>
                            </span>
                            <span className="font-mono-num font-bold text-amber-600 dark:text-[#C9A227]">
                              {Math.round(progress)}%
                            </span>
                          </div>
                          <MiniBar pct={progress} color="var(--color-profit)" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right 5 Cols: Desk Configuration & Security Status */}
          <div className="lg:col-span-5 space-y-5">
            <div className="terminal-card p-5">
              <SectionLabel
                right={
                  <button
                    onClick={() => setActivePage('settings')}
                    className="text-xs text-amber-600 dark:text-[#C9A227] hover:underline flex items-center gap-1"
                  >
                    Edit <ChevronRight size={12} />
                  </button>
                }
              >
                Risk &amp; Contract Specification
              </SectionLabel>
              <div className="mt-3">
                <StatRow label="Default Risk per Trade" value={`${settings.defaultRiskPct}%`} sub="Position sizing baseline" />
                <StatRow label="Base Account Capital" value={formatMoney(settings.accountBalance || 0, false)} tone="gold" />
                <StatRow label="XAU/USD Contract Size" value={`${settings.contractSize || 100} oz / lot`} sub="Standard spot gold contract" />
                <StatRow label="Desk Timezone" value={settings.sessionTimezone || 'UTC'} />
                <StatRow
                  label="Cloud Backup & RLS"
                  value={isCloudActive ? 'Encrypted & Active' : isDemoMode ? 'Demo Sandbox' : 'Local Only'}
                  tone={isCloudActive ? 'profit' : 'gold'}
                />
              </div>
            </div>

            {/* Session & Security Card */}
            <div className="terminal-card p-5 space-y-4">
              <SectionLabel>Authenticated Session &amp; Security</SectionLabel>
              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                    {email}
                  </span>
                  <Pill tone={isCloudActive ? 'profit' : 'gold'}>
                    {isCloudActive ? 'RLS Protected' : 'Demo Mode'}
                  </Pill>
                </div>
                {userId && (
                  <div className="text-[11px] font-mono-num flex items-center justify-between" style={{ color: 'var(--color-text-dim)' }}>
                    <span>UID: {userId.slice(0, 18)}…</span>
                    <button
                      type="button"
                      onClick={copyId}
                      className="text-amber-600 dark:text-[#C9A227] hover:underline flex items-center gap-1"
                    >
                      {copied ? 'Copied' : 'Copy UID'}
                    </button>
                  </div>
                )}
              </div>

              {userSession && (
                <button
                  onClick={signOut}
                  className="w-full py-2.5 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors text-xs font-bold flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> Sign Out of Trading Desk
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SHAREABLE VERIFIED TRADER CARD MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {isShareCardOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Shareable Verified Trader Card"
            onClick={() => setIsShareCardOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop-glass"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="max-w-lg w-full rounded-2xl overflow-hidden border shadow-2xl modal-card-pop"
              style={{ background: 'var(--color-surface)', borderColor: 'rgba(201, 162, 39, 0.45)' }}
            >
            {/* Top Gold Strip */}
            <div
              className="h-2 w-full"
              style={{ background: 'linear-gradient(90deg, #C9A227 0%, #F3D371 50%, #3FA88C 100%)' }}
            />

            <div className="p-6 space-y-5">
              {/* Brand Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LogoIcon size={28} />
                  <div>
                    <div className="text-xs font-bold font-display tracking-wider uppercase text-amber-600 dark:text-[#E5B83B]">
                      TradePulse Gold · Verified Passport
                    </div>
                    <div className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>
                      XAU/USD Institutional Performance Audit
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsShareCardOpen(false)}
                  aria-label="Close share card"
                  className="p-1.5 rounded-lg hover:opacity-80"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Trader Identity Row */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between gap-4"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold font-display text-[#080A0D] shrink-0"
                    style={{ background: 'linear-gradient(135deg, #F3D371, #C9A227)' }}
                  >
                    {(profileMeta.displayName || defaultName).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold font-display truncate" style={{ color: 'var(--color-text-main)' }}>
                      {profileMeta.displayName}
                    </div>
                    <div className="text-xs font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                      {profileMeta.handle} · {profileMeta.style}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold font-mono-num" style={{ color: rank.color }}>
                    {profileScore.overall}
                    <span className="text-xs font-normal" style={{ color: 'var(--color-text-dim)' }}>
                      /100
                    </span>
                  </div>
                  <div className="text-[11px] font-bold" style={{ color: rank.color }}>
                    {rank.label}
                  </div>
                </div>
              </div>

              {/* 4 Key Audited Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    label: privacyMode ? 'Net R Return' : 'Net Return',
                    value: privacyMode ? `${totalRealizedR >= 0 ? '+' : ''}${totalRealizedR}R` : formatMoney(stats.totalPnl),
                    color: 'var(--color-profit)',
                  },
                  { label: 'Win Rate', value: `${stats.winRate}%`, color: 'var(--color-accent)' },
                  { label: 'Profit Factor', value: stats.profitFactor.toFixed(2), color: 'var(--color-profit)' },
                  { label: 'Avg R:R', value: `1 : ${stats.avgRR}`, color: 'var(--color-text-main)' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="p-3 rounded-xl border text-center"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
                  >
                    <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-dim)' }}>
                      {m.label}
                    </div>
                    <div className="text-sm font-bold font-mono-num mt-1" style={{ color: m.color }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: 'var(--color-border-soft)' }}>
                <span className="font-mono-num text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                  Sample: {closedTrades.length} XAU/USD trades · Discipline {cleanSetupStats.cleanPct}%
                </span>
                <button
                  type="button"
                  onClick={handleCopyShareSummary}
                  className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  {copiedShareSummary ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedShareSummary ? 'Copied Summary!' : 'Copy Stats Summary'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}
