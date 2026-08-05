import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Upload,
  Layers,
  Activity,
  Award,
  AlertCircle,
  Database,
  RefreshCw,
  BookmarkPlus,
  Loader2,
  Wifi,
  Sliders,
  BarChart2,
  Info,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { runBacktest, compareStrategyHypotheses } from '../lib/crt/crtBacktest';
import { useTrade } from '../context/TradeContext';
import { supabaseStore } from '../services/supabaseStore';
import { isSupabaseConfigured } from '../services/supabaseClient';

export function CrtBacktest() {
  const { userSession } = useTrade();

  // Config state with configurable confluence parameters
  const [config, setConfig] = useState({
    referenceTimeframe: '4h',
    minBodyRatio: 0.3,
    bufferPercent: 0.1,
    useLiquidityGrading: false,
    minLiquidityScore: 2,
    equalLevelTolerancePct: 0.05,
    useHtfBiasFilter: false,
    useDisplacementFilter: false,
    displacementAtrMultiplier: 1.2,
    useOteZoneFilter: false,
    useSessionFilter: false,
  });

  const [splitRatio, setSplitRatio] = useState(0.7); // 70% In-Sample, 30% Out-of-Sample
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'setups' | 'session' | 'day' | 'saved'
  const [dataSource, setDataSource] = useState('backend'); // 'backend' | 'csv'
  const [candles, setCandles] = useState([]);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [backendMessage, setBackendMessage] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [savedSetups, setSavedSetups] = useState([]);
  const [savingId, setSavingId] = useState(null);

  // Fetch real candles from Supabase backend
  const fetchBackendCandles = useCallback(async (timeframe) => {
    setLoadingBackend(true);
    setBackendMessage('');

    if (!isSupabaseConfigured) {
      setBackendMessage('Supabase backend not connected. Please connect Supabase or upload an OHLC CSV file.');
      setCandles([]);
      setLoadingBackend(false);
      return;
    }

    try {
      const dbCandles = await supabaseStore.fetchHistoricalCandles('XAUUSD', timeframe, 1000);
      if (dbCandles && dbCandles.length >= 2) {
        setCandles(dbCandles);
        setBackendMessage(`Loaded ${dbCandles.length} real OHLC candles from backend price_snapshots table.`);
      } else {
        setBackendMessage(
          'No price snapshots recorded in backend database yet. Connect live price feed or upload a real OHLC CSV file.'
        );
        setCandles([]);
      }
    } catch (err) {
      console.error('Failed to load backend candles:', err);
      setBackendMessage('Error querying backend database.');
      setCandles([]);
    } finally {
      setLoadingBackend(false);
    }
  }, []);

  // Fetch user's saved CRT setups from backend
  const loadSavedSetups = useCallback(async () => {
    if (userSession?.user?.id) {
      const data = await supabaseStore.fetchCrtSetups(userSession.user.id);
      setSavedSetups(data || []);
    }
  }, [userSession]);

  // Initial load
  useEffect(() => {
    if (dataSource === 'backend') {
      fetchBackendCandles(config.referenceTimeframe);
    }
    loadSavedSetups();
  }, [dataSource, config.referenceTimeframe, fetchBackendCandles, loadSavedSetups]);

  // Execute Single Config Backtest
  const backtestResult = useMemo(() => {
    return runBacktest(candles, config);
  }, [candles, config]);

  // Execute Comparative Hypothesis Matrix (Walk-Forward Split)
  const hypothesisMatrix = useMemo(() => {
    return compareStrategyHypotheses(candles, config, splitRatio);
  }, [candles, config, splitRatio]);

  // Handle CSV file upload for custom backtests
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) return;

        const parsedCandles = [];
        const header = lines[0].toLowerCase().split(',');
        const timeIdx = header.findIndex((h) => h.includes('time') || h.includes('date'));
        const openIdx = header.findIndex((h) => h.includes('open'));
        const highIdx = header.findIndex((h) => h.includes('high'));
        const lowIdx = header.findIndex((h) => h.includes('low'));
        const closeIdx = header.findIndex((h) => h.includes('close'));

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length >= 4) {
            const time = timeIdx >= 0 ? cols[timeIdx] : `row_${i}`;
            const open = parseFloat(cols[openIdx >= 0 ? openIdx : 0]);
            const high = parseFloat(cols[highIdx >= 0 ? highIdx : 1]);
            const low = parseFloat(cols[lowIdx >= 0 ? lowIdx : 2]);
            const close = parseFloat(cols[closeIdx >= 0 ? closeIdx : 3]);

            if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
              parsedCandles.push({ time, open, high, low, close });
            }
          }
        }

        if (parsedCandles.length >= 2) {
          setCandles(parsedCandles);
          setDataSource('csv');
        }
      } catch (err) {
        console.error('Failed to parse CSV:', err);
      }
    };
    reader.readAsText(file);
  };

  // Save detected setup to Supabase backend database
  const handleSaveSetup = async (tradeResult) => {
    if (!userSession?.user?.id) {
      alert('Please sign in to save CRT setups to your cloud database.');
      return;
    }

    setSavingId(tradeResult.setup.timestamp);
    const saved = await supabaseStore.saveCrtSetup(userSession.user.id, {
      ...tradeResult.setup,
      timeframe: config.referenceTimeframe,
      outcome: tradeResult.outcome,
    });

    if (saved) {
      await loadSavedSetups();
    }
    setSavingId(null);
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#262B30] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold font-display text-[#EDEAE3] tracking-tight">
              CRT &amp; ICT Strategy Hypothesis Sandbox
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 font-bold uppercase">
              Walk-Forward Matrix v2
            </span>
          </div>
          <p className="text-xs text-[#8B8D91] mt-1">
            Empirically test CRT liquidity sweeps with FVG, MSS, HTF trend alignment, and ATR displacement against real backend data.
          </p>
        </div>

        {/* Data Source Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Source Tabs */}
          <div className="flex items-center bg-[#131619] p-1 rounded-lg border border-[#262B30]">
            <button
              onClick={() => {
                setDataSource('backend');
                fetchBackendCandles(config.referenceTimeframe);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                dataSource === 'backend'
                  ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 shadow-sm'
                  : 'text-[#8B8D91] hover:text-[#EDEAE3]'
              }`}
            >
              <Database size={13} />
              <span>Backend DB (Real Data)</span>
            </button>

            <label
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                dataSource === 'csv'
                  ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 shadow-sm'
                  : 'text-[#8B8D91] hover:text-[#EDEAE3]'
              }`}
            >
              <Upload size={13} />
              <span>{dataSource === 'csv' ? csvFileName || 'CSV Loaded' : 'Upload OHLC CSV'}</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Refresh Button for Backend */}
          {dataSource === 'backend' && (
            <button
              onClick={() => fetchBackendCandles(config.referenceTimeframe)}
              disabled={loadingBackend}
              className="p-2 rounded-lg bg-[#131619] border border-[#262B30] text-[#8B8D91] hover:text-[#EDEAE3] transition-colors disabled:opacity-50"
              title="Refresh Real Backend Data"
            >
              <RefreshCw size={14} className={loadingBackend ? 'animate-spin text-[#C9A227]' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Backend Status Notice */}
      {backendMessage && (
        <div className="px-4 py-2.5 rounded-xl bg-[#131619] border border-[#262B30] flex items-center justify-between text-xs text-[#8B8D91] animate-fade-in">
          <div className="flex items-center gap-2 text-[#EDEAE3]">
            <Wifi size={15} className="text-[#3FA88C]" />
            <span>{backendMessage}</span>
          </div>
        </div>
      )}

      {/* Control Panel: Parameters & ICT Confluence Toggles */}
      <div className="p-4 md:p-5 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col gap-5 shadow-lg">
        {/* Basic Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-[#262B30]">
          {/* Reference Timeframe */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold font-mono-num text-[#8B8D91] uppercase tracking-wider">
              Timeframe
            </label>
            <select
              value={config.referenceTimeframe}
              onChange={(e) => {
                const tf = e.target.value;
                setConfig((prev) => ({ ...prev, referenceTimeframe: tf }));
                if (dataSource === 'backend') {
                  fetchBackendCandles(tf);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#131619] border border-[#262B30] text-xs text-[#EDEAE3] focus:border-[#C9A227] outline-none"
            >
              <option value="1h">1-Hour (1H)</option>
              <option value="4h">4-Hour (4H) (Recommended)</option>
              <option value="1d">Daily (1D)</option>
            </select>
          </div>

          {/* Min Body Ratio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold font-mono-num text-[#8B8D91] uppercase tracking-wider flex items-center justify-between">
              <span>Min Body Ratio</span>
              <span className="text-[#C9A227]">{config.minBodyRatio}</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={config.minBodyRatio}
              onChange={(e) => setConfig((prev) => ({ ...prev, minBodyRatio: parseFloat(e.target.value) }))}
              className="w-full accent-[#C9A227]"
            />
          </div>

          {/* Displacement ATR Multiplier */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold font-mono-num text-[#8B8D91] uppercase tracking-wider flex items-center justify-between">
              <span>Displacement ATR x</span>
              <span className="text-[#C9A227]">{config.displacementAtrMultiplier}x</span>
            </label>
            <input
              type="range"
              min="0.8"
              max="2.5"
              step="0.1"
              value={config.displacementAtrMultiplier}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, displacementAtrMultiplier: parseFloat(e.target.value) }))
              }
              className="w-full accent-[#C9A227]"
            />
          </div>

          {/* Walk-Forward Split Ratio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold font-mono-num text-[#8B8D91] uppercase tracking-wider flex items-center justify-between">
              <span>Walk-Forward Split</span>
              <span className="text-[#C9A227]">{(splitRatio * 100).toFixed(0)}% / {((1 - splitRatio) * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="0.85"
              step="0.05"
              value={splitRatio}
              onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
              className="w-full accent-[#C9A227]"
            />
          </div>
        </div>

        {/* ICT SMC Confluence Hypothesis Toggles */}
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-bold font-display uppercase tracking-wider text-[#EDEAE3] flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-[#C9A227]" />
            <span>Testable Confluence Filter Toggles</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Filter 1: Equal Levels */}
            <label className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] flex items-center gap-2.5 cursor-pointer hover:border-[#C9A227]/40 transition-colors">
              <input
                type="checkbox"
                checked={config.useLiquidityGrading}
                onChange={(e) => setConfig((prev) => ({ ...prev, useLiquidityGrading: e.target.checked }))}
                className="accent-[#C9A227]"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#EDEAE3]">Equal Levels (2+)</span>
                <span className="text-[10px] text-[#8B8D91]">Liquidity Pool Pool Score &ge; 2</span>
              </div>
            </label>

            {/* Filter 2: Proxy HTF Bias */}
            <label className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] flex items-center gap-2.5 cursor-pointer hover:border-[#C9A227]/40 transition-colors">
              <input
                type="checkbox"
                checked={config.useHtfBiasFilter}
                onChange={(e) => setConfig((prev) => ({ ...prev, useHtfBiasFilter: e.target.checked }))}
                className="accent-[#C9A227]"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#EDEAE3]">HTF Trend Bias</span>
                <span className="text-[10px] text-[#8B8D91]">Proxy HTF trend alignment</span>
              </div>
            </label>

            {/* Filter 3: Displacement */}
            <label className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] flex items-center gap-2.5 cursor-pointer hover:border-[#C9A227]/40 transition-colors">
              <input
                type="checkbox"
                checked={config.useDisplacementFilter}
                onChange={(e) => setConfig((prev) => ({ ...prev, useDisplacementFilter: e.target.checked }))}
                className="accent-[#C9A227]"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#EDEAE3]">Displacement Strength</span>
                <span className="text-[10px] text-[#8B8D91]">Body &ge; {config.displacementAtrMultiplier}x ATR</span>
              </div>
            </label>

            {/* Filter 4: OTE Zone */}
            <label className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] flex items-center gap-2.5 cursor-pointer hover:border-[#C9A227]/40 transition-colors">
              <input
                type="checkbox"
                checked={config.useOteZoneFilter}
                onChange={(e) => setConfig((prev) => ({ ...prev, useOteZoneFilter: e.target.checked }))}
                className="accent-[#C9A227]"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#EDEAE3]">OTE Zone (Prem/Disc)</span>
                <span className="text-[10px] text-[#8B8D91]">Buy Discount / Sell Premium</span>
              </div>
            </label>

            {/* Filter 5: Session Window */}
            <label className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] flex items-center gap-2.5 cursor-pointer hover:border-[#C9A227]/40 transition-colors">
              <input
                type="checkbox"
                checked={config.useSessionFilter}
                onChange={(e) => setConfig((prev) => ({ ...prev, useSessionFilter: e.target.checked }))}
                className="accent-[#C9A227]"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#EDEAE3]">London/NY Window</span>
                <span className="text-[10px] text-[#8B8D91]">High volume 08-21 UTC</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Setups */}
        <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#8B8D91]">
            <span>Active Filter Setups</span>
            <Layers size={16} className="text-[#C9A227]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono-num text-[#EDEAE3]">
              {backtestResult.totalSetups}
            </span>
            {backtestResult.isLowSample && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 font-bold">
                n &lt; 30 (Low Sample)
              </span>
            )}
          </div>
        </div>

        {/* Win Rate with 95% Wilson CI */}
        <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#8B8D91]">
            <span>Win Rate (95% CI)</span>
            <Award size={16} className="text-[#3FA88C]" />
          </div>
          <div className="mt-3 flex flex-col">
            <span
              className={`text-2xl font-bold font-mono-num ${
                backtestResult.isLowSample
                  ? 'text-[#8B8D91]'
                  : backtestResult.winRatePct >= 50
                  ? 'text-[#3FA88C]'
                  : 'text-[#E46868]'
              }`}
            >
              {backtestResult.winRatePct}%
            </span>
            <span className="text-[10px] font-mono-num text-[#5A5D61]">
              CI: [{backtestResult.ciLowPct}% - {backtestResult.ciHighPct}%]
            </span>
          </div>
        </div>

        {/* Expectancy */}
        <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#8B8D91]">
            <span>Expectancy</span>
            <TrendingUp size={16} className="text-[#C9A227]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono-num ${
                backtestResult.expectancy >= 0 ? 'text-[#3FA88C]' : 'text-[#E46868]'
              }`}
            >
              {backtestResult.expectancy > 0 ? `+${backtestResult.expectancy}` : backtestResult.expectancy} R
            </span>
            <span className="text-xs font-mono-num text-[#8B8D91]">per trade</span>
          </div>
        </div>

        {/* Total R Return */}
        <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#8B8D91]">
            <span>Total R Return</span>
            <Activity size={16} className="text-[#C9A227]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono-num ${
                backtestResult.totalRMultiple >= 0 ? 'text-[#3FA88C]' : 'text-[#E46868]'
              }`}
            >
              {backtestResult.totalRMultiple > 0
                ? `+${backtestResult.totalRMultiple}`
                : backtestResult.totalRMultiple}{' '}
              R
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Header & View Content */}
      <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col gap-4">
        {/* Tab Headers */}
        <div className="flex items-center justify-between border-b border-[#262B30] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40'
                  : 'text-[#8B8D91] hover:text-[#EDEAE3]'
              }`}
            >
              <BarChart2 size={13} />
              <span>Hypothesis Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab('setups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'setups'
                  ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40'
                  : 'text-[#8B8D91] hover:text-[#EDEAE3]'
              }`}
            >
              Active Setups ({backtestResult.trades.length})
            </button>
            <button
              onClick={() => setActiveTab('session')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'session'
                  ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40'
                  : 'text-[#8B8D91] hover:text-[#EDEAE3]'
              }`}
            >
              Session Breakdown
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40'
                  : 'text-[#8B8D91] hover:text-[#EDEAE3]'
              }`}
            >
              <BookmarkPlus size={13} />
              <span>Saved Setups ({savedSetups.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 0: Strategy Hypothesis Matrix (Walk-Forward Validation) */}
        {activeTab === 'matrix' && (
          <div className="overflow-x-auto">
            <div className="pb-3 text-xs text-[#8B8D91] flex items-center justify-between">
              <span>Comparing Strategy Hypotheses against Real Data:</span>
              <span className="font-mono-num text-[#C9A227]">
                Walk-Forward Split: {(splitRatio * 100).toFixed(0)}% Train / {((1 - splitRatio) * 100).toFixed(0)}% Test
              </span>
            </div>
            <table className="w-full text-left text-xs font-mono-num">
              <thead>
                <tr className="border-b border-[#262B30] text-[#5A5D61] uppercase text-[10px]">
                  <th className="pb-2.5">Strategy Hypothesis</th>
                  <th className="pb-2.5 text-center">In-Sample (Train) WR%</th>
                  <th className="pb-2.5 text-center">Out-of-Sample (Test) WR%</th>
                  <th className="pb-2.5 text-center">95% Wilson CI</th>
                  <th className="pb-2.5 text-right">Expectancy</th>
                  <th className="pb-2.5 text-right">Total R</th>
                  <th className="pb-2.5 text-right">Sample Guardrail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262B30]/50">
                {hypothesisMatrix.map((item, idx) => {
                  const isLowSample = item.outOfSample.isLowSample;

                  return (
                    <tr key={idx} className="hover:bg-[#131619]/50 transition-colors">
                      <td className="py-3 font-semibold text-[#EDEAE3]">
                        {item.name}
                      </td>
                      <td className="py-3 text-center text-[#C9A227]">
                        {item.inSample.winRatePct}% ({item.inSample.wins}W / {item.inSample.losses}L)
                      </td>
                      <td
                        className={`py-3 text-center font-bold ${
                          isLowSample
                            ? 'text-[#8B8D91]'
                            : item.outOfSample.winRatePct >= 50
                            ? 'text-[#3FA88C]'
                            : 'text-[#E46868]'
                        }`}
                      >
                        {item.outOfSample.winRatePct}% ({item.outOfSample.wins}W / {item.outOfSample.losses}L)
                      </td>
                      <td className="py-3 text-center text-[#8B8D91]">
                        [{item.outOfSample.ciLowPct}% - {item.outOfSample.ciHighPct}%]
                      </td>
                      <td
                        className={`py-3 text-right font-bold ${
                          item.outOfSample.expectancy >= 0 ? 'text-[#3FA88C]' : 'text-[#E46868]'
                        }`}
                      >
                        {item.outOfSample.expectancy > 0
                          ? `+${item.outOfSample.expectancy}`
                          : item.outOfSample.expectancy}{' '}
                        R
                      </td>
                      <td
                        className={`py-3 text-right font-bold ${
                          item.outOfSample.totalRMultiple >= 0 ? 'text-[#3FA88C]' : 'text-[#E46868]'
                        }`}
                      >
                        {item.outOfSample.totalRMultiple > 0
                          ? `+${item.outOfSample.totalRMultiple}`
                          : item.outOfSample.totalRMultiple}{' '}
                        R
                      </td>
                      <td className="py-3 text-right">
                        {isLowSample ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40">
                            Low Sample (n &lt; 30)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1F4A40] text-[#3FA88C] border border-[#3FA88C]/40">
                            Statistically Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 1: Setups List Table */}
        {activeTab === 'setups' && (
          <div className="overflow-x-auto">
            {backtestResult.trades.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8B8D91]">
                {candles.length === 0
                  ? 'No real OHLC candles loaded from backend. Ensure live price feed is active or upload a real OHLC CSV.'
                  : 'No CRT setups detected matching current confluence filter parameters.'}
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono-num">
                <thead>
                  <tr className="border-b border-[#262B30] text-[#5A5D61] uppercase text-[10px]">
                    <th className="pb-2.5">Date / Time</th>
                    <th className="pb-2.5">Direction</th>
                    <th className="pb-2.5">Entry Zone</th>
                    <th className="pb-2.5">Entry Price</th>
                    <th className="pb-2.5">Stop Loss</th>
                    <th className="pb-2.5">Target</th>
                    <th className="pb-2.5">Displacement</th>
                    <th className="pb-2.5">Zone</th>
                    <th className="pb-2.5">Outcome</th>
                    <th className="pb-2.5 text-right">R Multiple</th>
                    <th className="pb-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262B30]/50">
                  {backtestResult.trades.map((item, idx) => {
                    const isWin = item.outcome === 'win';
                    const isLoss = item.outcome === 'loss';
                    const isPending = item.outcome === 'pending';
                    const isSaving = savingId === item.setup.timestamp;

                    return (
                      <tr key={idx} className="hover:bg-[#131619]/50 transition-colors">
                        <td className="py-3 text-[#EDEAE3]">
                          {typeof item.setup.timestamp === 'string'
                            ? item.setup.timestamp.replace('T', ' ').slice(0, 16)
                            : item.setup.timestamp}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.setup.direction === 'long'
                                ? 'bg-[#3FA88C]/10 text-[#3FA88C] border border-[#3FA88C]/30'
                                : 'bg-[#E46868]/10 text-[#E46868] border border-[#E46868]/30'
                            }`}
                          >
                            {item.setup.direction}
                          </span>
                        </td>
                        <td className="py-3 text-[#8B8D91]">
                          ${item.setup.entryZone.min} - ${item.setup.entryZone.max}
                        </td>
                        <td className="py-3 font-semibold text-[#EDEAE3]">
                          ${item.setup.entryPrice}
                        </td>
                        <td className="py-3 text-[#E46868]">
                          ${item.setup.stopPrice}
                        </td>
                        <td className="py-3 text-[#3FA88C]">
                          ${item.setup.targetPrice}
                        </td>
                        <td className="py-3 text-[#8B8D91]">
                          {item.setup.displacementRatio || '1.0'}x ATR
                        </td>
                        <td className="py-3 uppercase text-[10px] font-bold text-[#C9A227]">
                          {item.setup.rangeZone || 'N/A'}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              isWin
                                ? 'bg-[#3FA88C]/20 text-[#3FA88C]'
                                : isLoss
                                ? 'bg-[#E46868]/20 text-[#E46868]'
                                : 'bg-[#2A2311] text-[#C9A227]'
                            }`}
                          >
                            {isWin && <CheckCircle2 size={12} />}
                            {isLoss && <XCircle size={12} />}
                            {isPending && <Clock size={12} />}
                            <span className="uppercase">{item.outcome}</span>
                          </span>
                        </td>
                        <td
                          className={`py-3 text-right font-bold ${
                            item.rMultiple > 0
                              ? 'text-[#3FA88C]'
                              : item.rMultiple < 0
                              ? 'text-[#E46868]'
                              : 'text-[#8B8D91]'
                          }`}
                        >
                          {item.rMultiple > 0 ? `+${item.rMultiple}` : item.rMultiple} R
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleSaveSetup(item)}
                            disabled={isSaving}
                            className="px-2.5 py-1 rounded bg-[#131619] border border-[#262B30] text-[11px] text-[#C9A227] hover:border-[#C9A227]/50 transition-colors inline-flex items-center gap-1"
                          >
                            {isSaving ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <BookmarkPlus size={12} />
                            )}
                            <span>Save DB</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Session Breakdown */}
        {activeTab === 'session' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(backtestResult.bySession).map(([sessionName, data]) => (
              <div key={sessionName} className="p-4 rounded-xl bg-[#131619] border border-[#262B30] flex flex-col gap-2">
                <div className="text-xs font-bold text-[#EDEAE3] uppercase tracking-wider">
                  {sessionName} Session
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold font-mono-num text-[#C9A227]">
                    {data.winRatePct}%
                  </span>
                  <span className="text-xs text-[#8B8D91] font-mono-num">
                    {data.wins}W / {data.losses}L
                  </span>
                </div>
                <div className="text-[11px] text-[#5A5D61] mt-1">
                  Total Setups: {data.setups}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Saved Setups from Supabase Backend DB */}
        {activeTab === 'saved' && (
          <div className="overflow-x-auto">
            {savedSetups.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8B8D91]">
                No CRT setups saved in your Supabase cloud database yet. Click "Save DB" on any detected setup row to save it.
              </div>
            ) : (
              <table className="w-full text-left text-xs font-mono-num">
                <thead>
                  <tr className="border-b border-[#262B30] text-[#5A5D61] uppercase text-[10px]">
                    <th className="pb-2.5">Detected At</th>
                    <th className="pb-2.5">Symbol</th>
                    <th className="pb-2.5">Timeframe</th>
                    <th className="pb-2.5">Direction</th>
                    <th className="pb-2.5">Entry Price</th>
                    <th className="pb-2.5">Stop Loss</th>
                    <th className="pb-2.5">Target</th>
                    <th className="pb-2.5 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262B30]/50">
                  {savedSetups.map((s) => (
                    <tr key={s.id} className="hover:bg-[#131619]/50 transition-colors">
                      <td className="py-3 text-[#EDEAE3]">
                        {s.detected_at ? new Date(s.detected_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="py-3 text-[#C9A227] font-bold">{s.symbol}</td>
                      <td className="py-3 text-[#8B8D91] uppercase">{s.timeframe}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.direction === 'long'
                              ? 'bg-[#3FA88C]/10 text-[#3FA88C] border border-[#3FA88C]/30'
                              : 'bg-[#E46868]/10 text-[#E46868] border border-[#E46868]/30'
                          }`}
                        >
                          {s.direction}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-[#EDEAE3]">${s.entry_price}</td>
                      <td className="py-3 text-[#E46868]">${s.stop_price}</td>
                      <td className="py-3 text-[#3FA88C]">${s.target_price}</td>
                      <td className="py-3 text-right uppercase text-[#C9A227] font-bold">
                        {s.outcome}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
