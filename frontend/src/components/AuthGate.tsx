'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { 
  Radio, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  Calendar,
  CheckCircle,
  Layers,
  Sparkles,
  KeyRound,
  UserPlus,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading, isSessionExpired, login, register, resetPassword, clearSessionExpired } = useAuth();
  
  // Section toggle: 'LOGIN' (Section 1) | 'REGISTER' (Section 2) | 'FORGOT_PASSWORD' (Section 3)
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD'>('LOGIN');

  // Section 1: Sign In form fields
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Section 2: Create Account form fields
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Section 3: Reset / Create New Password form fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPasswordError, setIsPasswordError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear messages when tab changes
  useEffect(() => {
    setErrorMessage(null);
    setIsPasswordError(false);
  }, [activeTab]);

  // Loading state while checking localStorage session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex flex-col items-center justify-center text-white p-4">
        <div className="relative w-16 h-16 rounded-2xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse mb-4">
          <Radio className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
        <p className="text-xs font-mono font-bold tracking-widest text-cyan-300 uppercase">
          Initializing Terminal Engine...
        </p>
      </div>
    );
  }

  // If user is authenticated, unlock full dashboard!
  if (isAuthenticated && user) {
    return <>{children}</>;
  }

  // Section 1: Sign In submission handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPasswordError(false);
    setSuccessMessage(null);

    if (!loginEmail.trim() || !loginEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await login(loginName, loginEmail, loginPassword);
      if (res.success) {
        clearSessionExpired();
        setSuccessMessage('Access granted! Unlocking terminal...');
      } else {
        const errText = res.error || 'Password incorrect. Wrong password! If you forgot your password, please create a new password or create a new account again.';
        setErrorMessage(errText);
        // Identify password-specific error to highlight recovery options
        if (errText.toLowerCase().includes('password') || errText.toLowerCase().includes('incorrect') || errText.toLowerCase().includes('wrong')) {
          setIsPasswordError(true);
        }
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Section 2: Create Account submission handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPasswordError(false);
    setSuccessMessage(null);

    if (!regName.trim() || regName.trim().length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return;
    }

    const ageNum = parseInt(regAge, 10);
    if (isNaN(ageNum) || ageNum < 18) {
      setErrorMessage('Trading requirements: You must be at least 18 years of age.');
      return;
    }
    if (ageNum > 120) {
      setErrorMessage('Please enter a valid age.');
      return;
    }

    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password must contain at least 6 characters.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please check the box to confirm you acknowledge trading risks.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await register(regName, ageNum, regEmail, regPassword);
      if (res.success) {
        clearSessionExpired();
        setSuccessMessage('Account created successfully! Entering terminal...');
      } else {
        setErrorMessage(res.error || 'Failed to create account. Email may already be registered.');
      }
    } catch {
      setErrorMessage('Registration error. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Section 3: Reset / Create New Password submission handler
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPasswordError(false);
    setSuccessMessage(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (resetNewPassword.length < 6) {
      setErrorMessage('New password must contain at least 6 characters.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter identical passwords.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await resetPassword(resetEmail, resetNewPassword);
      if (res.success) {
        clearSessionExpired();
        setSuccessMessage(res.message || 'Password updated successfully! Entering terminal...');
      } else {
        setErrorMessage(res.error || 'Unable to update password. Please create a new account again.');
      }
    } catch {
      setErrorMessage('Failed to reset password. Please try creating a new account again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] relative flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 select-none overflow-x-hidden">
      
      {/* Laser Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 via-blue-500 to-transparent shadow-[0_0_15px_rgba(6,182,212,0.9)]" />

      {/* Ambient Neon Atmosphere Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Gatekeeper Card */}
      <div className="w-full max-w-xl glass-panel rounded-3xl border border-slate-800/90 shadow-[0_10px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-6 sm:p-8 lg:p-10 relative z-10 transition-all">
        
        {/* Holographic Header */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-950 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.35)] mb-3 group">
            <Radio className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-700/50 text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-300 mb-2">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Terminal Access Gate</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            PRILLS<span className="text-cyan-400">.AI</span> TRADING TERMINAL
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md">
            Please authenticate or create your trader account to unlock real-time binary algorithmic signals, OTC streams &amp; telemetry.
          </p>
        </div>

        {/* 2-HOUR SECURITY SESSION TIMEOUT BANNER */}
        {isSessionExpired && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 to-orange-950/50 border border-amber-500/60 text-amber-200 shadow-lg shadow-amber-950/40 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-900/60 border border-amber-600/60 text-amber-300 shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                    2-Hour Security Session Expired
                  </h4>
                  <span className="text-[10px] font-mono font-bold bg-amber-900/80 text-amber-200 px-2 py-0.5 rounded-full border border-amber-700/60">
                    2H TIMEOUT
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  For your account security, trading sessions automatically expire every <strong>2 hours</strong>. Please re-enter your credentials below to resume terminal access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/90 rounded-2xl border border-slate-800 mb-6 gap-1 shadow-inner">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => {
              setActiveTab('LOGIN');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'LOGIN' || activeTab === 'FORGOT_PASSWORD'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/30 border border-cyan-400/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            suppressHydrationWarning
            onClick={() => {
              setActiveTab('REGISTER');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'REGISTER'
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-900/30 border border-emerald-400/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Create Account</span>
          </button>
        </div>

        {/* DEDICATED WRONG PASSWORD / PASSWORD INCORRECT ALERT BANNER */}
        {isPasswordError && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-rose-950/70 to-red-950/50 border border-rose-500/70 text-rose-200 shadow-lg shadow-rose-950/40 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-900/60 border border-rose-600/60 text-rose-300 shrink-0 mt-0.5">
                <Lock className="w-5 h-5 text-rose-400 animate-pulse" />
              </div>
              <div className="space-y-2 flex-1">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <span>Password Incorrect / Wrong Password</span>
                  </h4>
                  <p className="text-[11px] text-rose-200/90 leading-relaxed mt-1">
                    The password you entered is incorrect. If you forgot your password, please <strong>create a new password</strong> or <strong>create a new account again</strong>.
                  </p>
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => {
                      setResetEmail(loginEmail);
                      setActiveTab('FORGOT_PASSWORD');
                      setErrorMessage(null);
                      setIsPasswordError(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/70 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Create New Password</span>
                  </button>

                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => {
                      setRegEmail(loginEmail);
                      setRegName(loginName);
                      setActiveTab('REGISTER');
                      setErrorMessage(null);
                      setIsPasswordError(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                    <span>Create New Account Again</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Standard Alert Feedback Messages */}
        {errorMessage && !isPasswordError && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* SECTION 1: SIGN IN FORM */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* Field 1: User's Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Your Name</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  suppressHydrationWarning
                  autoComplete="name"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
            </div>

            {/* Field 2: Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Email Address <span className="text-cyan-400">*</span></span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  suppressHydrationWarning
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="trader@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
            </div>

            {/* Field 3: Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Password <span className="text-cyan-400">*</span></span>
                </label>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => {
                    setResetEmail(loginEmail);
                    setActiveTab('FORGOT_PASSWORD');
                    setErrorMessage(null);
                    setIsPasswordError(false);
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  suppressHydrationWarning
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Options Bar: Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  suppressHydrationWarning
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <span>Remember this terminal session</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              suppressHydrationWarning
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-900/30 border border-cyan-400/50 hover:border-cyan-300 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating Credentials...</span>
                </>
              ) : (
                <>
                  <span>Enter Trading Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Switch Section Prompt */}
            <div className="text-center pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-center gap-2">
              <span>New trader on PRILLS.AI?</span>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setActiveTab('REGISTER');
                  setErrorMessage(null);
                  setIsPasswordError(false);
                }}
                className="font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer"
              >
                Create your account here &rarr;
              </button>
            </div>
          </form>
        )}

        {/* SECTION 2: CREATE ACCOUNT FORM */}
        {activeTab === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Field 1: Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Full Name <span className="text-emerald-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  suppressHydrationWarning
                  autoComplete="name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>

              {/* Field 2: Trader Age */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Age (18+) <span className="text-emerald-400">*</span></span>
                </label>
                <input
                  type="number"
                  required
                  min="18"
                  max="120"
                  suppressHydrationWarning
                  value={regAge}
                  onChange={(e) => setRegAge(e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all font-mono"
                />
              </div>
            </div>

            {/* Field 3: Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>Email Address <span className="text-emerald-400">*</span></span>
              </label>
              <input
                type="email"
                required
                suppressHydrationWarning
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="trader@domain.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Field 4: Create Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Password (min 6) <span className="text-emerald-400">*</span></span>
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    suppressHydrationWarning
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                  />
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 5: Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Confirm Password <span className="text-emerald-400">*</span></span>
                </label>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  suppressHydrationWarning
                  autoComplete="new-password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            {/* Terms and Risk Agreement */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  required
                  suppressHydrationWarning
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
                />
                <span className="leading-tight">
                  I confirm I am 18+ years of age, accept institutional terms, and understand that algorithmic binary trading carries capital risk.
                </span>
              </label>
            </div>

            {/* Create Account Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              suppressHydrationWarning
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-900/30 border border-emerald-400/50 hover:border-emerald-300 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Registering Account Profile...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Create Account &amp; Enter Dashboard</span>
                </>
              )}
            </button>

            {/* Switch Section Prompt */}
            <div className="text-center pt-3 border-t border-slate-800/80 text-xs text-slate-400">
              <span>Already registered on PRILLS.AI? </span>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setActiveTab('LOGIN');
                  setErrorMessage(null);
                  setIsPasswordError(false);
                }}
                className="font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 cursor-pointer"
              >
                Sign In to your terminal here &rarr;
              </button>
            </div>
          </form>
        )}

        {/* SECTION 3: CREATE NEW PASSWORD (FORGOT PASSWORD FLOW) */}
        {activeTab === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            
            <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/50 text-cyan-200 text-xs flex items-start gap-2.5 mb-2">
              <KeyRound className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-cyan-300">Set / Create New Password</p>
                <p className="text-[11px] text-cyan-200/90 leading-relaxed">
                  Enter your registered email address and your new password below. You can also create a new account again if preferred.
                </p>
              </div>
            </div>

            {/* Field 1: Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Registered Email Address <span className="text-cyan-400">*</span></span>
              </label>
              <input
                type="email"
                required
                suppressHydrationWarning
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="trader@domain.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>

            {/* Field 2: New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>New Password (min 6 characters) <span className="text-cyan-400">*</span></span>
              </label>
              <div className="relative">
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  suppressHydrationWarning
                  autoComplete="new-password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Field 3: Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Confirm New Password <span className="text-cyan-400">*</span></span>
              </label>
              <input
                type={showResetPassword ? 'text' : 'password'}
                required
                minLength={6}
                suppressHydrationWarning
                autoComplete="new-password"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              suppressHydrationWarning
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-900/30 border border-cyan-400/50 hover:border-cyan-300 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Update &amp; Set New Password</span>
                </>
              )}
            </button>

            {/* Alternate Options */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setActiveTab('LOGIN');
                  setErrorMessage(null);
                  setIsPasswordError(false);
                }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>

              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setActiveTab('REGISTER');
                  setErrorMessage(null);
                  setIsPasswordError(false);
                }}
                className="text-emerald-400 hover:text-emerald-300 transition-colors font-bold cursor-pointer"
              >
                Create New Account Again &rarr;
              </button>
            </div>
          </form>
        )}

        {/* Institutional Trust Badges */}
        <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-cyan-400" /> 256-Bit SSL
          </span>
          <span>&bull;</span>
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" /> Quotex OTC Engine
          </span>
          <span>&bull;</span>
          <span>Global Interbank Stream</span>
        </div>

      </div>

    </div>
  );
};
