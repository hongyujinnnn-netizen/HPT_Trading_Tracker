import React, { useState, useMemo } from 'react';
import { ListOrdered, Plus, Radio, ArrowUpRight, ArrowDownRight, Zap, Target, Clock, Filter, Trash2 } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';
import { OrderCard } from '../components/OrderCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { OrderDetailModal } from '../components/OrderDetailModal';

const ORDER_TYPES = [
  { value: 'buy_stop', label: 'Buy Stop', desc: 'Entry above price', isBuy: true },
  { value: 'sell_stop', label: 'Sell Stop', desc: 'Entry below price', isBuy: false },
  { value: 'buy_limit', label: 'Buy Limit', desc: 'Entry below price', isBuy: true },
  { value: 'sell_limit', label: 'Sell Limit', desc: 'Entry above price', isBuy: false },
];

const STRATEGIES = ['Breakout', 'Pullback', 'News Trading', 'Order Block / ICT', 'Trend Following', 'Range Scalp'];
const SESSIONS = ['Asian', 'London', 'New York', 'London Close'];
const EXPIRY_OPTIONS = [
  { value: '', label: 'No Expiry (GTC)' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '1w', label: '1 Week' },
];

function computeExpiry(value) {
  if (!value) return null;
  const now = new Date();
  const ms = { '1h': 3600000, '4h': 14400000, '24h': 86400000, '1w': 604800000 };
  return new Date(now.getTime() + (ms[value] || 0)).toISOString();
}

