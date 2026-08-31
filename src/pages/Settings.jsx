import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Shield, LogOut, Cloud, Sparkles, Activity, AlertTriangle, Radio, Bell, BellRing, Volume2, VolumeX, Send, Moon, Sun, Monitor } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { SectionLabel } from '../components/SectionLabel';
import { tradeRepository } from '../services/tradeRepository';

// ─── Theme Segment Control ─────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: 'dark',   label: 'Dark Mode',  Icon: Moon    },
  { value: 'light',  label: 'White Mode', Icon: Sun     },
  { value: 'system', label: 'System',     Icon: Monitor },
];

function ThemeToggle({ theme, setTheme }) {
  return (
    <div
      className="relative flex items-center p-1 rounded-xl border shadow-inner transition-colors duration-200"
      style={{
        background: 'var(--color-elevated)',
        borderColor: 'var(--color-border-soft)',
      }}
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`
              relative flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold
              transition-all duration-200 z-10
              ${isActive
                ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D] shadow-md shadow-[#C9A227]/30 font-bold'
                : 'hover:opacity-80'
              }
            `}
            style={!isActive ? { color: 'var(--color-text-muted)' } : undefined}
            aria-pressed={isActive}
            title={`Switch to ${label}`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Settings Page ─────────────────────────────────────────────────────────────

export function Settings() {
  const {
    settings,
    updateSettings,
    resetAllData,
    userSession,
    signOut,
    isDemoMode,
    isSoundEnabled,
    toggleNotificationSound,
    pushPermission,
    enablePushNotifications,
    sendNotification,
    theme,
    setTheme,
  } = useTrade();

  const [balance, setBalance] = useState(settings.accountBalance);
  const [riskPct, setRiskPct] = useState(settings.defaultRiskPct);
  const [contractSize, setContractSize] = useState(settings.contractSize || 100);
  const [timezone, setTimezone] = useState(settings.sessionTimezone);
  const [savedMsg, setSavedMsg] = useState(false);

  const [feedHealth, setFeedHealth] = useState(null);

  useEffect(() => {
    async function loadFeedHealth() {
      const data = await tradeRepository.getPriceFeedHealth24h();
      setFeedHealth(data);
    }
    loadFeedHealth();
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings({
      accountBalance: parseFloat(balance) || 10000,
      defaultRiskPct: parseFloat(riskPct) || 1.0,
      contractSize: parseFloat(contractSize) || 100,
      sessionTimezone: timezone,
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleTestNotification = () => {
    sendNotification({
      type: 'alert',
      title: '🔔 Test Alert Notification',
      message: 'TradePulse Gold notifications & audio chimes are functioning properly!',
    });
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to clear local cached trade history?')) {
      await resetAllData();
      alert('Local storage cleared!');
    }
  };

  // Human-readable resolved theme label
  const resolvedThemeLabel =
    theme === 'system'
      ? `System (${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'White'})`
      : theme === 'light'
      ? 'White Mode'
      : 'Dark Mode (Obsidian Gold)';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in select-none">
      <div>
        <h1 className="text-xl font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
          Account Preferences &amp; Configuration
        </h1>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Configure base balance, default risk parameters, notification alerts, and gold contract unit size
        </p>
      </div>

      {savedMsg && (
        <div className="p-3 bg-[#1F4A40] border border-[#3FA88C] rounded-lg text-xs font-semibold text-[#3FA88C]">
          ✓ Settings saved successfully!
        </div>
      )}

      {/* ── Appearance Card ──────────────────────────────────────────────────── */}
      <div className="terminal-card p-6 space-y-4">
        <SectionLabel>Appearance &amp; Theme</SectionLabel>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Seamlessly switch between Dark Mode and White Mode. All components, sidebars, charts, and cards adapt instantly.
        </p>

        <ThemeToggle theme={theme} setTheme={setTheme} />

        <div
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs"
          style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-soft)', color: 'var(--color-text-muted)' }}
        >
          {theme === 'light' ? (
            <Sun size={14} className="text-amber-500" />
          ) : theme === 'system' ? (
            <Monitor size={14} className="text-amber-500 dark:text-[#E5B83B]" />
          ) : (
            <Moon size={14} className="text-amber-500 dark:text-[#E5B83B]" />
          )}
          <span>
            Active theme: <strong className="text-amber-600 dark:text-[#E5B83B]">{resolvedThemeLabel}</strong>
          </span>
        </div>
      </div>

      {/* ── Notifications Card ───────────────────────────────────────────────── */}
      <div className="terminal-card p-6 space-y-4">
        <SectionLabel>Notifications &amp; Real-Time Alerts</SectionLabel>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Receive real-time alerts for price targets, order fills, TP/SL hits, and institutional edge degradation warnings.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Audio Chime Setting */}
          <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-soft)' }}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isSoundEnabled ? 'bg-emerald-500/15 text-emerald-600 dark:bg-[#152E25] dark:text-[#3FA88C]' : 'bg-slate-200 dark:bg-[#1B1F23] text-slate-500 dark:text-[#5A5D61]'}`}>
                {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
              <div>
                <span className="text-xs font-bold block" style={{ color: 'var(--color-text-main)' }}>Audio Chime</span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{isSoundEnabled ? 'Sound Enabled' : 'Muted'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleNotificationSound}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isSoundEnabled
                  ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#1F4A40] dark:text-[#3FA88C] border border-emerald-500/40'
                  : 'border hover:opacity-80'
              }`}
              style={!isSoundEnabled ? { background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' } : undefined}
            >
              {isSoundEnabled ? 'Active' : 'Enable'}
            </button>
          </div>

          {/* Browser Desktop Push Notification */}
          <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-soft)' }}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pushPermission === 'granted' ? 'bg-amber-500/15 text-amber-600 dark:bg-[#2A2311] dark:text-[#C9A227]' : 'bg-slate-200 dark:bg-[#1B1F23] text-slate-500 dark:text-[#5A5D61]'}`}>
                <BellRing size={18} />
              </div>
              <div>
                <span className="text-xs font-bold block" style={{ color: 'var(--color-text-main)' }}>Desktop Push</span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  {pushPermission === 'granted' ? 'Allowed' : pushPermission === 'denied' ? 'Blocked by Browser' : 'Click to Request'}
                </span>
              </div>
            </div>

            {pushPermission === 'granted' ? (
              <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:bg-[#152E25] dark:text-[#3FA88C] border border-emerald-500/30">
                Active
              </span>
            ) : (
              <button
                type="button"
                onClick={enablePushNotifications}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] text-xs font-bold transition-all shadow-sm"
              >
                Enable
              </button>
            )}
          </div>
        </div>

        {/* Test Alert Button */}
        <button
          type="button"
          onClick={handleTestNotification}
          className="w-full py-2 rounded-lg text-[#C9A227] border border-[#C9A227]/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors hover:border-[#C9A227]/60"
          style={{ background: 'var(--color-elevated)' }}
        >
          <Send size={13} /> Send Test Alert &amp; Play Chime
        </button>
      </div>

      {/* ── Account & Security Card ──────────────────────────────────────────── */}
      <div className="terminal-card p-6 space-y-4">
        <SectionLabel>Account &amp; Cloud Security</SectionLabel>
        {userSession ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)' }}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                  <Cloud size={16} className="text-[#3FA88C]" />
                  <span>Authenticated Account</span>
                </div>
                <div className="text-xs font-mono-num" style={{ color: 'var(--color-text-muted)' }}>{userSession.user.email}</div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#1F4A40]/50 text-[#3FA88C] border border-[#3FA88C]/30">
                  <Shield size={12} /> RLS Enforced
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <LogOut size={14} /> Sign Out of Journal
            </button>
          </div>
        ) : isDemoMode ? (
          <div className="p-3.5 bg-[#2A2311] border border-[#C9A227]/40 rounded-xl flex items-center justify-between text-xs text-[#C9A227]">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles size={16} />
              <span>Viewing in Demo Preview Mode</span>
            </div>
            <button
              onClick={signOut}
              className="px-3 py-1 rounded bg-[#C9A227] text-[#0A0C0E] font-bold hover:bg-[#E4C468] transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Live Price Feed Diagnostics ──────────────────────────────────────── */}
      <div className="terminal-card p-6 space-y-4">
        <SectionLabel>Live Price Feed Health (24 Hours)</SectionLabel>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Audit log of XAU/USD price snapshots written by the <code>fetch-gold-price</code> Edge Function and scheduled via <code>pg_cron</code>.
        </p>

        {feedHealth ? (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl space-y-1" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3FA88C]">
                <Radio size={13} /> GoldAPI Live
              </div>
              <div className="text-lg font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>{feedHealth.goldapi}</div>
              <div className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>source='goldapi'</div>
            </div>

            <div className="p-3 rounded-xl space-y-1" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C9A227]">
                <Sparkles size={13} /> Fallbacks
              </div>
              <div className="text-lg font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>{feedHealth.simulated}</div>
              <div className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>source='simulated'</div>
            </div>

            <div className="p-3 rounded-xl space-y-1" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)' }}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                <Activity size={13} /> Unknown
              </div>
              <div className="text-lg font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>{feedHealth.unknown}</div>
              <div className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>source='unknown'</div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl text-xs" style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)', color: 'var(--color-text-muted)' }}>
            Connect Supabase to inspect 24-hour feed metrics.
          </div>
        )}
      </div>

      {/* ── Trade Preferences Form ───────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="terminal-card p-6 space-y-5">
        <div>
          <label className="text-xs uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Default Starting Account Balance ($USD)
          </label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm font-mono-num outline-none focus:border-[#C9A227] transition-colors"
            style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)', color: 'var(--color-text-main)' }}
          />
        </div>

        <div>
          <label className="text-xs uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Default Risk Per Trade (%)
          </label>
          <input
            type="number"
            step="0.25"
            value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm font-mono-num outline-none focus:border-[#C9A227] transition-colors"
            style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)', color: '#C9A227' }}
          />
        </div>

        <div>
          <label className="text-xs uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Gold Contract Size (Ounces per Lot)
          </label>
          <input
            type="number"
            value={contractSize}
            onChange={(e) => setContractSize(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm font-mono-num outline-none focus:border-[#C9A227] transition-colors"
            style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)', color: 'var(--color-text-main)' }}
          />
          <span className="text-[11px] mt-1 block" style={{ color: 'var(--color-text-dim)' }}>
            Standard brokers: 100 oz/lot. Micro/Cent accounts: 10 oz/lot.
          </span>
        </div>

        <div>
          <label className="text-xs uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Session Display Timezone
          </label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm font-body outline-none focus:border-[#C9A227] transition-colors"
            style={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border-dark)', color: 'var(--color-text-main)' }}
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <Save size={14} /> Save Preferences
        </button>
      </form>

      {/* ── Data Cache Management ────────────────────────────────────────────── */}
      <div className="terminal-card p-6 border-l-4 border-l-[#C1502E] space-y-3">
        <SectionLabel>Data Cache Management</SectionLabel>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Clear temporary local storage caches. Cloud data stored in Supabase will remain unaffected.
        </p>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <RefreshCw size={14} /> Clear Local Cache
        </button>
      </div>
    </div>
  );
}
