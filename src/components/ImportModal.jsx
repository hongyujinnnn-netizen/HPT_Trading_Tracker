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
      <div className="bg-[#131619] border border-[#262B30] rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-[#1E2226] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-[#C9A227]" />
            <h3 className="text-lg font-bold font-display text-[#EDEAE3]">Import Trades from CSV (MT4 / MT5)</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#8B8D91] hover:text-[#EDEAE3] rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <p className="text-xs text-[#8B8D91] leading-relaxed">
            Upload your broker account export. TradePulse Gold automatically recognizes MT4 semicolon-delimited exports, MT5 tab-delimited files, and custom CSV format.
          </p>

          {/* Upload Area */}
          <label className="border-2 border-dashed border-[#262B30] hover:border-[#C9A227] bg-[#1B1F23] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors">
            <Upload size={24} className="text-[#8B8D91] mb-2" />
            <span className="text-sm font-semibold text-[#EDEAE3]">Select or Drop MT4 / MT5 CSV file</span>
            <span className="text-xs text-[#5A5D61] mt-1">Supports .csv, .txt tab or semicolon delimited reports</span>
            <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
          </label>

          {error && (
            <div className="p-3 bg-[#4A2A1E]/40 border border-[#5C3426] rounded-lg text-xs text-[#C1502E] flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[#3FA88C] flex items-center gap-1">
                  <CheckCircle2 size={14} /> Ready to Import {parsedPreview.length} Trades
                </span>
              </div>

              <div className="overflow-x-auto max-h-48 border border-[#1E2226] rounded-lg bg-[#0A0C0E]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#1B1F23] border-b border-[#1E2226] text-[#8B8D91]">
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
                  <tbody className="divide-y divide-[#1E2226] font-mono-num">
                    {parsedPreview.slice(0, 8).map((t, idx) => (
                      <tr key={idx} className="hover:bg-[#131619]">
                        <td className="px-3 py-1.5 text-[#5A5D61]">{t.ticket || `#${idx + 1}`}</td>
                        <td className="px-3 py-1.5 text-[#8B8D91]">{t.date}</td>
                        <td className="px-3 py-1.5 font-bold" style={{ color: t.side === 'Buy' ? '#3FA88C' : '#C1502E' }}>{t.side}</td>
                        <td className="px-3 py-1.5 text-[#EDEAE3]">${t.entryPrice}</td>
                        <td className="px-3 py-1.5 text-[#EDEAE3]">${t.exitPrice}</td>
                        <td className="px-3 py-1.5 text-[#C9A227]">{t.lotSize}</td>
                        <td className="px-3 py-1.5 font-bold" style={{ color: t.pnl >= 0 ? '#3FA88C' : '#C1502E' }}>
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
        <div className="p-4 border-t border-[#1E2226] flex justify-end gap-3 bg-[#131619]">
          <button onClick={onClose} className="px-4 py-2 rounded text-xs font-semibold text-[#8B8D91] hover:text-[#EDEAE3]">
            Cancel
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={parsedPreview.length === 0}
            className="px-5 py-2 rounded text-xs font-bold bg-[#C9A227] text-[#0A0C0E] disabled:opacity-50 hover:bg-[#E4C468] transition-colors"
          >
            Import {parsedPreview.length} Trades
          </button>
        </div>
      </div>
    </div>
  );
}
