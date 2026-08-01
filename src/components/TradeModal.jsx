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
      <div className="bg-[#131619] border border-[#262B30] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#1E2226] flex items-center justify-between sticky top-0 bg-[#131619] z-10">
          <div className="flex items-center gap-3">
            <Pill tone={trade.side === 'Buy' ? 'profit' : 'loss'} className="text-sm px-2.5 py-1">
              {trade.side.toUpperCase()}
            </Pill>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold font-display text-[#EDEAE3]">XAU/USD Trade #{trade.id}</span>
                <span className="text-xs text-[#5A5D61] font-mono-num">{trade.date}</span>
                {nearEvent && (
                  <Pill tone="warning" className="py-0.5 animate-pulse">
                    <Zap size={11} /> ⚠ Near {nearEvent.title}
                  </Pill>
                )}
              </div>
              <p className="text-xs text-[#8B8D91] font-body flex items-center gap-3">
                <span>Strategy: <strong className="text-[#EDEAE3]">{trade.strategy}</strong></span>
                <span>Session: <strong className="text-[#C9A227]">{trade.session}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-[#C1502E] hover:bg-[#4A2A1E]/40 rounded-lg transition-colors"
              title="Delete Trade"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#1B1F23] rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* Key Outcome Banner */}
          <div className={`p-4 rounded-lg flex items-center justify-between border ${isProfit ? 'bg-[#1F4A40]/20 border-[#265C50]' : 'bg-[#4A2A1E]/20 border-[#5C3426]'}`}>
            <div>
              <span className="text-xs font-semibold uppercase text-[#8B8D91]">Realized Net P&L</span>
              <div className={`text-2xl font-bold font-mono-num ${isProfit ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                {trade.pnl > 0 ? '+' : ''}${trade.pnl.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold uppercase text-[#8B8D91]">Realized R:R</span>
              <div className={`text-lg font-bold font-mono-num ${trade.rr >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                1 : {trade.rr.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Trade Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#1B1F23] p-4 rounded-lg border border-[#1E2226]">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Entry Price</span>
              <span className="text-sm font-semibold font-mono-num text-[#EDEAE3]">${trade.entryPrice}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Exit Price</span>
              <span className="text-sm font-semibold font-mono-num text-[#EDEAE3]">${trade.exitPrice}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Stop Loss</span>
              <span className="text-sm font-semibold font-mono-num text-[#C1502E]">{trade.stopLoss ? `$${trade.stopLoss}` : 'None'}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Take Profit</span>
              <span className="text-sm font-semibold font-mono-num text-[#3FA88C]">{trade.takeProfit ? `$${trade.takeProfit}` : 'None'}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Lot Size</span>
              <span className="text-sm font-semibold font-mono-num text-[#C9A227]">{trade.lotSize} lots</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Market</span>
              <span className="text-sm font-medium text-[#8B8D91]">{trade.marketCondition}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Emotion Log</span>
              <span className="text-sm font-medium text-[#8B8D91]">{trade.emotion}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#5A5D61] block">Ticket #</span>
              <span className="text-sm font-mono-num text-[#5A5D61]">{trade.ticket || 'Manual'}</span>
            </div>
          </div>

          {/* Mistakes & Flags */}
          {trade.mistakes && trade.mistakes.length > 0 && (
            <div className="bg-[#4A2A1E]/30 border border-[#5C3426] p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#C1502E]">
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
              <span className="text-xs font-semibold uppercase text-[#8B8D91] flex items-center gap-1.5">
                <FileText size={14} /> Retrospective & Setup Rationale
              </span>
              <div className="bg-[#1B1F23] p-3.5 rounded-lg border border-[#1E2226] text-sm text-[#EDEAE3] leading-relaxed whitespace-pre-wrap">
                {trade.notes}
              </div>
            </div>
          )}

          {/* Chart Screenshot (Loaded from IndexedDB) */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-[#8B8D91] flex items-center gap-1.5">
              <ImageIcon size={14} /> Chart Screenshot Attachment
            </span>
            {loadingImage ? (
              <div className="h-48 bg-[#1B1F23] rounded-lg animate-pulse flex items-center justify-center text-xs text-[#5A5D61]">
                Loading screenshot from IndexedDB...
              </div>
            ) : imageUrl ? (
              <div className="rounded-lg overflow-hidden border border-[#262B30] bg-[#0A0C0E]">
                <img src={imageUrl} alt="Trade chart screenshot" className="w-full h-auto object-cover" />
              </div>
            ) : (
              <div className="p-6 bg-[#1B1F23] rounded-lg border border-dashed border-[#262B30] text-center text-xs text-[#5A5D61]">
                No chart screenshot attached to this trade.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
