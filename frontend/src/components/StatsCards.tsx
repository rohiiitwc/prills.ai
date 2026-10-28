'use client';

import React, { useState } from 'react';
import { DashboardStats } from '../lib/types';
import { TrendingUp, CheckCircle2, XCircle, Clock, BarChart3, Layers, Globe } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats | null;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const [viewMode, setViewMode] = useState<'SPLIT' | 'OTC' | 'LIVE' | 'ALL'>('SPLIT');

  const winRate = stats ? stats.win_rate_percentage : 0;
  const total = stats ? stats.today_signal_count : 0;
  const wins = stats ? stats.today_win_count : 0;
  const losses = stats ? stats.today_loss_count : 0;
  const pending = stats ? stats.today_pending_count : 0;
  const otc = stats ? stats.otc_signals_today : 0;
  const live = stats ? stats.live_signals_today : 0;

  const otcWinRate = stats?.otc_win_rate_percentage ?? 0;
  const otcWins = stats?.otc_win_count ?? 0;
  const otcLosses = stats?.otc_loss_count ?? 0;

  const liveWinRate = stats?.live_win_rate_percentage ?? 0;
  const liveWins = stats?.live_win_count ?? 0;
  const liveLosses = stats?.live_loss_count ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
      {/* 1. Total Signals Today */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all pointer-events-none"></div>
        <div className="relative z-10 flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signals Today</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <BarChart3 className="w-4 h-4" />
          </div>
        </div>
        <div className="relative z-10 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{total}</span>
          <span className="text-xs text-slate-400 font-medium">signals received</span>
        </div>
        <div className="relative z-10 mt-3 flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1 text-cyan-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            OTC: {otc}
          </span>
          <span className="flex items-center gap-1 text-indigo-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Live: {live}
          </span>
        </div>
      </div>

      {/* 2. Reported Win Rate (Divided into OTC and Live Markets) */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group col-span-1 sm:col-span-2 lg:col-span-2">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none"></div>
        
        {/* Header with Title and View Switcher */}
        <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reported Win Rate</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Overall: {winRate}% ({wins}W / {losses}L)
            </span>
          </div>

          <div suppressHydrationWarning className="relative z-30 flex items-center justify-between sm:justify-start gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner w-full sm:w-auto">
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setViewMode('SPLIT')}
              className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 select-none ${
                viewMode === 'SPLIT'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Divided
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setViewMode('OTC')}
              className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 select-none ${
                viewMode === 'OTC'
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
              }`}
            >
              OTC
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setViewMode('LIVE')}
              className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 select-none ${
                viewMode === 'LIVE'
                  ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/60 shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800/60'
              }`}
            >
              Live
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setViewMode('ALL')}
              className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 select-none ${
                viewMode === 'ALL'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/60 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
              }`}
            >
              Total
            </button>
            <div className="hidden sm:block p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 ml-1">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Divided Body: Quotex OTC on Left, Live Markets on Right */}
        {viewMode === 'SPLIT' && (
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 pt-1">
            
            {/* OTC Markets Column */}
            <div className="flex flex-col justify-between pr-0 sm:pr-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Quotex OTC Markets
                  </span>
                  <span className="text-[10px] text-cyan-400/80 font-mono bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">OTC Engine</span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-cyan-400 tracking-tight">{otcWinRate}%</span>
                  <span className="text-xs text-slate-400 font-medium">accuracy</span>
                </div>
              </div>

              <div className="mt-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {otcWins} Wins
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {otcLosses} Losses
                  </span>
                </div>
                <div className="mt-2 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, otcWinRate))}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Live Markets Column */}
            <div className="flex flex-col justify-between pt-3 sm:pt-0 sm:pl-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Live Market Pairs
                  </span>
                  <span className="text-[10px] text-indigo-400/80 font-mono bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-800/40">FX Stream</span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-indigo-400 tracking-tight">{liveWinRate}%</span>
                  <span className="text-xs text-slate-400 font-medium">accuracy</span>
                </div>
              </div>

              <div className="mt-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {liveWins} Wins
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-rose-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {liveLosses} Losses
                  </span>
                </div>
                <div className="mt-2 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, liveWinRate))}%` }}
                  ></div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Focused OTC View */}
        {viewMode === 'OTC' && (
          <div className="relative z-10 pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Quotex OTC Markets Feed
              </span>
              <span className="text-xs text-slate-400 font-mono">Engine: Quotex OTC Stream</span>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-cyan-400 tracking-tight">{otcWinRate}%</span>
              <span className="text-xs sm:text-sm text-slate-400 font-medium">accuracy</span>
              <span className="text-xs text-slate-500 ml-1">({otcWins + otcLosses} decided signals)</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {otcWins} Wins
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {otcLosses} Losses
              </span>
            </div>
          </div>
        )}

        {/* Focused Live View */}
        {viewMode === 'LIVE' && (
          <div className="relative z-10 pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                Live Market Pairs Feed
              </span>
              <span className="text-xs text-slate-400 font-mono">Engine: Global Forex Stream</span>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-indigo-400 tracking-tight">{liveWinRate}%</span>
              <span className="text-xs sm:text-sm text-slate-400 font-medium">accuracy</span>
              <span className="text-xs text-slate-500 ml-1">({liveWins + liveLosses} decided signals)</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {liveWins} Wins
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {liveLosses} Losses
              </span>
            </div>
          </div>
        )}

        {/* Focused Total View */}
        {viewMode === 'ALL' && (
          <div className="relative z-10 pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Combined Aggregated Win Rate
              </span>
              <span className="text-xs text-slate-400 font-mono">All Market Feeds Combined</span>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">{winRate}%</span>
              <span className="text-xs sm:text-sm text-slate-400 font-medium">accuracy</span>
              <span className="text-xs text-slate-500 ml-1">({wins + losses} decided signals)</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {wins} Wins
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {losses} Losses
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Awaiting Result Card */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none"></div>
        <div className="relative z-10 flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Awaiting Result</span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="relative z-10 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{pending}</span>
          <span className="text-xs text-slate-400 font-medium">pending signals</span>
        </div>
        <div className="relative z-10 mt-3 text-xs text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span>Matching incoming market outcomes</span>
        </div>
      </div>
    </div>
  );
};
