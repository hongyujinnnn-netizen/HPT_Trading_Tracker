import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Globe,
  ChevronDown,
  Plus,
  Settings2,
  Check,
  Building2,
  Layers,
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { ACCOUNT_TYPE_LABELS } from '../types/accountSchema';

export function AccountSelector({ onOpenManager }) {
  const {
    tradingAccounts,
    activeAccountId,
    setActiveAccountId,
    activeAccount,
  } = useTrade();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);
  const isAggregate = activeAccountId === 'all';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Account Selector Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:border-amber-500/40 transition-all text-xs select-none shadow-sm"
        style={{
          background: 'var(--color-elevated)',
          borderColor: 'var(--color-border-soft)',
          color: 'var(--color-text-main)',
        }}
      >
        {visibleAccounts.length === 0 ? (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center">
              <Plus size={12} />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>No Sub-Accounts</span>
              <span className="text-[10px] text-amber-500 font-mono">+ Add Account</span>
            </div>
          </div>
        ) : isAggregate ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center">
              <Globe size={12} />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold flex items-center gap-1" style={{ color: 'var(--color-text-main)' }}>
                All Accounts
                <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-dim)' }}>({visibleAccounts.length})</span>
              </span>
              <span className="text-[10px] text-amber-500 font-mono font-medium">Aggregate View</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-black shadow-sm"
              style={{ backgroundColor: activeAccount?.colorHex || '#C9A227' }}
            >
              {(activeAccount?.broker || 'EX').substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold max-w-[140px] truncate" style={{ color: 'var(--color-text-main)' }}>
                {activeAccount?.name || 'Primary Account'}
              </span>
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                <span className="capitalize text-amber-500 font-mono font-semibold">
                  {ACCOUNT_TYPE_LABELS[activeAccount?.accountType] || activeAccount?.accountType || 'Live'}
                </span>
                <span>•</span>
                <span className="font-mono text-amber-600 dark:text-[#D4AF37]">
                  ${(activeAccount?.initialBalance || 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-500' : 'opacity-60 group-hover:opacity-100'
          }`}
          style={{ color: 'var(--color-text-muted)' }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 border rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border-dark)',
          }}
        >
          {/* Menu Header */}
          <div
            className="p-3 border-b flex items-center justify-between"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              <Building2 size={12} className="text-amber-500" />
              <span>Trading Sub-Accounts</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenManager?.();
              }}
              className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 font-medium transition-colors"
            >
              <Settings2 size={11} />
              <span>Manage</span>
            </button>
          </div>

          {/* Accounts List */}
          <div className="p-1.5 max-h-64 overflow-y-auto space-y-1">
            {/* All Accounts Option */}
            <button
              onClick={() => {
                setActiveAccountId('all');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition-all ${
                isAggregate
                  ? 'bg-amber-500/15 border border-amber-500/40'
                  : 'hover:bg-black/10 dark:hover:bg-white/[0.04]'
              }`}
              style={{ color: 'var(--color-text-main)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center">
                  <Globe size={14} />
                </div>
                <div>
                  <div className="font-semibold text-xs flex items-center gap-1" style={{ color: 'var(--color-text-main)' }}>
                    🌐 All Accounts Combined
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    Aggregated portfolio stats ({visibleAccounts.length} accounts)
                  </div>
                </div>
              </div>
              {isAggregate && <Check size={14} className="text-amber-500" />}
            </button>

            <div className="my-1 border-t" style={{ borderColor: 'var(--color-border-soft)' }} />

            {visibleAccounts.length === 0 && (
              <div className="p-3 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No trading sub-accounts found. Click below to add your first account.
              </div>
            )}

            {/* Individual Sub-Accounts */}
            {visibleAccounts.map((account) => {
              const isSelected = activeAccountId === account.id;
              return (
                <button
                  key={account.id}
                  onClick={() => {
                    setActiveAccountId(account.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/40'
                      : 'hover:bg-black/10 dark:hover:bg-white/[0.04]'
                  }`}
                  style={{ color: 'var(--color-text-main)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: account.colorHex || '#C9A227' }}
                    >
                      {account.broker.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate flex items-center gap-1.5" style={{ color: 'var(--color-text-main)' }}>
                        <span className="truncate">{account.name}</span>
                        {account.isDefault && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/15 text-amber-600 border border-amber-500/30 font-semibold">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="text-amber-500 capitalize font-medium">
                          {account.broker}
                        </span>
                        <span>•</span>
                        <span>{account.leverage}</span>
                        <span>•</span>
                        <span className="text-emerald-500 font-semibold">
                          ${account.initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check size={14} className="text-amber-500 flex-shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Quick Create Account Action */}
          <div
            className="p-2 border-t"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenManager?.();
              }}
              className="w-full py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={13} />
              <span>Create Trading Sub-Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
