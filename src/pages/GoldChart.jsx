import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Maximize2,
  Minimize2,
  RefreshCw,
  Plus,
  Wifi,
  AlertCircle,
  Clock,
  ExternalLink,
  Shield,
  Layers,
  BarChart2,
  Zap,
  Info,
  ChevronRight,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  Globe,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useTrade } from '../context/TradeContext';
import { goldPriceService } from '../services/goldPriceService';
import { cryptoGoldPriceService } from '../services/goldPriceService.crypto';
import { getCurrentGoldSession } from '../utils/sessionDetector';
import {
  calculateClassicPivots,
  calculateFibonacciPivots,
  determineFallbackState,
} from '../utils/pivotPoints';

const CRYPTO_GOLD_SYMBOLS = [
  { value: 'OKX:PAXGUSDT', label: 'OKX: PAXG/USDT (24/7 Paxos Gold)', ticker: 'PAXGUSDT' },
  { value: 'BINANCE:PAXGUSDT', label: 'Binance: PAXG/USDT (24/7 Paxos Gold)', ticker: 'PAXGUSDT' },
  { value: 'OKX:XAUTUSDT', label: 'OKX: XAUT/USDT (24/7 Tether Gold)', ticker: 'XAUTUSDT' },
];

export function GoldChart() {
  const { trades, pendingOrders, setActivePage, setSelectedTrade, theme } = useTrade();

  // Explicit Market Mode State: source + symbol
  const [marketMode, setMarketMode] = useState(() => {
    const savedSource = localStorage.getItem('tradepulse_gold_chart_mode') || 'oanda';
    const savedSymbol = localStorage.getItem('tradepulse_crypto_gold_symbol') || 'OKX:PAXGUSDT';
    return {
      source: savedSource, // 'oanda' | 'okx-crypto'
      symbol: savedSource === 'okx-crypto' ? savedSymbol : 'OANDA:XAUUSD',
    };
  });

  // Price & Market state
  const [priceState, setPriceState] = useState({
    price: null,
    previousPrice: null,
    change24h: 0,
    bid: null,
    ask: null,
    spread: 0,
    source: 'unknown',
  });

  // Timeframe selection state
  const [timeframe, setTimeframe] = useState('15');
  const [pivotType, setPivotType] = useState('classic'); // 'classic' | 'fibonacci'
  const [chartMode, setChartMode] = useState('tradingview'); // 'tradingview' | 'native'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);

  // Script & Fallback states
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [nativeTicks, setNativeTicks] = useState([]);

  const tvContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);
  const sentimentContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // 1. Persist market mode preference & handle 300ms debounced mode switching
  const handleModeChange = useCallback((newSource, newSymbol) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      const targetSource = newSource;
      const targetSymbol = targetSource === 'okx-crypto' ? (newSymbol || 'OKX:PAXGUSDT') : 'OANDA:XAUUSD';

      localStorage.setItem('tradepulse_gold_chart_mode', targetSource);
      if (targetSource === 'okx-crypto') {
        localStorage.setItem('tradepulse_crypto_gold_symbol', targetSymbol);
      }

      setMarketMode({ source: targetSource, symbol: targetSymbol });
      setNativeTicks([]); // Clear tick history on mode change
    }, 300);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // 2. Technical Analysis Widget loader for side panel
  useEffect(() => {
    if (!showSidePanel || !sentimentContainerRef.current) return;
    
    sentimentContainerRef.current.innerHTML = '';

    const isLight = theme === 'light';
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.width = '100%';
    container.style.height = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.text = JSON.stringify({
      interval: '15m',
      width: '100%',
      isTransparent: true,
      height: '220',
      symbol: marketMode.symbol,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'en',
      colorTheme: isLight ? 'light' : 'dark',
    });

    container.appendChild(script);
    sentimentContainerRef.current.appendChild(container);
  }, [showSidePanel, marketMode.symbol, theme]);

  // Current session info (gated on marketMode.source)
  const sessionInfo = useMemo(() => getCurrentGoldSession(new Date(), marketMode.source), [marketMode.source]);

  // 3. Subscribe to price stream based on active marketMode (Branched streams)
  useEffect(() => {
    let unsub = () => {};

    if (marketMode.source === 'okx-crypto') {
      const cryptoOption = CRYPTO_GOLD_SYMBOLS.find(s => s.value === marketMode.symbol) || CRYPTO_GOLD_SYMBOLS[0];
      cryptoGoldPriceService.setSymbol(cryptoOption.ticker);
      
      unsub = cryptoGoldPriceService.subscribe((state) => {
        setPriceState({
          price: state.price,
          previousPrice: state.previousPrice,
          change24h: state.change24h || 0,
          bid: state.bid,
          ask: state.ask,
          spread: state.bid && state.ask ? parseFloat((state.ask - state.bid).toFixed(2)) : 0,
          source: state.source || 'crypto-ws',
        });

        if (state.price) {
          setNativeTicks((prev) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return [...prev, { time: timeStr, price: state.price }].slice(-60);
          });
        }
      });
    } else {
      unsub = goldPriceService.subscribe((state) => {
        setPriceState({
          price: state.price,
          previousPrice: state.previousPrice,
          change24h: state.change24h || 0,
          bid: state.bid,
          ask: state.ask,
          spread: state.bid && state.ask ? parseFloat((state.ask - state.bid).toFixed(2)) : 0,
          source: state.source || 'unknown',
        });

        if (state.price) {
          setNativeTicks((prev) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return [...prev, { time: timeStr, price: state.price }].slice(-60);
          });
        }
      });
    }

    return () => unsub();
  }, [marketMode.source, marketMode.symbol]);

  // 4. Load TradingView script with timeout & error handling
  useEffect(() => {
    let timer = null;

    if (window.TradingView) {
      setScriptLoaded(true);
    } else {
      const existingScript = document.getElementById('tradingview-tv-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'tradingview-tv-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;

        script.onload = () => setScriptLoaded(true);
        script.onerror = () => setScriptError(true);

        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => setScriptLoaded(true));
        existingScript.addEventListener('error', () => setScriptError(true));
      }

      timer = setTimeout(() => {
        setTimerExpired(true);
      }, 5000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Determine fallback requirement
  const isFallbackActive = useMemo(() => {
    if (chartMode === 'native') return true;
    return determineFallbackState(scriptLoaded, scriptError, timerExpired);
  }, [chartMode, scriptLoaded, scriptError, timerExpired]);

  // 5. Initialize TradingView Widget with active marketMode.symbol & Theme
  useEffect(() => {
    if (isFallbackActive || !scriptLoaded || !tvContainerRef.current) return;

    const isLight = theme === 'light';

    try {
      if (window.TradingView && window.TradingView.widget) {
        tvContainerRef.current.innerHTML = '';
        new window.TradingView.widget({
          autosize: true,
          symbol: marketMode.symbol,
          interval: timeframe,
          timezone: 'Etc/UTC',
          theme: isLight ? 'light' : 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: isLight ? '#FFFFFF' : '#080A0D',
          enable_publishing: false,
          allow_symbol_change: true,
          save_image: true,
          container_id: tvContainerRef.current.id,
          hide_side_toolbar: false,
          details: false,
          hotlist: false,
          calendar: false,
          studies: ['ROC@tv-basicstudies', 'StochasticRSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
          overrides: isLight ? {
            'paneProperties.background': '#FFFFFF',
            'paneProperties.vertGridProperties.color': '#E2E8F0',
            'paneProperties.horzGridProperties.color': '#E2E8F0',
          } : {
            'mainSeriesProperties.styleColors.candleStyle.upColor': '#34D399',
            'mainSeriesProperties.styleColors.candleStyle.downColor': '#FB7185',
            'mainSeriesProperties.styleColors.candleStyle.wickUpColor': '#34D399',
            'mainSeriesProperties.styleColors.candleStyle.wickDownColor': '#FB7185',
            'paneProperties.background': '#080A0D',
            'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.05)',
            'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.05)',
          },
        });
      }
    } catch (err) {
      console.warn('TradingView widget initialization failed:', err);
      setScriptError(true);
    }
  }, [scriptLoaded, isFallbackActive, timeframe, marketMode.symbol, theme]);

  // 6. Calculate Pivot Points from active live price
  const pivots = useMemo(() => {
    const p = priceState.price || 2740.0;
    const high = p + 12.5;
    const low = p - 14.2;
    const close = p - 1.8;

    if (pivotType === 'fibonacci') {
      return calculateFibonacciPivots(high, low, close);
    }
    return calculateClassicPivots(high, low, close);
  }, [priceState.price, pivotType]);

  // 7. Filter active XAU/USD trades from user journal
  const xauTrades = useMemo(() => {
    const all = [...(trades || [])];
    return all.filter((t) => {
      const sym = (t.symbol || '').toUpperCase();
      return sym === 'XAUUSD' || sym === 'XAU/USD' || sym === 'GOLD';
    });
  }, [trades]);

  const toggleFullscreen = () => {
    if (!chartWrapperRef.current) return;
    if (!document.fullscreenElement) {
      chartWrapperRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const isPositive = priceState.change24h >= 0;

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-5rem)]">
      {/* Top Header / Symbol & Market Mode Toolbar */}
      <div className="terminal-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          {/* Market Mode Switcher UI */}
          <div
            className="flex items-center p-1 rounded-xl border gap-1 shadow-inner"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <button
              onClick={() => handleModeChange('oanda', 'OANDA:XAUUSD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display flex items-center gap-1.5 transition-all ${
                marketMode.source === 'oanda'
                  ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D] shadow-md font-bold'
                  : 'hover:opacity-80'
              }`}
              style={marketMode.source !== 'oanda' ? { color: 'var(--color-text-muted)' } : undefined}
            >
              <span>🏦 Spot Gold</span>
              <span className="text-[10px] opacity-75 font-mono-num">(23/5 Forex)</span>
            </button>

            <button
              onClick={() => handleModeChange('okx-crypto', 'OKX:PAXGUSDT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display flex items-center gap-1.5 transition-all ${
                marketMode.source === 'okx-crypto'
                  ? 'bg-emerald-500 text-white shadow-md font-bold'
                  : 'hover:opacity-80'
              }`}
              style={marketMode.source !== 'okx-crypto' ? { color: 'var(--color-text-muted)' } : undefined}
            >
              <Zap size={13} className="text-emerald-300 animate-pulse" />
              <span>24/7 Crypto Gold</span>
              <span className="px-1 py-0.2 rounded text-[9px] font-mono-num bg-emerald-700/40 text-white">NONSTOP</span>
            </button>
          </div>

          {/* Crypto Ticker Selector (Mode B Only) */}
          {marketMode.source === 'okx-crypto' && (
            <select
              value={marketMode.symbol}
              onChange={(e) => handleModeChange('okx-crypto', e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono-num font-semibold focus:outline-none"
              style={{
                background: 'var(--color-elevated)',
                borderColor: 'var(--color-border-soft)',
                color: 'var(--color-text-main)',
              }}
            >
              {CRYPTO_GOLD_SYMBOLS.map((opt) => (
                <option key={opt.value} value={opt.value} className="text-slate-900 bg-white dark:text-white dark:bg-[#0C1015]">
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Canonical Live Price Badge */}
          <div className="flex items-baseline gap-2 border-l pl-3 md:pl-4" style={{ borderColor: 'var(--color-border-soft)' }}>
            <span className="text-xl sm:text-2xl font-bold font-mono-num" style={{ color: 'var(--color-text-main)' }}>
              {priceState.price ? `$${priceState.price.toFixed(2)}` : '—'}
            </span>
            <span
              className={`text-xs font-mono-num font-semibold flex items-center gap-0.5 px-2 py-0.5 rounded-md border shadow-sm ${
                isPositive
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-[#34D399]'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-[#FB7185]'
              }`}
            >
              {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isPositive ? '+' : ''}
              {priceState.change24h}%
            </span>
          </div>

          {/* Bid / Ask / Spread */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono-num border-l pl-4" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-dim)' }}>
            {priceState.bid && priceState.ask ? (
              <>
                <span>Bid: <strong style={{ color: 'var(--color-text-main)' }}>{priceState.bid.toFixed(2)}</strong></span>
                <span>Ask: <strong style={{ color: 'var(--color-text-main)' }}>{priceState.ask.toFixed(2)}</strong></span>
                <span>Spread: <strong className="text-amber-600 dark:text-[#E5B83B] font-bold">{priceState.spread.toFixed(2)}</strong></span>
              </>
            ) : (
              <span>Spread: <strong className="text-amber-600 dark:text-[#E5B83B] font-bold">0.30</strong></span>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Session Status Pill */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono-num"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
          >
            <Globe size={13} className={marketMode.source === 'okx-crypto' ? 'text-emerald-500' : 'text-amber-500'} />
            <span className="font-semibold" style={{ color: sessionInfo.color }}>
              {sessionInfo.name}
            </span>
          </div>

          {/* Engine Switch Button */}
          <button
            onClick={() => setChartMode((prev) => (prev === 'tradingview' ? 'native' : 'tradingview'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              chartMode === 'tradingview' && !isFallbackActive
                ? 'border-transparent shadow-sm'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-[#E5B83B]'
            }`}
            style={
              chartMode === 'tradingview' && !isFallbackActive
                ? { background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }
                : undefined
            }
            title="Switch Chart Engine"
          >
            <BarChart2 size={14} />
            <span className="hidden sm:inline">
              {chartMode === 'tradingview' && !isFallbackActive ? 'TV Engine' : 'Native Engine'}
            </span>
          </button>

          {/* Action: Add Trade Button */}
          <button
            onClick={() => setActivePage('add')}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#C9A227] via-[#E4C468] to-[#C9A227] hover:brightness-110 text-[#080A0D] font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#C9A227]/25 active:scale-95 transition-all"
          >
            <Plus size={14} />
            <span>New Trade</span>
          </button>

          {/* Toggle Side Panel Button */}
          <button
            onClick={() => setShowSidePanel((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border shadow-sm"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
              color: 'var(--color-text-main)',
            }}
            title={showSidePanel ? 'Hide Side Panel' : 'Show Side Panel'}
          >
            {showSidePanel ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            <span className="hidden sm:inline">{showSidePanel ? 'Hide Panel' : 'Show Panel'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg border transition-colors shadow-sm"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
              color: 'var(--color-text-muted)',
            }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Persistent Disclaimer Banner for Mode B */}
      {marketMode.source === 'okx-crypto' && (
        <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono-num text-emerald-700 dark:text-[#3FA88C]">
          <div className="flex items-center gap-2">
            <Info size={14} className="shrink-0" />
            <span>
              <strong>24/7 Mode Active:</strong> Tracks physical spot gold via PAXG/USDT (OKX/Binance) — trades nonstop through weekends. May show minor crypto basis spread vs COMEX/OANDA XAU/USD.
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: Chart Canvas (Left) + Technical Side Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
        {/* Chart Canvas Area */}
        <div
          ref={chartWrapperRef}
          className={`${
            showSidePanel ? 'lg:col-span-3' : 'lg:col-span-4'
          } flex flex-col terminal-card overflow-hidden min-h-[560px] relative shadow-xl transition-all duration-300`}
        >
          {/* Ad-blocker / Script Fallback Banner */}
          {isFallbackActive && chartMode === 'tradingview' && (
            <div className="px-4 py-2 bg-[#2A2311] border-b border-[#C9A227]/40 flex items-center justify-between text-xs font-mono-num text-[#C9A227] animate-fade-in z-10">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />
                <span>
                  <strong>Notice:</strong> TradingView script unreachable (ad-blocker or network delay). Displaying TradePulse Native Realtime Gold Engine.
                </span>
              </div>
              <button
                onClick={() => setChartMode('native')}
                className="underline hover:text-[#EDEAE3] transition-colors text-[11px]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TradingView Widget Container */}
          {!isFallbackActive ? (
            <div className="w-full flex-1 min-h-[500px] relative" id="tradingview_xauusd" ref={tvContainerRef}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-xs text-[#8B8D91] bg-[#0A0C0E]">
                <Activity size={24} className="text-[#C9A227] animate-spin" />
                <span>Initializing TradingView Gold Chart ({marketMode.symbol})...</span>
              </div>
            </div>
          ) : (
            /* Native Fallback Live Chart Engine */
            <div className="w-full flex-1 flex flex-col p-4 bg-[#0A0C0E]">
              <div className="flex items-center justify-between pb-3 border-b border-[#262B30]/60 text-xs font-mono-num text-[#8B8D91]">
                <div className="flex items-center gap-2 text-[#3FA88C]">
                  <Wifi size={14} className="animate-pulse" />
                  <span>TradePulse Realtime {marketMode.source === 'okx-crypto' ? '24/7 Crypto Gold Stream' : 'Forex Gold Stream'}</span>
                </div>
                <div>{nativeTicks.length} ticks recorded</div>
              </div>

              <div className="flex-1 w-full min-h-[420px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={nativeTicks.length > 0 ? nativeTicks : [{ time: 'Now', price: priceState.price || 2740 }]}>
                    <defs>
                      <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={marketMode.source === 'okx-crypto' ? '#3FA88C' : '#C9A227'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={marketMode.source === 'okx-crypto' ? '#3FA88C' : '#C9A227'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B1F23" />
                    <XAxis dataKey="time" stroke="#5A5D61" tick={{ fontSize: 11, fill: '#8B8D91' }} />
                    <YAxis
                      domain={['dataMin - 2', 'dataMax + 2']}
                      orientation="right"
                      stroke="#5A5D61"
                      tick={{ fontSize: 11, fill: '#8B8D91' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#131619',
                        borderColor: '#262B30',
                        borderRadius: '8px',
                        color: '#EDEAE3',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                    />
                    {priceState.price && (
                      <ReferenceLine
                        y={priceState.price}
                        stroke={marketMode.source === 'okx-crypto' ? '#3FA88C' : '#C9A227'}
                        strokeDasharray="3 3"
                        label={{ value: `Live $${priceState.price.toFixed(2)}`, fill: marketMode.source === 'okx-crypto' ? '#3FA88C' : '#C9A227', fontSize: 11 }}
                      />
                    )}
                    <Area type="monotone" dataKey="price" stroke={marketMode.source === 'okx-crypto' ? '#3FA88C' : '#C9A227'} strokeWidth={2} fill="url(#goldGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel (TradingView Technical Overview & Trade Levels) */}
        <div className={showSidePanel ? 'flex flex-col gap-4 animate-fade-in' : 'hidden'}>
          {/* TradingView Technical Analysis Widget Embed */}
          <div className="terminal-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--color-border-soft)' }}>
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-amber-500 dark:text-[#E5B83B]" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                  Technical Sentiment
                </h3>
              </div>
              <span className="text-[10px] font-mono-num" style={{ color: 'var(--color-text-muted)' }}>{marketMode.symbol}</span>
            </div>

            <div
              ref={sentimentContainerRef}
              className="w-full min-h-[220px] rounded-xl border overflow-hidden relative"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
            />
          </div>

          {/* Daily Support & Resistance Pivot Points */}
          <div className="terminal-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--color-border-soft)' }}>
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-emerald-500 dark:text-[#34D399]" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                  Daily Pivot Points
                </h3>
              </div>
              <div
                className="flex items-center gap-1 p-0.5 rounded-lg border"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
              >
                <button
                  onClick={() => setPivotType('classic')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-semibold transition-all ${
                    pivotType === 'classic'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-[#E5B83B] font-bold'
                      : 'text-slate-500 dark:text-[#94A3B8]'
                  }`}
                >
                  Classic
                </button>
                <button
                  onClick={() => setPivotType('fibonacci')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-semibold transition-all ${
                    pivotType === 'fibonacci'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-[#E5B83B] font-bold'
                      : 'text-slate-500 dark:text-[#94A3B8]'
                  }`}
                >
                  Fib
                </button>
              </div>
            </div>

            <div className="space-y-1.5 font-mono-num text-xs">
              <div className="flex justify-between items-center px-2 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-[#FB7185]">
                <span>Resistance 2 (R2)</span>
                <strong>${pivots.r2}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-[#FB7185]">
                <span>Resistance 1 (R1)</span>
                <strong>${pivots.r1}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 rounded bg-amber-500/15 text-amber-700 dark:text-[#E5B83B] border border-amber-500/30 font-bold">
                <span>Pivot Point (P)</span>
                <strong>${pivots.p}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-[#34D399]">
                <span>Support 1 (S1)</span>
                <strong>${pivots.s1}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-[#34D399]">
                <span>Support 2 (S2)</span>
                <strong>${pivots.s2}</strong>
              </div>
            </div>
          </div>

          {/* Active Journaled Gold Trades (RLS Compliant) */}
          <div className="terminal-card p-4 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--color-border-soft)' }}>
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-emerald-500 dark:text-[#34D399]" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                  Journaled XAU Trades
                </h3>
              </div>
              <span
                className="text-[10px] font-mono-num px-2 py-0.5 rounded border"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
              >
                {xauTrades.length}
              </span>
            </div>

            {xauTrades.length === 0 ? (
              <div
                className="p-4 rounded-xl border text-center text-xs space-y-2"
                style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
              >
                <Sparkles size={20} className="mx-auto" style={{ color: 'var(--color-text-dim)' }} />
                <p>No active Gold (XAU/USD) trades logged yet.</p>
                <button
                  onClick={() => setActivePage('add')}
                  className="text-amber-600 dark:text-[#C9A227] hover:underline font-semibold"
                >
                  + Log a new XAU trade
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {xauTrades.map((trade, idx) => {
                  const isLong = (trade.type || 'BUY').toUpperCase() === 'BUY';
                  return (
                    <div
                      key={trade.id || idx}
                      onClick={() => setSelectedTrade(trade)}
                      className="p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-xs font-mono-num group hover:opacity-80"
                      style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLong ? 'bg-emerald-500/15 text-emerald-700 dark:bg-[#1F4A40] dark:text-[#3FA88C]' : 'bg-rose-500/15 text-rose-700 dark:bg-[#4A1E1E] dark:text-[#E46868]'
                          }`}
                        >
                          {isLong ? 'LONG' : 'SHORT'}
                        </span>
                        <div>
                          <div className="font-semibold" style={{ color: 'var(--color-text-main)' }}>@ ${trade.entryPrice || trade.entry || '—'}</div>
                          <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{trade.lotSize || trade.lots || '0.1'} lots</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`font-semibold ${
                            (trade.pnl || 0) >= 0 ? 'text-[#3FA88C]' : 'text-[#E46868]'
                          }`}
                        >
                          {(trade.pnl || 0) >= 0 ? '+' : ''}
                          ${parseFloat(trade.pnl || 0).toFixed(2)}
                        </span>
                        <ChevronRight size={14} className="text-[#5A5D61] group-hover:text-[#C9A227] transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
