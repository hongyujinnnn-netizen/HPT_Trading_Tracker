import React, { useState, useMemo } from 'react';
import { Search, Download, Upload, AlertTriangle, Filter, Trash2, Eye, Plus } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from '../components/Pill';
import { exportToCSV } from '../utils/csvParser';

export function TradeHistory() {
  const { trades, setSelectedTrade, setIsImportModalOpen, deleteTrade, setActivePage } = useTrade();

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState('All'); // 'All' | 'Wins' | 'Losses' | 'Flagged'
  const [selectedStrategy, setSelectedStrategy] = useState('All');
  const [selectedSession, setSelectedSession] = useState('All');

  // Filter Logic
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
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
          <h1 className="text-xl font-bold font-display text-[#EDEAE3]">Trade Journal &amp; History</h1>
          <p className="text-xs text-[#8B8D91]">
            Showing {filteredTrades.length} of {trades.length} logged XAU/USD trades
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] border border-[#262B30] text-xs font-semibold text-[#EDEAE3] flex items-center gap-1.5 transition-colors"
          >
            <Upload size={14} className="text-[#C9A227]" /> Import CSV (MT4/MT5)
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] border border-[#262B30] text-xs font-semibold text-[#EDEAE3] flex items-center gap-1.5 transition-colors"
          >
            <Download size={14} className="text-[#3FA88C]" /> Export CSV
          </button>

          <button
            onClick={() => setActivePage('add')}
            className="px-3.5 py-1.5 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus size={14} /> Add Trade
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="terminal-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div className="flex gap-1.5 bg-[#1B1F23] p-1 rounded-lg border border-[#1E2226]">
            {['All', 'Wins', 'Losses', 'Flagged'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-3 py-1 rounded text-xs font-semibold font-body transition-colors ${filterTab === tab ? 'bg-[#C9A227] text-[#0A0C0E]' : 'text-[#8B8D91] hover:text-[#EDEAE3]'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-[#1B1F23] px-3 py-1.5 rounded-lg border border-[#1E2226] text-xs text-[#EDEAE3] sm:w-64">
            <Search size={14} className="text-[#5A5D61]" />
            <input
              type="text"
              placeholder="Search strategy, notes, emotion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none w-full text-xs placeholder-[#5A5D61]"
            />
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1E2226] text-xs">
          <span className="text-[#5A5D61] flex items-center gap-1 font-semibold">
            <Filter size={12} /> Filters:
          </span>

          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="bg-[#1B1F23] border border-[#262B30] rounded px-2.5 py-1 text-[#EDEAE3] outline-none"
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
            className="bg-[#1B1F23] border border-[#262B30] rounded px-2.5 py-1 text-[#EDEAE3] outline-none"
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
            <thead className="bg-[#1B1F23] border-b border-[#1E2226] text-[#8B8D91] uppercase tracking-wider font-semibold">
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
            <tbody className="divide-y divide-[#1E2226] font-body">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-[#5A5D61]">
                    No trades found matching active filters.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-[#1B1F23]/60 transition-colors group cursor-pointer"
                    onClick={() => setSelectedTrade(t)}
                  >
                    <td className="px-4 py-3 font-mono-num text-[#8B8D91]">{t.date}</td>
                    <td className="px-4 py-3">
                      <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'}>{t.side}</Pill>
                    </td>
                    <td className="px-4 py-3 font-mono-num text-[#EDEAE3]">${t.entryPrice}</td>
                    <td className="px-4 py-3 font-mono-num text-[#EDEAE3]">${t.exitPrice}</td>
                    <td className="px-4 py-3 font-mono-num text-[#C9A227]">{t.lotSize}</td>
                    <td className="px-4 py-3 font-mono-num" style={{ color: t.rr >= 1.0 ? '#3FA88C' : '#C1502E' }}>
                      1 : {t.rr.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-[#EDEAE3] font-medium">{t.strategy}</td>
                    <td className="px-4 py-3 text-[#8B8D91]">{t.session}</td>
                    <td className="px-4 py-3">
                      {t.mistakes && t.mistakes.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#C1502E] font-semibold bg-[#4A2A1E]/30 px-2 py-0.5 rounded border border-[#5C3426]">
                          <AlertTriangle size={11} /> {t.mistakes[0]}
                        </span>
                      ) : (
                        <span className="text-xs text-[#5A5D61]">{t.emotion}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono-num font-bold text-right text-sm" style={{ color: t.pnl >= 0 ? '#3FA88C' : '#C1502E' }}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedTrade(t)}
                          className="p-1 rounded text-[#8B8D91] hover:text-[#C9A227]"
                          title="View Trade Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => deleteTrade(t.id)}
                          className="p-1 rounded text-[#5A5D61] hover:text-[#C1502E]"
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
