import React, { useState, useEffect } from 'react';
import { Shield, Lock, LogIn, UserPlus, KeyRound, Mail, AlertTriangle, CheckCircle2, ArrowLeft, Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { useTrade } from '../context/TradeContext';
import { LogoIcon } from './LogoIcon';

export function AuthGate() {
  const { isPasswordRecovery, setIsPasswordRecovery, toggleDemoMode, refreshData } = useTrade();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'pending' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 60-second cooldown timer for resend email
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('reset');
    }
  }, [isPasswordRecovery]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        // Check if user session was immediately returned or email confirmation is required
        if (data?.user && !data?.session) {
          setMode('pending');
          setResendCooldown(60);
        } else {
          setSuccessMsg('Account created successfully! Logging you in...');
          await refreshData();
        }
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSuccessMsg('Signed in successfully!');
        await refreshData();
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMsg('Password reset link sent! Please check your email inbox.');
      } else if (mode === 'reset') {
        if (newPassword !== confirmPassword) {
          throw new Error('New password and confirmation password do not match.');
        }
        if (newPassword.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setSuccessMsg('Password updated successfully! You can now access your account.');
        setIsPasswordRecovery(false);
        setMode('signin');
        await refreshData();
      }
    } catch (err) {
      if (err.name === 'AuthRetryableFetchError' || err.message?.includes('rate limit')) {
        setErrorMsg('Email rate limit reached (SMTP limits). Please check your inbox or try again in a few minutes.');
      } else {
        setErrorMsg(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0 || !email) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setSuccessMsg('Confirmation email resent! Please check your inbox.');
      setResendCooldown(60);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend confirmation email.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    if (supabase) {
      try {
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: window.location.origin,
          },
        });
      } catch (err) {
        setErrorMsg(`OAuth Sign in failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 font-body select-none" style={{ background: 'var(--color-bg)', color: 'var(--color-text-main)' }}>
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#C9A227]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#3FA88C]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-2">
            <LogoIcon size={56} />
          </div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--color-text-main)' }}>TradePulse Gold</h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Institutional XAU/USD Trading Journal &amp; Analytics</p>
        </div>

        {/* Missing Supabase Env Guide Banner */}
        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 text-amber-600 dark:text-[#C9A227] font-bold">
              <AlertTriangle size={16} /> Cloud Database Configuration Needed
            </div>
            <p className="leading-relaxed" style={{ color: 'var(--color-text-main)' }}>
              To connect your secure Supabase database, define your credentials in <code>.env.local</code>:
            </p>
            <div className="p-2.5 rounded font-mono text-[11px] text-amber-600 dark:text-[#C9A227]" style={{ background: 'var(--color-elevated)' }}>
              VITE_SUPABASE_URL=https://your-project.supabase.co<br />
              VITE_SUPABASE_ANON_KEY=your-anon-key
            </div>
          </div>
        )}

        {/* Main Auth Card */}
        <div className="terminal-card rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 backdrop-blur-md">
          {/* Navigation / Mode Switch */}
          {mode !== 'reset' && mode !== 'pending' && (
            <div className="flex p-1 rounded-xl border text-xs font-semibold" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
              <button
                onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  mode === 'signin' ? 'bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] font-bold shadow' : 'hover:opacity-80'
                }`}
                style={{ color: mode === 'signin' ? '#080A0D' : 'var(--color-text-muted)' }}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  mode === 'signup' ? 'bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] font-bold shadow' : 'hover:opacity-80'
                }`}
                style={{ color: mode === 'signup' ? '#080A0D' : 'var(--color-text-muted)' }}
              >
                Create Account
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'pending' ? (
            /* EMAIL CONFIRMATION PENDING VIEW */
            <div className="space-y-5 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Mail size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--color-text-main)' }}>Check Your Email</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  We sent a confirmation link to <strong style={{ color: 'var(--color-text-main)' }}>{email}</strong>. Please click the link in your inbox to confirm your account.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  disabled={loading || resendCooldown > 0}
                  onClick={handleResendConfirmation}
                  className="w-full py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  {resendCooldown > 0 ? `Resend Email (${resendCooldown}s)` : 'Resend Confirmation Email'}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                  className="text-xs hover:text-amber-600 dark:hover:text-[#C9A227] flex items-center justify-center gap-1 mx-auto"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <ArrowLeft size={13} /> Back to Sign In
                </button>
              </div>
            </div>
          ) : mode === 'reset' ? (
            /* RESET PASSWORD VIEW */
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--color-border-soft)' }}>
                <KeyRound size={18} className="text-amber-600 dark:text-[#C9A227]" />
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>Set New Password</h3>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                  New Password (min 8 chars)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2.5 rounded-lg text-xs terminal-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80"
                    style={{ color: 'var(--color-text-muted)' }}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2.5 rounded-lg text-xs terminal-input"
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[10px] text-rose-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md"
              >
                <CheckCircle2 size={14} /> Update Password
              </button>
            </form>
          ) : mode === 'forgot' ? (
            /* FORGOT PASSWORD VIEW */
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--color-border-soft)' }}>
                <KeyRound size={18} className="text-amber-600 dark:text-[#C9A227]" />
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>Reset Account Password</h3>
              </div>

              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Enter your registered email address and we will send you a password reset link.
              </p>

              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@example.com"
                  className="w-full px-3 py-2.5 rounded-lg text-xs terminal-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md"
              >
                <Mail size={14} /> Send Reset Link
              </button>

              <button
                type="button"
                onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                className="text-xs hover:text-amber-600 dark:hover:text-[#C9A227] flex items-center justify-center gap-1 mx-auto pt-2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <ArrowLeft size={13} /> Back to Sign In
              </button>
            </form>
          ) : (
            /* SIGN IN & SIGN UP FORMS */
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="text-[11px] uppercase font-bold tracking-wider block mb-1" style={{ color: 'var(--color-text-dim)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@example.com"
                  className="w-full px-3 py-2.5 rounded-lg text-xs terminal-input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] uppercase font-bold tracking-wider block" style={{ color: 'var(--color-text-dim)' }}>
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setErrorMsg(null); setSuccessMsg(null); }}
                      className="text-[11px] text-amber-600 dark:text-[#C9A227] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2.5 rounded-lg text-xs terminal-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md"
              >
                {mode === 'signup' ? <UserPlus size={14} /> : <LogIn size={14} />}
                {mode === 'signup' ? 'Create Secure Account' : 'Sign In to Journal'}
              </button>

              {isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  className="w-full py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors hover:opacity-80"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
                >
                  Sign in with Google
                </button>
              )}
            </form>
          )}

          {/* Demo Mode Action */}
          <div className="pt-3 border-t text-center space-y-2" style={{ borderColor: 'var(--color-border-soft)' }}>
            <button
              type="button"
              onClick={toggleDemoMode}
              className="text-xs font-semibold text-amber-600 dark:text-[#C9A227] hover:brightness-110 flex items-center justify-center gap-1.5 mx-auto"
            >
              <Sparkles size={13} /> Preview Demo Account (Read Only)
            </button>
          </div>
        </div>

        {/* Security Assurances */}
        <div className="space-y-2 text-center text-[11px] text-[#8B8D91]">
          <div className="flex items-center justify-center gap-1.5 text-[#3FA88C]">
            <Shield size={13} /> Protected by Supabase Row-Level Security (RLS)
          </div>
          <p className="text-[#5A5D61] px-4 leading-relaxed">
            Your trades are strictly isolated to your authenticated account. TLS 256-bit encrypted data in transit and at rest.
          </p>
        </div>
      </div>
    </div>
  );
}
