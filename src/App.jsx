import React, { useState, lazy, Suspense } from 'react';
import {
  LayoutDashboard,
  Plus,
  History,
  TrendingUp,
  GitCompare,
  Calculator,
  Newspaper,
  ShieldAlert,
  Settings as SettingsIcon,
  ChevronRight,
  Shield,
  Cloud,
  Loader2,
  LogOut,
  Sparkles,
  ArrowRight,
  X,
  ListOrdered,
  Menu,
  CandlestickChart,
  Target,
  User,
} from 'lucide-react';
import { TradeProvider, useTrade } from './context/TradeContext';
import { TickerBar } from './components/TickerBar';
import { LogoIcon } from './components/LogoIcon';
import { TradeModal } from './components/TradeModal';
import { ImportModal } from './components/ImportModal';
import { AuthModal } from './components/AuthModal';
import { AuthGate } from './components/AuthGate';
import { OrderToast } from './components/OrderToast';
import { AccountManagerModal } from './components/AccountManagerModal';
import { ImportMT5Modal } from './components/ImportMT5Modal';

// Code Splitting with React.lazy() to reduce initial bundle chunk size
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const GoldChart = lazy(() => import('./pages/GoldChart').then((m) => ({ default: m.GoldChart })));
const AddTrade = lazy(() => import('./pages/AddTrade').then((m) => ({ default: m.AddTrade })));
const TradeHistory = lazy(() => import('./pages/TradeHistory').then((m) => ({ default: m.TradeHistory })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const StrategyCompare = lazy(() => import('./pages/StrategyCompare').then((m) => ({ default: m.StrategyCompare })));
const RiskCalculator = lazy(() => import('./pages/RiskCalculator').then((m) => ({ default: m.RiskCalculator })));
const TargetPlan = lazy(() => import('./pages/TargetPlan').then((m) => ({ default: m.TargetPlan })));
const MarketNews = lazy(() => import('./pages/MarketNews').then((m) => ({ default: m.MarketNews })));
const MistakeCenter = lazy(() => import('./pages/MistakeCenter').then((m) => ({ default: m.MistakeCenter })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const PendingOrders = lazy(() => import('./pages/PendingOrders').then((m) => ({ default: m.PendingOrders })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));

const NAV_SECTIONS = [
  {
    title: 'Trading Desk',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'chart', label: 'Gold Chart', icon: CandlestickChart, badge: 'PRO' },
      { key: 'add', label: 'Add Trade', icon: Plus },
      { key: 'pendingorders', label: 'Pending Orders', icon: ListOrdered },
      { key: 'history', label: 'Trade History', icon: History },
    ],
  },
  {
    title: 'Analytics & Quant',
    items: [
      { key: 'analytics', label: 'Analytics', icon: TrendingUp },
      { key: 'strategy', label: 'Strategy Comparison', icon: GitCompare },
      { key: 'risk', label: 'Risk Calculator', icon: Calculator },
      { key: 'targetplan', label: 'Target Plan', icon: Target },
    ],
  },
  {
    title: 'System & Edge',
    items: [
      { key: 'news', label: 'Market News', icon: Newspaper },
      { key: 'mistakes', label: 'Mistake Center', icon: ShieldAlert },
      { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function PageFallback() {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-3 text-xs text-[#8B8D91]">
      <Loader2 size={24} className="text-[#C9A227] animate-spin" />
      <span>Loading page component...</span>
    </div>
  );
}

function AppSplash() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0A0C0E] text-[#EDEAE3] select-none">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <LogoIcon size={56} />
        <div className="flex items-center gap-2 text-xs font-mono-num text-[#8B8D91]">
          <Loader2 size={16} className="text-[#C9A227] animate-spin" />
          <span>Verifying Secure Session...</span>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const {
    authLoading,
    userSession,
    isDemoMode,
    toggleDemoMode,
    isPasswordRecovery,
    unmigratedTrades,
    migrateLocalTrades,
    dismissLocalTrades,
    signOut,
    activePage,
    setActivePage,
    selectedTrade,
    setSelectedTrade,
    isImportModalOpen,
    setIsImportModalOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    trades,
    pendingOrders,
    orderToasts,
    dismissToast,
  } = useTrade();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasVisitedChart, setHasVisitedChart] = useState(false);
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);

  React.useEffect(() => {
    if (activePage === 'chart' && !hasVisitedChart) {
      setHasVisitedChart(true);
    }
  }, [activePage, hasVisitedChart]);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  if (authLoading) {
    return <AppSplash />;
  }

  // Mandatory Auth Gate: Must log in unless Demo Mode or Password Reset flow is active
  if ((!userSession && !isDemoMode) || isPasswordRecovery) {
    return <AuthGate />;
  }

  // Count active + pending orders for badge
  const activeOrderCount = (pendingOrders || []).filter(
    (o) => o.status === 'pending' || o.status === 'active'
  ).length;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'chart': return null; // Rendered in persistent wrapper to preserve iframe & drawing state
      case 'add': return <AddTrade />;
      case 'pendingorders': return <PendingOrders />;
      case 'history': return <TradeHistory />;
      case 'analytics': return <Analytics />;
      case 'strategy': return <StrategyCompare />;
      case 'risk': return <RiskCalculator />;
      case 'targetplan': return <TargetPlan />;
      case 'news': return <MarketNews />;
      case 'mistakes': return <MistakeCenter />;
      case 'profile': return <Profile />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col font-body relative overflow-x-hidden transition-colors duration-200"
      style={{
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-main)',
      }}
    >
      {/* Top Banner: Demo Mode Warning */}
      {isDemoMode && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between text-xs font-mono-num text-amber-700 dark:text-[#E5B83B]">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500 dark:text-[#E5B83B] animate-pulse" />
            <span><strong>DEMO MODE</strong> — Previewing with sample XAU/USD trade data. Changes are temporary.</span>
          </div>
          <button
            onClick={toggleDemoMode}
            className="px-2.5 py-1 rounded bg-[#C9A227] text-[#080A0D] font-bold text-[11px] hover:bg-[#E4C468] transition-colors shadow-sm"
          >
            Exit Demo &amp; Sign In
          </button>
        </div>
      )}

      {/* Top Banner: Unmigrated Local Trades Prompt */}
      {userSession && unmigratedTrades.length > 0 && (
        <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-between text-xs font-mono-num text-emerald-700 dark:text-[#34D399] animate-fade-in">
          <div className="flex items-center gap-2">
            <Cloud size={15} />
            <span>Found <strong>{unmigratedTrades.length} trades</strong> saved in local storage. Import them to your cloud account now?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={migrateLocalTrades}
              className="px-3 py-1 rounded bg-[#3FA88C] text-[#080A0D] font-bold text-[11px] flex items-center gap-1 hover:bg-[#58C4A7] transition-colors shadow-sm"
            >
              <span>Import to Cloud</span>
              <ArrowRight size={12} />
            </button>
            <button
              onClick={dismissLocalTrades}
              className="p-1 text-emerald-700 dark:text-[#34D399] hover:opacity-75 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Slide-Out Drawer & Backdrop Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
          {/* Dark Glass Backdrop Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          />

          {/* Slide Drawer Panel */}
          <div
            className="relative w-72 max-w-[85vw] border-r flex flex-col h-full z-10 shadow-2xl transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-sidebar)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            {/* Drawer Header */}
            <div
              className="px-5 py-4 flex items-center justify-between border-b"
              style={{ borderColor: 'var(--color-border-soft)' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <LogoIcon size={32} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0C1015]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold font-display tracking-tight bg-gradient-to-r from-slate-900 via-amber-800 to-amber-600 dark:from-[#EDEAE3] dark:via-[#F3D371] dark:to-[#C9A227] bg-clip-text text-transparent">
                      TradePulse
                    </span>
                    <span className="text-[9px] font-mono-num font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-[#C9A227]/15 dark:text-[#E5B83B] dark:border-[#C9A227]/30 tracking-wider">
                      GOLD
                    </span>
                  </div>
                  <div className="text-[10px] font-mono-num font-medium text-slate-500 dark:text-[#64748B]">
                    XAU/USD Trading Desk
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 py-3 space-y-3 px-3 overflow-y-auto">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="px-2 text-[10px] font-mono-num uppercase tracking-wider text-slate-400 dark:text-[#64748B] font-semibold">
                    {section.title}
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activePage === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActivePage(item.key);
                          setMobileMenuOpen(false);
                        }}
                        className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                          isActive
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 shadow-sm dark:bg-gradient-to-r dark:from-[#C9A227]/20 dark:via-[#C9A227]/10 dark:to-transparent dark:text-[#F3D371] dark:border-[#C9A227]/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-[#F1F3F5] dark:hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-amber-600 dark:bg-gradient-to-b dark:from-[#F3D371] dark:to-[#C9A227] shadow-[0_0_8px_rgba(201,162,39,0.5)]" />
                        )}
                        <Icon
                          size={18}
                          className={`transition-colors shrink-0 ${
                            isActive ? 'text-amber-700 dark:text-[#F3D371]' : 'text-slate-400 group-hover:text-slate-700 dark:text-[#64748B] dark:group-hover:text-[#94A3B8]'
                          }`}
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] font-mono-num font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-[#C9A227]/15 dark:text-[#E5B83B] dark:border-[#C9A227]/30">
                            {item.badge}
                          </span>
                        )}
                        {item.key === 'history' && (
                          <span
                            className="text-[10px] font-mono-num px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#151C25] dark:text-[#94A3B8] dark:border-white/[0.08]"
                          >
                            {trades.length}
                          </span>
                        )}
                        {item.key === 'pendingorders' && activeOrderCount > 0 && (
                          <span className="text-[10px] font-mono-num bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:bg-[#C9A227]/20 dark:text-[#E5B83B] dark:border-[#C9A227]/40 px-2 py-0.5 rounded animate-pulse">
                            {activeOrderCount}
                          </span>
                        )}
                        {isActive && <ChevronRight size={14} className="text-amber-600 dark:text-[#F3D371]/80" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Drawer Footer */}
            <div
              className="p-4 border-t text-xs space-y-2.5"
              style={{ borderColor: 'var(--color-border-soft)' }}
            >
              {userSession ? (
                <div className="space-y-2">
                  <div
                    className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                    style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:bg-gradient-to-br dark:from-[#C9A227]/30 dark:to-[#C9A227]/10 dark:text-[#F3D371] dark:border-[#C9A227]/40 flex items-center justify-center font-bold text-xs shrink-0">
                        {userSession.user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
                          {userSession.user.email}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-mono-num text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>RLS Protected</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        signOut();
                      }}
                      title="Sign Out"
                      className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:border-rose-500/20 transition-all shrink-0"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-500 font-semibold flex items-center gap-2">
                  <Sparkles size={14} className="text-[#C9A227] shrink-0" />
                  <span className="text-[11px]">Demo Preview Mode</span>
                </div>
              )}
              <div className="flex items-center justify-between px-1 text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                <div className="flex items-center gap-1">
                  <Shield size={11} className="text-emerald-500" />
                  <span>Supabase Cloud</span>
                </div>
                <span className="font-mono-num text-[9px] text-slate-400 dark:text-[#64748B]">v1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Desktop Modern Sidebar */}
        <aside
          className="w-64 shrink-0 hidden md:flex flex-col border-r select-none relative z-20 transition-colors duration-200"
          style={{
            backgroundColor: 'var(--color-sidebar)',
            borderColor: 'var(--color-border-soft)',
          }}
        >
          {/* Brand Header */}
          <div
            className="px-5 py-4 flex items-center justify-between border-b"
            style={{ borderColor: 'var(--color-border-soft)' }}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <LogoIcon size={32} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0C1015]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold font-display tracking-tight bg-gradient-to-r from-slate-900 via-amber-800 to-amber-600 dark:from-[#EDEAE3] dark:via-[#F3D371] dark:to-[#C9A227] bg-clip-text text-transparent">
                    TradePulse
                  </span>
                  <span className="text-[9px] font-mono-num font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-[#C9A227]/15 dark:text-[#E5B83B] dark:border-[#C9A227]/30 tracking-wider">
                    GOLD
                  </span>
                </div>
                <div className="text-[10px] font-mono-num font-medium text-slate-500 dark:text-[#64748B] flex items-center gap-1">
                  <span>XAU/USD Trading Desk</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Items (Grouped Desks) */}
          <nav className="flex-1 py-3 space-y-3 px-3 overflow-y-auto">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="px-2 text-[10px] font-mono-num uppercase tracking-wider text-slate-400 dark:text-[#64748B] font-semibold">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActivePage(item.key)}
                      className={`group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 shadow-sm dark:bg-gradient-to-r dark:from-[#C9A227]/20 dark:via-[#C9A227]/10 dark:to-transparent dark:text-[#F3D371] dark:border-[#C9A227]/30'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-[#F1F3F5] dark:hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-amber-600 dark:bg-gradient-to-b dark:from-[#F3D371] dark:to-[#C9A227] shadow-[0_0_8px_rgba(201,162,39,0.6)]" />
                      )}
                      <Icon
                        size={16}
                        className={`transition-colors shrink-0 ${
                          isActive ? 'text-amber-700 dark:text-[#F3D371]' : 'text-slate-400 group-hover:text-slate-700 dark:text-[#64748B] dark:group-hover:text-[#94A3B8]'
                        }`}
                      />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-mono-num font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-[#C9A227]/15 dark:text-[#E5B83B] dark:border-[#C9A227]/30">
                          {item.badge}
                        </span>
                      )}
                      {item.key === 'history' && (
                        <span
                          className="text-[10px] font-mono-num px-1.5 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#151C25] dark:text-[#94A3B8] dark:border-white/[0.08]"
                        >
                          {trades.length}
                        </span>
                      )}
                      {item.key === 'pendingorders' && activeOrderCount > 0 && (
                        <span className="text-[10px] font-mono-num bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:bg-[#C9A227]/20 dark:text-[#E5B83B] dark:border-[#C9A227]/40 px-1.5 py-0.5 rounded animate-pulse">
                          {activeOrderCount}
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight size={13} className="text-amber-600 dark:text-[#F3D371]/80 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Desktop Sidebar Footer */}
          <div
            className="p-3.5 border-t text-xs space-y-2.5"
            style={{
              borderColor: 'var(--color-border-soft)',
              backgroundColor: 'var(--color-sidebar)',
            }}
          >
            {userSession ? (
              <div className="space-y-2">
                <div
                  className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                  style={{
                    background: 'var(--color-elevated)',
                    borderColor: 'var(--color-border-soft)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:bg-gradient-to-br dark:from-[#C9A227]/30 dark:to-[#C9A227]/10 dark:text-[#F3D371] dark:border-[#C9A227]/40 flex items-center justify-center font-bold text-xs shrink-0">
                      {userSession.user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-[11px] font-semibold truncate leading-tight"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {userSession.user.email}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-mono-num text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>RLS Protected</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={signOut}
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:border-rose-500/20 transition-all shrink-0"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-500 font-semibold flex items-center gap-2">
                <Sparkles size={14} className="text-[#C9A227] shrink-0" />
                <span className="text-[11px]">Demo Preview Mode</span>
              </div>
            )}

            <div
              className="flex items-center justify-between px-1 text-[10px]"
              style={{ color: 'var(--color-text-dim)' }}
            >
              <div className="flex items-center gap-1">
                <Shield size={11} className="text-emerald-500" />
                <span>Supabase Cloud</span>
              </div>
              <span className="font-mono-num text-[9px] text-slate-400 dark:text-[#64748B]">v1.0.0</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          <TickerBar
            onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
            mobileMenuOpen={mobileMenuOpen}
            onOpenAccountManager={() => setIsAccountManagerOpen(true)}
          />
          <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 md:pb-6 overflow-x-hidden">
            <Suspense fallback={<PageFallback />}>
              {hasVisitedChart && (
                <div className={activePage === 'chart' ? 'block flex-1 min-h-0' : 'hidden'}>
                  <GoldChart />
                </div>
              )}
              {activePage !== 'chart' && renderPage()}
            </Suspense>
          </main>
        </div>
      </div>

      {/* Modern Bottom Docked Navigation Bar for Mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t px-2 py-1 min-h-[4rem] pb-safe flex items-center justify-around shadow-2xl transition-colors duration-200"
        style={{
          backgroundColor: 'var(--color-header)',
          borderColor: 'var(--color-border-soft)',
        }}
      >
        <button
          onClick={() => setActivePage('dashboard')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium transition-all ${
            activePage === 'dashboard' ? 'text-amber-600 dark:text-[#E5B83B]' : 'text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F1F3F5]'
          }`}
        >
          <LayoutDashboard size={20} className={activePage === 'dashboard' ? 'text-amber-600 dark:text-[#E5B83B]' : 'text-slate-400 dark:text-[#64748B]'} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActivePage('pendingorders')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium transition-all relative ${
            activePage === 'pendingorders' ? 'text-amber-600 dark:text-[#E5B83B]' : 'text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F1F3F5]'
          }`}
        >
          <div className="relative">
            <ListOrdered size={20} className={activePage === 'pendingorders' ? 'text-amber-600 dark:text-[#E5B83B]' : 'text-slate-400 dark:text-[#64748B]'} />
            {activeOrderCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-[#C9A227] text-[#080A0D] text-[9px] font-bold flex items-center justify-center border border-white dark:border-[#080A0D]">
                {activeOrderCount}
              </span>
            )}
          </div>
          <span>Orders</span>
        </button>

        {/* Center Action Button: + Add Trade */}
        <div className="flex-1 flex justify-center items-center">
          <button
            onClick={() => setActivePage('add')}
            className={`flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-tr from-[#C9A227] to-[#F3D371] text-[#080A0D] font-bold shadow-lg shadow-[#C9A227]/40 active:scale-95 transition-all ${
              activePage === 'add' ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-[#0C1015]' : ''
            }`}
            title="Add Trade"
          >
            <Plus size={24} />
          </button>
        </div>

        <button
          onClick={() => setActivePage('history')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium transition-all ${
            activePage === 'history' ? 'text-amber-600 dark:text-[#E5B83B]' : 'text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F1F3F5]'
          }`}
        >
          <History size={20} className={activePage === 'history' ? 'text-amber-600 dark:text-[#E5B83B]' : 'text-slate-400 dark:text-[#64748B]'} />
          <span>Journal</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F1F3F5] transition-all"
        >
          <Menu size={20} className="text-slate-400 dark:text-[#64748B]" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Modals */}
      <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      <ImportMT5Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <AccountManagerModal isOpen={isAccountManagerOpen} onClose={() => setIsAccountManagerOpen(false)} />

      {/* Order Toast Notifications */}
      <OrderToast toasts={orderToasts || []} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <TradeProvider>
      <AppContent />
    </TradeProvider>
  );
}
