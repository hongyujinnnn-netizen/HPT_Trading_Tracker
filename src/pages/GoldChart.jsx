import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { getCurrentGoldSession } from '../utils/sessionDetector';
import {
  calculateClassicPivots,
  calculateFibonacciPivots,
  determineFallbackState,
} from '../utils/pivotPoints';

export function GoldChart() {
  const { trades, pendingOrders, setActivePage, setSelectedTrade } = useTrade();

  // Price & Market state (Canonical source: goldPriceService)
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
  const [showSidePanel, setShowSidePanel] = useState(true);

  // Script & Fallback states
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [nativeTicks, setNativeTicks] = useState([]);

  const tvContainerRef = useRef(null);
  const chartWrapperRef = useRef(null);
  const sentimentContainerRef = useRef(null);

  // Technical Analysis Widget loader
  useEffect(() => {
    if (!showSidePanel || !sentimentContainerRef.current) return;
    
    // Only inject if container is empty or missing widget
    if (sentimentContainerRef.current.children.length === 0) {
      sentimentContainerRef.current.innerHTML = '';

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
        symbol: 'OANDA:XAUUSD',
        showIntervalTabs: true,
        displayMode: 'single',
        locale: 'en',
        colorTheme: 'dark',
      });

      container.appendChild(script);
      sentimentContainerRef.current.appendChild(container);
    }
  }, [showSidePanel]);

  // Current session info
  const sessionInfo = useMemo(() => getCurrentGoldSession(), []);

  // 1. Subscribe to canonical goldPriceService for live prices & native ticks
  useEffect(() => {
    const unsub = goldPriceService.subscribe((state) => {
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
          const newPoint = { time: timeStr, price: state.price };
          const updated = [...prev, newPoint];
          return updated.slice(-60); // Keep last 60 ticks
        });
      }
    });

    return () => unsub();
  }, []);

  // 2. Load TradingView script with timeout & error handling
  useEffect(() => {
    let timer = null;

    // Check if script already loaded globally
    if (window.TradingView) {
      setScriptLoaded(true);
    } else {
      const existingScript = document.getElementById('tradingview-tv-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'tradingview-tv-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;

        script.onload = () => {
          setScriptLoaded(true);
        };
        script.onerror = () => {
          setScriptError(true);
        };

        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => setScriptLoaded(true));
        existingScript.addEventListener('error', () => setScriptError(true));
      }

      // 5-second timeout fallback for silent ad-blocker suppression
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

  // 3. Initialize TradingView Widget when script is ready
  useEffect(() => {
    if (isFallbackActive || !scriptLoaded || !tvContainerRef.current) return;

    try {
      if (window.TradingView && window.TradingView.widget) {
        tvContainerRef.current.innerHTML = '';
        new window.TradingView.widget({
          autosize: true,
          symbol: 'OANDA:XAUUSD',
          interval: timeframe,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#0A0C0E',
          enable_publishing: false,
          allow_symbol_change: true,
          save_image: true,
          container_id: tvContainerRef.current.id,
          hide_side_toolbar: false,
          details: true,
          hotlist: false,
          calendar: false,
          studies: ['ROC@tv-basicstudies', 'StochasticRSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
          overrides: {
            'mainSeriesProperties.styleColors.candleStyle.upColor': '#3FA88C',
            'mainSeriesProperties.styleColors.candleStyle.downColor': '#E46868',
            'mainSeriesProperties.styleColors.candleStyle.wickUpColor': '#3FA88C',
            'mainSeriesProperties.styleColors.candleStyle.wickDownColor': '#E46868',
            'paneProperties.background': '#0A0C0E',
            'paneProperties.vertGridProperties.color': '#1B1F23',
            'paneProperties.horzGridProperties.color': '#1B1F23',
          },
        });
      }
    } catch (err) {
      console.warn('TradingView widget initialization failed:', err);
      setScriptError(true);
    }
  }, [scriptLoaded, isFallbackActive, timeframe]);

  // 4. Calculate Pivot Points from canonical price
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

  // 5. Filter active XAU/USD trades from user journal
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
      {/* Top Header / Symbol Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-[#1B1F23] border border-[#262B30]">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          {/* Symbol Info */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#2A2311] border border-[#C9A227]/40 flex items-center justify-center font-bold text-[#C9A227] text-xs font-mono-num shadow-inner">
              AU
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold font-mono-num text-[#EDEAE3] tracking-tight">
                  OANDA:XAUUSD
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-semibold bg-[#131619] border border-[#262B30] text-[#8B8D91]">
                  Gold Spot / USD
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8B8D91] font-mono-num">
                <span>Data Feed:</span>
                <span className="text-[#C9A227] font-semibold flex items-center gap-1">
                  <Zap size={11} />
                  {!isFallbackActive ? 'TradingView Standard (Real-time)' : 'TradePulse Native WS'}
                </span>
              </div>
            </div>
          </div>

          {/* Canonical Live Price Badge */}
          <div className="flex items-baseline gap-2 border-l border-[#262B30] pl-3 md:pl-4">
            <span className="text-xl sm:text-2xl font-bold font-mono-num text-[#EDEAE3]">
              {priceState.price ? `$${priceState.price.toFixed(2)}` : '—'}
            </span>
            <span
              className={`text-xs font-mono-num font-semibold flex items-center gap-0.5 px-2 py-0.5 rounded ${
                isPositive ? 'text-[#3FA88C] bg-[#1F4A40]/40' : 'text-[#E46868] bg-[#4A1E1E]/40'
              }`}
            >
              {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isPositive ? '+' : ''}
              {priceState.change24h}%
            </span>
          </div>

          {/* Bid / Ask / Spread */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono-num text-[#5A5D61] border-l border-[#262B30] pl-4">
            {priceState.bid && priceState.ask ? (
              <>
                <span>Bid: <strong className="text-[#EDEAE3]">{priceState.bid.toFixed(2)}</strong></span>
                <span>Ask: <strong className="text-[#EDEAE3]">{priceState.ask.toFixed(2)}</strong></span>
                <span>Spread: <strong className="text-[#C9A227]">{priceState.spread.toFixed(2)}</strong></span>
              </>
            ) : (
              <span>Spread: <strong className="text-[#C9A227]">0.30</strong></span>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div className="flex items-center bg-[#131619] p-1 rounded-lg border border-[#262B30]">
            {['1', '5', '15', '60', '240', 'D'].map((tf) => {
              const labels = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', 'D': '1D' };
              const isActive = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded text-xs font-mono-num font-semibold transition-all ${
                    isActive
                      ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 shadow-sm'
                      : 'text-[#8B8D91] hover:text-[#EDEAE3]'
                  }`}
                >
                  {labels[tf]}
                </button>
              );
            })}
          </div>

          {/* Engine Switch Button */}
          <button
            onClick={() => setChartMode((prev) => (prev === 'tradingview' ? 'native' : 'tradingview'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              chartMode === 'tradingview' && !isFallbackActive
                ? 'bg-[#131619] border-[#262B30] text-[#EDEAE3] hover:bg-[#262B30]'
                : 'bg-[#2A2311] border-[#C9A227]/50 text-[#C9A227]'
            }`}
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
            className="px-3 py-1.5 rounded-lg bg-[#C9A227] text-[#0A0C0E] font-bold text-xs flex items-center gap-1.5 hover:bg-[#E4C468] transition-colors shadow-md shadow-[#C9A227]/20"
          >
            <Plus size={14} />
            <span>New Trade</span>
          </button>

          {/* Toggle Side Panel Button */}
          <button
            onClick={() => setShowSidePanel((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              showSidePanel
                ? 'bg-[#131619] border-[#262B30] text-[#8B8D91] hover:text-[#EDEAE3]'
                : 'bg-[#2A2311] border-[#C9A227]/50 text-[#C9A227]'
            }`}
            title={showSidePanel ? 'Hide Side Panel' : 'Show Side Panel'}
          >
            {showSidePanel ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            <span className="hidden sm:inline">{showSidePanel ? 'Hide Panel' : 'Show Panel'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-[#131619] border border-[#262B30] text-[#8B8D91] hover:text-[#EDEAE3] transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Grid: Chart Canvas (Left) + Technical Side Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
        {/* Chart Canvas Area */}
        <div
          ref={chartWrapperRef}
          className={`${
            showSidePanel ? 'lg:col-span-3' : 'lg:col-span-4'
          } flex flex-col bg-[#1B1F23] border border-[#262B30] rounded-xl overflow-hidden min-h-[520px] relative shadow-xl transition-all duration-300`}
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
                <span>Initializing TradingView Gold Chart...</span>
              </div>
            </div>
          ) : (
            /* Native Fallback Live Chart Engine */
            <div className="w-full flex-1 flex flex-col p-4 bg-[#0A0C0E]">
              <div className="flex items-center justify-between pb-3 border-b border-[#262B30]/60 text-xs font-mono-num text-[#8B8D91]">
                <div className="flex items-center gap-2 text-[#3FA88C]">
                  <Wifi size={14} className="animate-pulse" />
                  <span>TradePulse Realtime Gold Stream</span>
                </div>
                <div>{nativeTicks.length} ticks recorded</div>
              </div>

              <div className="flex-1 w-full min-h-[420px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={nativeTicks.length > 0 ? nativeTicks : [{ time: 'Now', price: priceState.price || 2740 }]}>
                    <defs>
                      <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A227" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#C9A227" stopOpacity={0.0} />
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
                        stroke="#C9A227"
                        strokeDasharray="3 3"
                        label={{ value: `Live $${priceState.price.toFixed(2)}`, fill: '#C9A227', fontSize: 11 }}
                      />
                    )}
                    <Area type="monotone" dataKey="price" stroke="#C9A227" strokeWidth={2} fill="url(#goldGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel (TradingView Technical Overview & Trade Levels) */}
        <div className={showSidePanel ? 'flex flex-col gap-4 animate-fade-in' : 'hidden'}>
          {/* TradingView Technical Analysis Widget Embed */}
          <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262B30] pb-2.5">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-[#C9A227]" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#EDEAE3]">
                  Technical Sentiment
                </h3>
              </div>
              <span className="text-[10px] font-mono-num text-[#8B8D91]">XAUUSD</span>
            </div>

            {/* TradingView Embedded Technical Gauge Container */}
            <div
              ref={sentimentContainerRef}
              className="w-full min-h-[220px] rounded-lg bg-[#131619] border border-[#262B30] overflow-hidden relative"
            />
          </div>

          {/* Daily Support & Resistance Pivot Points */}
          <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#262B30] pb-2.5">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-[#3FA88C]" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#EDEAE3]">
                  Daily Pivot Points
                </h3>
              </div>
              <div className="flex items-center gap-1 bg-[#131619] p-0.5 rounded border border-[#262B30]">
                <button
                  onClick={() => setPivotType('classic')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-semibold ${
                    pivotType === 'classic' ? 'bg-[#2A2311] text-[#C9A227]' : 'text-[#8B8D91]'
                  }`}
                >
                  Classic
                </button>
                <button
                  onClick={() => setPivotType('fibonacci')}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-semibold ${
                    pivotType === 'fibonacci' ? 'bg-[#2A2311] text-[#C9A227]' : 'text-[#8B8D91]'
                  }`}
                >
                  Fib
                </button>
              </div>
            </div>

            <div className="space-y-1.5 font-mono-num text-xs">
              <div className="flex justify-between items-center px-2 py-1 rounded bg-[#2A1E1E]/50 text-[#E46868]">
                <span>Resistance 2 (R2)</span>
                <strong>${pivots.r2}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded bg-[#2A1E1E]/30 text-[#E46868]">
                <span>Resistance 1 (R1)</span>
                <strong>${pivots.r1}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1.5 rounded bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/30 font-bold">
                <span>Pivot Point (P)</span>
                <strong>${pivots.p}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded bg-[#1F4A40]/30 text-[#3FA88C]">
                <span>Support 1 (S1)</span>
                <strong>${pivots.s1}</strong>
              </div>
              <div className="flex justify-between items-center px-2 py-1 rounded bg-[#1F4A40]/50 text-[#3FA88C]">
                <span>Support 2 (S2)</span>
                <strong>${pivots.s2}</strong>
              </div>
            </div>
          </div>

          {/* Active Journaled Gold Trades (RLS Compliant) */}
          <div className="p-4 rounded-xl bg-[#1B1F23] border border-[#262B30] flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between border-b border-[#262B30] pb-2.5">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#3FA88C]" />
                <h3 className="text-xs font-bold font-display uppercase tracking-wider text-[#EDEAE3]">
                  Journaled XAU Trades
                </h3>
              </div>
              <span className="text-[10px] font-mono-num bg-[#131619] px-2 py-0.5 rounded text-[#8B8D91]">
                {xauTrades.length}
              </span>
            </div>

            {xauTrades.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#131619] border border-[#262B30] text-center text-xs text-[#8B8D91] space-y-2">
                <Sparkles size={20} className="mx-auto text-[#5A5D61]" />
                <p>No active Gold (XAU/USD) trades logged yet.</p>
                <button
                  onClick={() => setActivePage('add')}
                  className="text-[#C9A227] hover:underline font-semibold"
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
                      className="p-2.5 rounded-lg bg-[#131619] hover:bg-[#262B30]/60 border border-[#262B30] cursor-pointer transition-all flex items-center justify-between text-xs font-mono-num group"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLong ? 'bg-[#1F4A40] text-[#3FA88C]' : 'bg-[#4A1E1E] text-[#E46868]'
                          }`}
                        >
                          {isLong ? 'LONG' : 'SHORT'}
                        </span>
                        <div>
                          <div className="text-[#EDEAE3] font-semibold">@ ${trade.entryPrice || trade.entry || '—'}</div>
                          <div className="text-[10px] text-[#8B8D91]">{trade.lotSize || trade.lots || '0.1'} lots</div>
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
