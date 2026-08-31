import React, { useState, useMemo, useEffect } from 'react';
import { PlusCircle, Upload, AlertTriangle, ShieldCheck, Calculator, Sparkles, X, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { calculatePnL, calculateRR, calculateLotSize } from '../utils/calculations';
import { detectMistakes } from '../utils/mistakeDetector';

export function AddTrade() {
  const {
    addTrade,
    trades,
    filteredTrades,
    tradingAccounts,
    activeAccountId,
    settings,
    setActivePage,
    liveGoldPrice,
    tradeDraft,
    setTradeDraft,
  } = useTrade();

  const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);

  // Form State initialized with draft or live gold price
  const [selectedAccountId, setSelectedAccountId] = useState(
    tradeDraft?.accountId || (activeAccountId !== 'all' ? activeAccountId : (visibleAccounts[0]?.id || ''))
  );
  const [side, setSide] = useState(tradeDraft?.side || 'Buy');
  const [entryPrice, setEntryPrice] = useState(
    tradeDraft?.entryPrice || (liveGoldPrice ? liveGoldPrice.toFixed(2) : '2700.00')
  );
  const [exitPrice, setExitPrice] = useState(
    tradeDraft?.exitPrice || (liveGoldPrice ? (liveGoldPrice + (side === 'Buy' ? 10 : -10)).toFixed(2) : '2710.00')
  );
  const [stopLoss, setStopLoss] = useState(
    tradeDraft?.stopLoss || (liveGoldPrice ? (liveGoldPrice + (side === 'Buy' ? -10 : 10)).toFixed(2) : '2690.00')
  );
  const [takeProfit, setTakeProfit] = useState(
    tradeDraft?.takeProfit || (liveGoldPrice ? (liveGoldPrice + (side === 'Buy' ? 20 : -20)).toFixed(2) : '2720.00')
  );
  const [lotSize, setLotSize] = useState(tradeDraft?.lotSize || '0.50');
  const [strategy, setStrategy] = useState(tradeDraft?.strategy || 'Breakout');
  const [isCustomStrategy, setIsCustomStrategy] = useState(false);
  const [customStrategy, setCustomStrategy] = useState('');
  const [session, setSession] = useState('London');
  const [marketCondition, setMarketCondition] = useState('Trending');
  const [emotion, setEmotion] = useState('Planned');
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [formError, setFormError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Check if current hour was blocked as an unprofitable red slot
  const isBlockedSlot = useMemo(() => {
    try {
      const saved = localStorage.getItem('tradepulse_blocked_slots');
      const blocked = saved ? JSON.parse(saved) : [];
      const now = new Date();
      const day = now.toLocaleDateString('en-US', { weekday: 'long' });
      const hr = now.getUTCHours();
      return blocked.includes(`${day}_${hr}`);
    } catch {
      return false;
    }
  }, []);

  // Consume tradeDraft once on mount
  useEffect(() => {
    if (tradeDraft) {
      if (tradeDraft.side) setSide(tradeDraft.side);
      if (tradeDraft.entryPrice) setEntryPrice(tradeDraft.entryPrice);
      if (tradeDraft.exitPrice) setExitPrice(tradeDraft.exitPrice);
      if (tradeDraft.stopLoss) setStopLoss(tradeDraft.stopLoss);
      if (tradeDraft.takeProfit) setTakeProfit(tradeDraft.takeProfit);
      if (tradeDraft.lotSize) setLotSize(tradeDraft.lotSize);
      if (tradeDraft.strategy) setStrategy(tradeDraft.strategy);
      if (tradeDraft.accountId) setSelectedAccountId(tradeDraft.accountId);
      setTradeDraft(null);
    }
  }, [tradeDraft, setTradeDraft]);

  // Live Calculations
  const entry = parseFloat(entryPrice) || 0;
  const exit = parseFloat(exitPrice) || 0;
  const sl = parseFloat(stopLoss) || 0;
  const tp = parseFloat(takeProfit) || 0;
  const lots = parseFloat(lotSize) || 0.1;

  const computedPnL = useMemo(() => {
    return calculatePnL(side, entry, exit, lots, settings.contractSize);
  }, [side, entry, exit, lots, settings.contractSize]);

  const computedRR = useMemo(() => {
    return calculateRR(side, entry, sl, tp);
  }, [side, entry, sl, tp]);

  const lotRec = useMemo(() => {
    return calculateLotSize(settings.accountBalance, settings.defaultRiskPct, entry, sl, settings.contractSize);
  }, [settings.accountBalance, settings.defaultRiskPct, entry, sl, settings.contractSize]);

  // Live Mistake Evaluation Preview
  const liveMistakes = useMemo(() => {
    const draft = {
      side,
      entryPrice: entry,
      exitPrice: exit,
      stopLoss: sl,
      takeProfit: tp,
      lotSize: lots,
      pnl: computedPnL,
      rr: computedRR,
      strategy,
      session,
      marketCondition,
      emotion,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    };
    return detectMistakes(draft, trades);
  }, [side, entry, exit, sl, tp, lots, computedPnL, computedRR, strategy, session, marketCondition, emotion, trades]);

  // Process file object
  const processImageFile = (file) => {
    if (!file) return;
    setFormError(null);

    // Security check: validate file type (images only)
    if (!file.type || !file.type.startsWith('image/')) {
      setFormError('Only image files (PNG, JPG, WEBP) are allowed.');
      return;
    }

    // Security check: limit image size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshot(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    processImageFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processImageFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const finalStrategy = isCustomStrategy && customStrategy.trim() ? customStrategy.trim() : strategy;

    await addTrade(
      {
        accountId: selectedAccountId,
        side,
        entryPrice: entry,
        exitPrice: exit,
        stopLoss: sl,
        takeProfit: tp,
        lotSize: lots,
        pnl: computedPnL,
        rr: computedRR,
        strategy: finalStrategy,
        session,
        marketCondition,
        emotion,
        notes,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
      },
      screenshot
    );

    setSavedSuccess(true);
    setTimeout(() => {
      setActivePage('history');
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display" style={{ color: 'var(--color-text-main)' }}>Log New XAU/USD Trade</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Enter your trade parameters for real-time risk-reward feedback and automatic mistake analysis</p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-700 dark:text-[#3FA88C] font-semibold flex items-center gap-2">
          <ShieldCheck size={18} /> Trade successfully logged to journal! Redirecting to trade history...
        </div>
      )}

      {isBlockedSlot && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs flex items-start gap-3 shadow-lg animate-pulse" style={{ color: 'var(--color-text-main)' }}>
          <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-rose-600 dark:text-[#E46868] block">
              ⚠ Restricted Trading Slot Warning
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              You have previously flagged this hour in your Time-of-Day Heat Map as an unprofitable red slot. Review your trade edge carefully before execution.
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Fields */}
        <div className="lg:col-span-2 terminal-card p-6 space-y-5">
          {/* Sub-Account Selector */}
          <div>
            <label className="text-xs uppercase font-bold text-amber-600 dark:text-[#C9A227] tracking-wider block mb-1.5">
              Trading Sub-Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full p-2.5 rounded-lg text-xs font-semibold terminal-select focus:outline-none"
            >
              {visibleAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.broker} • {acc.leverage} • ${acc.initialBalance.toLocaleString()} {acc.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Side Toggle */}
          <div>
            <label className="text-xs uppercase font-bold tracking-wider block mb-2" style={{ color: 'var(--color-text-muted)' }}>Order Direction</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSide('Buy')}
                className={`py-2.5 rounded-lg font-bold text-sm font-display flex items-center justify-center gap-2 border transition-all ${
                  side === 'Buy'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:bg-[#1F4A40] dark:border-[#3FA88C] dark:text-[#3FA88C] shadow-sm gold-glow'
                    : 'border-[var(--color-border-soft)] hover:bg-black/5 dark:hover:bg-white/[0.04]'
                }`}
                style={side !== 'Buy' ? { background: 'var(--color-elevated)', color: 'var(--color-text-muted)' } : undefined}
              >
                BUY (Long)
              </button>
              <button
                type="button"
                onClick={() => setSide('Sell')}
                className={`py-2.5 rounded-lg font-bold text-sm font-display flex items-center justify-center gap-2 border transition-all ${
                  side === 'Sell'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:bg-[#4A2A1E] dark:border-[#C1502E] dark:text-[#C1502E] shadow-sm loss-glow'
                    : 'border-[var(--color-border-soft)] hover:bg-black/5 dark:hover:bg-white/[0.04]'
                }`}
                style={side !== 'Sell' ? { background: 'var(--color-elevated)', color: 'var(--color-text-muted)' } : undefined}
              >
                SELL (Short)
              </button>
            </div>
          </div>

          {/* Price Inputs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Entry Price</label>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm font-mono-num terminal-input"
                required
              />
            </div>
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Exit Price</label>
              <input
                type="number"
                step="0.01"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm font-mono-num terminal-input"
                required
              />
            </div>
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Stop Loss (SL)</label>
              <input
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="0 = No SL"
                className="w-full px-3 py-2 rounded-md text-sm font-mono-num terminal-input"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Take Profit (TP)</label>
              <input
                type="number"
                step="0.01"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm font-mono-num terminal-input"
              />
            </div>
          </div>

          {/* Volume & Tag Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Lot Size</label>
              <input
                type="number"
                step="0.01"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm font-mono-num text-amber-600 dark:text-[#C9A227] font-semibold terminal-input"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Strategy Setup</label>
                <button
                  type="button"
                  onClick={() => setIsCustomStrategy(!isCustomStrategy)}
                  className="text-[10px] text-amber-600 dark:text-[#C9A227] hover:underline font-mono-num"
                >
                  {isCustomStrategy ? '← Choose Standard' : '+ Custom Setup Tag'}
                </button>
              </div>

              {isCustomStrategy ? (
                <input
                  type="text"
                  value={customStrategy}
                  onChange={(e) => setCustomStrategy(e.target.value)}
                  placeholder="e.g. London Breakout, News Fade, FVG Sweep..."
                  className="w-full px-3 py-2 rounded-md text-xs terminal-input"
                  required
                />
              ) : (
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-xs terminal-select"
                >
                  <option value="Breakout">Breakout</option>
                  <option value="Pullback">Pullback</option>
                  <option value="London Breakout">London Breakout</option>
                  <option value="News Fade">News Fade</option>
                  <option value="Order Block / ICT">Order Block / ICT</option>
                  <option value="FVG Liquidity Sweep">FVG Liquidity Sweep</option>
                  <option value="Trend Following">Trend Following</option>
                  <option value="Range Scalp">Range Scalp</option>
                </select>
              )}
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Trading Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-xs terminal-select"
              >
                <option value="Asian">Asian Session</option>
                <option value="London">London Session</option>
                <option value="New York">New York Session</option>
                <option value="London Close">London Close</option>
              </select>
            </div>
          </div>

          {/* Condition & Emotion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Market Condition</label>
              <select
                value={marketCondition}
                onChange={(e) => setMarketCondition(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-xs terminal-select"
              >
                <option value="Trending">Trending</option>
                <option value="Ranging">Ranging</option>
                <option value="High Volatility">High Volatility</option>
                <option value="Low Volatility">Low Volatility</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Emotion Log</label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-xs terminal-select"
              >
                <option value="Planned">Planned / Disciplined</option>
                <option value="FOMO">FOMO (Fear Of Missing Out)</option>
                <option value="Revenge Trade">Revenge Trade</option>
                <option value="Late Entry">Late Entry / Chasing</option>
                <option value="Greedy">Greedy / Overleveraged</option>
                <option value="Hesitant">Hesitant / Fearful</option>
                <option value="Overconfident">Overconfident</option>
                <option value="Emotional">Emotional / Impulsive</option>
              </select>
            </div>
          </div>

          {/* Notes & Reason for Entry */}
          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>Trade Notes & Rationale</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did you take this entry? Confluences, HTF key levels..."
              className="w-full px-3 py-2 rounded-md text-xs resize-none terminal-input"
            />
          </div>

          {/* Screenshot Upload (Saved to IndexedDB) */}
          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Chart Screenshot (IndexedDB Storage)
            </label>

            {!screenshot ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-[var(--color-border-soft)] hover:border-amber-500'
                }`}
                style={{ background: 'var(--color-elevated)' }}
              >
                <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
                  <Upload size={20} className="text-amber-500 mb-1.5" />
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>Click or drag &amp; drop screenshot here</span>
                  <span className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-dim)' }}>PNG, JPG, or WEBP up to 5MB (stored in local IndexedDB)</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              </div>
            ) : (
              <div
                className="p-3 rounded-xl border flex items-center justify-between gap-3"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={screenshot}
                    alt="Trade Screenshot Preview"
                    className="w-12 h-12 object-cover rounded-lg border"
                    style={{ borderColor: 'var(--color-border-soft)' }}
                  />
                  <div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-[#3FA88C] flex items-center gap-1 font-mono-num">
                      <CheckCircle2 size={13} /> Screenshot attached
                    </span>
                    <span className="text-[10px] block" style={{ color: 'var(--color-text-muted)' }}>Ready for local IndexedDB saving</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                  title="Remove Screenshot"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {formError && (
              <p className="text-xs text-rose-500 font-semibold mt-2 flex items-center gap-1">
                <AlertTriangle size={13} /> {formError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#C9A227] via-[#D4AF37] to-[#C9A227] hover:brightness-105 text-[#080A0D] font-bold text-sm font-display tracking-wide shadow-lg shadow-[#C9A227]/25 transition-all active:scale-[0.99]"
          >
            Save Trade to Journal
          </button>
        </div>

        {/* Sidebar Live Preview & Mistake Detector */}
        <div className="space-y-4">
          {/* Live Calculations Widget */}
          <div className="terminal-card p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <Calculator size={14} className="text-amber-500 dark:text-[#C9A227]" /> Live Realized Estimates
            </h3>

            <div className="space-y-3 font-mono-num">
              <div className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--color-text-muted)' }}>Estimated P&L:</span>
                <span className={`text-base font-bold ${computedPnL >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                  {computedPnL >= 0 ? '+' : ''}${computedPnL}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--color-text-muted)' }}>Risk-Reward Ratio:</span>
                <span className={`text-sm font-bold ${computedRR >= 1.5 ? 'text-emerald-600 dark:text-[#3FA88C]' : computedRR >= 1.0 ? 'text-amber-600 dark:text-[#C9A227]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                  1 : {computedRR.toFixed(1)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs pt-2 border-t" style={{ borderColor: 'var(--color-border-soft)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Risk Amount ({settings.defaultRiskPct}%):</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>${lotRec.riskAmount}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--color-text-muted)' }}>Rec. Lot Size:</span>
                <span className="text-xs font-semibold text-amber-600 dark:text-[#C9A227]">{lotRec.lotSize} lots</span>
              </div>
            </div>
          </div>

          {/* Live Automated Mistake Detector Alert */}
          <div
            className="terminal-card p-5 space-y-3 transition-colors"
            style={{
              borderColor: liveMistakes.length > 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)',
              background: liveMistakes.length > 0 ? 'rgba(244, 63, 94, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: liveMistakes.length > 0 ? '#E11D48' : '#059669' }}>
              {liveMistakes.length > 0 ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
              {liveMistakes.length > 0 ? `Mistake Detector Alert (${liveMistakes.length})` : 'Clean Setup Standard'}
            </h3>

            {liveMistakes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Rule engine detected potential discipline breaches before saving:</p>
                <div className="space-y-1.5">
                  {liveMistakes.map((m) => (
                    <div
                      key={m}
                      className="p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    >
                      <AlertTriangle size={12} /> {m}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                No behavioral discipline breaches flagged! Stop loss set and risk-reward ratio meets trading plan criteria.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
