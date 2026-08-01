import React, { useState, useEffect } from 'react';
import { X, LogIn, LogOut, UserCheck, Shield, Lock } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export function AuthModal({ isOpen, onClose }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  if (!isOpen) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase is running in offline mode. Configure VITE_SUPABASE_URL in environment to connect cloud backend.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg('Account created! Please check your inbox to confirm your email.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSuccessMsg('Signed in successfully!');
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    if (supabase) {
      await supabase.auth.signInWithOAuth({ provider });
    }
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setSession(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#131619] border border-[#262B30] rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E2226] pb-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#C9A227]" />
            <h3 className="text-base font-bold font-display text-[#EDEAE3]">
              {session ? 'Account Management' : isSignUp ? 'Create Journal Account' : 'Sign In to TradePulse'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#8B8D91] hover:text-[#EDEAE3] rounded">
            <X size={18} />
          </button>
        </div>

        {session ? (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-[#1F4A40]/40 border border-[#3FA88C] rounded-lg text-[#3FA88C] font-semibold flex items-center gap-2">
              <UserCheck size={16} /> Signed in as {session.user.email}
            </div>
            <p className="text-[#8B8D91] leading-relaxed">
              Your journal trades, lot size settings, and custom strategies are automatically synchronized across all devices using Supabase cloud backup with Row Level Security.
            </p>
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-lg bg-[#4A2A1E] hover:bg-[#C1502E] text-[#EDEAE3] font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-[#4A2A1E]/40 border border-[#5C3426] rounded-lg text-xs text-[#C1502E] font-semibold">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-[#1F4A40]/40 border border-[#3FA88C] rounded-lg text-xs text-[#3FA88C] font-semibold">
                {successMsg}
              </div>
            )}

            <div>
              <label className="text-[11px] uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@example.com"
                className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-xs text-[#EDEAE3] outline-none focus:border-[#C9A227]"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-xs text-[#EDEAE3] outline-none focus:border-[#C9A227]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <LogIn size={14} /> {isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            {isSupabaseConfigured && (
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                className="w-full py-2 rounded-lg bg-[#1B1F23] hover:bg-[#262B30] border border-[#262B30] text-[#EDEAE3] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Sign in with Google
              </button>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-[#8B8D91] hover:text-[#C9A227] underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
