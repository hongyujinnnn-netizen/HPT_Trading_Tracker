import React, { useState } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#131619] border border-[#262B30] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1E2226] flex items-center justify-between sticky top-0 bg-[#131619] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C9A227]/15 border border-[#C9A227]/30 flex items-center justify-center text-[#C9A227]">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display text-[#EDEAE3]">XAU/USD Price Alerts</h2>
                {liveGoldPrice && (
                  <span className="text-xs font-mono-num px-2 py-0.5 rounded-full bg-[#1B1F23] border border-[#262B30] text-[#3FA88C]">
                    ${liveGoldPrice.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8B8D91]">Real-time notification when gold price crosses key technical levels</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#1B1F23] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Create Alert Form */}
          <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-[#0A0C0E] border border-[#262B30] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C9A227] flex items-center gap-1.5">
                <Plus size={13} /> Set New Alert Level
              </span>
              {liveGoldPrice && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(5)}
                    className="px-2 py-0.5 rounded bg-[#1B1F23] hover:bg-[#262B30] text-[10px] font-mono-num text-[#3FA88C] border border-[#262B30]"
                  >
                    +$5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(10)}
                    className="px-2 py-0.5 rounded bg-[#1B1F23] hover:bg-[#262B30] text-[10px] font-mono-num text-[#3FA88C] border border-[#262B30]"
                  >
                    +$10
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(-5)}
                    className="px-2 py-0.5 rounded bg-[#1B1F23] hover:bg-[#262B30] text-[10px] font-mono-num text-[#C1502E] border border-[#262B30]"
                  >
                    -$5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetQuickPrice(-10)}
                    className="px-2 py-0.5 rounded bg-[#1B1F23] hover:bg-[#262B30] text-[10px] font-mono-num text-[#C1502E] border border-[#262B30]"
                  >
                    -$10
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8B8D91] font-semibold mb-1 block">
                  Target Price ($USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder={liveGoldPrice ? `Current: ${liveGoldPrice.toFixed(2)}` : 'e.g. 2750.00'}
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-[#131619] border border-[#262B30] rounded-lg text-xs font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227] transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#8B8D91] font-semibold mb-1 block">
                  Trigger Condition
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDirection('above')}
                    className={`px-2 py-2 rounded-lg text-xs font-bold font-mono-num flex items-center justify-center gap-1 border transition-all ${
                      direction === 'above'
                        ? 'bg-[#1F4A40] text-[#3FA88C] border-[#265C50]'
                        : 'bg-[#131619] text-[#8B8D91] border-[#262B30]'
                    }`}
                  >
                    <ArrowUpRight size={13} /> Rises ≥
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('below')}
                    className={`px-2 py-2 rounded-lg text-xs font-bold font-mono-num flex items-center justify-center gap-1 border transition-all ${
                      direction === 'below'
                        ? 'bg-[#4A2A1E] text-[#C1502E] border-[#5C3426]'
                        : 'bg-[#131619] text-[#8B8D91] border-[#262B30]'
                    }`}
                  >
                    <ArrowDownRight size={13} /> Drops ≤
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8B8D91] font-semibold mb-1 block">
                Note / Technical Level (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 4H Order Block Sweep / Asian High"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 bg-[#131619] border border-[#262B30] rounded-lg text-xs text-[#EDEAE3] outline-none focus:border-[#C9A227] transition-colors"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-[#C1502E] font-semibold flex items-center gap-1">
                <AlertCircle size={13} /> {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
            >
              <Bell size={14} /> Create Price Alert
            </button>
          </form>

          {/* Active Alerts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8B8D91] flex items-center gap-1.5">
                <Zap size={13} className="text-[#C9A227]" /> Active Monitoring ({activeAlerts.length})
              </span>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5A5D61] bg-[#0A0C0E] rounded-xl border border-[#262B30] border-dashed">
                No active price alerts. Set a price target above to receive live notifications.
              </div>
            ) : (
              <div className="space-y-2">
                {activeAlerts.map((alert) => {
                  const isAbove = alert.direction === 'above';
                  const dist = liveGoldPrice ? Math.abs(liveGoldPrice - alert.price).toFixed(2) : null;
                  return (
                    <div
                      key={alert.id}
                      className="p-3 rounded-xl bg-[#1B1F23] border border-[#262B30] hover:border-[#3A4048] flex items-center justify-between gap-3 text-xs transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center border font-bold ${
                            isAbove
                              ? 'bg-[#1F4A40]/60 text-[#3FA88C] border-[#265C50]'
                              : 'bg-[#4A2A1E]/60 text-[#C1502E] border-[#5C3426]'
                          }`}
                        >
                          {isAbove ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono-num text-[#EDEAE3] text-sm">
                              ${alert.price.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-[#8B8D91] font-mono-num">
                              ({isAbove ? '≥ High' : '≤ Low'})
                            </span>
                          </div>
                          {alert.label && (
                            <p className="text-[11px] text-[#8B8D91] font-medium">{alert.label}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-mono-num">
                        {dist && (
                          <span className="text-[11px] text-[#8B8D91]">
                            ${dist} away
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePriceAlert(alert.id)}
                          className="p-1.5 text-[#5A5D61] hover:text-[#C1502E] hover:bg-[#4A2A1E]/30 rounded-lg transition-colors"
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
            <div className="space-y-3 pt-3 border-t border-[#1E2226]">
              <div className="flex items-center justify-between text-xs text-[#8B8D91] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-[#3FA88C]" /> Triggered Alerts ({triggeredAlerts.length})
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {triggeredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2.5 rounded-lg bg-[#0A0C0E] border border-[#262B30] flex items-center justify-between gap-2 text-xs opacity-75"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-[#3FA88C]" />
                      <span className="font-mono-num font-semibold text-[#EDEAE3]">
                        ${alert.price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#8B8D91] truncate max-w-[140px]">
                        {alert.label || 'Target reached'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePriceAlert(alert.id)}
                        className="text-[10px] text-[#C9A227] hover:underline"
                      >
                        Reactivate
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePriceAlert(alert.id)}
                        className="p-1 text-[#5A5D61] hover:text-[#C1502E]"
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
}
