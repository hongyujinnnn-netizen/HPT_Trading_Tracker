import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Shield, LogOut, Cloud, Sparkles, Activity, AlertTriangle, Radio } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { SectionLabel } from '../components/SectionLabel';
import { tradeRepository } from '../services/tradeRepository';

export function Settings() {
  const { settings, updateSettings, resetAllData, userSession, signOut, isDemoMode } = useTrade();

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

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to clear local cached trade history?')) {
      await resetAllData();
      alert('Local storage cleared!');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in select-none">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">Account Preferences &amp; Configuration</h1>
        <p className="text-xs text-[#8B8D91]">Configure base balance, default risk parameters, and gold contract unit size</p>
      </div>

      {savedMsg && (
        <div className="p-3 bg-[#1F4A40] border border-[#3FA88C] rounded-lg text-xs font-semibold text-[#3FA88C]">
          ✓ Settings saved successfully!
        </div>
      )}

      {/* Account & Security Card */}
      <div className="terminal-card p-6 space-y-4">
        <SectionLabel>Account &amp; Cloud Security</SectionLabel>
        {userSession ? (
          <div className="space-y-3">
            <div className="p-3.5 bg-[#131619] border border-[#262B30] rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#EDEAE3]">
                  <Cloud size={16} className="text-[#3FA88C]" />
                  <span>Authenticated Account</span>
                </div>
                <div className="text-xs text-[#8B8D91] font-mono-num">{userSession.user.email}</div>
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
              className="w-full py-2.5 rounded-lg bg-[#4A2A1E] hover:bg-[#C1502E] text-[#EDEAE3] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
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

      {/* Live Price Feed Diagnostics */}
      <div className="terminal-card p-6 space-y-4">
        <SectionLabel>Live Price Feed Health (24 Hours)</SectionLabel>
        <p className="text-xs text-[#8B8D91]">
          Audit log of XAU/USD price snapshots written by the <code>fetch-gold-price</code> Edge Function and scheduled via <code>pg_cron</code>.
        </p>

        {feedHealth ? (
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-[#131619] border border-[#262B30] rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3FA88C]">
                <Radio size={13} /> GoldAPI Live
              </div>
              <div className="text-lg font-bold font-mono-num text-[#EDEAE3]">{feedHealth.goldapi}</div>
              <div className="text-[10px] text-[#5A5D61]">source='goldapi'</div>
            </div>

            <div className="p-3 bg-[#131619] border border-[#262B30] rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C9A227]">
                <Sparkles size={13} /> Fallbacks
              </div>
              <div className="text-lg font-bold font-mono-num text-[#EDEAE3]">{feedHealth.simulated}</div>
              <div className="text-[10px] text-[#5A5D61]">source='simulated'</div>
            </div>

            <div className="p-3 bg-[#131619] border border-[#262B30] rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8B8D91]">
                <Activity size={13} /> Unknown
              </div>
              <div className="text-lg font-bold font-mono-num text-[#EDEAE3]">{feedHealth.unknown}</div>
              <div className="text-[10px] text-[#5A5D61]">source='unknown'</div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[#131619] border border-[#262B30] rounded-xl text-xs text-[#8B8D91]">
            Connect Supabase to inspect 24-hour feed metrics.
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="terminal-card p-6 space-y-5">
        <div>
          <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
            Default Starting Account Balance ($USD)
          </label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227]"
          />
        </div>

        <div>
          <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
            Default Risk Per Trade (%)
          </label>
          <input
            type="number"
            step="0.25"
            value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)}
            className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-mono-num text-[#C9A227] outline-none focus:border-[#C9A227]"
          />
        </div>

        <div>
          <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
            Gold Contract Size (Ounces per Lot)
          </label>
          <input
            type="number"
            value={contractSize}
            onChange={(e) => setContractSize(e.target.value)}
            className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227]"
          />
          <span className="text-[11px] text-[#5A5D61] mt-1 block">
            Standard brokers: 100 oz/lot. Micro/Cent accounts: 10 oz/lot.
          </span>
        </div>

        <div>
          <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
            Session Display Timezone
          </label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-body text-[#EDEAE3] outline-none focus:border-[#C9A227]"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
        >
          <Save size={14} /> Save Preferences
        </button>
      </form>

      {/* Local Cache Management */}
      <div className="terminal-card p-6 border-l-4 border-l-[#C1502E] space-y-3">
        <SectionLabel>Data Cache Management</SectionLabel>
        <p className="text-xs text-[#8B8D91]">
          Clear temporary local storage caches. Cloud data stored in Supabase will remain unaffected.
        </p>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-[#4A2A1E] hover:bg-[#C1502E] text-[#EDEAE3] text-xs font-bold flex items-center gap-2 transition-colors"
        >
          <RefreshCw size={14} /> Clear Local Cache
        </button>
      </div>
    </div>
  );
}


