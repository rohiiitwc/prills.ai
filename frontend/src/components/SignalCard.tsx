'use client';

import React from 'react';
import { Signal } from '../lib/types';
import { ArrowUpRight, ArrowDownRight, Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, FileText, HelpCircle } from 'lucide-react';

interface SignalCardProps {
  signal: Signal | null;
  title: string;
  category: 'OTC' | 'LIVE';
  sourceName: string;
  sourceLink?: string;
  onViewDetails?: (signal: Signal) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  title,
  category,
  sourceName,
  onViewDetails
}) => {
  if (!signal) {
    return (
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-800/80 relative flex flex-col justify-between min-h-[280px] sm:min-h-[340px] w-full">
        <div>
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800/60 mb-4 sm:mb-5 gap-2">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-cyan-400">MARKET FEED</span>
              <h3 className="text-lg sm:text-xl font-extrabold text-white">{title}</h3>
            </div>
            <div className="text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="truncate max-w-[120px] sm:max-w-none">{sourceName}</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center text-slate-500">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3 text-slate-600 animate-pulse">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-400">Waiting for live market signal...</p>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-xs">Signals stream automatically upon live algorithmic trigger.</p>
          </div>
        </div>
      </div>
    );
  }

  const isCall = signal.direction === 'CALL';
  const isWin = signal.status === 'WIN';
  const isLoss = signal.status === 'LOSS';
  const isPending = signal.status === 'PENDING';
  const isUnknown = signal.status === 'UNKNOWN';

  return (
    <div
      className={`glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border transition-all duration-300 relative flex flex-col justify-between overflow-hidden group w-full ${
        isWin
          ? 'border-emerald-500/40 glow-green'
          : isLoss
          ? 'border-rose-500/40 glow-red'
          : isUnknown
          ? 'border-slate-700/60'
          : isCall
          ? 'border-emerald-500/30'
          : 'border-rose-500/30'
      }`}
    >
      {/* Top Banner Accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 sm:h-1.5 ${
          isWin
            ? 'bg-gradient-to-r from-emerald-500 to-green-400'
            : isLoss
            ? 'bg-gradient-to-r from-rose-600 to-red-400'
            : isUnknown
            ? 'bg-gradient-to-r from-slate-500 to-zinc-400'
            : isCall
            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
            : 'bg-gradient-to-r from-rose-500 to-amber-500'
        }`}
      />

      <div>
        {/* Header: Market Category & Source Feed Badge */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800/60 mb-4 sm:mb-5 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span
              className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 sm:px-2.5 py-0.5 rounded-full border ${
                category === 'OTC'
                  ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60'
                  : 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60'
              }`}
            >
              {category} MARKET
            </span>
            {signal.is_test_data && (
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60">
                TEST
              </span>
            )}
          </div>

          <div className="text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1.5 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${category === 'OTC' ? 'bg-cyan-400' : 'bg-indigo-400'} animate-pulse`}></span>
            <span className="truncate max-w-[120px] sm:max-w-none">{sourceName}</span>
          </div>
        </div>

        {/* Asset & Direction Display */}
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block">Trading Asset</span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-wide mt-0.5 truncate">
              {signal.asset}
            </h2>
          </div>

          {/* Direction Badge */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm tracking-wide shadow-lg shrink-0 ${
              isCall
                ? 'bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-emerald-500/20'
                : 'bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-rose-500/20'
            }`}
          >
            {isCall ? <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" /> : <ArrowDownRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />}
            <span>{signal.direction_display}</span>
          </div>
        </div>

        {/* Key Trade Parameters: Entry Time & Expiry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/80 border border-slate-800/90 mb-4 sm:mb-5">
          <div>
            <span className="text-[10px] sm:text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              IST Entry Time
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5 sm:mt-1">
              <span className="text-lg sm:text-xl font-black text-cyan-300 font-mono tracking-tight">
                {(signal.entry_time_converted || `${signal.entry_time_announced} IST`).replace(/\s+on the following day/i, '')}
              </span>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-800/60 flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400">
              <span className="font-semibold text-slate-400">PRILLS AI:</span>
              <strong className="text-slate-200 font-mono">{signal.entry_time_announced}</strong>
            </div>
          </div>

          <div className="pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 sm:pl-3 sm:border-l">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Expiry Duration</span>
            <p className="text-lg sm:text-xl font-extrabold text-white font-mono mt-0.5 sm:mt-1">
              {signal.expiry_duration}
            </p>
          </div>
        </div>

        {/* Late Signal Alert if Applicable */}
        {signal.is_late && (
          <div className="mb-3 sm:mb-4 flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">
              <strong>Late Signal:</strong> Published after entry time (+{signal.late_by_seconds}s).
            </span>
          </div>
        )}
      </div>

      {/* Outcome / Result Footer */}
      <div className="pt-3 sm:pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] sm:text-xs text-slate-400 font-medium">Status:</span>
          {isWin && (
            <span className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-emerald-800/60">
              <CheckCircle className="w-3.5 h-3.5" /> WIN (REPORTED)
            </span>
          )}
          {isLoss && (
            <span className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-rose-400 bg-rose-950/80 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-rose-800/60">
              <XCircle className="w-3.5 h-3.5" /> LOSS (REPORTED)
            </span>
          )}
          {isUnknown && (
            <span className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-300 bg-slate-800/90 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-700/70" title="No result reported in Telegram within 5 minutes">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> UNKNOWN
            </span>
          )}
          {isPending && (
            <span className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-slate-300 bg-slate-800/80 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-700/60">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" /> PENDING
            </span>
          )}
        </div>

        {onViewDetails && (
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => onViewDetails(signal)}
            className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-cyan-400 transition-colors px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-95"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Audit</span>
          </button>
        )}
      </div>
    </div>
  );
};
