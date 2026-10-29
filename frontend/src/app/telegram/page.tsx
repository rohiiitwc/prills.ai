'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { TelegramStatus } from '../../lib/types';
import {
  fetchTelegramStatus,
  requestTelegramCode,
  submitTelegramCode,
  submitTelegram2FA,
  injectTestMessage,
  syncTelegramChannels,
  reconnectTelegram
} from '../../lib/api';
import {
  Send,
  Radio,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  Phone,
  Hash,
  Play,
  Layers,
  Globe,
  Flame,
  Clock,
  ShieldAlert,
  Lock,
  ShieldCheck
} from 'lucide-react';

function TelegramLabContent() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Security Lock state
  const [isLabLocked, setIsLabLocked] = useState(true);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Auth form states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP' | '2FA' | 'DONE'>('DONE');

  // Injector state
  const [injectChannel, setInjectChannel] = useState<'quotex0o' | 'quotexofficialvipbot'>('quotex0o');
  const [rawText, setRawText] = useState(
    '📊 AUDCAD-OTCq\n⏰ 12:30:00 🔔 GET READY\n⏳ 1 Minutes\n🟢 CALL UP ⬆\n\n🚧 Quotex 1M FREE 🚧'
  );

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKeyInput.trim() === 'prills-admin-secret-2026') {
      setIsLabLocked(false);
      setShowUnlockModal(false);
      setAdminKeyInput('');
      setUnlockError(null);
      setFeedback({ type: 'success', message: 'Master Key verified. Synthetic Testing Lab unlocked.' });
    } else {
      setUnlockError('Invalid Master Admin Key. Authorization rejected.');
    }
  };

  const handleLock = () => {
    setIsLabLocked(true);
    setFeedback({ type: 'success', message: 'Testing console has been locked securely.' });
  };

  const refreshStatus = async () => {
    try {
      const data = await fetchTelegramStatus();
      setStatus(data);
      if (data.is_connected) {
        setStep('DONE');
      }
    } catch (err) {
      console.warn('Status error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceReconnect = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await reconnectTelegram();
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Telegram connection successfully re-established!' });
        setStep('DONE');
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to reconnect. Please verify credentials or request a new code.' });
      }
      await refreshStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reconnect failed';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(() => {
      fetchTelegramStatus().then(setStatus).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      const parsedApiId = apiId.trim() ? parseInt(apiId.trim(), 10) : undefined;
      const res = await requestTelegramCode(phoneNumber.trim() || undefined, parsedApiId, apiHash.trim() || undefined);
      setFeedback({ type: 'success', message: res.message || 'Verification code requested from Telegram!' });
      setStep('OTP');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request verification code';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await submitTelegramCode(otpCode.trim(), phoneNumber.trim() || undefined);
      setFeedback({ type: 'success', message: res.message || 'Telegram authorized successfully!' });
      setStep('DONE');
      const updated = await fetchTelegramStatus();
      setStatus(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code';
      if (msg.includes('2FA') || msg.includes('two-step')) {
        setStep('2FA');
        setFeedback({ type: 'error', message: 'Two-step verification (2FA) is required on your Telegram account.' });
      } else {
        setFeedback({ type: 'error', message: msg });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await submitTelegram2FA(password2FA);
      setFeedback({ type: 'success', message: res.message || '2FA verified and connected!' });
      setStep('DONE');
      const updated = await fetchTelegramStatus();
      setStatus(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid 2FA password';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInject = async () => {
    if (!rawText.trim()) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await injectTestMessage(injectChannel, rawText.trim());
      setFeedback({
        type: 'success',
        message: `Synthetic signal dispatched! Status: ${res.details?.status || 'PROCESSED'}`
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to inject message';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const ok = await syncTelegramChannels();
      if (ok) {
        setFeedback({ type: 'success', message: 'Channel backfill & reconciliation initiated successfully.' });
      } else {
        setFeedback({ type: 'error', message: 'Failed to initiate channel synchronization.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to trigger channel sync.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col text-slate-100 selection:bg-cyan-500 selection:text-black">
      <Navbar
        isConnected={status?.is_connected ?? false}
        telegramStatus={status?.status}
        lastSyncAt={status?.last_sync_at}
        onSync={refreshStatus}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 mb-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Terminal Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">Ingestion & Testing Console</h1>
                <p className="text-xs text-slate-400">
                  Private MTProto client status and testing laboratory.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleForceReconnect}
              disabled={actionLoading}
              title="Force instant reconnection with the stored Telegram session"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 font-semibold text-xs transition-all shadow-lg cursor-pointer"
            >
              <Radio className={`w-3.5 h-3.5 ${actionLoading ? 'animate-pulse text-indigo-200' : 'text-indigo-400'}`} />
              <span>Reconnect Stream</span>
            </button>

            <button
              onClick={handleSyncNow}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-semibold text-xs transition-all shadow-lg cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Re-Sync Channels</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
        )}

        {/* Connection Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Stream Connection</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  status?.is_connected
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {status?.status || (loading ? 'LOADING' : 'UNKNOWN')}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Radio className={`w-4 h-4 ${status?.is_connected ? 'text-emerald-400' : 'text-amber-400'}`} />
              {status?.is_connected ? 'Connected & Active' : 'Authorization Needed'}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Account: Active Server Session (Credentials Encrypted)
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Monitored Channels</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white">2 Segregated Sources</div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-2 flex-wrap">
              <span>Channel 1 (OTC)</span>
              <span>•</span>
              <span>Channel 2 (LIVE)</span>
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 col-span-1 sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Reconciliation Clock</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono">
              {status?.last_sync_at ? new Date(status.last_sync_at).toLocaleTimeString() : 'Awaiting Ingestion'}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Auto-converted to Indian Standard Time (IST)</p>
          </div>
        </div>

        {/* Two-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Column 1: Authorization Wizard */}
          <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 sm:space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Client Authorization</h2>
                <p className="text-xs text-slate-400">Secure MTProto daemon configuration</p>
              </div>
            </div>

            {step === 'DONE' && (
              <div className={`p-5 rounded-xl border space-y-4 ${
                status?.is_connected
                  ? 'bg-emerald-950/30 border-emerald-800/60'
                  : 'bg-amber-950/30 border-amber-800/60'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className={`flex items-center gap-2 font-bold text-sm ${
                    status?.is_connected ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {status?.is_connected ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    )}
                    <span>{status?.is_connected ? 'Authorized & Actively Ingesting' : 'Stream Disconnected / Offline'}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    status?.is_connected ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'
                  }`}>
                    {status?.status || 'UNKNOWN'}
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  {status?.is_connected
                    ? 'Your MTProto session is permanently saved across server storage and .env. Incoming signals stream live with sub-second latency. The automated connection watchdog verifies connectivity every 15 seconds.'
                    : 'The server session is stored, but the MTProto stream is currently inactive or network dropped. Click Reconnect to resume live streaming immediately.'}
                </p>

                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={handleForceReconnect}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-all shadow cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                    <span>{status?.is_connected ? 'Refresh Connection' : 'Reconnect Now'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('CREDENTIALS')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all cursor-pointer border border-slate-700"
                  >
                    <Key className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Change Account / Re-Authorize</span>
                  </button>
                </div>
              </div>
            )}

            {step === 'CREDENTIALS' && (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-cyan-400" /> Phone Number (with Country Code)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-cyan-400" /> API ID
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-cyan-400" /> API Hash
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Request Verification Code</span>
                </button>
              </form>
            )}

            {step === 'OTP' && (
              <form onSubmit={handleSubmitCode} className="space-y-4">
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs">
                  Telegram has sent an official login code to your Telegram app. Enter it below:
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Verification Code (OTP)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="12345"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono tracking-widest text-center focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Confirm Code & Authorize</span>
                </button>
              </form>
            )}

            {step === '2FA' && (
              <form onSubmit={handleSubmit2FA} className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs">
                  Enter your Cloud Password (2FA) to finalize authorization:
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    2FA Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter password..."
                    value={password2FA}
                    onChange={(e) => setPassword2FA(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Submit 2FA & Connect</span>
                </button>
              </form>
            )}
          </div>

          {/* Column 2: Synthetic Testing Lab - Security Locked by Default */}
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-6 relative overflow-hidden">
            {/* Ambient Background Gradient for Cyber Security */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                  isLabLocked
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {isLabLocked ? <Lock className="w-4 h-4 text-rose-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Synthetic Testing Lab</h2>
                    <span className={`text-[9px] uppercase font-mono font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      isLabLocked
                        ? 'bg-rose-950/80 border-rose-800/60 text-rose-300'
                        : 'bg-emerald-950/80 border-emerald-800/60 text-emerald-300'
                    }`}>
                      <Lock className="w-2.5 h-2.5" />
                      {isLabLocked ? 'LOCKED' : 'UNLOCKED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isLabLocked
                      ? 'Production injection locked to preserve signal accuracy'
                      : 'Admin session active: test injection enabled'}
                  </p>
                </div>
              </div>

              {/* Security Lock Toggle Button */}
              {isLabLocked ? (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => { setShowUnlockModal(true); setUnlockError(null); }}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Unlock</span>
                </button>
              ) : (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handleLock}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Console</span>
                </button>
              )}
            </div>

            {/* Tamper-Proof Security Banner */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
              isLabLocked
                ? 'bg-slate-950/90 border-slate-800 text-slate-300'
                : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLabLocked ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isLabLocked ? 'bg-cyan-500' : 'bg-emerald-500'}`}></span>
                </span>
                <span className="font-semibold">
                  {isLabLocked ? 'Status: LOCKED (Modifications Disabled)' : 'Status: UNLOCKED (Admin Verification Active)'}
                </span>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLabLocked ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {isLabLocked ? 'PROTECTED' : 'DEV ACCESS'}
              </span>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span>Quick Test Presets:</span>
                {isLabLocked && <span className="text-[10px] text-slate-500 font-mono">🔒 Disabled</span>}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isLabLocked}
                  onClick={() => {
                    if (isLabLocked) return;
                    setInjectChannel('quotex0o');
                    setRawText('📊 AUDCAD-OTCq\n⏰ 12:30:00 🔔 GET READY\n⏳ 1 Minutes\n🟢 CALL UP ⬆\n\n🚧 Quotex 1M FREE 🚧');
                  }}
                  className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs transition-all flex items-center gap-2 ${
                    isLabLocked
                      ? 'opacity-50 cursor-not-allowed text-slate-500 border-slate-900'
                      : 'hover:border-cyan-500/50 text-slate-300 hover:text-white cursor-pointer'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 shrink-0 ${isLabLocked ? 'text-slate-600' : 'text-cyan-400'}`} />
                  <span className="truncate">AUDCAD-OTC Call</span>
                </button>

                <button
                  type="button"
                  disabled={isLabLocked}
                  onClick={() => {
                    if (isLabLocked) return;
                    setInjectChannel('quotexofficialvipbot');
                    setRawText('📊 EURJPY\n⏰ 14:15:00 🔔 GET READY\n⏳ 1 Minutes\n🟢 CALL UP ⬆\n\n🚧 Quotex Official 🚧');
                  }}
                  className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs transition-all flex items-center gap-2 ${
                    isLabLocked
                      ? 'opacity-50 cursor-not-allowed text-slate-500 border-slate-900'
                      : 'hover:border-indigo-500/50 text-slate-300 hover:text-white cursor-pointer'
                  }`}
                >
                  <Globe className={`w-3.5 h-3.5 shrink-0 ${isLabLocked ? 'text-slate-600' : 'text-indigo-400'}`} />
                  <span className="truncate">EURJPY Live Call</span>
                </button>

                <button
                  type="button"
                  disabled={isLabLocked}
                  onClick={() => {
                    if (isLabLocked) return;
                    setInjectChannel('quotex0o');
                    setRawText('AUDCAD-OTCq\n12:30:00\nPROFIT ✅ 0000');
                  }}
                  className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs transition-all flex items-center gap-2 ${
                    isLabLocked
                      ? 'opacity-50 cursor-not-allowed text-slate-500 border-slate-900'
                      : 'hover:border-emerald-500/50 text-slate-300 hover:text-white cursor-pointer'
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isLabLocked ? 'text-slate-600' : 'text-emerald-400'}`} />
                  <span className="truncate">Result: Profit ✅</span>
                </button>

                <button
                  type="button"
                  disabled={isLabLocked}
                  onClick={() => {
                    if (isLabLocked) return;
                    setInjectChannel('quotex0o');
                    setRawText('AUDCAD-OTCq\n12:30:00\nLOSS ❌ 0000');
                  }}
                  className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs transition-all flex items-center gap-2 ${
                    isLabLocked
                      ? 'opacity-50 cursor-not-allowed text-slate-500 border-slate-900'
                      : 'hover:border-rose-500/50 text-slate-300 hover:text-white cursor-pointer'
                  }`}
                >
                  <AlertCircle className={`w-3.5 h-3.5 shrink-0 ${isLabLocked ? 'text-slate-600' : 'text-rose-400'}`} />
                  <span className="truncate">Result: Loss ❌</span>
                </button>
              </div>
            </div>

            {/* Target Channel */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Target Ingestion Stream</span>
                {isLabLocked && <span className="text-[10px] text-slate-500 font-mono">🔒 Locked</span>}
              </label>
              <select
                disabled={isLabLocked}
                value={injectChannel}
                onChange={(e) => setInjectChannel(e.target.value as 'quotex0o' | 'quotexofficialvipbot')}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none transition-all ${
                  isLabLocked ? 'opacity-60 cursor-not-allowed' : 'focus:border-indigo-500 cursor-pointer'
                }`}
              >
                <option value="quotex0o">Quotex OTC Engine (Stream 1 - OTC)</option>
                <option value="quotexofficialvipbot">Global Interbank Forex (Stream 2 - LIVE)</option>
              </select>
            </div>

            {/* Raw Text Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Simulated Ingestion Payload</span>
                {isLabLocked && <span className="text-[10px] text-slate-500 font-mono">🔒 Read Only</span>}
              </label>
              <textarea
                rows={4}
                readOnly={isLabLocked}
                disabled={isLabLocked}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none transition-all ${
                  isLabLocked ? 'opacity-60 cursor-not-allowed bg-slate-950/80' : 'focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Action / Lock Button */}
            {isLabLocked ? (
              <div className="w-full py-3 rounded-xl bg-slate-950 border border-slate-800/90 text-slate-400 font-mono font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed select-none shadow-inner">
                <Lock className="w-4 h-4 text-rose-400" />
                <span>LOCKED — MANUAL INJECTION DISABLED</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInject}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>Inject & Process Test Signal</span>
              </button>
            )}
          </div>
        </div>

        {/* Master Admin Verification Modal */}
        {showUnlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Administrator Passkey</h3>
                    <p className="text-[11px] text-slate-400">Unlock synthetic signal injector</p>
                  </div>
                </div>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setShowUnlockModal(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {unlockError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-medium">
                  {unlockError}
                </div>
              )}

              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                    ENTER MASTER ADMIN KEY
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••••••"
                    value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-2 justify-end pt-2">
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => setShowUnlockModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    suppressHydrationWarning
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Authorize & Unlock</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TelegramPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080d1a]" />}>
      <TelegramLabContent />
    </Suspense>
  );
}
