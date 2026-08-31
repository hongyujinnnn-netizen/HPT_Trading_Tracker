import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseCSV } from '../utils/csvParser';
import { useTrade } from '../context/TradeContext';

export function ImportModal({ isOpen, onClose }) {
  const { importTrades } = useTrade();
  const [csvContent, setCsvContent] = useState('');
  const [parsedPreview, setParsedPreview] = useState([]);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Security check: limit CSV import file size to 5MB to prevent memory denial of service
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit. Please upload a smaller export file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setCsvContent(text);
      try {
        const results = parseCSV(text);
        if (results.length === 0) {
          setError('Could not parse any valid trades. Ensure your file is an MT4, MT5, or TradePulse CSV export.');
          setParsedPreview([]);
        } else {
          setError(null);
          setParsedPreview(results);
        }
      } catch (err) {
        setError('Error parsing CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (parsedPreview.length > 0) {
      await importTrades(parsedPreview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="terminal-card rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-amber-500 dark:text-[#C9A227]" />
            <h3 className="text-lg font-bold font-display" style={{ color: 'var(--color-text-main)' }}>Import Trades from CSV (MT4 / MT5)</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--color-text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Upload your broker account export. TradePulse Gold automatically recognizes MT4 semicolon-delimited exports, MT5 tab-delimited files, and custom CSV format.
          </p>

          {/* Upload Area */}
          <label
            className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-amber-500"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <Upload size={24} className="mb-2" style={{ color: 'var(--color-text-dim)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>Select or Drop MT4 / MT5 CSV file</span>
            <span className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>Supports .csv, .txt tab or semicolon delimited reports</span>
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-600 dark:text-[#C1502E] flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-emerald-600 dark:text-[#3FA88C] flex items-center gap-1">
                  <CheckCircle2 size={14} /> Ready to Import {parsedPreview.length} Trades
                </span>
              </div>

              <div className="overflow-x-auto max-h-48 border rounded-xl" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
                <table className="w-full text-xs text-left">
                  <thead className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-dim)' }}>
                    <tr>
                      <th className="px-3 py-2">Ticket</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Side</th>
                      <th className="px-3 py-2">Entry</th>
                      <th className="px-3 py-2">Exit</th>
                      <th className="px-3 py-2">Lots</th>
                      <th className="px-3 py-2">P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#262B30] font-mono-num">
                    {parsedPreview.slice(0, 8).map((t, idx) => (
                      <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5">
                        <td className="px-3 py-1.5" style={{ color: 'var(--color-text-dim)' }}>{t.ticket || `#${idx + 1}`}</td>
                        <td className="px-3 py-1.5" style={{ color: 'var(--color-text-muted)' }}>{t.date}</td>
                        <td className="px-3 py-1.5 font-bold" style={{ color: t.side === 'Buy' ? '#059669' : '#E11D48' }}>{t.side}</td>
                        <td className="px-3 py-1.5" style={{ color: 'var(--color-text-main)' }}>${t.entryPrice}</td>
                        <td className="px-3 py-1.5" style={{ color: 'var(--color-text-main)' }}>${t.exitPrice}</td>
                        <td className="px-3 py-1.5 text-amber-600 dark:text-[#C9A227] font-semibold">{t.lotSize}</td>
                        <td className="px-3 py-1.5 font-bold" style={{ color: t.pnl >= 0 ? '#059669' : '#E11D48' }}>
                          ${t.pnl}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={parsedPreview.length === 0}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] disabled:opacity-50 transition-all shadow-sm"
          >
            Import {parsedPreview.length} Trades
          </button>
        </div>
      </div>
    </div>
  );
}
