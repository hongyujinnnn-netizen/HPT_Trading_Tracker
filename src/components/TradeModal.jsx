import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Calendar, Clock, Target, Shield, FileText, Image as ImageIcon, Trash2, Zap } from 'lucide-react';
import { Pill } from './Pill';
import { imageStore } from '../services/imageStore';
import { useTrade } from '../context/TradeContext';
import { getEconomicEvents, isNearHighImpactEvent } from '../lib/economicEvents';

export function TradeModal({ trade, onClose }) {
  const { deleteTrade } = useTrade();
  const [imageUrl, setImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [nearEvent, setNearEvent] = useState(null);

  // Check if trade entry is near a high-impact economic event (±30 min)
  useEffect(() => {
    async function checkNews() {
      if (!trade?.date) return;
      const tradeDate = new Date(trade.date);
      const from = new Date(tradeDate);
      from.setDate(from.getDate() - 1);
      const to = new Date(tradeDate);
      to.setDate(to.getDate() + 1);

      const events = await getEconomicEvents({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const result = isNearHighImpactEvent(trade.date, events, 30);
      if (result.isNear && result.event) {
        setNearEvent(result.event);
      } else {
        setNearEvent(null);
      }
    }
    checkNews();
  }, [trade]);

  useEffect(() => {
    async function loadScreenshot() {
      if (trade && trade.imageId) {
        setLoadingImage(true);
        const data = await imageStore.getImage(trade.imageId);
        setImageUrl(data);
        setLoadingImage(false);
      } else {
        setImageUrl(null);
      }
    }
    loadScreenshot();
  }, [trade]);

  if (!trade) return null;

  const isProfit = trade.pnl >= 0;

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete trade #${trade.id}?`)) {
      await deleteTrade(trade.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="terminal-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col my-8">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
          <div className="flex items-center gap-3">
            <Pill tone={trade.side === 'Buy' ? 'profit' : 'loss'} className="text-sm px-2.5 py-1">
              {trade.side.toUpperCase()}
            </Pill>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-display" style={{ color: 'var(--color-text-main)' }}>XAU/USD Trade #{trade.id}</span>
                <span className="text-xs font-mono-num" style={{ color: 'var(--color-text-dim)' }}>{trade.date}</span>
                {nearEvent && (
                  <Pill tone="warning" className="py-0.5 animate-pulse">
                    <Zap size={11} /> ⚠ Near {nearEvent.title}
                  </Pill>
                )}
              </div>
              <p className="text-xs font-body flex items-center gap-3 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                <span>Strategy: <strong style={{ color: 'var(--color-text-main)' }}>{trade.strategy}</strong></span>
                <span>Session: <strong className="text-amber-600 dark:text-[#C9A227]">{trade.session}</strong></span>
                <span>Emotion: <strong style={{ color: 'var(--color-text-main)' }}>{trade.emotion || 'Planned'}</strong></span>
                {trade.accountId && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-[#C9A227] border border-amber-500/30 text-[10px] font-mono">
                    Sub-Account: #{trade.accountId}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Delete Trade"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* Key Outcome Banner */}
          <div className={`p-4 rounded-xl flex items-center justify-between border ${isProfit ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
            <div>
              <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Realized Net P&L</span>
              <div className={`text-2xl font-bold font-mono-num ${isProfit ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                {trade.pnl > 0 ? '+' : ''}${trade.pnl.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>R-Multiple</span>
                <div className={`text-lg font-bold font-mono-num ${trade.pnl >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                  {trade.pnl >= 0 ? '+' : ''}{trade.rr ? Number(trade.rr).toFixed(1) : (trade.pnl >= 0 ? '1.0' : '-1.0')}R
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Realized R:R</span>
                <div className={`text-lg font-bold font-mono-num ${trade.rr >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                  1 : {trade.rr ? Number(trade.rr).toFixed(1) : '1.0'}
                </div>
              </div>
            </div>
          </div>

          {/* Trade Parameters Grid */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <div>
              <span className="text-[11px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Entry Price</span>
              <span className="text-sm font-semibold font-mono-num" style={{ color: 'var(--color-text-main)' }}>${trade.entryPrice}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Exit Price</span>
              <span className="text-sm font-semibold font-mono-num" style={{ color: 'var(--color-text-main)' }}>${trade.exitPrice}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-rose-600 dark:text-[#C1502E] block font-semibold">Stop Loss</span>
              <span className="text-sm font-semibold font-mono-num text-rose-600 dark:text-[#C1502E]">{trade.stopLoss ? `$${trade.stopLoss}` : 'None'}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-[#3FA88C] block font-semibold">Take Profit</span>
              <span className="text-sm font-semibold font-mono-num text-emerald-600 dark:text-[#3FA88C]">{trade.takeProfit ? `$${trade.takeProfit}` : 'None'}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Lot Size</span>
              <span className="text-sm font-semibold font-mono-num text-amber-600 dark:text-[#C9A227]">{trade.lotSize} lots</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Market</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>{trade.marketCondition}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Emotion Log</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>{trade.emotion}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider block font-semibold" style={{ color: 'var(--color-text-dim)' }}>Ticket #</span>
              <span className="text-sm font-mono-num" style={{ color: 'var(--color-text-dim)' }}>{trade.ticket || 'Manual'}</span>
            </div>
          </div>

          {/* Trade Timeline & Up Time */}
          <div
            className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-mono-num"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-main)' }}>
              <Clock size={13} className="text-amber-500 dark:text-[#C9A227]" />
              <span style={{ color: 'var(--color-text-dim)' }}>Entry Time / Setup:</span>
              <strong style={{ color: 'var(--color-text-main)' }}>{trade.timestamp ? new Date(trade.timestamp).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : trade.date}</strong>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-main)' }}>
              <span style={{ color: 'var(--color-text-dim)' }}>Exit / End Time:</span>
              <strong style={{ color: 'var(--color-text-main)' }}>{trade.exitTime ? new Date(trade.exitTime).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Closed'}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'var(--color-text-dim)' }}>Holding Duration:</span>
              <span className="text-emerald-600 dark:text-[#3FA88C] font-bold">{trade.duration || 'N/A'}</span>
            </div>
          </div>

          {/* Mistakes & Flags */}
          {trade.mistakes && trade.mistakes.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-rose-700 dark:text-[#C1502E]">
                <AlertTriangle size={14} /> Identified Discipline Leaks ({trade.mistakes.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {trade.mistakes.map((m) => (
                  <Pill key={m} tone="loss" className="py-1">
                    <AlertTriangle size={11} /> {m}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {/* Trade Notes */}
          {trade.notes && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <FileText size={14} /> Retrospective & Setup Rationale
              </span>
              <div
                className="p-3.5 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
              >
                {trade.notes}
              </div>
            </div>
          )}

          {/* Chart Screenshot (Loaded from IndexedDB) */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <ImageIcon size={14} /> Chart Screenshot Attachment
            </span>
            {loadingImage ? (
              <div
                className="h-48 rounded-xl animate-pulse flex items-center justify-center text-xs"
                style={{ background: 'var(--color-elevated)', color: 'var(--color-text-dim)' }}
              >
                Loading screenshot from IndexedDB...
              </div>
            ) : imageUrl ? (
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-border-soft)' }}>
                <img src={imageUrl} alt="Trade chart screenshot" className="w-full h-auto object-cover" />
              </div>
            ) : (
              <div
                className="p-6 rounded-xl border border-dashed text-center text-xs"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-dim)' }}
              >
                No chart screenshot attached to this trade.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
