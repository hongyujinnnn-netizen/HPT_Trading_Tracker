import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Upload, AlertTriangle, Filter, Trash2, Eye, Plus, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from '../components/Pill';
import { ConfirmModal } from '../components/ConfirmModal';
import { exportToCSV } from '../utils/csvParser';
import { STANDARD_STRATEGIES, TRADING_SESSIONS } from '../utils/tradingConstants';

const PAGE_SIZE = 25;

export function TradeHistory() {
  const { trades, filteredTrades: contextFilteredTrades, setSelectedTrade, setIsImportModalOpen, deleteTrade, setActivePage } = useTrade();

  const activeTrades = contextFilteredTrades || trades;

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('All'); // 'All' | 'Wins' | 'Losses' | 'Flagged'
  const [selectedStrategy, setSelectedStrategy] = useState('All');
  const [selectedSession, setSelectedSession] = useState('All');
  const [tradePendingDelete, setTradePendingDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Merge standard strategies with any custom strategies logged in the user's trades
  const strategyOptions = useMemo(() => {
    const custom = activeTrades.map((t) => t.strategy).filter(Boolean);
    return Array.from(new Set([...STANDARD_STRATEGIES, ...custom]));
  }, [activeTrades]);

  const hasActiveFilters =
    filterTab !== 'All' || selectedStrategy !== 'All' || selectedSession !== 'All' || Boolean(search.trim());

  const clearFilters = () => {
    setFilterTab('All');
    setSelectedStrategy('All');
    setSelectedSession('All');
    setSearch('');
    setCurrentPage(1);
  };

  // Filter Logic (depends on activeTrades so account switching refreshes immediately)
  const filteredTrades = useMemo(() => {
    return activeTrades.filter((t) => {
      // Tab filter
      if (filterTab === 'Wins' && t.pnl <= 0) return false;
      if (filterTab === 'Losses' && t.pnl >= 0) return false;
      if (filterTab === 'Flagged' && (!t.mistakes || t.mistakes.length === 0)) return false;

      // Strategy filter
      if (selectedStrategy !== 'All' && t.strategy !== selectedStrategy) return false;

      // Session filter
      if (selectedSession !== 'All' && t.session !== selectedSession) return false;

      // Search query
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchStrategy = (t.strategy || '').toLowerCase().includes(query);
        const matchNotes = (t.notes || '').toLowerCase().includes(query);
        const matchEmotion = (t.emotion || '').toLowerCase().includes(query);
        const matchSide = (t.side || '').toLowerCase().includes(query);
        if (!matchStrategy && !matchNotes && !matchEmotion && !matchSide) return false;
      }

      return true;
    });
  }, [activeTrades, filterTab, selectedStrategy, selectedSession, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, selectedStrategy, selectedSession, search, activeTrades.length]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTrades = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTrades.slice(start, start + PAGE_SIZE);
  }, [filteredTrades, safePage]);

  // Export to CSV (revoke Object URL after download to avoid memory leak)
  const handleExportCSV = () => {
    const csvStr = exportToCSV(filteredTrades);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `XAU_USD_Trading_Journal_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header & Main Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display" style={{ color: 'var(--color-text-main)' }}>Trade Journal &amp; History</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Showing {filteredTrades.length} of {activeTrades.length} logged XAU/USD trades
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:opacity-80"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
              color: 'var(--color-text-main)',
            }}
          >
            <Upload size={14} className="text-amber-500 dark:text-[#C9A227]" /> Import MT5 Report
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredTrades.length === 0}
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:opacity-80 disabled:opacity-50"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
              color: 'var(--color-text-main)',
            }}
          >
            <Download size={14} className="text-emerald-500 dark:text-[#3FA88C]" /> Export CSV
          </button>

          <button
            onClick={() => setActivePage('add')}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus size={14} /> Add Trade
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="terminal-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div
            className="flex gap-1 p-1 rounded-xl border shadow-inner transition-colors w-fit"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            {['All', 'Wins', 'Losses', 'Flagged'].map((tab) => {
              const isActive = filterTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-display transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] shadow-sm'
                      : 'hover:opacity-80'
                  }`}
                  style={!isActive ? { color: 'var(--color-text-muted)' } : undefined}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:w-64 terminal-input">
            <Search size={14} style={{ color: 'var(--color-text-dim)' }} />
            <input
              type="text"
              aria-label="Search trades by strategy, notes, emotion, or side"
              placeholder="Search strategy, notes, emotion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none w-full text-xs"
              style={{ color: 'var(--color-text-main)' }}
            />
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs" style={{ borderColor: 'var(--color-border-soft)' }}>
          <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--color-text-dim)' }}>
            <Filter size={12} /> Filters:
          </span>

          <select
            aria-label="Filter by strategy"
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="rounded-lg px-2.5 py-1 text-xs terminal-select"
          >
            <option value="All">All Strategies</option>
            {strategyOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            aria-label="Filter by session"
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="rounded-lg px-2.5 py-1 text-xs terminal-select"
          >
            <option value="All">All Sessions</option>
            {TRADING_SESSIONS.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition-colors"
              style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-accent)' }}
            >
              <RotateCcw size={12} /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Empty States */}
      {filteredTrades.length === 0 ? (
        <div className="terminal-card p-8 text-center space-y-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
            {activeTrades.length === 0
              ? 'No trades logged in this account yet'
              : 'No trades match your active filters'}
          </p>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            {activeTrades.length === 0
              ? 'Log your first XAU/USD setup or import an MT5 trading statement to start tracking edge and discipline.'
              : 'Try broadening your search query or resetting the strategy and session filters.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {activeTrades.length === 0 ? (
              <>
                <button
                  onClick={() => setActivePage('add')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} /> Log First Trade
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
                >
                  <Upload size={14} /> Import MT5
                </button>
              </>
            ) : (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
              >
                <RotateCcw size={13} /> Clear All Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Card List (below md) */}
          <div className="md:hidden space-y-2.5">
            {paginatedTrades.map((t) => {
              const rrNum = t.rr != null && Number.isFinite(Number(t.rr)) ? Number(t.rr) : null;
              const pnlNum = Number(t.pnl) || 0;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTrade(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrade(t);
                    }
                  }}
                  className="terminal-card p-3.5 space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'}>{t.side}</Pill>
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
                        {t.strategy}
                      </span>
                      <span className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>
                        {t.date}
                      </span>
                    </div>
                    <span
                      className="text-sm font-bold font-mono-num shrink-0"
                      style={{ color: pnlNum >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
                    >
                      {pnlNum >= 0 ? '+' : ''}${pnlNum.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                    <span>
                      ${t.entryPrice} → ${t.exitPrice} · <strong className="text-amber-600 dark:text-[#C9A227]">{t.lotSize}L</strong>
                    </span>
                    <span>
                      {t.session} · {rrNum !== null ? `1:${rrNum.toFixed(1)}` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--color-border-soft)' }}>
                    {t.mistakes && t.mistakes.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 text-rose-700 dark:text-rose-400 truncate max-w-[75%]">
                        <AlertTriangle size={11} className="shrink-0" />
                        <span className="truncate">{t.mistakes[0]}</span>
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>{t.emotion || 'Planned'}</span>
                    )}

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedTrade(t)}
                        className="p-1.5 rounded text-slate-400 dark:text-[#8B8D91] hover:text-amber-500"
                        aria-label={`View trade ${t.id} details`}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => setTradePendingDelete(t)}
                        className="p-1.5 rounded text-rose-500/70 hover:text-rose-600"
                        aria-label={`Delete trade ${t.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Data Table (md and up) */}
          <div className="hidden md:block terminal-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead
                  className="border-b border-slate-200 dark:border-[#262B30] uppercase tracking-wider font-semibold text-[11px]"
                  style={{
                    background: 'var(--color-elevated)',
                    color: 'var(--color-text-dim)',
                  }}
                >
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Exit</th>
                    <th className="px-4 py-3">Lots</th>
                    <th className="px-4 py-3">R:R</th>
                    <th className="px-4 py-3">Strategy</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Discipline &amp; Emotion</th>
                    <th className="px-4 py-3 text-right">P&amp;L ($)</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#262B30] font-body">
                  {paginatedTrades.map((t) => {
                    const rrNum = t.rr != null && Number.isFinite(Number(t.rr)) ? Number(t.rr) : null;
                    const pnlNum = Number(t.pnl) || 0;
                    return (
                      <tr
                        key={t.id}
                        tabIndex={0}
                        onClick={() => setSelectedTrade(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedTrade(t);
                          }
                        }}
                        className="hover:bg-slate-100/60 dark:hover:bg-white/[0.04] focus:bg-slate-100/60 dark:focus:bg-white/[0.04] focus:outline-none transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono-num" style={{ color: 'var(--color-text-muted)' }}>{t.date}</td>
                        <td className="px-4 py-3">
                          <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'}>{t.side}</Pill>
                        </td>
                        <td className="px-4 py-3 font-mono-num font-medium" style={{ color: 'var(--color-text-main)' }}>${t.entryPrice}</td>
                        <td className="px-4 py-3 font-mono-num font-medium" style={{ color: 'var(--color-text-main)' }}>${t.exitPrice}</td>
                        <td className="px-4 py-3 font-mono-num font-semibold text-amber-600 dark:text-[#C9A227]">{t.lotSize}</td>
                        <td
                          className="px-4 py-3 font-mono-num"
                          style={{ color: rrNum === null ? 'var(--color-text-dim)' : rrNum >= 1.0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
                        >
                          {rrNum !== null ? `1 : ${rrNum.toFixed(1)}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-main)' }}>{t.strategy}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{t.session}</td>
                        <td className="px-4 py-3">
                          {t.mistakes && t.mistakes.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 text-rose-700 dark:text-rose-400">
                              <AlertTriangle size={11} /> {t.mistakes[0]}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.emotion}</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 font-mono-num font-bold text-right text-sm"
                          style={{ color: pnlNum >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
                        >
                          {pnlNum >= 0 ? '+' : ''}${pnlNum.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedTrade(t)}
                              className="p-1 rounded text-slate-400 dark:text-[#8B8D91] hover:text-amber-500 transition-colors"
                              title="View Trade Details"
                              aria-label={`View trade ${t.id} details`}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => setTradePendingDelete(t)}
                              className="p-1 rounded text-rose-500/70 hover:text-rose-600 transition-colors"
                              title="Delete Trade"
                              aria-label={`Delete trade ${t.id}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div
              className="terminal-card px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <span style={{ color: 'var(--color-text-muted)' }}>
                Showing <strong className="font-mono-num" style={{ color: 'var(--color-text-main)' }}>{(safePage - 1) * PAGE_SIZE + 1}</strong>–<strong className="font-mono-num" style={{ color: 'var(--color-text-main)' }}>{Math.min(safePage * PAGE_SIZE, filteredTrades.length)}</strong> of <strong className="font-mono-num" style={{ color: 'var(--color-text-main)' }}>{filteredTrades.length}</strong> trades
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 disabled:opacity-40 hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
                >
                  <ChevronLeft size={13} /> Prev
                </button>
                <span className="font-mono-num px-2" style={{ color: 'var(--color-text-muted)' }}>
                  Page <strong style={{ color: 'var(--color-text-main)' }}>{safePage}</strong> / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 disabled:opacity-40 hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={Boolean(tradePendingDelete)}
        onClose={() => setTradePendingDelete(null)}
        onConfirm={() => {
          if (tradePendingDelete) deleteTrade(tradePendingDelete.id);
        }}
        title={tradePendingDelete ? `Delete Trade #${tradePendingDelete.id}?` : 'Delete Trade?'}
        description={
          tradePendingDelete
            ? `This will permanently remove your ${tradePendingDelete.side} ${tradePendingDelete.strategy} trade from ${tradePendingDelete.date} (${(tradePendingDelete.pnl ?? 0) >= 0 ? '+' : ''}$${(tradePendingDelete.pnl ?? 0).toLocaleString()}).`
            : 'This action cannot be undone.'
        }
        confirmText="Delete Trade"
      />
    </div>
  );
}
