import React, { useState, useMemo } from 'react';
import {
  User,
  Shield,
  Cloud,
  LogOut,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Award,
  Zap,
  Calendar,
  BarChart2,
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
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { SectionLabel } from '../components/SectionLabel';
import { calculateExpectancy, calculateSharpeRatio } from '../utils/edgeAnalytics';

// ── Helpers ──────────────────────────────────────────────────────────
function StatRow({ label, value, sub, accent = false, warn = false }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#1E2328] last:border-0">
      <span className="text-xs text-[#8B8D91]">{label}</span>
      <div className="text-right">
        <span
          className={`text-xs font-bold font-mono-num ${
            warn ? 'text-[#E85D5D]' : accent ? 'text-[#C9A227]' : 'text-[#EDEAE3]'
          }`}
        >
          {value}
        </span>
        {sub && <div className="text-[10px] text-[#555A60] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function BadgeChip({ icon: Icon, label, color = '#C9A227', bg = '#2A2311' }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
      style={{ background: bg, color }}
    >
      <Icon size={11} />
      {label}
    </div>
  );
}

function MiniBar({ pct, color }) {
  return (
    <div className="w-full h-1.5 bg-[#1E2328] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}

// ── Badge logic ──────────────────────────────────────────────────────
function computeBadges(stats, trades) {
  const badges = [];
  if (stats.totalTrades >= 100) badges.push({ icon: Trophy, label: '100 Trades Club', color: '#C9A227', bg: '#2A2311' });
  else if (stats.totalTrades >= 50) badges.push({ icon: Star, label: '50 Trades', color: '#C9A227', bg: '#2A2311' });
  if (stats.winRate >= 65) badges.push({ icon: Flame, label: 'Hot Hand 65%+', color: '#E87C3E', bg: '#2A1A0E' });
  if (stats.profitFactor >= 2) badges.push({ icon: Zap, label: 'PF 2.0+', color: '#3FA88C', bg: '#0D2420' });
  if (stats.avgRR >= 2) badges.push({ icon: Target, label: 'RR Elite', color: '#7C5CFC', bg: '#1A1230' });
  if (stats.totalPnl > 0) badges.push({ icon: TrendingUp, label: 'Net Positive', color: '#3FA88C', bg: '#0D2420' });
  if (stats.maxDrawdownPct < 5 && stats.totalTrades > 10) badges.push({ icon: Shield, label: 'Ironclad DD', color: '#5CA8E8', bg: '#0D1E2A' });

  // Streak badge
  const sorted = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let streak = 0; let maxStreak = 0; let cur = 0;
  for (const t of sorted) {
    if ((t.pnl || 0) > 0) { cur++; maxStreak = Math.max(maxStreak, cur); } else cur = 0;
  }
  if (maxStreak >= 5) badges.push({ icon: Flame, label: `${maxStreak}W Streak`, color: '#E85D5D', bg: '#2A0D0D' });

  return badges;
}

// ── Radar-style profile score ─────────────────────────────────────────
function computeProfileScore(stats) {
  const dimensions = [
    { label: 'Win Rate', score: Math.min(100, (stats.winRate / 70) * 100), value: `${stats.winRate}%`, target: '70%' },
    { label: 'Profit Factor', score: Math.min(100, (stats.profitFactor / 3) * 100), value: stats.profitFactor.toFixed(2), target: '3.0' },
    { label: 'Avg R:R', score: Math.min(100, (stats.avgRR / 3) * 100), value: `${stats.avgRR}:1`, target: '3:1' },
    { label: 'Discipline', score: Math.min(100, 100 - stats.maxDrawdownPct * 5), value: `DD ${stats.maxDrawdownPct.toFixed(1)}%`, target: '<5%' },
    { label: 'Consistency', score: Math.min(100, (stats.totalTrades / 50) * 100), value: `${stats.totalTrades} trades`, target: '50+' },
  ];
  const overall = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
  return { dimensions, overall };
}

function getRank(score) {
  if (score >= 85) return { label: 'Elite Trader', color: '#C9A227', glow: '#C9A22740' };
  if (score >= 70) return { label: 'Advanced', color: '#3FA88C', glow: '#3FA88C40' };
  if (score >= 50) return { label: 'Intermediate', color: '#5CA8E8', glow: '#5CA8E840' };
  if (score >= 30) return { label: 'Developing', color: '#E87C3E', glow: '#E87C3E40' };
  return { label: 'Novice', color: '#8B8D91', glow: '#8B8D9140' };
}

// ── Session breakdown ────────────────────────────────────────────────
function computeSessionStats(trades) {
  const map = {};
  for (const t of trades) {
    if (!t.session) continue;
    if (!map[t.session]) map[t.session] = { trades: 0, pnl: 0, wins: 0 };
    map[t.session].trades++;
    map[t.session].pnl += t.pnl || 0;
    if ((t.pnl || 0) > 0) map[t.session].wins++;
  }
  return Object.entries(map).map(([name, d]) => ({
    name,
    trades: d.trades,
    pnl: Math.round(d.pnl * 100) / 100,
    winRate: d.trades > 0 ? Math.round((d.wins / d.trades) * 100) : 0,
  })).sort((a, b) => b.pnl - a.pnl);
}

// ── Emotion / psychology breakdown ───────────────────────────────────
function computeEmotionStats(trades) {
  const map = {};
  for (const t of trades) {
    const e = t.emotion || 'Planned';
    if (!map[e]) map[e] = { trades: 0, pnl: 0 };
    map[e].trades++;
    map[e].pnl += t.pnl || 0;
  }
  return Object.entries(map)
    .map(([emotion, d]) => ({ emotion, trades: d.trades, avgPnl: d.trades > 0 ? Math.round((d.pnl / d.trades) * 100) / 100 : 0 }))
    .sort((a, b) => b.avgPnl - a.avgPnl);
}

// ── Best / Worst day ─────────────────────────────────────────────────
function computeDayStats(trades) {
  const byDay = {};
  for (const t of trades) {
    const d = (t.date || t.timestamp || '').slice(0, 10);
    if (!d) continue;
    if (!byDay[d]) byDay[d] = 0;
    byDay[d] += t.pnl || 0;
  }
  const days = Object.entries(byDay).map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 100) / 100 }));
  if (!days.length) return { best: null, worst: null };
  return {
    best: days.reduce((a, b) => (b.pnl > a.pnl ? b : a)),
    worst: days.reduce((a, b) => (b.pnl < a.pnl ? b : a)),
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function Profile() {
  const {
    userSession,
    stats,
    trades,
    tradingAccounts,
    targetPlans,
    activePlan,
    settings,
    signOut,
    isDemoMode,
    isCloudActive,
  } = useTrade();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'psychology' | 'accounts'

  const closedTrades = useMemo(() => trades.filter((t) => t.status === 'closed' || t.pnl !== 0), [trades]);

  const expectancy = useMemo(() => calculateExpectancy(closedTrades), [closedTrades]);
  const sharpe = useMemo(() => calculateSharpeRatio(closedTrades, 0.02, 30), [closedTrades]);
  const profileScore = useMemo(() => computeProfileScore(stats), [stats]);
  const rank = getRank(profileScore.overall);
  const badges = useMemo(() => computeBadges(stats, closedTrades), [stats, closedTrades]);
  const sessionStats = useMemo(() => computeSessionStats(closedTrades), [closedTrades]);
  const emotionStats = useMemo(() => computeEmotionStats(closedTrades), [closedTrades]);
  const dayStats = useMemo(() => computeDayStats(closedTrades), [closedTrades]);

  const email = userSession?.user?.email || (isDemoMode ? 'demo@tradepulsegold.app' : '—');
  const userId = userSession?.user?.id || '';
  const joinedDate = userSession?.user?.created_at
    ? new Date(userSession.user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Demo Session';

  const copyId = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Longest win streak
  const longestStreak = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let max = 0, cur = 0;
    for (const t of sorted) { if ((t.pnl || 0) > 0) { cur++; max = Math.max(max, cur); } else cur = 0; }
    return max;
  }, [closedTrades]);

  const sessionColors = { London: '#C9A227', 'New York': '#3FA88C', Asian: '#7C5CFC', 'London Close': '#5CA8E8' };
  const emotionColors = { Planned: '#3FA88C', Emotional: '#E85D5D', 'Late Entry': '#E87C3E', 'Revenge Trade': '#E85D5D', FOMO: '#E87C3E', Overtrading: '#C9A227' };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in select-none pb-8">

      {/* ── Hero Card ── */}
      <div className="terminal-card p-0 overflow-hidden">
        {/* Gold banner strip */}
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #C9A227, #7C5CFC, #3FA88C)' }} />

        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-[#0A0C0E] shadow-xl"
              style={{ background: `radial-gradient(circle at 30% 30%, ${rank.color}, ${rank.color}90)`, boxShadow: `0 0 24px ${rank.glow}` }}
            >
              {email.charAt(0).toUpperCase()}
            </div>
            {isCloudActive && (
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#3FA88C] border-2 border-[#131619] flex items-center justify-center">
                <Cloud size={11} className="text-[#0A0C0E]" />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold font-display text-[#EDEAE3] truncate">{email.split('@')[0]}</h1>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{ background: rank.glow, color: rank.color }}
              >
                {rank.label}
              </span>
            </div>
            <div className="text-xs text-[#555A60] font-mono-num mb-2">{email}</div>
            {userId && (
              <button
                onClick={copyId}
                className="flex items-center gap-1.5 text-[10px] text-[#555A60] hover:text-[#8B8D91] transition-colors font-mono-num"
              >
                <span className="truncate max-w-[180px]">ID: {userId.slice(0, 18)}...</span>
                {copied ? <Check size={10} className="text-[#3FA88C]" /> : <Copy size={10} />}
              </button>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#555A60]">
              <Calendar size={11} />
              <span>Member since {joinedDate}</span>
              {isCloudActive && (
                <>
                  <span className="text-[#262B30]">•</span>
                  <Cloud size={11} className="text-[#3FA88C]" />
                  <span className="text-[#3FA88C]">Cloud Sync Active</span>
                </>
              )}
            </div>
          </div>

          {/* Score ring */}
          <div className="flex-shrink-0 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center relative"
              style={{
                background: `conic-gradient(${rank.color} ${profileScore.overall * 3.6}deg, #1E2328 0deg)`,
              }}
            >
              <div className="w-12 h-12 rounded-full bg-[#131619] flex items-center justify-center flex-col">
                <span className="text-sm font-bold font-mono-num" style={{ color: rank.color }}>
                  {profileScore.overall}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-[#555A60] mt-1">Trader Score</div>
          </div>
        </div>

        {/* Badges row */}
        {badges.length > 0 && (
          <div className="px-6 pb-5 flex flex-wrap gap-2">
            {badges.map((b, i) => (
              <BadgeChip key={i} icon={b.icon} label={b.label} color={b.color} bg={b.bg} />
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-[#131619] p-1 rounded-xl border border-[#1E2328]">
        {[
          { key: 'overview', label: 'Performance' },
          { key: 'psychology', label: 'Psychology' },
          { key: 'accounts', label: 'Accounts & Plans' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-[#C9A227] text-[#0A0C0E]'
                : 'text-[#8B8D91] hover:text-[#EDEAE3]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Performance Overview ── */}
      {activeTab === 'overview' && (
        <>
          {/* Score Breakdown */}
          <div className="terminal-card p-5 space-y-4">
            <SectionLabel>Trader Profile Score Breakdown</SectionLabel>
            <div className="space-y-3">
              {profileScore.dimensions.map((d) => (
                <div key={d.label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-[#8B8D91]">{d.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono-num text-[#EDEAE3]">{d.value}</span>
                      <span className="text-[10px] text-[#555A60]">target {d.target}</span>
                      <span className="text-[11px] font-bold font-mono-num text-[#C9A227]">{Math.round(d.score)}pts</span>
                    </div>
                  </div>
                  <MiniBar pct={d.score} color={d.score >= 70 ? '#3FA88C' : d.score >= 40 ? '#C9A227' : '#E85D5D'} />
                </div>
              ))}
            </div>
          </div>

          {/* Core Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Trades', value: stats.totalTrades, icon: Activity, color: '#5CA8E8' },
              { label: 'Win Rate', value: `${stats.winRate}%`, icon: TrendingUp, color: '#3FA88C' },
              { label: 'Profit Factor', value: stats.profitFactor, icon: Zap, color: '#C9A227' },
              { label: 'Avg R:R', value: `${stats.avgRR}:1`, icon: Target, color: '#7C5CFC' },
            ].map((s) => (
              <div key={s.label} className="terminal-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <s.icon size={14} style={{ color: s.color }} />
                  <span className="text-[10px] text-[#555A60]">{s.label}</span>
                </div>
                <div className="text-xl font-bold font-mono-num" style={{ color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Financial Stats */}
          <div className="terminal-card p-5">
            <SectionLabel>Financial Performance</SectionLabel>
            <div className="mt-3">
              <StatRow label="Net P&L" value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`} accent={stats.totalPnl >= 0} warn={stats.totalPnl < 0} />
              <StatRow label="Gross Wins" value={`${stats.wins} trades`} sub={`Avg win $${stats.avgWin.toFixed(2)}`} accent />
              <StatRow label="Gross Losses" value={`${stats.losses} trades`} sub={`Avg loss $${stats.avgLoss.toFixed(2)}`} warn={stats.losses > stats.wins} />
              <StatRow label="Breakevens" value={stats.breakevens} />
              <StatRow label="Expectancy / Trade" value={`${expectancy.expectancy >= 0 ? '+' : ''}$${(expectancy.expectancy || 0).toFixed(2)}`} accent={expectancy.expectancy >= 0} warn={expectancy.expectancy < 0} sub="Expected $ per trade taken" />
              <StatRow label="Max Drawdown" value={`${stats.maxDrawdownPct.toFixed(1)}%`} sub={`$${stats.maxDrawdownDollar.toFixed(2)}`} warn={stats.maxDrawdownPct > 10} />
              <StatRow label="Sharpe Ratio" value={sharpe?.sharpeRatio ? sharpe.sharpeRatio.toFixed(2) : '—'} sub={sharpe?.sampleSize >= 30 ? `${sharpe.sampleSize} trades sample` : 'Need 30+ trades'} accent={sharpe?.sharpeRatio > 1} />
              <StatRow label="Longest Win Streak" value={`${longestStreak} trades`} accent={longestStreak >= 3} />
              <StatRow label="Best Day" value={dayStats.best ? `+$${dayStats.best.pnl.toFixed(2)}` : '—'} sub={dayStats.best?.date} accent />
              <StatRow label="Worst Day" value={dayStats.worst ? `$${dayStats.worst.pnl.toFixed(2)}` : '—'} sub={dayStats.worst?.date} warn />
            </div>
          </div>

          {/* Session Performance */}
          {sessionStats.length > 0 && (
            <div className="terminal-card p-5 space-y-4">
              <SectionLabel>Session Performance Breakdown</SectionLabel>
              <div className="space-y-3">
                {sessionStats.map((s) => {
                  const maxPnl = Math.max(...sessionStats.map((x) => Math.abs(x.pnl)), 1);
                  const color = sessionColors[s.name] || '#8B8D91';
                  return (
                    <div key={s.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-xs text-[#EDEAE3]">{s.name}</span>
                          <span className="text-[10px] text-[#555A60]">{s.trades} trades</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-[#8B8D91]">{s.winRate}% WR</span>
                          <span
                            className="text-xs font-bold font-mono-num"
                            style={{ color: s.pnl >= 0 ? '#3FA88C' : '#E85D5D' }}
                          >
                            {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <MiniBar pct={(Math.abs(s.pnl) / maxPnl) * 100} color={s.pnl >= 0 ? color : '#E85D5D'} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Psychology ── */}
      {activeTab === 'psychology' && (
        <>
          {/* Emotion vs PnL Breakdown */}
          <div className="terminal-card p-5 space-y-4">
            <SectionLabel>Emotion vs. P&L Correlation</SectionLabel>
            <p className="text-[11px] text-[#555A60]">
              Behavioral audit — which mental states lead to profitable trades?
            </p>
            <div className="space-y-3">
              {emotionStats.length === 0 && (
                <div className="text-xs text-[#555A60] py-4 text-center">No trade emotion data yet.</div>
              )}
              {emotionStats.map((e) => {
                const color = emotionColors[e.emotion] || '#8B8D91';
                const maxAbs = Math.max(...emotionStats.map((x) => Math.abs(x.avgPnl)), 1);
                return (
                  <div key={e.emotion} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs text-[#EDEAE3]">{e.emotion}</span>
                        <span className="text-[10px] text-[#555A60]">{e.trades} trades</span>
                      </div>
                      <span
                        className="text-xs font-bold font-mono-num"
                        style={{ color: e.avgPnl >= 0 ? '#3FA88C' : '#E85D5D' }}
                      >
                        {e.avgPnl >= 0 ? '+' : ''}${e.avgPnl.toFixed(2)}/trade
                      </span>
                    </div>
                    <MiniBar
                      pct={(Math.abs(e.avgPnl) / maxAbs) * 100}
                      color={e.avgPnl >= 0 ? '#3FA88C' : '#E85D5D'}
                    />
                  </div>
                );
              })}
            </div>
            {emotionStats.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-[#0D2420] border border-[#3FA88C]/20 text-[11px] text-[#3FA88C]">
                <strong>Best mental state:</strong>{' '}
                {emotionStats[0]?.emotion} at +${emotionStats[0]?.avgPnl.toFixed(2)}/trade average.{' '}
                {emotionStats[emotionStats.length - 1]?.avgPnl < 0
                  ? `Avoid trading when ${emotionStats[emotionStats.length - 1]?.emotion} (${emotionStats[emotionStats.length - 1]?.avgPnl.toFixed(2)}/trade).`
                  : ''}
              </div>
            )}
          </div>

          {/* Behavioral Red Flags */}
          <div className="terminal-card p-5 space-y-3">
            <SectionLabel>Discipline Audit</SectionLabel>
            {[
              {
                label: 'Revenge Trades Detected',
                value: closedTrades.filter((t) => t.emotion === 'Revenge Trade').length,
                warn: true,
                icon: AlertTriangle,
                note: 'Trades entered emotionally after a loss',
              },
              {
                label: 'FOMO Entries',
                value: closedTrades.filter((t) => t.emotion === 'FOMO').length,
                warn: true,
                icon: Zap,
                note: 'Chasing price without a clear setup',
              },
              {
                label: 'Planned Setups',
                value: closedTrades.filter((t) => t.emotion === 'Planned').length,
                warn: false,
                icon: CheckCircle2,
                note: 'Trades taken from a pre-defined playbook',
              },
              {
                label: 'Late Entries',
                value: closedTrades.filter((t) => t.emotion === 'Late Entry').length,
                warn: true,
                icon: Clock,
                note: 'Entry price away from strategy trigger',
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#1E2328] last:border-0">
                <div className="flex items-center gap-2">
                  <item.icon
                    size={13}
                    className={item.warn ? 'text-[#E85D5D]' : 'text-[#3FA88C]'}
                  />
                  <div>
                    <div className="text-xs text-[#EDEAE3]">{item.label}</div>
                    <div className="text-[10px] text-[#555A60]">{item.note}</div>
                  </div>
                </div>
                <span
                  className="text-sm font-bold font-mono-num"
                  style={{ color: item.warn && item.value > 0 ? '#E85D5D' : item.warn ? '#555A60' : '#3FA88C' }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Mistake Distribution */}
          <div className="terminal-card p-5 space-y-3">
            <SectionLabel>Most Common Mistakes</SectionLabel>
            {(() => {
              const mistakeMap = {};
              for (const t of closedTrades) {
                for (const m of (t.mistakes || [])) {
                  mistakeMap[m] = (mistakeMap[m] || 0) + 1;
                }
              }
              const entries = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]);
              if (entries.length === 0) {
                return <div className="text-xs text-[#3FA88C] py-3 text-center flex items-center justify-center gap-2"><CheckCircle2 size={14} />No mistakes detected in your trades. Clean journal!</div>;
              }
              const maxCount = entries[0][1];
              return entries.map(([mistake, count]) => (
                <div key={mistake} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#EDEAE3]">{mistake}</span>
                    <span className="text-[#E85D5D] font-bold font-mono-num">{count}×</span>
                  </div>
                  <MiniBar pct={(count / maxCount) * 100} color="#E85D5D" />
                </div>
              ));
            })()}
          </div>
        </>
      )}

      {/* ── Tab: Accounts & Plans ── */}
      {activeTab === 'accounts' && (
        <>
          {/* Trading Accounts */}
          <div className="terminal-card p-5 space-y-4">
            <SectionLabel>Trading Accounts</SectionLabel>
            {tradingAccounts.length === 0 ? (
              <div className="text-xs text-[#555A60] py-4 text-center">No sub-accounts configured.</div>
            ) : (
              <div className="space-y-2.5">
                {tradingAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      acc.isArchived ? 'border-[#1E2328] opacity-40' : 'border-[#262B30] bg-[#0F1215]'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-[#0A0C0E] flex-shrink-0"
                      style={{ background: acc.colorHex || '#C9A227' }}
                    >
                      {acc.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#EDEAE3] truncate">{acc.name}</span>
                        {acc.isDefault && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#C9A227]/20 text-[#C9A227] rounded font-bold">DEFAULT</span>
                        )}
                        {acc.isArchived && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#1E2328] text-[#555A60] rounded font-bold">ARCHIVED</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#555A60]">{acc.broker} · {acc.accountType?.toUpperCase()} · {acc.leverage}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono-num text-[#C9A227]">
                        ${parseFloat(acc.initialBalance || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#555A60]">{acc.currency}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Target Plans */}
          <div className="terminal-card p-5 space-y-4">
            <SectionLabel>Active Target Plans</SectionLabel>
            {targetPlans.length === 0 ? (
              <div className="text-xs text-[#555A60] py-4 text-center">No target plans configured yet.</div>
            ) : (
              <div className="space-y-3">
                {targetPlans.map((plan) => {
                  const progress = plan.startingBalance > 0
                    ? Math.min(100, ((settings.accountBalance - plan.startingBalance) / (plan.targetBalance - plan.startingBalance)) * 100)
                    : 0;
                  const isActive = plan.id === activePlan?.id;
                  const statusColors = { active: '#3FA88C', achieved: '#C9A227', breached: '#E85D5D', paused: '#8B8D91' };
                  return (
                    <div
                      key={plan.id}
                      className={`p-4 rounded-xl border ${isActive ? 'border-[#C9A227]/40 bg-[#2A2311]/30' : 'border-[#1E2328] bg-[#0F1215]'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#EDEAE3]">{plan.name}</span>
                            {isActive && <span className="text-[9px] px-1.5 py-0.5 bg-[#C9A227]/20 text-[#C9A227] rounded font-bold">ACTIVE</span>}
                          </div>
                          <div className="text-[10px] text-[#555A60] mt-0.5">
                            ${plan.startingBalance} ➔ ${plan.targetBalance} · {plan.riskPerTradePct}% risk · {plan.targetRR}:1 RR
                          </div>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{
                            color: statusColors[plan.status] || '#8B8D91',
                            background: (statusColors[plan.status] || '#8B8D91') + '20',
                          }}
                        >
                          {plan.status?.toUpperCase()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-[#555A60]">
                          <span>Progress to Target</span>
                          <span className="font-mono-num text-[#C9A227]">{Math.max(0, Math.round(progress))}%</span>
                        </div>
                        <MiniBar pct={Math.max(0, progress)} color="#C9A227" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account Settings Summary */}
          <div className="terminal-card p-5">
            <SectionLabel>Account Configuration</SectionLabel>
            <div className="mt-3">
              <StatRow label="Default Risk %" value={`${settings.defaultRiskPct}%`} sub="Risk per trade setting" />
              <StatRow label="Account Balance" value={`$${(settings.accountBalance || 0).toLocaleString()}`} accent />
              <StatRow label="Contract Size" value={`${settings.contractSize || 100} oz`} sub="XAU/USD lot size" />
              <StatRow label="Session Timezone" value={settings.sessionTimezone || 'UTC'} />
              <StatRow label="Cloud Sync" value={isCloudActive ? 'Active' : isDemoMode ? 'Demo Mode' : 'Offline'} accent={isCloudActive} warn={!isCloudActive && !isDemoMode} />
              <StatRow label="Total Accounts" value={tradingAccounts.filter((a) => !a.isArchived).length} />
              <StatRow label="Target Plans" value={targetPlans.length} />
            </div>
          </div>

          {/* Danger Zone */}
          {userSession && (
            <div className="terminal-card p-5 border-[#E85D5D]/20">
              <SectionLabel>Session</SectionLabel>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[#EDEAE3] font-semibold">{email}</div>
                    <div className="text-[#555A60] text-[10px] mt-0.5">Signed in with email · UID: {userId.slice(0, 12)}…</div>
                  </div>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[#E85D5D] bg-[#E85D5D]/10 hover:bg-[#E85D5D]/20 transition-colors text-xs font-semibold"
                  >
                    <LogOut size={13} />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
