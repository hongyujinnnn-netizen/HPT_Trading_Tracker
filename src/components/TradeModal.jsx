import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Clock, FileText, Image as ImageIcon, Trash2, Zap, Edit3, Save, Upload } from 'lucide-react';
import { Pill } from './Pill';
import { ConfirmModal } from './ConfirmModal';
import { imageStore } from '../services/imageStore';
import { supabaseStore } from '../services/supabaseStore';
import { useTrade } from '../context/TradeContext';
import { getEconomicEvents, isNearHighImpactEvent } from '../lib/economicEvents';
import { calculatePnL, calculateRR } from '../utils/calculations';
import { STANDARD_STRATEGIES, TRADING_SESSIONS } from '../utils/tradingConstants';

export function TradeModal({ trade, onClose }) {
  const { deleteTrade, updateTrade, settings } = useTrade();
  const [imageUrl, setImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [nearEvent, setNearEvent] = useState(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Edit Trade State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [newScreenshot, setNewScreenshot] = useState(null);

  useEffect(() => {
    setIsEditing(false);
    setNewScreenshot(null);
    if (trade) {
      setEditDraft({
        side: trade.side || 'Buy',
        entryPrice: trade.entryPrice ?? '',
        exitPrice: trade.exitPrice ?? '',
        stopLoss: trade.stopLoss ?? '',
        takeProfit: trade.takeProfit ?? '',
        lotSize: trade.lotSize ?? 0.1,
        pnl: trade.pnl ?? 0,
        strategy: trade.strategy || 'Breakout',
        session: trade.session || 'London',
        marketCondition: trade.marketCondition || 'Trending',
        emotion: trade.emotion || 'Planned',
        notes: trade.notes || '',
      });
    }
  }, [trade]);

  // Close on Escape and lock body scroll while open
  useEffect(() => {
    if (!trade) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === 'Escape' && !isConfirmDeleteOpen) onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [trade, isConfirmDeleteOpen, onClose]);

  // Check if trade entry is near a high-impact economic event (±30 min)
  useEffect(() => {
    let cancelled = false;
    async function checkNews() {
      if (!trade?.date) return;
      try {
        const tradeDate = new Date(trade.date);
        const from = new Date(tradeDate);
        from.setDate(from.getDate() - 1);
        const to = new Date(tradeDate);
        to.setDate(to.getDate() + 1);

        const events = await getEconomicEvents({
          from: from.toISOString(),
          to: to.toISOString(),
        });
        if (cancelled) return;
        const result = isNearHighImpactEvent(trade.date, events, 30);
        setNearEvent(result.isNear && result.event ? result.event : null);
      } catch (_err) {
        if (!cancelled) setNearEvent(null);
      }
    }
    checkNews();
    return () => {
      cancelled = true;
    };
  }, [trade]);

  useEffect(() => {
    let cancelled = false;
    async function loadScreenshot() {
      if (!trade || !trade.imageId) {
        setImageUrl(null);
        return;
      }
      setLoadingImage(true);
      try {
        let data = await imageStore.getImage(trade.imageId);
        // If not in local IndexedDB and looks like a Supabase Storage path, resolve a signed URL
        if (!data && typeof trade.imageId === 'string' && trade.imageId.includes('/')) {
          data = await supabaseStore.getScreenshotSignedUrl(trade.imageId);
        }
        if (!cancelled) setImageUrl(data);
      } catch (_err) {
        if (!cancelled) setImageUrl(null);
      } finally {
        if (!cancelled) setLoadingImage(false);
      }
    }
    loadScreenshot();
    return () => {
      cancelled = true;
    };
  }, [trade]);

  if (!trade) return null;

  const isProfit = (trade.pnl ?? 0) >= 0;
  const rrNumber = trade.rr != null && Number.isFinite(Number(trade.rr)) ? Number(trade.rr) : null;

  const handleConfirmDelete = async () => {
    await deleteTrade(trade.id);
    onClose();
  };

  const handleScreenshotUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/') || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewScreenshot(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editDraft || !updateTrade) return;
    setIsSaving(true);
    try {
      const entry = parseFloat(editDraft.entryPrice) || 0;
      const exit = parseFloat(editDraft.exitPrice) || 0;
      const sl = parseFloat(editDraft.stopLoss) || 0;
      const tp = parseFloat(editDraft.takeProfit) || 0;
      const lots = parseFloat(editDraft.lotSize) || 0.1;

      const priceChanged =
        entry !== Number(trade.entryPrice) ||
        exit !== Number(trade.exitPrice) ||
        lots !== Number(trade.lotSize) ||
        editDraft.side !== trade.side;

      const finalPnl = priceChanged
        ? calculatePnL(editDraft.side, entry, exit, lots, settings?.contractSize || 100)
        : (parseFloat(editDraft.pnl) || 0);

      const finalRR = calculateRR(editDraft.side, entry, sl, tp || exit) || trade.rr || 0;

      await updateTrade(
        trade.id,
        {
          side: editDraft.side,
          entryPrice: entry,
          exitPrice: exit,
          stopLoss: sl,
          takeProfit: tp,
          lotSize: lots,
          pnl: finalPnl,
          rr: finalRR,
          strategy: editDraft.strategy || 'Breakout',
          session: editDraft.session || 'London',
          marketCondition: editDraft.marketCondition || 'Trending',
          emotion: editDraft.emotion || 'Planned',
          notes: editDraft.notes || '',
        },
        newScreenshot
      );
      if (newScreenshot) {
        setImageUrl(newScreenshot);
        setNewScreenshot(null);
      }
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`XAU/USD Trade #${trade.id} details`}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="terminal-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b flex items-start sm:items-center justify-between gap-3 sticky top-0 z-10" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <Pill tone={trade.side === 'Buy' ? 'profit' : 'loss'} className="text-sm px-2.5 py-1 shrink-0">
                {(trade.side || 'Buy').toUpperCase()}
              </Pill>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base sm:text-lg font-bold font-display" style={{ color: 'var(--color-text-main)' }}>XAU/USD Trade #{trade.id}</span>
                  <span className="text-xs font-mono-num" style={{ color: 'var(--color-text-dim)' }}>{trade.date}</span>
                  {nearEvent && (
                    <Pill tone="warning" className="py-0.5">
                      <Zap size={11} /> ⚠ Near {nearEvent.title}
                    </Pill>
                  )}
                </div>
                <p className="text-xs font-body flex flex-wrap items-center gap-x-3 gap-y-1 mt-1" style={{ color: 'var(--color-text-muted)' }}>
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

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-amber-500/20 text-amber-500' : 'text-amber-500 hover:bg-amber-500/10'}`}
                title={isEditing ? 'Cancel Editing' : 'Edit Trade'}
                aria-label={isEditing ? 'Cancel editing trade' : 'Edit trade'}
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Delete Trade"
                aria-label="Delete trade"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label="Close trade details"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 space-y-6">
            {isEditing && editDraft && (
              <form
                onSubmit={handleSaveEdit}
                className="p-4 rounded-xl border space-y-4"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-accent)' }}
              >
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--color-border-soft)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-[#C9A227]">
                    Edit Trade Parameters &amp; Journal Notes
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-dim)' }}>Side</label>
                    <select
                      value={editDraft.side}
                      onChange={(e) => setEditDraft({ ...editDraft, side: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 terminal-select"
                    >
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-dim)' }}>Entry Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDraft.entryPrice}
                      onChange={(e) => setEditDraft({ ...editDraft, entryPrice: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 font-mono-num terminal-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-dim)' }}>Exit Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDraft.exitPrice}
                      onChange={(e) => setEditDraft({ ...editDraft, exitPrice: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 font-mono-num terminal-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-rose-500">Stop Loss ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDraft.stopLoss}
                      onChange={(e) => setEditDraft({ ...editDraft, stopLoss: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 font-mono-num terminal-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-emerald-500">Take Profit ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDraft.takeProfit}
                      onChange={(e) => setEditDraft({ ...editDraft, takeProfit: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 font-mono-num terminal-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-dim)' }}>Lot Size</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDraft.lotSize}
                      onChange={(e) => setEditDraft({ ...editDraft, lotSize: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 font-mono-num terminal-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-dim)' }}>Net P&amp;L ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDraft.pnl}
                      onChange={(e) => setEditDraft({ ...editDraft, pnl: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 font-mono-num terminal-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-dim)' }}>Strategy</label>
                    <select
                      value={editDraft.strategy}
                      onChange={(e) => setEditDraft({ ...editDraft, strategy: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 terminal-select"
                    >
                      {Array.from(new Set([...STANDARD_STRATEGIES, editDraft.strategy].filter(Boolean))).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-dim)' }}>Session</label>
                    <select
                      value={editDraft.session}
                      onChange={(e) => setEditDraft({ ...editDraft, session: e.target.value })}
                      className="w-full rounded-lg px-2.5 py-1.5 terminal-select"
                    >
                      {TRADING_SESSIONS.map((s) => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="block font-semibold" style={{ color: 'var(--color-text-dim)' }}>
                    Retrospective &amp; Setup Rationale
                  </label>
                  <textarea
                    rows={3}
                    value={editDraft.notes}
                    onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                    placeholder="Add post-trade review, execution notes, or why this MT5 position was taken..."
                    className="w-full rounded-lg p-2.5 terminal-input text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:opacity-80" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}>
                    <Upload size={13} className="text-amber-500" />
                    <span>{newScreenshot ? 'Screenshot Selected' : 'Upload / Replace Screenshot'}</span>
                    <input type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setNewScreenshot(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold"
                      style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Save size={13} /> {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            )}
            {/* Key Outcome Banner */}
            <div className={`p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 border ${isProfit ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
              <div>
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Realized Net P&L</span>
                <div className={`text-2xl font-bold font-mono-num ${isProfit ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                  {(trade.pnl ?? 0) > 0 ? '+' : ''}${(trade.pnl ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>R-Multiple</span>
                  <div className={`text-lg font-bold font-mono-num ${isProfit ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                    {isProfit ? '+' : ''}{rrNumber !== null ? rrNumber.toFixed(1) : (isProfit ? '1.0' : '-1.0')}R
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>Realized R:R</span>
                  <div className={`text-lg font-bold font-mono-num ${(rrNumber ?? 0) >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}`}>
                    {rrNumber !== null ? `1 : ${rrNumber.toFixed(1)}` : '—'}
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
                  <FileText size={14} /> Retrospective &amp; Setup Rationale
                </span>
                <div
                  className="p-3.5 rounded-xl border text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
                >
                  {trade.notes}
                </div>
              </div>
            )}

            {/* Chart Screenshot */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <ImageIcon size={14} /> Chart Screenshot Attachment
              </span>
              {loadingImage ? (
                <div
                  className="h-48 rounded-xl animate-pulse flex items-center justify-center text-xs"
                  style={{ background: 'var(--color-elevated)', color: 'var(--color-text-dim)' }}
                >
                  Loading chart screenshot...
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

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete Trade #${trade.id}?`}
        description={`This will permanently remove your ${trade.side} trade on ${trade.date} (${(trade.pnl ?? 0) >= 0 ? '+' : ''}$${(trade.pnl ?? 0).toLocaleString()}) from your journal.`}
        confirmText="Delete Trade"
      />
    </>
  );
}
