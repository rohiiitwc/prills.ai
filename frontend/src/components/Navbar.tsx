'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, 
  Radio, 
  History, 
  Layers, 
  Globe, 
  RefreshCw, 
  Cpu, 
  Clock, 
  Menu, 
  X,
  User,
  LogOut 
} from 'lucide-react';
import { syncTelegramChannels, reconnectTelegram } from '../lib/api';
import { useAuth } from '../lib/auth';

interface NavbarProps {
  isConnected: boolean;
  telegramStatus?: string;
  lastSyncAt?: string | null;
  onSync?: () => Promise<void> | void;
}

export const Navbar: React.FC<NavbarProps> = ({ isConnected, telegramStatus, lastSyncAt, onSync }) => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Live ticking IST clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on page change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = [
    { label: 'Dashboard', href: '/', icon: Activity },
    { label: 'Quotex OTC', href: '/otc', icon: Layers },
    { label: 'Live Forex', href: '/live', icon: Globe },
    { label: 'Signal History', href: '/history', icon: History },
    { label: 'AI Lab', href: '/ai-lab', icon: Cpu },
  ];

  const formatLastSync = (isoStr?: string | null) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    } catch {
      return null;
    }
  };

  const displaySyncTime = formatLastSync(lastSyncAt) || currentTime || '00:00:00';

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback('Syncing...');
    try {
      const ok = await syncTelegramChannels();
      if (ok) {
        if (onSync) {
          try {
            await onSync();
          } catch {}
        }
        setSyncFeedback('Synced');
        setTimeout(() => setSyncFeedback(null), 2500);
      } else {
        // If sync failed, attempt auto-reconnect using persistent server session
        try {
          const rec = await reconnectTelegram();
          if (rec.success) {
            setSyncFeedback('Healed');
            if (onSync) await onSync();
            setTimeout(() => setSyncFeedback(null), 2500);
            return;
          }
        } catch {}
        setSyncFeedback('Retry');
        setTimeout(() => setSyncFeedback(null), 2500);
      }
    } catch {
      setSyncFeedback('Error');
      setTimeout(() => setSyncFeedback(null), 2500);
    } finally {
      setIsSyncing(false);
    }
  };

  const isLive = isConnected || telegramStatus === 'CONNECTED';

  return (
    <header className="sticky top-0 z-50 bg-[#080d1a]/95 backdrop-blur-2xl border-b border-slate-800/80 transition-all select-none w-full">
      {/* 1. Futuristic Iridescent Laser Top Accent Beam */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 via-blue-500 via-indigo-500 to-transparent opacity-90 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
      
      {/* 2. Soft Cyber Ambient Halos */}
      <div className="absolute -top-10 left-1/3 w-80 h-20 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 right-1/4 w-80 h-20 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          
          {/* LEFT: Cyber Brand Identity (Compact & Resilient) */}
          <Link href="/" className="shrink-0 flex items-center gap-2.5 group cursor-pointer">
            {/* Holographic Crest */}
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950 border border-cyan-500/40 flex items-center justify-center shadow-lg group-hover:scale-105 group-hover:border-cyan-400 transition-all">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
            </div>

            {/* Typography */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-wider text-white flex items-center">
                  PRILLS<span className="text-cyan-400 font-black">.AI</span>
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 text-[9px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
                  TERMINAL
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap hidden sm:flex items-center gap-1">
                <span>Algorithmic Binary Stream</span>
              </p>
            </div>
          </Link>

          {/* CENTER: Floating Cockpit Navigation Deck (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800/90 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-md border border-cyan-400/50 scale-[1.02]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/80 border border-transparent hover:border-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-400'}`} />
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]"></span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Institutional Stream Telemetry & Sync Section */}
          <div className="shrink-0 flex items-center gap-2 sm:gap-2.5">
            
            {/* Live Feed Status Beacon */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80 shadow-inner">
              <span className="relative flex h-2 w-2">
                {isLive ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                )}
              </span>
              <span className={`text-[10px] font-mono font-bold tracking-tight ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLive ? 'LIVE' : 'CONN'}
              </span>
            </div>

            {/* UNIFIED SYNC STATION: 100% VISIBLE, BEAUTIFULLY PADDED & NEVER CLIPPED */}
            <div className="flex items-center rounded-xl bg-slate-950/90 border border-cyan-500/50 hover:border-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.18)] p-1 gap-1">
              
              {/* Sync IST Clock */}
              <div className="flex items-center gap-1.5 px-2 py-0.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-mono font-black text-cyan-400 leading-none tracking-wider">
                    SYNC (IST)
                  </span>
                  <span className="text-xs font-mono font-extrabold text-white tracking-wider leading-tight mt-0.5">
                    {displaySyncTime}
                  </span>
                </div>
              </div>

              {/* Direct Manual Sync Action Button */}
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Click to force instant feed sync & refresh signals"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-sm active:scale-95 disabled:opacity-60 cursor-pointer whitespace-nowrap ${
                  isSyncing
                    ? 'bg-cyan-500 text-slate-950 font-black border border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                    : syncFeedback === 'Synced'
                    ? 'bg-emerald-500 text-slate-950 font-black border border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                    : syncFeedback === 'Error' || syncFeedback === 'Retry'
                    ? 'bg-rose-500 text-white border border-rose-300'
                    : 'bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 hover:from-cyan-600 hover:to-blue-600 text-cyan-300 hover:text-white border border-cyan-500/50 hover:border-cyan-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : 'transition-transform duration-500 hover:rotate-180'}`} />
                <span className="tracking-wide">
                  {isSyncing ? 'Syncing...' : syncFeedback ? syncFeedback : 'Sync'}
                </span>
              </button>

            </div>

            {/* Authenticated Trader Profile Chip (Desktop) */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-slate-800/80">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 shadow-inner">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-white truncate max-w-[90px] leading-tight">
                      {user.name}
                    </span>
                    <span className="text-[8px] font-mono text-cyan-400 leading-none">
                      TRADER
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={logout}
                  title="Sign out of trading terminal"
                  className="flex items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Mobile Menu Hamburger Toggle */}
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Toggle Navigation"
            >
              {mobileOpen ? <X className="w-4 h-4 text-cyan-400" /> : <Menu className="w-4 h-4" />}
            </button>

          </div>

        </div>

        {/* MOBILE NAVIGATION DRAWER */}
        {mobileOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg border border-cyan-400/50'
                        : 'bg-slate-900/80 border border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{link.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Mobile User Profile Card */}
            {user && (
              <div className="mb-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-xs font-black text-white shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={logout}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2.5 py-1.5 rounded-lg active:scale-95 shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* Mobile Telemetry & Sync Footer */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  {isLive ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                  )}
                </span>
                <span className={`font-bold ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isLive ? 'FEED LIVE' : 'CONNECTING'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="text-slate-400 text-[11px]">
                  Sync: <span className="text-white font-bold">{displaySyncTime} IST</span>
                </div>
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-700/60 text-cyan-300 font-bold text-[10px] active:scale-95"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? '...' : syncFeedback || 'Sync'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </header>
  );
};
