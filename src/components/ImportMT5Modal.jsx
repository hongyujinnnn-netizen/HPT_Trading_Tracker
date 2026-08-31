import React, { useState, useMemo } from 'react';
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  Plus,
  Layers,
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { parseMt5HtmlDeals, parseMt5CsvDeals, detectEncoding } from '../services/mt5Import/mt5CsvParser';
import { classifyMt5Rows, groupDealsByPosition, reducePositionToTrade } from '../services/mt5Import/mt5RowClassifier';
import { mapPositionToTrade } from '../services/mt5Import/mt5TradeMapper';
import { diffMt5Import } from '../services/mt5Import/importDedup';
import { tradeRepository } from '../services/tradeRepository';

export function ImportMT5Modal({ isOpen, onClose }) {
  const {
    tradingAccounts,
    activeAccountId,
    setActiveAccountId,
    trades,
    refreshData,
  } = useTrade();

  const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);

  // Form State
  const [selectedAccountId, setSelectedAccountId] = useState(
    activeAccountId !== 'all' ? activeAccountId : (visibleAccounts[0]?.id || '')
  );

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const targetAccount = visibleAccounts.find((a) => a.id === selectedAccountId) || visibleAccounts[0];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError('');
    setSuccessMsg('');
    setParsedResult(null);

    // Auto parse on selection
    parseFileContent(selectedFile);
  };

  const parseFileContent = async (fileToParse) => {
    setParsing(true);
    setParseError('');

    try {
      const buffer = await fileToParse.arrayBuffer();
      const encoding = detectEncoding(buffer);
      const textDecoder = new TextDecoder(encoding);
      const content = textDecoder.decode(buffer);

      let rawRows = [];
      const fileName = fileToParse.name.toLowerCase();

      if (fileName.endsWith('.html') || fileName.endsWith('.htm') || content.includes('<html')) {
        rawRows = parseMt5HtmlDeals(content);
      } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
        rawRows = parseMt5CsvDeals(content);
      } else {
        throw new Error('Unsupported file format. Please upload an MT5 HTML or CSV report.');
      }

      if (rawRows.length === 0) {
        throw new Error('No deal records found in the uploaded file.');
      }

      // Step 1: Classify Rows (Deals vs Balance Ops)
      const { balanceOps, dealRows } = classifyMt5Rows(rawRows);

      // Step 2: Group Deals by Position ID
      const positionGroups = groupDealsByPosition(dealRows);

      // Step 3: Reduce Position Groups to Trades (Handling partial closes & skipping open positions)
      let openPositionsCount = 0;
      const mappedTrades = [];

      positionGroups.forEach((group, posId) => {
        const reduced = reducePositionToTrade(posId, group);
        if (reduced) {
          const canonical = mapPositionToTrade(reduced, targetAccount);
          mappedTrades.push(canonical);
        } else {
          openPositionsCount++;
        }
      });

      // Step 4: Diff against existing trades for deduplication
      const diffResult = diffMt5Import(mappedTrades, balanceOps, openPositionsCount, trades, targetAccount?.id);

      setParsedResult({
        ...diffResult,
        totalRawDeals: dealRows.length,
      });
    } catch (err) {
      console.error('Failed to parse MT5 report:', err);
      setParseError(err.message || 'Error parsing MT5 report file.');
    } finally {
      setParsing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!parsedResult || !parsedResult.newTrades) return;
    setImporting(true);

    try {
      await tradeRepository.bulkImportTrades(
        parsedResult.newTrades,
        parsedResult.balanceOps,
        selectedAccountId
      );

      await refreshData();
      setSuccessMsg(`Imported ${parsedResult.newTrades.length} new trades successfully!`);
      setTimeout(() => {
        onClose();
        setSuccessMsg('');
        setParsedResult(null);
        setFile(null);
      }, 1500);
    } catch (err) {
      console.error('Commit import error:', err);
      setParseError('Failed to save imported trades.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl terminal-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <div className="flex items-center gap-2">
            <FileText className="text-amber-500 dark:text-[#C9A227]" size={20} />
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                Import MetaTrader 5 Report (HTML / CSV)
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Position pairing, partial-close aggregation, and deposit classification engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border hover:opacity-80 transition-all"
            style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
          {/* Target Sub-Account Selector */}
          <div>
            <label className="text-[11px] font-semibold text-amber-600 dark:text-[#C9A227] uppercase tracking-wider block mb-1.5">
              Select Target Trading Sub-Account *
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                if (file) parseFileContent(file);
              }}
              className="w-full p-2.5 rounded-lg text-xs font-semibold terminal-select"
            >
              {visibleAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.broker} • {acc.leverage} • ${acc.initialBalance.toLocaleString()} {acc.currency} • {acc.currencyMode === 'cent' ? 'Cent Account' : 'Standard'})
                </option>
              ))}
            </select>
          </div>

          {/* File Drag and Drop Zone */}
          <div
            className="p-6 border-2 border-dashed hover:border-amber-500/50 rounded-xl text-center transition-all"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <input
              type="file"
              accept=".html,.htm,.csv,.txt"
              onChange={handleFileChange}
              id="mt5-file-input"
              className="hidden"
            />
            <label htmlFor="mt5-file-input" className="cursor-pointer block space-y-2">
              <Upload className="mx-auto text-amber-500 dark:text-[#C9A227] animate-bounce" size={28} />
              <div className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                {file ? file.name : 'Click or Drag MT5 Report File (.html, .htm, .csv)'}
              </div>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                Exported from MT5 Terminal → History Tab → Save as Report
              </p>
            </label>
          </div>

          {parsing && (
            <div className="p-4 rounded-xl border flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-[#C9A227]" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <RefreshCw size={16} className="animate-spin" />
              <span>Parsing MT5 deals, pairing positions &amp; checking deduplication...</span>
            </div>
          )}

          {parseError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{parseError}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Diff Summary Cards */}
          {parsedResult && !parsing && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-dim)' }}>New Trades</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{parsedResult.newTrades.length}</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-dim)' }}>Duplicates</div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{parsedResult.duplicateTrades.length}</div>
                </div>

                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-center">
                  <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-dim)' }}>Balance Ops</div>
                  <div className="text-lg font-bold text-sky-600 dark:text-sky-400">{parsedResult.balanceOps.length}</div>
                </div>

                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
                  <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-dim)' }}>Open Positions</div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{parsedResult.openPositionCount}</div>
                </div>
              </div>

              {/* Preview Table of Mapped Trades */}
              <div className="border rounded-xl overflow-hidden" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
                <div className="p-3 border-b flex items-center justify-between text-xs font-semibold" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}>
                  <span>Import Preview ({parsedResult.newTrades.length} new trades to commit)</span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-dim)' }}>Position Anchors Checked</span>
                </div>
                <div className="max-h-48 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 text-[10px] uppercase font-semibold" style={{ background: 'var(--color-surface)', color: 'var(--color-text-dim)' }}>
                      <tr>
                        <th className="p-2">Pos ID</th>
                        <th className="p-2">Side</th>
                        <th className="p-2">Symbol</th>
                        <th className="p-2">Volume</th>
                        <th className="p-2">Entry Price</th>
                        <th className="p-2">Exit Price</th>
                        <th className="p-2 text-right">Net PnL ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#262B30] font-mono">
                      {parsedResult.newTrades.slice(0, 50).map((t, idx) => (
                        <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5">
                          <td className="p-2 text-amber-600 dark:text-[#C9A227]">#{t.brokerPositionId}</td>
                          <td className={`p-2 font-bold ${t.side === 'Buy' ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#EF4444]'}`}>
                            {t.side}
                          </td>
                          <td className="p-2 font-semibold" style={{ color: 'var(--color-text-main)' }}>{t.symbol}</td>
                          <td className="p-2" style={{ color: 'var(--color-text-dim)' }}>{t.lotSize}</td>
                          <td className="p-2" style={{ color: 'var(--color-text-main)' }}>{t.entryPrice}</td>
                          <td className="p-2" style={{ color: 'var(--color-text-main)' }}>{t.exitPrice}</td>
                          <td className={`p-2 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-600 dark:text-[#10B981]' : 'text-rose-600 dark:text-[#EF4444]'}`}>
                            {t.pnl >= 0 ? `+$${t.pnl}` : `-$${Math.abs(t.pnl)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t flex items-center justify-end gap-2" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-xs font-semibold hover:opacity-80 transition-all"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCommitImport}
            disabled={!parsedResult || parsedResult.newTrades.length === 0 || importing}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-[#080A0D] font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
          >
            <Check size={14} />
            <span>{importing ? 'Committing Import...' : `Confirm & Import (${parsedResult?.newTrades?.length || 0} Trades)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
