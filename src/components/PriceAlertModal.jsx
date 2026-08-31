import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Plus, Trash2, X, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, Zap, AlertCircle } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from './Pill';

export function PriceAlertModal({ isOpen, onClose }) {
  const { liveGoldPrice, priceAlerts, addPriceAlert, deletePriceAlert, togglePriceAlert } = useTrade();

  const [targetPrice, setTargetPrice] = useState('');
  const [direction, setDirection] = useState('above'); // 'above' | 'below'
  const [label, setLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const p = parseFloat(targetPrice);
    if (!p || isNaN(p) || p <= 0) {
      setErrorMsg('Please enter a valid target price.');
      return;
    }

    addPriceAlert(p, direction, label.trim());
    setTargetPrice('');
    setLabel('');
    setErrorMsg('');
  };

  const handleSetQuickPrice = (offset) => {
    if (!liveGoldPrice) return;
    const p = liveGoldPrice + offset;
    setTargetPrice(p.toFixed(2));
    setDirection(offset >= 0 ? 'above' : 'below');
  };

  const activeAlerts = (priceAlerts || []).filter((a) => !a.isTriggered);
  const triggeredAlerts = (priceAlerts || []).filter((a) => a.isTriggered);

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="terminal-card rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b flex items-center justify-between sticky top-0 z-10" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display" style={{ color: 'var(--color-text-main)' }}>XAU/USD Price Alerts</h2>
                {liveGoldPrice && (
                  <span className="text-xs font-mono-num px-2 py-0.5 rounded-full border text-emerald-600 dark:text-[#3FA88C]" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
                    ${liveGoldPrice.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Real-time notification when gold price crosses key technical levels</p>
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

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Create Alert Form */}
          <form onSubmit={handleSubmit} className="p-4 rounded-xl border space-y-4" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-[#C9A227] flex items-center gap-1.5">
                <Plus size={13} /> Set New Alert Level
              </span>
              {liveGoldPrice && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(5)}
                    className="px-2 py-0.5 rounded border text-[10px] font-mono-num text-emerald-600 dark:text-[#3FA88C] hover:opacity-80"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}
                  >
                    +$5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(10)}
                    className="px-2 py-0.5 rounded border text-[10px] font-mono-num text-emerald-600 dark:text-[#3FA88C] hover:opacity-80"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}
                  >
                    +$10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(-5)}
                    className="px-2 py-0.5 rounded border text-[10px] font-mono-num text-rose-600 dark:text-[#C1502E] hover:opacity-80"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}
                  >
                    -$5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(-10)}
                    className="px-2 py-0.5 rounded border text-[10px] font-mono-num text-rose-600 dark:text-[#C1502E] hover:opacity-80"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}
                  >
                    -$10
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block" style={{ color: 'var(--color-text-dim)' }}>
                  Target Price ($USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={liveGoldPrice ? `Current: ${liveGoldPrice.toFixed(2)}` : 'e.g. 2750.00'}
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono-num terminal-input"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block" style={{ color: 'var(--color-text-dim)' }}>
                  Trigger Condition
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDirection('above')}
                    className={`px-2 py-2 rounded-lg text-xs font-bold font-mono-num flex items-center justify-center gap-1 border transition-all ${
                      direction === 'above'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#3FA88C] border-emerald-500/40'
                        : 'border hover:opacity-80'
                    }`}
                    style={{
                      background: direction !== 'above' ? 'var(--color-surface)' : undefined,
                      borderColor: direction !== 'above' ? 'var(--color-border-soft)' : undefined,
                      color: direction !== 'above' ? 'var(--color-text-muted)' : undefined,
                    }}
                  >
                    <ArrowUpRight size={13} /> Rises ≥
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('below')}
                    className={`px-2 py-2 rounded-lg text-xs font-bold font-mono-num flex items-center justify-center gap-1 border transition-all ${
                      direction === 'below'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-[#C1502E] border-rose-500/40'
                        : 'border hover:opacity-80'
                    }`}
                    style={{
                      background: direction !== 'below' ? 'var(--color-surface)' : undefined,
                      borderColor: direction !== 'below' ? 'var(--color-border-soft)' : undefined,
                      color: direction !== 'below' ? 'var(--color-text-muted)' : undefined,
                    }}
                  >
                    <ArrowDownRight size={13} /> Drops ≤
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold mb-1 block" style={{ color: 'var(--color-text-dim)' }}>
                Note / Technical Level (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 4H Order Block Sweep / Asian High"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs terminal-input"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                <AlertCircle size={13} /> {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
            >
              <Bell size={14} /> Create Price Alert
            </button>
          </form>

          {/* Active Alerts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-[#C9A227] flex items-center gap-1.5">
                <Zap size={13} /> Active Monitoring ({activeAlerts.length})
              </span>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="py-6 text-center text-xs rounded-xl border border-dashed" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}>
                No active alerts set. Configure a level above to get notified.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {activeAlerts.map((alert) => {
                  const isAbove = alert.direction === 'above';
                  const dist = liveGoldPrice ? Math.abs(liveGoldPrice - alert.price).toFixed(2) : null;
                  return (
                    <div
                      key={alert.id}
                      className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all hover:opacity-85"
                      style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center border font-bold ${
                            isAbove
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-[#3FA88C] border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-600 dark:text-[#C1502E] border-rose-500/40'
                          }`}
                        >
                          {isAbove ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono-num text-sm" style={{ color: 'var(--color-text-main)' }}>
                              ${alert.price.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                              ({isAbove ? '≥ High' : '≤ Low'})
                            </span>
                          </div>
                          {alert.label && (
                            <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{alert.label}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-mono-num">
                        {dist && (
                          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            ${dist} away
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePriceAlert(alert.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Alert"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Triggered Alerts History */}
          {triggeredAlerts.length > 0 && (
            <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--color-border-soft)' }}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" /> Triggered Alerts ({triggeredAlerts.length})
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {triggeredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2.5 rounded-lg border flex items-center justify-between gap-2 text-xs opacity-75"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="font-mono-num font-semibold" style={{ color: 'var(--color-text-main)' }}>
                        ${alert.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] truncate max-w-[140px]" style={{ color: 'var(--color-text-muted)' }}>
                        {alert.label || 'Target reached'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePriceAlert(alert.id)}
                        className="text-[10px] text-amber-600 dark:text-[#C9A227] hover:underline"
                      >
                        Reactivate
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePriceAlert(alert.id)}
                        className="p-1 text-rose-500 hover:opacity-80"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
