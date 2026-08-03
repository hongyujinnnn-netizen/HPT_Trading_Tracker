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
} from 'lucide-react';
import { TradeProvider, useTrade } from './context/TradeContext';
import { TickerBar } from './components/TickerBar';
import { LogoIcon } from './components/LogoIcon';
import { TradeModal } from './components/TradeModal';
import { ImportModal } from './components/ImportModal';
import { AuthModal } from './components/AuthModal';
import { AuthGate } from './components/AuthGate';
import { OrderToast } from './components/OrderToast';

// Code Splitting with React.lazy() to reduce initial bundle chunk size
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const AddTrade = lazy(() => import('./pages/AddTrade').then((m) => ({ default: m.AddTrade })));
const TradeHistory = lazy(() => import('./pages/TradeHistory').then((m) => ({ default: m.TradeHistory })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const StrategyCompare = lazy(() => import('./pages/StrategyCompare').then((m) => ({ default: m.StrategyCompare })));
const RiskCalculator = lazy(() => import('./pages/RiskCalculator').then((m) => ({ default: m.RiskCalculator })));
const MarketNews = lazy(() => import('./pages/MarketNews').then((m) => ({ default: m.MarketNews })));
const MistakeCenter = lazy(() => import('./pages/MistakeCenter').then((m) => ({ default: m.MistakeCenter })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const PendingOrders = lazy(() => import('./pages/PendingOrders').then((m) => ({ default: m.PendingOrders })));

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'add', label: 'Add Trade', icon: Plus },
  { key: 'pendingorders', label: 'Pending Orders', icon: ListOrdered },
  { key: 'history', label: 'Trade History', icon: History },
  { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  { key: 'strategy', label: 'Strategy Comparison', icon: GitCompare },
  { key: 'risk', label: 'Risk Calculator', icon: Calculator },
  { key: 'news', label: 'Market News', icon: Newspaper },
  { key: 'mistakes', label: 'Mistake Center', icon: ShieldAlert },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

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
      case 'add': return <AddTrade />;
      case 'pendingorders': return <PendingOrders />;
      case 'history': return <TradeHistory />;
      case 'analytics': return <Analytics />;
      case 'strategy': return <StrategyCompare />;
      case 'risk': return <RiskCalculator />;
      case 'news': return <MarketNews />;
      case 'mistakes': return <MistakeCenter />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0A0C0E] text-[#EDEAE3] font-body relative">
      {/* Top Banner: Demo Mode Warning */}
      {isDemoMode && (
        <div className="px-4 py-2 bg-[#2A2311] border-b border-[#C9A227]/40 flex items-center justify-between text-xs font-mono-num text-[#C9A227]">
          <div className="flex items-center gap-2">
            <Sparkles size={14} />
            <span><strong>DEMO MODE</strong> — Previewing with sample XAU/USD trade data. Changes are temporary.</span>
          </div>
          <button
            onClick={toggleDemoMode}
            className="px-2.5 py-1 rounded bg-[#C9A227] text-[#0A0C0E] font-bold text-[11px] hover:bg-[#E4C468] transition-colors"
          >
            Exit Demo &amp; Sign In
          </button>
        </div>
      )}

      {/* Top Banner: Unmigrated Local Trades Prompt */}
      {userSession && unmigratedTrades.length > 0 && (
        <div className="px-4 py-2 bg-[#1F4A40] border-b border-[#3FA88C] flex items-center justify-between text-xs font-mono-num text-[#3FA88C] animate-fade-in">
          <div className="flex items-center gap-2">
            <Cloud size={15} />
            <span>Found <strong>{unmigratedTrades.length} trades</strong> saved in local storage. Import them to your cloud account now?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={migrateLocalTrades}
              className="px-3 py-1 rounded bg-[#3FA88C] text-[#0A0C0E] font-bold text-[11px] flex items-center gap-1 hover:bg-[#58C4A7] transition-colors"
            >
              <span>Import to Cloud</span>
              <ArrowRight size={12} />
            </button>
            <button
              onClick={dismissLocalTrades}
              className="p-1 text-[#3FA88C] hover:text-[#EDEAE3] transition-colors"
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
            className="fixed inset-0 bg-[#0A0C0E]/80 backdrop-blur-sm transition-opacity"
          />

          {/* Slide Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-[#1B1F23] border-r border-[#262B30] flex flex-col h-full z-10 shadow-2xl">
            {/* Drawer Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#262B30]">
              <div className="flex items-center gap-3">
                <LogoIcon size={34} />
                <div>
                  <div className="text-sm font-bold font-display tracking-tight text-[#EDEAE3]">TradePulse Gold</div>
                  <div className="text-[10px] font-mono-num text-[#8B8D91]">XAU/USD Journal</div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#131619] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 py-3 space-y-1 px-3 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActivePage(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#2A2311] text-[#C9A227] border-l-2 border-[#C9A227]'
                        : 'text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#131619]'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-[#C9A227]' : 'text-[#8B8D91]'} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.key === 'history' && (
                      <span className="text-[10px] font-mono-num bg-[#131619] px-2 py-0.5 rounded text-[#5A5D61]">
                        {trades.length}
                      </span>
                    )}
                    {item.key === 'pendingorders' && activeOrderCount > 0 && (
                      <span className="text-[10px] font-mono-num bg-[#2A2311] px-2 py-0.5 rounded text-[#C9A227] border border-[#C9A227]/30">
                        {activeOrderCount}
                      </span>
                    )}
                    {isActive && <ChevronRight size={14} className="text-[#C9A227]" />}
                  </button>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#262B30] text-xs text-[#5A5D61] space-y-2">
              {userSession ? (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3FA88C]">
                      <Cloud size={13} />
                      <span className="truncate">{userSession.user.email}</span>
                    </div>
                    <div className="text-[10px] text-[#5A5D61]">Row-Level Security Active</div>
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full py-2 rounded-lg bg-[#1F1412] hover:bg-[#4A2A1E] text-[#E68A6E] font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-[#4A2A1E]"
                  >
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#2A2311]/50 border border-[#C9A227]/30 text-xs text-[#C9A227] font-semibold flex items-center gap-2">
                  <Sparkles size={14} /> Demo Preview Mode
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[#8B8D91] text-[11px] pt-1">
                <Shield size={12} className="text-[#3FA88C]" /> Supabase Cloud &amp; RLS Verified
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Desktop Sidebar */}
        <aside className="w-60 shrink-0 hidden md:flex flex-col bg-[#1B1F23] border-r border-[#262B30] select-none">
          {/* Brand Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-[#262B30]">
            <div className="flex items-center gap-3">
              <LogoIcon size={34} />
              <div>
                <div className="text-sm font-bold font-display tracking-tight text-[#EDEAE3]">TradePulse Gold</div>
                <div className="text-[10px] font-mono-num text-[#8B8D91]">XAU/USD Journal</div>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 py-3 space-y-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActivePage(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#2A2311] text-[#C9A227] border-l-2 border-[#C9A227]'
                      : 'text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#131619]'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-[#C9A227]' : 'text-[#8B8D91]'} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.key === 'history' && (
                    <span className="text-[10px] font-mono-num bg-[#131619] px-1.5 py-0.5 rounded text-[#5A5D61]">
                      {trades.length}
                    </span>
                  )}
                  {item.key === 'pendingorders' && activeOrderCount > 0 && (
                    <span className="text-[10px] font-mono-num bg-[#2A2311] px-1.5 py-0.5 rounded text-[#C9A227] border border-[#C9A227]/30">
                      {activeOrderCount}
                    </span>
                  )}
                  {isActive && <ChevronRight size={13} className="text-[#C9A227]" />}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-[#262B30] text-xs text-[#5A5D61] space-y-2">
            {userSession ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-[#131619] border border-[#262B30] space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3FA88C]">
                    <Cloud size={13} />
                    <span className="truncate">{userSession.user.email}</span>
                  </div>
                  <div className="text-[10px] text-[#5A5D61]">Row-Level Security Active</div>
                </div>

                <button
                  onClick={signOut}
                  className="w-full py-2 rounded-lg bg-[#1F1412] hover:bg-[#4A2A1E] text-[#E68A6E] font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-[#4A2A1E]"
                >
                  <LogOut size={13} /> Sign Out
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-[#2A2311]/50 border border-[#C9A227]/30 text-xs text-[#C9A227] font-semibold flex items-center gap-2">
                <Sparkles size={14} /> Demo Preview Mode
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[#8B8D91] text-[11px] pt-1">
              <Shield size={12} className="text-[#3FA88C]" /> Supabase Cloud &amp; RLS Verified
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          <TickerBar
            onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
            mobileMenuOpen={mobileMenuOpen}
          />
          <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 md:pb-6 overflow-x-hidden">
            <Suspense fallback={<PageFallback />}>
              {renderPage()}
            </Suspense>
          </main>
        </div>
      </div>

      {/* Modern Bottom Docked Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#131619] border-t border-[#262B30] px-2 h-16 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActivePage('dashboard')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium transition-all ${
            activePage === 'dashboard' ? 'text-[#C9A227]' : 'text-[#8B8D91] hover:text-[#EDEAE3]'
          }`}
        >
          <LayoutDashboard size={20} className={activePage === 'dashboard' ? 'text-[#C9A227]' : 'text-[#8B8D91]'} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActivePage('pendingorders')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium transition-all relative ${
            activePage === 'pendingorders' ? 'text-[#C9A227]' : 'text-[#8B8D91] hover:text-[#EDEAE3]'
          }`}
        >
          <div className="relative">
            <ListOrdered size={20} className={activePage === 'pendingorders' ? 'text-[#C9A227]' : 'text-[#8B8D91]'} />
            {activeOrderCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-[#C9A227] text-[#0A0C0E] text-[9px] font-bold flex items-center justify-center border border-[#0A0C0E]">
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
            className={`flex items-center justify-center w-11 h-11 rounded-full bg-[#C9A227] text-[#0A0C0E] font-bold shadow-lg shadow-[#C9A227]/40 active:scale-95 transition-all ${
              activePage === 'add' ? 'ring-2 ring-[#EDEAE3] ring-offset-2 ring-offset-[#131619]' : ''
            }`}
            title="Add Trade"
          >
            <Plus size={24} />
          </button>
        </div>

        <button
          onClick={() => setActivePage('history')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium transition-all ${
            activePage === 'history' ? 'text-[#C9A227]' : 'text-[#8B8D91] hover:text-[#EDEAE3]'
          }`}
        >
          <History size={20} className={activePage === 'history' ? 'text-[#C9A227]' : 'text-[#8B8D91]'} />
          <span>Journal</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg text-[10px] font-mono-num font-medium text-[#8B8D91] hover:text-[#EDEAE3] transition-all"
        >
          <Menu size={20} className="text-[#8B8D91]" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Modals */}
      <TradeModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

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