export function PendingOrders() {
  const {
    pendingOrders = [],
    filteredPendingOrders = [],
    createPendingOrder,
    cancelPendingOrder,
    deletePendingOrder,
    clearOrderHistory,
    liveGoldPrice,
    settings,
    tradingAccounts = [],
    activeAccountId,
  } = useTrade();

  const displayOrders = filteredPendingOrders || pendingOrders;

  const [orderType, setOrderType] = useState('buy_stop');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [lotSize, setLotSize] = useState('0.10');
  const [strategy, setStrategy] = useState('');
  const [session, setSession] = useState('');
  const [notes, setNotes] = useState('');
  const [expiry, setExpiry] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);

  const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);
  const [selectedAccountId, setSelectedAccountId] = useState(
    activeAccountId !== 'all' ? activeAccountId : (visibleAccounts[0]?.id || '')
  );

  const targetSubAccount = visibleAccounts.find((a) => a.id === selectedAccountId) || visibleAccounts[0];

  const selectedType = ORDER_TYPES.find(t => t.value === orderType);
  const contractSize = settings?.contractSize || 100;

  // Calculate leverage numeric (e.g., '1:500' -> 500)
  const leverageNum = useMemo(() => {
    const levStr = targetSubAccount?.leverage || '1:500';
    const match = levStr.match(/\d+/g);
    return match && match.length > 0 ? parseFloat(match[match.length - 1]) : 500;
  }, [targetSubAccount]);

  // Preview calculations
  const preview = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const lots = parseFloat(lotSize);
    if (!ep || !sl || !tp || !lots) return null;

    const isBuy = orderType === 'buy_stop' || orderType === 'buy_limit';
    const potentialProfit = isBuy
      ? (tp - ep) * lots * contractSize
      : (ep - tp) * lots * contractSize;
    const potentialLoss = isBuy
      ? (ep - sl) * lots * contractSize
      : (sl - ep) * lots * contractSize;
    const riskReward = potentialLoss !== 0 ? Math.abs(potentialProfit / potentialLoss) : 0;
    const distanceToEntry = liveGoldPrice ? Math.abs(liveGoldPrice - ep) : null;
    const requiredMargin = (ep * lots * contractSize) / (leverageNum || 500);

    // Broker-style margin info
    const balance = targetSubAccount ? parseFloat(targetSubAccount.initialBalance) || 0 : 0;
    const freeMargin = balance - requiredMargin;
    const marginLevel = requiredMargin > 0 ? (balance / requiredMargin) * 100 : 0;

    return {
      potentialProfit: potentialProfit.toFixed(2),
      potentialLoss: Math.abs(potentialLoss).toFixed(2),
      riskReward: riskReward.toFixed(2),
      distanceToEntry: distanceToEntry ? distanceToEntry.toFixed(2) : null,
      requiredMargin: requiredMargin.toFixed(2),
      freeMargin: freeMargin.toFixed(2),
      marginLevel: marginLevel.toFixed(0),
      balance: balance.toFixed(2),
    };
  }, [entryPrice, stopLoss, takeProfit, lotSize, orderType, liveGoldPrice, contractSize, leverageNum, targetSubAccount]);

  // Validation (only blocks on real errors — broker-style allows any lot size with leverage)
  const validationError = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const lots = parseFloat(lotSize);

    if (targetSubAccount && targetSubAccount.initialBalance <= 0) {
      return `Sub-account "${targetSubAccount.name}" balance is $0.00 (Stopped Out). Cannot place orders.`;
    }

    if (!ep || !sl || !tp || !lots) return null; // Not filled yet, not an error
    if (lots <= 0) return 'Lot size must be positive';

    const isBuy = orderType === 'buy_stop' || orderType === 'buy_limit';
    if (isBuy) {
      if (sl >= ep) return 'Stop Loss must be below Entry for buy orders';
      if (tp <= ep) return 'Take Profit must be above Entry for buy orders';
    } else {
      if (sl <= ep) return 'Stop Loss must be above Entry for sell orders';
      if (tp >= ep) return 'Take Profit must be below Entry for sell orders';
    }

    if (liveGoldPrice) {
      if (orderType === 'buy_stop' && ep <= liveGoldPrice) return `Buy Stop entry must be above current price ($${liveGoldPrice})`;
      if (orderType === 'sell_stop' && ep >= liveGoldPrice) return `Sell Stop entry must be below current price ($${liveGoldPrice})`;
      if (orderType === 'buy_limit' && ep >= liveGoldPrice) return `Buy Limit entry must be below current price ($${liveGoldPrice})`;
      if (orderType === 'sell_limit' && ep <= liveGoldPrice) return `Sell Limit entry must be above current price ($${liveGoldPrice})`;
    }

    return null;
  }, [entryPrice, stopLoss, takeProfit, lotSize, orderType, liveGoldPrice, targetSubAccount]);

  // Non-blocking margin warning (informational, like brokers show)
  const marginWarning = useMemo(() => {
    if (!preview || !targetSubAccount) return null;
    const marginLevel = parseFloat(preview.marginLevel);
    const freeMargin = parseFloat(preview.freeMargin);
    if (freeMargin < 0) {
      return `⚠ High leverage position — Free Margin: -$${Math.abs(freeMargin).toFixed(2)} (Margin Level: ${marginLevel}%)`;
    }
    if (marginLevel > 0 && marginLevel < 200) {
      return `⚠ Low margin level: ${marginLevel}% — Consider reducing lot size`;
    }
    return null;
  }, [preview, targetSubAccount]);

  const canSubmit = entryPrice && stopLoss && takeProfit && lotSize && !validationError && !isSubmitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await createPendingOrder({
        accountId: targetSubAccount?.id || (activeAccountId !== 'all' ? activeAccountId : null),
        orderType,
        entryPrice,
        stopLoss,
        takeProfit,
        lotSize,
        strategy: strategy || null,
        session: session || null,
        notes: notes || null,
        expiresAt: computeExpiry(expiry),
      });
      // Reset form
      setEntryPrice('');
      setStopLoss('');
      setTakeProfit('');
      setNotes('');
      setSuccessMsg('Order placed successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to create order:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter orders by tab
  const filteredOrders = useMemo(() => {
    if (activeTab === 'pending') return displayOrders.filter(o => o.status === 'pending');
    if (activeTab === 'active') return displayOrders.filter(o => o.status === 'active');
    return displayOrders.filter(o => ['closed_tp', 'closed_sl', 'cancelled', 'expired'].includes(o.status));
  }, [displayOrders, activeTab]);

  const pendingCount = displayOrders.filter(o => o.status === 'pending').length;
  const activeCount = displayOrders.filter(o => o.status === 'active').length;
  const historyCount = displayOrders.filter(o => ['closed_tp', 'closed_sl', 'cancelled', 'expired'].includes(o.status)).length;

  const handleClearHistory = () => {
    setIsClearModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-[#EDEAE3] flex items-center gap-2">
            <ListOrdered size={22} className="text-[#C9A227]" /> Pending Orders
          </h1>
          <p className="text-xs text-[#8B8D91] mt-0.5">
            Set up pending orders that auto-execute when real XAU/USD price hits your entry, TP, or SL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live price badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131619] border border-[#262B30] text-xs font-mono-num">
            <span className="w-2 h-2 rounded-full bg-[#3FA88C] animate-pulse" />
            <span className="text-[#8B8D91]">
              XAU/USD <strong className="text-[#EDEAE3]">${liveGoldPrice ? liveGoldPrice.toFixed(2) : '—'}</strong>
            </span>
          </div>

          {/* Summary pills */}
          {pendingCount > 0 && <Pill tone="warning"><Clock size={11} /> {pendingCount} Pending</Pill>}
          {activeCount > 0 && <Pill tone="gold"><Zap size={11} /> {activeCount} Active</Pill>}
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Create Order Form */}
        <div className="terminal-card p-5 space-y-5">
          <SectionLabel right={<Pill tone="gold"><Plus size={11} /> New</Pill>}>
            Place Pending Order
          </SectionLabel>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Target Sub-Account Picker */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#C9A227] font-semibold mb-1 block">
                Target Sub-Account *
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#C9A227]/40 text-xs font-semibold text-[#EDEAE3] focus:outline-none focus:border-[#C9A227]"
              >
                {visibleAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.broker} • {acc.leverage} • ${acc.initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
              {targetSubAccount && (
                <div className="flex items-center justify-between text-[10px] text-[#8B8D91] mt-1 font-mono">
                  <span>Balance: <strong className="text-[#3FA88C]">${targetSubAccount.initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Leverage: <strong className="text-[#C9A227]">{targetSubAccount.leverage}</strong></span>
                </div>
              )}
            </div>

            {/* Order Type Selector */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1.5 block">Order Type</label>
              <div className="grid grid-cols-2 gap-2">
                {ORDER_TYPES.map(t => {
                  const isSelected = orderType === t.value;
                  const bgActive = t.isBuy ? '#1F4A40' : '#4A2A1E';
                  const fgActive = t.isBuy ? '#3FA88C' : '#C1502E';
                  const borderActive = t.isBuy ? '#265C50' : '#5C3426';
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setOrderType(t.value)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold font-display border transition-all flex flex-col items-center gap-0.5 ${
                        isSelected ? '' : 'bg-[#1B1F23] text-[#8B8D91] border-[#262B30] hover:border-[#3A3F45]'
                      }`}
                      style={isSelected ? { background: bgActive, color: fgActive, borderColor: borderActive } : {}}
                    >
                      <span className="flex items-center gap-1">
                        {t.isBuy ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {t.label}
                      </span>
                      <span className="text-[9px] font-normal font-mono-num opacity-70">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price Inputs */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1 block">Entry Price</label>
                <input
                  type="number" step="0.01" value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
                  placeholder={liveGoldPrice ? `Current: $${liveGoldPrice.toFixed(2)}` : 'e.g. 2450.00'}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-sm font-mono-num text-[#EDEAE3] placeholder:text-[#5A5D61] focus:outline-none focus:border-[#C9A227] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#3FA88C] mb-1 block">Take Profit</label>
                  <input
                    type="number" step="0.01" value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
                    placeholder="e.g. 2480.00"
                    className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-sm font-mono-num text-[#EDEAE3] placeholder:text-[#5A5D61] focus:outline-none focus:border-[#3FA88C] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#C1502E] mb-1 block">Stop Loss</label>
                  <input
                    type="number" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                    placeholder="e.g. 2430.00"
                    className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-sm font-mono-num text-[#EDEAE3] placeholder:text-[#5A5D61] focus:outline-none focus:border-[#C1502E] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Lot Size */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1 block">Lot Size</label>
              <input
                type="number" step="0.01" min="0.01" value={lotSize} onChange={e => setLotSize(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-sm font-mono-num text-[#EDEAE3] focus:outline-none focus:border-[#C9A227] transition-colors"
              />
            </div>

            {/* Strategy & Session */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1 block">Strategy</label>
                <select
                  value={strategy} onChange={e => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-xs font-mono-num text-[#EDEAE3] focus:outline-none focus:border-[#C9A227] transition-colors"
                >
                  <option value="">Optional</option>
                  {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1 block">Session</label>
                <select
                  value={session} onChange={e => setSession(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-xs font-mono-num text-[#EDEAE3] focus:outline-none focus:border-[#C9A227] transition-colors"
                >
                  <option value="">Optional</option>
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1 block">Expiry</label>
              <select
                value={expiry} onChange={e => setExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-xs font-mono-num text-[#EDEAE3] focus:outline-none focus:border-[#C9A227] transition-colors"
              >
                {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1 block">Notes (optional)</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Trade rationale..."
                className="w-full px-3 py-2 rounded-lg bg-[#0A0C0E] border border-[#262B30] text-xs font-body text-[#EDEAE3] placeholder:text-[#5A5D61] focus:outline-none focus:border-[#C9A227] resize-none transition-colors"
              />
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="px-3 py-2 rounded-lg bg-[#4A2A1E]/50 border border-[#C1502E]/40 text-xs text-[#C1502E] font-mono-num">
                ⚠ {validationError}
              </div>
            )}

            {/* Margin Warning (non-blocking, broker-style) */}
            {!validationError && marginWarning && (
              <div className="px-3 py-2 rounded-lg bg-[#3D3215]/50 border border-[#C9A227]/40 text-xs text-[#C9A227] font-mono-num">
                {marginWarning}
              </div>
            )}

            {/* Preview Panel — Broker-Style */}
            {preview && !validationError && (
              <div className="p-3 rounded-lg bg-[#0A0C0E] border border-[#262B30] space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-[#8B8D91] mb-1">Order Preview</div>

                {/* P&L & Risk Section */}
                <div className="grid grid-cols-3 gap-2 text-xs font-mono-num">
                  <div>
                    <span className="text-[#5A5D61]">Potential Profit</span>
                    <div className="text-[#3FA88C] font-bold">+${preview.potentialProfit}</div>
                  </div>
                  <div>
                    <span className="text-[#5A5D61]">Potential Loss</span>
                    <div className="text-[#C1502E] font-bold">-${preview.potentialLoss}</div>
                  </div>
                  <div>
                    <span className="text-[#5A5D61]">Risk : Reward</span>
                    <div className="text-[#C9A227] font-bold">1 : {preview.riskReward}</div>
                  </div>
                </div>

                {/* Broker Margin Section */}
                <div className="pt-2 border-t border-[#1E2226]">
                  <div className="text-[10px] uppercase tracking-wider text-[#5A5D61] mb-1.5">Margin Info</div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono-num">
                    <div>
                      <span className="text-[#5A5D61]">Balance</span>
                      <div className="text-[#EDEAE3] font-bold">${preview.balance}</div>
                    </div>
                    <div>
                      <span className="text-[#5A5D61]">Required Margin</span>
                      <div className="text-[#C9A227] font-bold">${preview.requiredMargin}</div>
                    </div>
                    <div>
                      <span className="text-[#5A5D61]">Free Margin</span>
                      <div className={`font-bold ${parseFloat(preview.freeMargin) >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                        ${preview.freeMargin}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#5A5D61]">Margin Level</span>
                      <div className={`font-bold ${
                        parseFloat(preview.marginLevel) >= 500 ? 'text-[#3FA88C]' :
                        parseFloat(preview.marginLevel) >= 200 ? 'text-[#C9A227]' :
                        'text-[#C1502E]'
                      }`}>
                        {preview.marginLevel}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Distance to Entry */}
                {preview.distanceToEntry && (
                  <div className="pt-2 border-t border-[#1E2226]">
                    <div className="flex items-center justify-between text-xs font-mono-num">
                      <span className="text-[#5A5D61]">Distance to Entry</span>
                      <span className="text-[#EDEAE3] font-bold">${preview.distanceToEntry}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="px-3 py-2 rounded-lg bg-[#1F4A40]/50 border border-[#3FA88C]/40 text-xs text-[#3FA88C] font-mono-num text-center">
                ✅ {successMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 rounded-lg font-bold text-sm font-display flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] shadow-lg"
            >
              <Target size={16} />
              {isSubmitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </form>
        </div>

        {/* Right: Orders List */}
        <div className="lg:col-span-2 terminal-card p-5 space-y-4">
          <SectionLabel
            right={
              <div className="flex items-center gap-2">
                <Pill tone="neutral"><Radio size={11} className="animate-pulse" /> Live Monitoring</Pill>
              </div>
            }
          >
            Order Book
          </SectionLabel>

          {/* Tabs & Clear History Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1 bg-[#0A0C0E] p-1 rounded-lg border border-[#262B30] w-fit">
              {[
                { key: 'pending', label: 'Pending', count: pendingCount },
                { key: 'active', label: 'Active', count: activeCount },
                { key: 'history', label: 'History', count: historyCount },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold font-display transition-all flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? 'bg-[#C9A227] text-[#0A0C0E]'
                      : 'text-[#8B8D91] hover:text-[#EDEAE3]'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] font-mono-num px-1.5 py-0.5 rounded ${
                      activeTab === tab.key ? 'bg-[#0A0C0E]/20 text-[#0A0C0E]' : 'bg-[#131619] text-[#5A5D61]'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'history' && historyCount > 0 && (
              <button
                onClick={handleClearHistory}
                className="px-3 py-1.5 rounded-lg bg-[#4A2A1E]/40 hover:bg-[#4A2A1E] text-[#C1502E] text-xs font-semibold flex items-center gap-1.5 border border-[#5C3426] transition-colors"
                title="Clear all completed and cancelled orders"
              >
                <Trash2 size={13} /> Clear History
              </button>
            )}
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ListOrdered size={32} className="mx-auto text-[#5A5D61]" />
              <p className="text-sm text-[#8B8D91] font-display">
                {activeTab === 'pending' && 'No pending orders'}
                {activeTab === 'active' && 'No active positions'}
                {activeTab === 'history' && 'No order history yet'}
              </p>
              <p className="text-xs text-[#5A5D61]">
                {activeTab === 'pending' && 'Place a new order using the form on the left.'}
                {activeTab === 'active' && 'Orders become active when price hits your entry level.'}
                {activeTab === 'history' && 'Completed and cancelled orders will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  currentPrice={liveGoldPrice}
                  onCancel={cancelPendingOrder}
                  onDelete={(id) => setOrderToDelete(id)}
                  onSelect={(order) => setSelectedOrderForModal(order)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrderForModal && (
        <OrderDetailModal
          order={selectedOrderForModal}
          currentPrice={liveGoldPrice}
          onClose={() => setSelectedOrderForModal(null)}
          onCancel={cancelPendingOrder}
          onDelete={(id) => setOrderToDelete(id)}
        />
      )}

      {/* Confirm Modal: Clear All History */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={clearOrderHistory}
        title="Clear All Order History?"
        description="Are you sure you want to delete all completed (TP/SL), cancelled, and expired pending orders? This action cannot be undone."
        confirmText="Clear History"
        confirmTone="danger"
      />

      {/* Confirm Modal: Delete Single Order */}
      <ConfirmModal
        isOpen={Boolean(orderToDelete)}
        onClose={() => setOrderToDelete(null)}
        onConfirm={() => {
          if (orderToDelete) deletePendingOrder(orderToDelete);
        }}
        title="Delete Order Record?"
        description="Are you sure you want to remove this order record from your database history?"
        confirmText="Delete Order"
        confirmTone="danger"
      />
    </div>
  );
}
