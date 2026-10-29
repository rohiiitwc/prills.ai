'use client';

import React from 'react';
import { Signal } from '../lib/types';
import { X, ExternalLink, ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle, FileCode } from 'lucide-react';

interface SignalModalProps {
  signal: Signal | null;
  onClose: () => void;
}

export const SignalModal: React.FC<SignalModalProps> = ({ signal, onClose }) => {
  if (!signal) return null;

  const isCall = signal.direction === 'CALL';
  const isWin = signal.status === 'WIN';
  const isLoss = signal.status === 'LOSS';
  const isUnknown = signal.status === 'UNKNOWN';

  const formatIST = (isoStr?: string | null) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} ${d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST`;
    } catch {
      return isoStr;
    }
  };

  const formatUTC = (isoStr?: string | null) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toUTCString();
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-700/80 shadow-2xl p-4 sm:p-6 lg:p-8 max-h-[92dvh] overflow-y-auto touch-scroll">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${isCall ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">Signal Execution & Audit Log</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Signal #{signal.id} &bull; Feed: {signal.market_category === 'OTC' ? 'Quotex OTC Engine' : 'Global Interbank Forex'}
              </p>
            </div>
          </div>
          <button
            type="button"
            suppressHydrationWarning
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Trade Summary */}
        <div className="my-4 sm:my-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/90 border border-slate-800">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Asset</span>
            <p className="text-sm sm:text-base font-extrabold text-white mt-0.5 truncate">{signal.asset}</p>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Direction</span>
            <p className={`text-sm sm:text-base font-extrabold mt-0.5 ${isCall ? 'text-emerald-400' : 'text-rose-400'}`}>
              {signal.direction_display}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-cyan-400 uppercase">IST Entry</span>
            <p className="text-sm sm:text-base font-black text-cyan-300 font-mono mt-0.5 truncate">
              {(signal.entry_time_converted || `${signal.entry_time_announced} IST`).replace(/\s+on the following day/i, '')}
            </p>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono block truncate">PRILLS AI: {signal.entry_time_announced}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Outcome</span>
            <p className="text-sm sm:text-base font-extrabold mt-0.5">
              {isWin ? (
                <span className="text-emerald-400">WIN</span>
              ) : isLoss ? (
                <span className="text-rose-400">LOSS</span>
              ) : isUnknown ? (
                <span className="text-slate-300" title="No result reported in Telegram within 5 minutes">UNKNOWN</span>
              ) : (
                <span className="text-slate-400">PENDING</span>
              )}
            </p>
          </div>
        </div>

        {/* Timestamps Verification */}
        <div className="mb-4 sm:mb-6 space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-slate-800/60 gap-0.5 sm:gap-2">
            <span className="text-slate-400">Signal Publication Timestamp:</span>
            <span className="font-mono text-slate-200 break-all">{formatIST(signal.signal_published_at)} ({formatUTC(signal.signal_published_at)})</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-slate-800/60 gap-0.5 sm:gap-2">
            <span className="text-slate-400">Website Ingestion Time:</span>
            <span className="font-mono text-slate-200">{formatIST(signal.website_received_at)}</span>
          </div>
          {signal.result_reported_at && (
            <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-slate-800/60 gap-0.5 sm:gap-2">
              <span className="text-slate-400">Settlement Verification Timestamp:</span>
              <span className="font-mono text-slate-200">{formatIST(signal.result_reported_at)}</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-slate-800/60 gap-0.5 sm:gap-2">
            <span className="text-slate-400">Latency / Timing Integrity:</span>
            <span className={`font-semibold ${signal.is_late ? 'text-amber-400' : 'text-emerald-400'}`}>
              {signal.is_late ? `Late by ${signal.late_by_seconds}s` : 'On Time (<5s Target)'}
            </span>
          </div>
        </div>

        {/* Raw Signal Message Payload */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" /> Algorithmic Signal Payload:
            </span>
            <span className="text-[10px] text-slate-400">Direct Feed Payload</span>
          </div>
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap">
            {signal.raw_signal_text}
          </pre>
        </div>

        {/* Settlement Output Payload if matched */}
        {signal.raw_result_text && (
          <div className="mb-6">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
              <FileCode className="w-4 h-4 text-emerald-400" /> Settlement Verification Output:
            </span>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 font-mono whitespace-pre-wrap">
              {signal.raw_result_text}
            </pre>
          </div>
        )}

        {/* Audit Trail */}
        {signal.audit_logs && signal.audit_logs.length > 0 && (
          <div>
            <span className="text-xs font-bold text-slate-300 mb-2 block">System Audit Trail:</span>
            <div className="space-y-2">
              {signal.audit_logs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span className="font-semibold text-cyan-400">{log.action}</span>
                    <span className="font-mono text-[11px]">{formatIST(log.timestamp)}</span>
                  </div>
                  <p className="text-slate-300">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            suppressHydrationWarning
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
