import React from 'react';
import {
  X,
  Clock,
  Zap,
  Target,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Hourglass,
} from 'lucide-react';
import { Pill } from './Pill';
import { useTrade } from '../context/TradeContext';

function formatFullTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const year = d.getFullYear();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${month} ${day}, ${year} · ${hh}:${mm}:${ss}`;
  } catch {
    return iso;
  }
}

function calculateDuration(startIso, endIso) {
  if (!startIso) return '—';
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    if (isNaN(start) || isNaN(end)) return '—';

    const diffMs = Math.max(0, end - start);
    const totalMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return `${days}d ${remainingHours}h ${mins}m`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} mins`;
  } catch {
    return '—';
  }
}

function formatPrice(p) {
  if (p === null || p === undefined || isNaN(p)) return '—';
  return parseFloat(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ORDER_TYPE_LABELS = {
  buy_stop: 'Buy Stop',
  sell_stop: 'Sell Stop',
  buy_limit: 'Buy Limit',
  sell_limit: 'Sell Limit',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending Trigger', tone: 'warning', icon: Hourglass, desc: 'Waiting for market price to hit entry' },
  active: { label: 'Active Position', tone: 'gold', icon: Zap, desc: 'Entry triggered; position currently open' },
  closed_tp: { label: 'Closed (Take Profit ✅)', tone: 'profit', icon: CheckCircle2, desc: 'Position reached Take Profit target' },
  closed_sl: { label: 'Closed (Stop Loss ❌)', tone: 'loss', icon: XCircle, desc: 'Position stopped out at Stop Loss level' },
  cancelled: { label: 'Cancelled Order', tone: 'neutral', icon: X, desc: 'Manually cancelled before trigger' },
  expired: { label: 'Expired Order', tone: 'neutral', icon: ShieldAlert, desc: 'Order reached expiration duration' },
};

export function OrderDetailModal({ order, currentPrice, onClose, onCancel, onDelete }) {
  const { setSelectedTrade, trades, setActivePage } = useTrade();

  if (!order) return null;

  const isBuy = order.order_type === 'buy_stop' || order.order_type === 'buy_limit';
  const entry = parseFloat(order.entry_price);
  const tp = parseFloat(order.take_profit);
  const sl = parseFloat(order.stop_loss);
  const lotSize = parseFloat(order.lot_size);
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  const typeBgColor = isBuy ? '#1F4A40' : '#4A2A1E';
  const typeFgColor = isBuy ? '#3FA88C' : '#C1502E';
  const typeBorderColor = isBuy ? '#265C50' : '#5C3426';

  const contractSize = 100;
  const isActionable = order.status === 'pending' || order.status === 'active';

  // Distance calculations
  const distanceToEntry = currentPrice ? Math.abs(currentPrice - entry).toFixed(2) : null;

  // Potential Profit & Loss
  const potentialProfit = isBuy
    ? (tp - entry) * lotSize * contractSize
    : (entry - tp) * lotSize * contractSize;
  const potentialLoss = isBuy
    ? (entry - sl) * lotSize * contractSize
    : (sl - entry) * lotSize * contractSize;
  const riskReward = potentialLoss !== 0 ? Math.abs(potentialProfit / potentialLoss) : 0;

  // Unrealized P&L for active orders
  let unrealizedPnl = null;
  if (order.status === 'active' && currentPrice) {
    const triggerPrice = parseFloat(order.triggered_price) || entry;
    unrealizedPnl = isBuy
      ? (currentPrice - triggerPrice) * lotSize * contractSize
      : (triggerPrice - currentPrice) * lotSize * contractSize;
    unrealizedPnl = parseFloat(unrealizedPnl.toFixed(2));
  }

  // Realized P&L for closed orders
  let realizedPnl = null;
  if ((order.status === 'closed_tp' || order.status === 'closed_sl') && order.closed_price) {
    const closedPrice = parseFloat(order.closed_price);
    const triggerPrice = parseFloat(order.triggered_price) || entry;
    realizedPnl = isBuy
      ? (closedPrice - triggerPrice) * lotSize * contractSize
      : (triggerPrice - closedPrice) * lotSize * contractSize;
    realizedPnl = parseFloat(realizedPnl.toFixed(2));
  }

  // Find linked journal trade if present
  const linkedTrade = order.resulting_trade_id
    ? trades.find(t => t.id === order.resulting_trade_id)
    : null;

  // Timings:
  const upTime = calculateDuration(order.created_at, order.closed_at || order.triggered_at || null);
  const activeDuration = order.triggered_at ? calculateDuration(order.triggered_at, order.closed_at) : null;
  const totalLifetime = calculateDuration(order.created_at, order.closed_at);

  const handleOpenLinkedTrade = () => {
    if (linkedTrade) {
      onClose();
      setSelectedTrade(linkedTrade);
      setActivePage('history');
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="terminal-card rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono-num border"
              style={{ background: typeBgColor, color: typeFgColor, borderColor: typeBorderColor }}
            >
              {isBuy ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
                  XAU/USD Order #{order.id ? String(order.id).slice(-6) : '—'}
                </span>
                <Pill tone={statusCfg.tone}>
                  <StatusIcon size={12} /> {statusCfg.label}
                </Pill>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{statusCfg.desc}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg border hover:opacity-80 transition-colors"
            style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">

          {/* Realized/Unrealized P&L Banner */}
          {realizedPnl !== null && (
            <div className={`p-4 rounded-xl flex items-center justify-between border ${realizedPnl >= 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-rose-500/15 border-rose-500/30'}`}>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Realized Net P&L</span>
                <div className={`text-2xl font-bold font-mono-num ${realizedPnl >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                  {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Status Outcome</span>
                <div className="text-sm font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
                  {order.status === 'closed_tp' ? 'Take Profit Hit ✅' : 'Stop Loss Hit ❌'}
                </div>
              </div>
            </div>
          )}

          {unrealizedPnl !== null && (
            <div className={`p-4 rounded-xl flex items-center justify-between border ${unrealizedPnl >= 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-rose-500/15 border-rose-500/30'}`}>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Unrealized Active P&L</span>
                <div className={`text-2xl font-bold font-mono-num ${unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                </div>
              </div>
              {currentPrice && (
                <div className="text-right font-mono-num">
                  <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>Current Live Price</span>
                  <span className="text-base font-bold" style={{ color: 'var(--color-text-main)' }}>${formatPrice(currentPrice)}</span>
                </div>
              )}
            </div>
          )}

          {/* TIMING & DURATION HIGHLIGHT PANEL */}
          <div className="p-4 space-y-3 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--color-border-soft)' }}>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-[#C9A227] flex items-center gap-1.5">
                <Clock size={14} /> Order Timeline &amp; Up Time Details
              </span>
              <span className="text-xs font-mono-num flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Hourglass size={12} className="text-amber-500" /> Total Lifetime: <strong style={{ color: 'var(--color-text-main)' }}>{totalLifetime}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Placed / Setup Time */}
              <div className="p-3 rounded-lg border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
                <span className="text-[10px] uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                  1. Setup Time (Placed At)
                </span>
                <div className="font-mono-num font-semibold text-sm" style={{ color: 'var(--color-text-main)' }}>
                  {formatFullTime(order.created_at)}
                </div>
                <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span>Up Time / Waiting Duration:</span>
                  <span className="font-bold font-mono-num text-amber-600 dark:text-[#C9A227]">{upTime}</span>
                </div>
              </div>

              {/* Triggered Time */}
              <div className="p-3 rounded-lg border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
                <span className="text-[10px] uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                  2. Start / Trigger Time
                </span>
                <div className="font-mono-num font-semibold text-sm flex items-center gap-1" style={{ color: 'var(--color-text-main)' }}>
                  {order.triggered_at ? (
                    <>
                      <Zap size={14} className="text-amber-500" />
                      {formatFullTime(order.triggered_at)}
                    </>
                  ) : (
                    <span className="italic" style={{ color: 'var(--color-text-dim)' }}>Not triggered yet</span>
                  )}
                </div>
                {order.triggered_price && (
                  <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Fill Price: <strong className="font-mono-num" style={{ color: 'var(--color-text-main)' }}>${formatPrice(order.triggered_price)}</strong>
                  </div>
                )}
              </div>

              {/* End / Closed Time */}
              <div className="p-3 rounded-lg border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
                <span className="text-[10px] uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                  3. End / Closed Time
                </span>
                <div className="font-mono-num font-semibold text-sm" style={{ color: 'var(--color-text-main)' }}>
                  {order.closed_at ? (
                    formatFullTime(order.closed_at)
                  ) : (
                    <span className="text-emerald-600 dark:text-[#3FA88C] italic font-normal">Still Active / Pending</span>
                  )}
                </div>
                {order.closed_price && (
                  <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Closed Price: <strong className="font-mono-num" style={{ color: 'var(--color-text-main)' }}>${formatPrice(order.closed_price)}</strong>
                  </div>
                )}
              </div>

              {/* Expiry Time & Active Duration */}
              <div className="p-3 rounded-lg border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
                <span className="text-[10px] uppercase tracking-wider block mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                  4. Expiry / Active Holding Duration
                </span>
                {activeDuration ? (
                  <div className="text-xs" style={{ color: 'var(--color-text-main)' }}>
                    Active Holding Time: <strong className="font-mono-num text-emerald-600 dark:text-[#3FA88C] text-sm block">{activeDuration}</strong>
                  </div>
                ) : order.expires_at ? (
                  <div className="text-xs font-mono-num" style={{ color: 'var(--color-text-main)' }}>
                    Expires At: <span className="text-rose-500 font-semibold">{formatFullTime(order.expires_at)}</span>
                  </div>
                ) : (
                  <div className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>Good 'Til Cancelled (GTC - No Expiry)</div>
                )}
              </div>
            </div>
          </div>

          {/* Price Levels & Financial Parameters */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Order Specifications &amp; Risk Parameters
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <div>
                <span className="text-[11px] uppercase tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>Target Entry</span>
                <span className="text-sm font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>${formatPrice(entry)}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-[#3FA88C] block">Take Profit</span>
                <span className="text-sm font-bold font-mono-num text-emerald-600 dark:text-[#3FA88C]">${formatPrice(tp)}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-rose-600 dark:text-[#C1502E] block">Stop Loss</span>
                <span className="text-sm font-bold font-mono-num text-rose-600 dark:text-[#C1502E]">${formatPrice(sl)}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-600 dark:text-[#C9A227] block">Volume / Lots</span>
                <span className="text-sm font-bold font-mono-num text-amber-600 dark:text-[#C9A227]">{lotSize} Lots</span>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>Potential Profit</span>
                <span className="text-sm font-semibold font-mono-num text-emerald-600 dark:text-[#3FA88C]">
                  +${potentialProfit.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>Potential Loss</span>
                <span className="text-sm font-semibold font-mono-num text-rose-600 dark:text-[#C1502E]">
                  -${Math.abs(potentialLoss).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>Risk : Reward</span>
                <span className="text-sm font-semibold font-mono-num text-amber-600 dark:text-[#C9A227]">
                  1 : {riskReward.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>Live Distance</span>
                <span className="text-sm font-mono-num" style={{ color: 'var(--color-text-main)' }}>
                  {distanceToEntry ? `$${distanceToEntry}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Strategy, Session & Rationale Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Strategy &amp; Trading Session
              </span>
              <div className="p-3 rounded-xl border space-y-1.5 text-xs" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-dim)' }}>Strategy:</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>{order.strategy || 'Unspecified'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-dim)' }}>Session:</span>
                  <span className="font-semibold text-amber-600 dark:text-[#C9A227]">{order.session || 'Unspecified'}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-dim)' }}>Symbol:</span>
                  <span className="font-mono-num" style={{ color: 'var(--color-text-muted)' }}>{order.symbol || 'XAUUSD'}</span>
                </div>
              </div>
            </div>

            {linkedTrade && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-[#3FA88C]">
                  Linked Journal Trade
                </span>
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 space-y-2 text-xs">
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    This completed order generated Trade record <strong style={{ color: 'var(--color-text-main)' }}>#{linkedTrade.id}</strong> in your journal.
                  </p>
                  <button
                    onClick={handleOpenLinkedTrade}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink size={13} /> View Trade Journal Record
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Rationale / Notes */}
          {order.notes && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <FileText size={14} /> Trade Rationale &amp; Order Notes
              </span>
              <div className="p-3.5 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap font-body" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}>
                {order.notes}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t flex items-center justify-between" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <div>
            {isActionable && onCancel && (
              <button
                onClick={() => {
                  onCancel(order.id);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <X size={14} /> Cancel Order
              </button>
            )}
            {!isActionable && onDelete && (
              <button
                onClick={() => {
                  onDelete(order.id);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} /> Delete Record
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg border text-xs font-semibold transition-colors hover:opacity-80"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
