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
        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14181D] hover:bg-[#1C2229] border border-[#262B33] hover:border-[#C9A227]/40 transition-all text-xs select-none"
      >
        {visibleAccounts.length === 0 ? (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-5 h-5 rounded-md bg-[#C9A227]/20 border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227]">
              <Plus size={12} />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold text-[#EDEAE3]">No Sub-Accounts</span>
              <span className="text-[10px] text-[#C9A227] font-mono">+ Add Account</span>
            </div>
          </div>
        ) : isAggregate ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#C9A227]/20 border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227]">
              <Globe size={12} />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold text-[#EDEAE3] flex items-center gap-1">
                All Accounts
                <span className="text-[10px] text-[#8B8D91] font-mono">({visibleAccounts.length})</span>
              </span>
              <span className="text-[10px] text-[#C9A227] font-mono font-medium">Aggregate View</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-black"
              style={{ backgroundColor: activeAccount?.colorHex || '#C9A227' }}
            >
              {(activeAccount?.broker || 'EX').substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold text-[#EDEAE3] max-w-[140px] truncate">
                {activeAccount?.name || 'Primary Account'}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-[#8B8D91]">
                <span className="capitalize text-[#C9A227] font-mono font-semibold">
                  {ACCOUNT_TYPE_LABELS[activeAccount?.accountType] || activeAccount?.accountType || 'Live'}
                </span>
                <span>•</span>
                <span className="font-mono text-[#D4AF37]">
                  ${(activeAccount?.initialBalance || 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        <ChevronDown
          size={14}
          className={`text-[#8B8D91] transition-transform duration-200 group-hover:text-[#EDEAE3] ${
            isOpen ? 'rotate-180 text-[#C9A227]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[#101418] border border-[#262B33] rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Menu Header */}
          <div className="p-3 border-b border-[#1E232B] flex items-center justify-between bg-[#14181D]/60">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8B8D91] uppercase tracking-wider">
              <Building2 size={12} className="text-[#C9A227]" />
              <span>Trading Sub-Accounts</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenManager?.();
              }}
              className="text-[10px] text-[#C9A227] hover:text-[#E6C65C] flex items-center gap-1 font-medium transition-colors"
            >
              <Settings2 size={11} />
              <span>Manage</span>
            </button>
          </div>

          {/* Accounts List */}
          <div className="p-1.5 max-h-64 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-[#262B33]">
            {/* All Accounts Option */}
            <button
              onClick={() => {
                setActiveAccountId('all');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition-all ${
                isAggregate
                  ? 'bg-[#C9A227]/15 border border-[#C9A227]/40 text-[#EDEAE3]'
                  : 'hover:bg-[#1A1F26] text-[#8B8D91] hover:text-[#EDEAE3]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#C9A227]/20 border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227]">
                  <Globe size={14} />
                </div>
                <div>
                  <div className="font-semibold text-xs text-[#EDEAE3] flex items-center gap-1">
                    🌐 All Accounts Combined
                  </div>
                  <div className="text-[10px] text-[#8B8D91]">
                    Aggregated portfolio stats ({visibleAccounts.length} accounts)
                  </div>
                </div>
              </div>
              {isAggregate && <Check size={14} className="text-[#C9A227]" />}
            </button>

            <div className="my-1 border-t border-[#1E232B]" />

            {visibleAccounts.length === 0 && (
              <div className="p-3 text-center text-xs text-[#8B8D91]">
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
                      ? 'bg-[#1C2229] border border-[#C9A227]/50 text-[#EDEAE3]'
                      : 'hover:bg-[#171C22] text-[#8B8D91] hover:text-[#EDEAE3]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                      style={{ backgroundColor: account.colorHex || '#C9A227' }}
                    >
                      {account.broker.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs text-[#EDEAE3] truncate flex items-center gap-1.5">
                        <span className="truncate">{account.name}</span>
                        {account.isDefault && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/30">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#8B8D91] mt-0.5 font-mono">
                        <span className="text-[#C9A227] capitalize">
                          {account.broker}
                        </span>
                        <span>•</span>
                        <span>{account.leverage}</span>
                        <span>•</span>
                        <span className="text-[#22C55E]">
                          ${account.initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check size={14} className="text-[#C9A227] flex-shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Quick Create Account Action */}
          <div className="p-2 border-t border-[#1E232B] bg-[#14181D]/60">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenManager?.();
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#C9A227]/10 hover:bg-[#C9A227]/20 border border-[#C9A227]/30 text-[#C9A227] text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
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
