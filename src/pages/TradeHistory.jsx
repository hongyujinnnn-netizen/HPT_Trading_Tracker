import React, { useState, useMemo } from 'react';
import { Search, Download, Upload, AlertTriangle, Filter, Trash2, Eye, Plus } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from '../components/Pill';
import { exportToCSV } from '../utils/csvParser';

export function TradeHistory() {
  const { trades, filteredTrades: contextFilteredTrades, setSelectedTrade, setIsImportModalOpen, deleteTrade, setActivePage } = useTrade();

  const activeTrades = contextFilteredTrades || trades;

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('All'); // 'All' | 'Wins' | 'Losses' | 'Flagged'
  const [selectedStrategy, setSelectedStrategy] = useState('All');
  const [selectedSession, setSelectedSession] = useState('All');

  // Filter Logic
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
  }, [trades, filterTab, selectedStrategy, selectedSession, search]);

  // Export to CSV
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
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header & Main Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display" style={{ color: 'var(--color-text-main)' }}>Trade Journal &amp; History</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Showing {filteredTrades.length} of {trades.length} logged XAU/USD trades
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
            className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:opacity-80"
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
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="rounded-lg px-2.5 py-1 text-xs terminal-select"
          >
            <option value="All">All Strategies</option>
            <option value="Breakout">Breakout</option>
            <option value="Pullback">Pullback</option>
            <option value="News Trading">News Trading</option>
            <option value="Order Block / ICT">Order Block / ICT</option>
          </select>

          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="rounded-lg px-2.5 py-1 text-xs terminal-select"
          >
            <option value="All">All Sessions</option>
            <option value="Asian">Asian</option>
            <option value="London">London</option>
            <option value="New York">New York</option>
            <option value="London Close">London Close</option>
          </select>
        </div>
      </div>

      {/* Main Journal Data Table */}
      <div className="terminal-card overflow-hidden">
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
                <th className="px-4 py-3 text-right">P&L ($)</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#262B30] font-body">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400 dark:text-[#8B8D91]">
                    No trades found matching active filters.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors group cursor-pointer"
                    onClick={() => setSelectedTrade(t)}
                  >
                    <td className="px-4 py-3 font-mono-num text-slate-500 dark:text-[#8B8D91]">{t.date}</td>
                    <td className="px-4 py-3">
                      <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'}>{t.side}</Pill>
                    </td>
                    <td className="px-4 py-3 font-mono-num font-medium" style={{ color: 'var(--color-text-main)' }}>${t.entryPrice}</td>
                    <td className="px-4 py-3 font-mono-num font-medium" style={{ color: 'var(--color-text-main)' }}>${t.exitPrice}</td>
                    <td className="px-4 py-3 font-mono-num font-semibold text-amber-600 dark:text-[#C9A227]">{t.lotSize}</td>
                    <td className="px-4 py-3 font-mono-num" style={{ color: t.rr >= 1.0 ? '#059669' : '#E11D48' }}>
                      1 : {t.rr.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-main)' }}>{t.strategy}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-[#8B8D91]">{t.session}</td>
                    <td className="px-4 py-3">
                      {t.mistakes && t.mistakes.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 text-rose-700 dark:text-rose-400">
                          <AlertTriangle size={11} /> {t.mistakes[0]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-[#8B8D91]">{t.emotion}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono-num font-bold text-right text-sm" style={{ color: t.pnl >= 0 ? '#059669' : '#E11D48' }}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedTrade(t)}
                          className="p-1 rounded text-slate-400 dark:text-[#8B8D91] hover:text-amber-500 transition-colors"
                          title="View Trade Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => deleteTrade(t.id)}
                          className="p-1 rounded text-rose-500/70 hover:text-rose-600 transition-colors"
                          title="Delete Trade"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
