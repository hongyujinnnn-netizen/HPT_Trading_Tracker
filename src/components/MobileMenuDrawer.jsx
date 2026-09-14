import React, { useState } from 'react';
import {
  X,
  User,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Building2,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Settings2,
  Globe,
  Shield,
  Sparkles,
  LogIn,
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { LogoIcon } from './LogoIcon';
import { ACCOUNT_TYPE_LABELS } from '../types/accountSchema';

const THEME_OPTIONS = [
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function MobileMenuDrawer({
  isOpen,
  onClose,
  onOpenAccountManager,
  navSections,
  activeOrderCount = 0,
}) {
  const {
    userSession,
    isDemoMode,
    toggleDemoMode,
    signOut,
    activePage,
    setActivePage,
    setIsAuthModalOpen,
    trades = [],
    theme,
    setTheme,
    tradingAccounts = [],
    activeAccountId,
    setActiveAccountId,
    activeAccount,
  } = useTrade();

  const [isAccountsExpanded, setIsAccountsExpanded] = useState(false);

  if (!isOpen) return null;

  const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);
  const isAggregate = activeAccountId === 'all';

  return (
    <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        aria-label="Close drawer backdrop"
      />

      {/* Slide Drawer Panel */}
      <div
        className="relative w-80 max-w-[88vw] border-r flex flex-col h-full z-10 shadow-2xl transition-colors duration-200 select-none overflow-hidden"
        style={{
          backgroundColor: 'var(--color-sidebar)',
          borderColor: 'var(--color-border-soft)',
        }}
      >
        {/* Drawer Header */}
        <div
          className="px-4 py-3.5 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: 'var(--color-border-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <LogoIcon size={28} />
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
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body: Profile, Account, Theme, Navigation */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 custom-scrollbar">
          {/* 1. User Profile & Login State */}
          <div
            className="p-3 rounded-xl border shadow-sm space-y-2.5"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            {userSession ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#C9A227] to-[#E5B83B] text-[#080A0D] font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                      {userSession.user.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-xs font-semibold truncate leading-tight"
                        style={{ color: 'var(--color-text-main)' }}
                        title={userSession.user.email}
                      >
                        {userSession.user.email}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-mono-num text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>RLS Cloud Protected</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      signOut();
                    }}
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-500/10 dark:hover:border-rose-500/20 transition-all shrink-0"
                    aria-label="Sign Out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>

                {/* Profile Link Button */}
                <button
                  onClick={() => {
                    setActivePage('profile');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                    activePage === 'profile'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-[#E5B83B]'
                      : 'hover:bg-black/5 dark:hover:bg-white/[0.04]'
                  }`}
                  style={activePage !== 'profile' ? {
                    borderColor: 'var(--color-border-soft)',
                    color: 'var(--color-text-main)',
                  } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-amber-600 dark:text-[#E5B83B]" />
                    <span>My Profile &amp; Performance</span>
                  </div>
                  <ChevronRight size={14} className="opacity-60" />
                </button>
              </>
            ) : isDemoMode ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-[#E5B83B] flex items-center justify-center shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-700 dark:text-[#E5B83B]">
                        Demo Trader Mode
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-[#94A3B8]">
                        Sample XAU/USD data
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    toggleDemoMode();
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#080A0D] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <LogIn size={13} />
                  <span>Exit Demo &amp; Sign In</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                  Guest Trader
                </div>
                <button
                  onClick={() => {
                    onClose();
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#080A0D] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <LogIn size={13} />
                  <span>Sign In / Create Account</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Trading Sub-Account Selector */}
          <div
            className="p-3 rounded-xl border shadow-sm space-y-2"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <div className="flex items-center justify-between text-[11px] font-mono-num font-semibold">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                <Building2 size={13} className="text-amber-600 dark:text-[#E5B83B]" />
                Trading Sub-Account
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenAccountManager?.();
                }}
                className="text-[10px] text-amber-600 dark:text-[#E5B83B] hover:underline flex items-center gap-1"
              >
                <Settings2 size={11} />
                <span>Manage</span>
              </button>
            </div>

            {/* Current Active Account Header / Toggle Accordion */}
            <button
              onClick={() => setIsAccountsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all"
              style={{
                backgroundColor: 'var(--color-sidebar)',
                borderColor: 'var(--color-border-soft)',
              }}
            >
              {visibleAccounts.length === 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center text-xs">
                    <Plus size={12} />
                  </div>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
                    No Sub-Accounts
                  </div>
                </div>
              ) : isAggregate ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center shrink-0">
                    <Globe size={13} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
                      All Accounts Combined
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-[#E5B83B] font-mono-num">
                      Aggregate ({visibleAccounts.length})
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-black shrink-0 shadow-sm"
                    style={{ backgroundColor: activeAccount?.colorHex || '#C9A227' }}
                  >
                    {(activeAccount?.broker || 'EX').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
                      {activeAccount?.name || 'Primary Account'}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono-num">
                      <span className="text-amber-600 dark:text-[#E5B83B] capitalize font-medium">
                        {ACCOUNT_TYPE_LABELS[activeAccount?.accountType] || activeAccount?.accountType || 'Live'}
                      </span>
                      <span className="opacity-40">•</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ${(activeAccount?.initialBalance || 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <ChevronDown
                size={14}
                className={`transition-transform duration-200 shrink-0 ml-1 text-slate-400 ${
                  isAccountsExpanded ? 'rotate-180 text-amber-500' : ''
                }`}
              />
            </button>

            {/* Collapsible Sub-Accounts List */}
            {isAccountsExpanded && (
              <div
                className="p-1 rounded-lg border space-y-1 max-h-48 overflow-y-auto animate-fade-in"
                style={{
                  backgroundColor: 'var(--color-sidebar)',
                  borderColor: 'var(--color-border-soft)',
                }}
              >
                {/* Aggregate Option */}
                <button
                  onClick={() => {
                    setActiveAccountId('all');
                    setIsAccountsExpanded(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-all ${
                    isAggregate
                      ? 'bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-[#E5B83B]'
                      : 'hover:bg-black/5 dark:hover:bg-white/[0.04]'
                  }`}
                  style={!isAggregate ? { color: 'var(--color-text-main)' } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Globe size={13} className="text-amber-600 dark:text-[#E5B83B]" />
                    <span className="font-medium">🌐 All Accounts Combined</span>
                  </div>
                  {isAggregate && <Check size={13} className="text-amber-500 shrink-0" />}
                </button>

                {visibleAccounts.map((acc) => {
                  const isSelected = activeAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setActiveAccountId(acc.id);
                        setIsAccountsExpanded(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded text-left text-xs transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-[#E5B83B]'
                          : 'hover:bg-black/5 dark:hover:bg-white/[0.04]'
                      }`}
                      style={!isSelected ? { color: 'var(--color-text-main)' } : undefined}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-black shrink-0"
                          style={{ backgroundColor: acc.colorHex || '#C9A227' }}
                        >
                          {acc.broker.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{acc.name}</div>
                          <div className="text-[9px] font-mono-num opacity-70">
                            ${acc.initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={13} className="text-amber-500 shrink-0 ml-1" />}
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    setIsAccountsExpanded(false);
                    onClose();
                    onOpenAccountManager?.();
                  }}
                  className="w-full py-1.5 px-2 rounded text-[11px] font-medium text-amber-600 dark:text-[#E5B83B] hover:bg-amber-500/10 flex items-center justify-center gap-1 transition-colors mt-1"
                >
                  <Plus size={12} />
                  <span>Add New Sub-Account</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Navigation Links (Grouped Desks) */}
          <div className="space-y-3 pt-1">
            {navSections.map((section) => (
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
                        onClose();
                      }}
                      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-900 shadow-sm dark:bg-gradient-to-r dark:from-[#C9A227]/20 dark:via-[#C9A227]/10 dark:to-transparent dark:text-[#F3D371] dark:border-[#C9A227]/30'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#94A3B8] dark:hover:text-[#F1F3F5] dark:hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-amber-600 dark:bg-gradient-to-b dark:from-[#F3D371] dark:to-[#C9A227] shadow-[0_0_8px_rgba(201,162,39,0.5)]" />
                      )}
                      <Icon
                        size={17}
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
                        <span className="text-[10px] font-mono-num px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#151C25] dark:text-[#94A3B8] dark:border-white/[0.08]">
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
          </div>

          {/* 4. Theme Mode Toggle Bar Design (Under System & Edge) */}
          <div
            className="p-3 rounded-xl border shadow-sm space-y-2 pt-3"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <div className="text-[11px] font-mono-num font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <Sun size={13} className="text-amber-600 dark:text-[#E5B83B]" />
              <span>Theme Appearance</span>
            </div>

            {/* Segmented Toggle Bar */}
            <div
              className="grid grid-cols-3 p-1 rounded-xl border shadow-inner transition-colors duration-200 gap-1"
              style={{
                backgroundColor: 'var(--color-sidebar)',
                borderColor: 'var(--color-border-soft)',
              }}
              role="radiogroup"
              aria-label="Theme selection"
            >
              {THEME_OPTIONS.map(({ value, label, Icon }) => {
                const isActive = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    role="radio"
                    aria-checked={isActive}
                    className={`
                      flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
                      transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D] shadow-md shadow-[#C9A227]/30 font-bold scale-[1.02]'
                        : 'text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white'
                      }
                    `}
                    title={`Switch to ${label} Mode`}
                  >
                    <Icon size={14} className={isActive ? 'text-[#080A0D]' : ''} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div
          className="p-3 border-t text-xs shrink-0 flex items-center justify-between"
          style={{
            borderColor: 'var(--color-border-soft)',
            backgroundColor: 'var(--color-sidebar)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#94A3B8]">
            <Shield size={12} className="text-emerald-500" />
            <span>Supabase Cloud</span>
          </div>
          <span className="font-mono-num text-[10px] text-slate-400 dark:text-[#64748B]">v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
