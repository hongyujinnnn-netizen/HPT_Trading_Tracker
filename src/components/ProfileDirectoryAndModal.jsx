import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus,
  Edit3,
  Trash2,
  Check,
  Camera,
  X,
  Tag,
  Plus,
  MapPin,
  Clock,
  Compass,
  Sliders,
  Award,
  Copy,
  Users,
  Sparkles,
  Lock,
  Shield,
} from 'lucide-react';
import { Pill } from './Pill';
import {
  PROFILE_ROLE_TAGS,
  PROFILE_TRADING_STYLES,
  PROFILE_RISK_MANDATES,
  PROFILE_SESSIONS,
  PROFILE_EXPERIENCE_LEVELS,
} from '../types/profileSchema';
import { computeProfileFingerprint, encryptProfileField } from '../utils/profileCrypto';

const SUGGESTED_TAGS = [
  'XAU/USD',
  'London Session',
  'NY Overlap',
  'ICT / SMC',
  'Liquidity Sweep',
  'Order Blocks',
  'Price Action',
  'Prop Funded',
  'Strict 1:2+ R:R',
];

/**
 * Compresses an uploaded image file to a clean 256x256 JPEG data URL
 * so it stores reliably in `public.profiles.image_profile` and localStorage.
 */
function compressAvatarImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfileFormModal({
  isOpen,
  mode = 'edit', // 'add' | 'edit'
  initialProfile,
  userId,
  tradingAccounts = [],
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    name: '',
    handle: '',
    imageProfile: '',
    tag: PROFILE_ROLE_TAGS[0],
    tags: ['XAU/USD', 'London Session', 'ICT / SMC'],
    tradingStyle: PROFILE_TRADING_STYLES[0],
    riskProfile: PROFILE_RISK_MANDATES[1],
    preferredSession: PROFILE_SESSIONS[0],
    location: 'Global Trading Desk',
    experienceLevel: PROFILE_EXPERIENCE_LEVELS[1],
    motto: 'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
    bio: '',
    linkedAccountId: 'all',
  });
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialProfile) {
      setForm({
        name: initialProfile.name || '',
        handle: initialProfile.handle || '@xautrader',
        imageProfile: initialProfile.imageProfile || '',
        tag: initialProfile.tag || PROFILE_ROLE_TAGS[0],
        tags: Array.isArray(initialProfile.tags) ? [...initialProfile.tags] : ['XAU/USD', 'London Session'],
        tradingStyle: initialProfile.tradingStyle || PROFILE_TRADING_STYLES[0],
        riskProfile: initialProfile.riskProfile || PROFILE_RISK_MANDATES[1],
        preferredSession: initialProfile.preferredSession || PROFILE_SESSIONS[0],
        location: initialProfile.location || 'Global Trading Desk',
        experienceLevel: initialProfile.experienceLevel || PROFILE_EXPERIENCE_LEVELS[1],
        motto:
          initialProfile.motto ||
          'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
        bio: initialProfile.bio || '',
        linkedAccountId: initialProfile.linkedAccountId || 'all',
      });
    } else {
      setForm({
        name: '',
        handle: '',
        imageProfile: '',
        tag: PROFILE_ROLE_TAGS[0],
        tags: ['XAU/USD', 'London Session', 'ICT / SMC'],
        tradingStyle: PROFILE_TRADING_STYLES[0],
        riskProfile: PROFILE_RISK_MANDATES[1],
        preferredSession: PROFILE_SESSIONS[0],
        location: 'Global Trading Desk',
        experienceLevel: PROFILE_EXPERIENCE_LEVELS[1],
        motto: 'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
        bio: '',
        linkedAccountId: 'all',
      });
    }
    setTagInput('');
  }, [isOpen, mode, initialProfile]);

  if (!isOpen) return null;

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAvatarImage(file);
      setForm((prev) => ({ ...prev, imageProfile: dataUrl }));
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setForm((prev) => ({ ...prev, imageProfile: ev.target?.result || '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = (rawTag) => {
    const cleaned = String(rawTag || tagInput).trim().replace(/^#/, '').slice(0, 24);
    if (!cleaned) return;
    if (!form.tags.includes(cleaned) && form.tags.length < 8) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, cleaned] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (target) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== target),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      const cleanName = form.name.trim().slice(0, 40);
      const rawHandle = (form.handle || `@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}`).trim();
      await onSave({
        ...form,
        name: cleanName,
        handle: rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'add' ? 'Add New Trader Profile' : 'Edit Trader Profile'}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop-glass overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="terminal-card modal-card-pop w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border my-auto"
        style={{ borderColor: 'var(--color-border-soft)' }}
      >
          {/* Modal Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-[#C9A227]">
              <Lock size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
                  Edit Encrypted Trader Profile
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-num font-bold bg-emerald-500/10 text-emerald-600 dark:text-[#3FA88C] border border-emerald-500/25">
                  1 User : 1 Profile
                </span>
              </div>
              <p className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>
                user_id: {userId ? `${userId.slice(0, 12)}…` : 'local_desk'} · AES-256 Field Encryption Active
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs max-h-[82vh] overflow-y-auto">
          {/* Avatar Upload & Primary Identity Row */}
          <div
            className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <div className="relative shrink-0">
              {form.imageProfile ? (
                <img
                  src={form.imageProfile}
                  alt={form.name || 'Profile avatar'}
                  className="w-20 h-20 rounded-2xl object-cover border border-amber-400/40 shadow-md"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold font-display text-[#080A0D] border border-amber-400/40 shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, #F3D371 0%, #C9A227 55%, #8A7332 100%)',
                  }}
                >
                  {(form.name || 'T').charAt(0).toUpperCase()}
                </div>
              )}

              <label
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#080A0D] flex items-center justify-center cursor-pointer shadow-md transition-colors"
                title="Upload profile image"
              >
                <Camera size={14} />
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <div className="flex-1 min-w-0 space-y-2 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 rounded-lg border font-semibold inline-flex items-center gap-1.5 hover:opacity-85 transition-opacity" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}>
                  <Camera size={13} className="text-amber-500 dark:text-[#C9A227]" />
                  <span>Upload Image Profile</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>

                {form.imageProfile && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, imageProfile: '' }))}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-semibold"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                Supports PNG, JPG, or WebP. Automatically optimized for your Trader Passport, Sidebar, and Share Card.
              </p>
            </div>
          </div>

          {/* Name, Handle & Primary Role Tag */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Trader Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Hongna Cap / London Desk"
                className="w-full px-3 py-2 rounded-lg terminal-input"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Handle (@username)
              </label>
              <input
                type="text"
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
                placeholder="@hongnacap2022"
                className="w-full px-3 py-2 rounded-lg font-mono-num terminal-input"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Primary Role Tag
              </label>
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                className="w-full px-3 py-2 rounded-lg terminal-select"
              >
                {PROFILE_ROLE_TAGS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Tags Builder */}
          <div
            className="p-3.5 rounded-xl border space-y-2.5"
            style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
          >
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase font-bold tracking-wider flex items-center gap-1.5" style={{ color: 'var(--color-text-dim)' }}>
                <Tag size={12} className="text-amber-500 dark:text-[#C9A227]" />
                Profile Tags ({form.tags.length}/8)
              </label>
              <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                Click × to remove or add custom desk tags
              </span>
            </div>

            {/* Active Tag Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono-num font-semibold bg-amber-500/10 text-amber-700 dark:text-[#E5B83B] border border-amber-500/30"
                >
                  <span>#{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-500 ml-0.5"
                    aria-label={`Remove tag ${t}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            {/* Tag Input + Quick Suggestions */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add custom tag (e.g. FTMO Funded, M15 Scalper)..."
                className="flex-1 px-3 py-1.5 rounded-lg terminal-input text-xs"
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                className="px-3 py-1.5 rounded-lg border font-semibold inline-flex items-center gap-1 hover:opacity-85"
                style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
              >
                <Plus size={12} /> Add Tag
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[10px] mr-1" style={{ color: 'var(--color-text-dim)' }}>Suggested:</span>
              {SUGGESTED_TAGS.filter((s) => !form.tags.includes(s)).slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleAddTag(s)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono-num border hover:border-amber-500/40 transition-colors"
                  style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Style, Risk Mandate, Session & Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Trading Style
              </label>
              <select
                value={form.tradingStyle}
                onChange={(e) => setForm({ ...form, tradingStyle: e.target.value })}
                className="w-full px-3 py-2 rounded-lg terminal-select"
              >
                {PROFILE_TRADING_STYLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Risk Mandate
              </label>
              <select
                value={form.riskProfile}
                onChange={(e) => setForm({ ...form, riskProfile: e.target.value })}
                className="w-full px-3 py-2 rounded-lg terminal-select"
              >
                {PROFILE_RISK_MANDATES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Preferred Session
              </label>
              <select
                value={form.preferredSession}
                onChange={(e) => setForm({ ...form, preferredSession: e.target.value })}
                className="w-full px-3 py-2 rounded-lg terminal-select"
              >
                {PROFILE_SESSIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Experience Tier
              </label>
              <select
                value={form.experienceLevel}
                onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
                className="w-full px-3 py-2 rounded-lg terminal-select"
              >
                {PROFILE_EXPERIENCE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Desk Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Phnom Penh, KH / London, UK"
                className="w-full px-3 py-2 rounded-lg terminal-input"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                Linked Sub-Account
              </label>
              <select
                value={form.linkedAccountId}
                onChange={(e) => setForm({ ...form, linkedAccountId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg terminal-select"
              >
                <option value="all">All Trading Accounts</option>
                {tradingAccounts
                  .filter((a) => !a.isArchived)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.broker})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Motto */}
          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
              Desk Rule #1 / Motto
            </label>
            <input
              type="text"
              value={form.motto}
              onChange={(e) => setForm({ ...form, motto: e.target.value })}
              placeholder="Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline."
              className="w-full px-3 py-2 rounded-lg terminal-input"
            />
          </div>

          {/* End-to-End Encryption Verification Banner */}
          <div
            className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-[#3FA88C]">
                <Shield size={13} /> End-to-End Profile Encryption (1 User : 1 Profile Lock)
              </span>
              <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-[#3FA88C] font-semibold">
                HASH #{computeProfileFingerprint(form, userId || 'local_single_user')}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              All profile fields (name, handle, avatar image, tags, style, risk mandate, session, and motto) are encrypted with a 256-bit user-bound key (<code className="font-mono-num text-[10px]">enc:tp256:v1:…</code>) before storage in Supabase &amp; local vault.
            </p>
            <div className="text-[10px] font-mono-num truncate opacity-75" style={{ color: 'var(--color-text-dim)' }}>
              Cipher Preview: {encryptProfileField(form.name || 'Gold Trader', userId || 'local_single_user').slice(0, 68)}…
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t flex items-center justify-end gap-2.5" style={{ borderColor: 'var(--color-border-soft)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border font-semibold"
              style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold shadow-md disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Lock size={13} />
              {isSaving ? 'Encrypting & Saving…' : 'Encrypt & Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export function ProfileDirectoryTable({
  profiles = [],
  activeProfileId,
  userId,
  onSelectProfile,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteProfile,
}) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (val) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedId(val);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="terminal-card overflow-hidden">
      {/* Header Bar */}
      <div
        className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ borderColor: 'var(--color-border-soft)' }}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-amber-500 dark:text-[#C9A227]" />
            <h3 className="text-sm font-bold font-display uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
              Trader Profiles Table (`public.profiles`)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-num font-bold bg-amber-500/10 text-amber-600 dark:text-[#C9A227] border border-amber-500/25">
              {profiles.length} {profiles.length === 1 ? 'Profile' : 'Profiles'}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Manage multiple trader identities, avatar images, role tags, and desk mandates linked to your account.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <UserPlus size={14} /> Add New Profile
        </button>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead
            className="border-b uppercase tracking-wider font-semibold text-[10px] font-mono-num"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
              color: 'var(--color-text-dim)',
            }}
          >
            <tr>
              <th className="px-4 py-3">ID User / Profile</th>
              <th className="px-4 py-3">Image &amp; Name</th>
              <th className="px-4 py-3">Role Tag &amp; Skill Tags</th>
              <th className="px-4 py-3">Style &amp; Risk Mandate</th>
              <th className="px-4 py-3">Session &amp; Desk</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--color-border-soft)' }}>
            {profiles.map((prof) => {
              const isCurrent = prof.id === activeProfileId || (profiles.length === 1);
              const displayUid = prof.userId || userId || 'local_user';
              return (
                <tr
                  key={prof.id}
                  className={`transition-colors ${
                    isCurrent
                      ? 'bg-amber-500/[0.04] dark:bg-[#C9A227]/[0.05]'
                      : 'hover:bg-slate-100/50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  {/* 1. ID User & Profile ID */}
                  <td className="px-4 py-3.5 font-mono-num whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-main)' }}>
                        UID: {String(displayUid).slice(0, 8)}…
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(displayUid)}
                        className="p-1 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-500"
                        title="Copy User ID"
                      >
                        {copiedId === displayUid ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                      PID: {String(prof.id).slice(0, 10)}
                    </div>
                  </td>

                  {/* 2. Image Profile + Name + Handle */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-[180px]">
                      {prof.imageProfile ? (
                        <img
                          src={prof.imageProfile}
                          alt={prof.name}
                          className="w-10 h-10 rounded-xl object-cover border border-amber-400/40 shrink-0 shadow-sm"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-display text-[#080A0D] shrink-0 border border-amber-400/40"
                          style={{
                            background: 'linear-gradient(135deg, #F3D371 0%, #C9A227 60%, #8A7332 100%)',
                          }}
                        >
                          {(prof.name || 'T').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold font-display truncate" style={{ color: 'var(--color-text-main)' }}>
                            {prof.name}
                          </span>
                          {isCurrent && (
                            <Pill tone="profit" className="text-[9px] px-1.5 py-0">
                              ACTIVE
                            </Pill>
                          )}
                        </div>
                        <div className="text-[11px] font-mono-num truncate" style={{ color: 'var(--color-text-dim)' }}>
                          {prof.handle}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 3. Tag & Tags */}
                  <td className="px-4 py-3.5">
                    <div className="space-y-1.5 min-w-[200px]">
                      <div>
                        <Pill tone="gold">{prof.tag || 'XAU/USD Specialist'}</Pill>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(prof.tags || []).slice(0, 4).map((tg) => (
                          <span
                            key={tg}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono-num border"
                            style={{
                              background: 'var(--color-elevated)',
                              borderColor: 'var(--color-border-soft)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            #{tg}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* 4. Trading Style & Risk Mandate */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="font-semibold" style={{ color: 'var(--color-text-main)' }}>
                      {prof.tradingStyle}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {prof.riskProfile}
                    </div>
                  </td>

                  {/* 5. Preferred Session & Location */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-main)' }}>
                      <Clock size={11} className="text-amber-500 dark:text-[#C9A227]" />
                      <span>{prof.preferredSession || 'London & NY'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                      <MapPin size={10} />
                      <span>{prof.location || 'Global Desk'} · {prof.experienceLevel || 'Intermediate'}</span>
                    </div>
                  </td>

                  {/* 6. Actions */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => onSelectProfile(prof.id)}
                          className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold hover:border-amber-500/40 transition-colors"
                          style={{
                            background: 'var(--color-elevated)',
                            borderColor: 'var(--color-border-soft)',
                            color: 'var(--color-text-main)',
                          }}
                        >
                          Use Profile
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenEditModal(prof)}
                        className="px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 text-amber-600 dark:text-[#E5B83B] border-amber-500/30 hover:bg-amber-500/10 transition-colors"
                        title="Edit Profile"
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                      {profiles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteProfile(prof.id)}
                          className="p-1.5 rounded-lg text-rose-500/80 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete Profile"
                          aria-label={`Delete profile ${prof.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
