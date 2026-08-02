import React from 'react';
import { X, ArrowUpRight, ArrowDownRight, Clock, Zap, Target, ShieldAlert } from 'lucide-react';
import { Pill } from './Pill';

function formatPrice(p) {
  return parseFloat(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${day} · ${hh}:${mm}`;
  } catch { return iso; }
}

const ORDER_TYPE_LABELS = {
  buy_stop: 'Buy Stop',
  sell_stop: 'Sell Stop',
  buy_limit: 'Buy Limit',
  sell_limit: 'Sell Limit',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', tone: 'warning' },
  active: { label: 'Active', tone: 'gold' },
  closed_tp: { label: 'Closed TP ✅', tone: 'profit' },
  closed_sl: { label: 'Closed SL ❌', tone: 'loss' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};

export function OrderCard({ order, currentPrice, onCancel }) {
  const isBuy = order.order_type === 'buy_stop' || order.order_type === 'buy_limit';
  const entry = parseFloat(order.entry_price);
  const tp = parseFloat(order.take_profit);
  const sl = parseFloat(order.stop_loss);
  const lotSize = parseFloat(order.lot_size);
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const typeBgColor = isBuy ? '#1F4A40' : '#4A2A1E';
  const typeFgColor = isBuy ? '#3FA88C' : '#C1502E';
  const typeBorderColor = isBuy ? '#265C50' : '#5C3426';

  // Distance to entry from current price (in pips — for gold, 1 pip = $0.10 typically, but we show in $ difference)
  const distanceToEntry = currentPrice ? Math.abs(currentPrice - entry).toFixed(2) : '—';
  const priceAboveEntry = currentPrice ? currentPrice > entry : false;

  // Unrealized P&L for active orders
  let unrealizedPnl = null;
  if (order.status === 'active' && currentPrice) {
    const triggerPrice = parseFloat(order.triggered_price) || entry;
    const contractSize = 100; // Standard gold contract
    if (isBuy) {
      unrealizedPnl = (currentPrice - triggerPrice) * lotSize * contractSize;
    } else {
      unrealizedPnl = (triggerPrice - currentPrice) * lotSize * contractSize;
    }
    unrealizedPnl = parseFloat(unrealizedPnl.toFixed(2));
  }

  // Realized P&L for closed orders
  let realizedPnl = null;
  if ((order.status === 'closed_tp' || order.status === 'closed_sl') && order.closed_price) {
    const closedPrice = parseFloat(order.closed_price);
    const triggerPrice = parseFloat(order.triggered_price) || entry;
    const contractSize = 100;
    if (isBuy) {
      realizedPnl = (closedPrice - triggerPrice) * lotSize * contractSize;
    } else {
      realizedPnl = (triggerPrice - closedPrice) * lotSize * contractSize;
    }
    realizedPnl = parseFloat(realizedPnl.toFixed(2));
  }

  // Progress bar: where current price sits between SL and TP
  let progressPct = 50;
  if (currentPrice && (order.status === 'pending' || order.status === 'active')) {
    const range = Math.abs(tp - sl);
    if (range > 0) {
      if (isBuy) {
        // SL is below, TP is above: SL(0%) → TP(100%)
        progressPct = Math.max(0, Math.min(100, ((currentPrice - sl) / range) * 100));
      } else {
        // SL is above, TP is below: TP(0%) → SL(100%) — but we invert for visual
        // For sell: SL is higher, TP is lower. Show SL on right, TP on left
        progressPct = Math.max(0, Math.min(100, ((sl - currentPrice) / range) * 100));
      }
    }
  }

  const isActionable = order.status === 'pending' || order.status === 'active';

  return (
    <div className="p-4 rounded-xl bg-[#131619] border border-[#262B30] hover:border-[#3A3F45] transition-colors space-y-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono-num border"
            style={{ background: typeBgColor, color: typeFgColor, borderColor: typeBorderColor }}
          >
            {isBuy ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {ORDER_TYPE_LABELS[order.order_type]}
          </span>
          <Pill tone={statusCfg.tone}>{statusCfg.label}</Pill>
          <span className="text-[10px] font-mono-num text-[#5A5D61]">{lotSize} lots</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Unrealized P&L */}
          {unrealizedPnl !== null && (
            <span className={`text-sm font-bold font-mono-num ${unrealizedPnl >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
            </span>
          )}
          {/* Realized P&L */}
          {realizedPnl !== null && (
            <span className={`text-sm font-bold font-mono-num ${realizedPnl >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
              {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
            </span>
          )}
          {/* Cancel button */}
          {isActionable && onCancel && (
            <button
              onClick={() => onCancel(order.id)}
              className="p-1.5 rounded-lg text-[#8B8D91] hover:text-[#C1502E] hover:bg-[#4A2A1E]/50 transition-colors"
              title="Cancel Order"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Price Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#5A5D61] block">Entry</span>
          <span className="text-sm font-bold font-mono-num text-[#EDEAE3]">${formatPrice(entry)}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#3FA88C] block">Take Profit</span>
          <span className="text-sm font-bold font-mono-num text-[#3FA88C]">${formatPrice(tp)}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#C1502E] block">Stop Loss</span>
          <span className="text-sm font-bold font-mono-num text-[#C1502E]">${formatPrice(sl)}</span>
        </div>
      </div>

      {/* Price Progress Bar (only for pending/active) */}
      {(order.status === 'pending' || order.status === 'active') && currentPrice && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono-num">
            <span className="text-[#C1502E]">SL</span>
            <span className="text-[#8B8D91]">Current: ${formatPrice(currentPrice)}</span>
            <span className="text-[#3FA88C]">TP</span>
          </div>
          <div className="relative h-2 rounded-full bg-[#1B1F23] overflow-hidden">
            {/* Entry price marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#C9A227] z-10"
              style={{ left: `${Math.max(0, Math.min(100, isBuy ? ((entry - sl) / (tp - sl)) * 100 : ((sl - entry) / (sl - tp)) * 100))}%` }}
              title={`Entry: $${formatPrice(entry)}`}
            />
            {/* Current price fill */}
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: progressPct > 50
                  ? 'linear-gradient(90deg, #C1502E 0%, #C9A227 40%, #3FA88C 100%)'
                  : 'linear-gradient(90deg, #C1502E 0%, #C9A227 100%)',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer: metadata */}
      <div className="flex items-center justify-between text-[10px] font-mono-num text-[#5A5D61] pt-1 border-t border-[#1E2226]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Clock size={10} /> {formatTime(order.created_at)}</span>
          {order.strategy && <span>{order.strategy}</span>}
          {order.session && <span className="text-[#8B8D91]">{order.session}</span>}
        </div>
        <div className="flex items-center gap-3">
          {order.status === 'pending' && currentPrice && (
            <span className="flex items-center gap-1">
              <Target size={10} className="text-[#C9A227]" />
              ${distanceToEntry} {priceAboveEntry ? 'above' : 'below'}
            </span>
          )}
          {order.triggered_at && (
            <span className="flex items-center gap-1 text-[#C9A227]">
              <Zap size={10} /> Triggered {formatTime(order.triggered_at)}
            </span>
          )}
          {order.expires_at && order.status === 'pending' && (
            <span className="flex items-center gap-1">
              <ShieldAlert size={10} /> Expires {formatTime(order.expires_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
