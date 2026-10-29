'use client';

import React, { useState } from 'react';
import { Signal } from '../lib/types';
import { ArrowUpRight, ArrowDownRight, Download, Search, Filter, ExternalLink, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import { getExportCsvUrl } from '../lib/api';

interface SignalTableProps {
  signals: Signal[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onFilterChange: (filters: Record<string, string | number | boolean | undefined>) => void;
  currentFilters: Record<string, string | number | boolean | undefined>;
  onSelectSignal: (signal: Signal) => void;
  loading: boolean;
  hideMarketFilter?: boolean;
}

export const SignalTable: React.FC<SignalTableProps> = ({
  signals,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onFilterChange,
  currentFilters,
  onSelectSignal,
  loading,
  hideMarketFilter
}) => {
  const [searchInput, setSearchInput] = useState(typeof currentFilters.search === 'string' ? currentFilters.search : '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...currentFilters, search: searchInput, page: 1 });
  };

  const handleSelectFilter = (key: string, value: string) => {
    const updated = { ...currentFilters, [key]: value, page: 1 };
    if (!value) delete updated[key];
    onFilterChange(updated);
  };

  const formatIST = (isoStr?: string | null) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    } catch {
      return isoStr;
    }
  };

  const formatDateIST = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl border border-slate-800/80 p-3.5 sm:p-5 md:p-6 overflow-hidden w-full">
      
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full max-w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            suppressHydrationWarning
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by asset (e.g. EURUSD, AUDCAD), raw text..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          {/* Market Filter */}
          {!hideMarketFilter && (
            <select
              suppressHydrationWarning
              value={typeof currentFilters.market === 'string' ? currentFilters.market : ''}
              onChange={(e) => handleSelectFilter('market', e.target.value)}
              className="flex-1 sm:flex-initial min-w-[130px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-medium focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Markets</option>
              <option value="OTC">Quotex OTC Markets</option>
              <option value="LIVE">Live Market Pairs</option>
            </select>
          )}

          {/* Direction Filter */}
          <select
            suppressHydrationWarning
            value={typeof currentFilters.direction === 'string' ? currentFilters.direction : ''}
            onChange={(e) => handleSelectFilter('direction', e.target.value)}
            className="flex-1 sm:flex-initial min-w-[120px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-medium focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Directions</option>
            <option value="CALL">CALL UP</option>
            <option value="PUT">PUT DOWN</option>
          </select>

          {/* Status Filter */}
          <select
            suppressHydrationWarning
            value={typeof currentFilters.status === 'string' ? currentFilters.status : ''}
            onChange={(e) => handleSelectFilter('status', e.target.value)}
            className="flex-1 sm:flex-initial min-w-[125px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-medium focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Outcomes</option>
            <option value="WIN">WIN (Reported)</option>
            <option value="LOSS">LOSS (Reported)</option>
            <option value="UNKNOWN">UNKNOWN (No Result &gt;5m)</option>
            <option value="DRAW">DRAW</option>
            <option value="PENDING">PENDING</option>
            <option value="NEEDS_REVIEW">NEEDS REVIEW</option>
          </select>

          {/* CSV Export Button */}
          <a
            href={getExportCsvUrl(
              typeof currentFilters.market === 'string' ? currentFilters.market : undefined,
              typeof currentFilters.status === 'string' ? currentFilters.status : undefined
            )}
            download
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 hover:bg-cyan-900/60 font-semibold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Table with responsive horizontal touch scrolling */}
      <div 
        tabIndex={0} 
        role="region" 
        aria-label="Algorithmic Trading Signal Records Table" 
        className="overflow-x-auto min-h-[300px] touch-scroll scrollbar-thin -mx-3.5 sm:mx-0 px-3.5 sm:px-0 focus:outline-none"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
            <p className="text-xs font-semibold">Updating historical records...</p>
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm font-semibold">No signals found matching your active filters.</p>
            <p className="text-xs text-slate-600 mt-1">Try resetting search or filters to see all recorded signals.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse min-w-[880px]">
            <thead className="sticky top-0 bg-[#0c1427]/95 backdrop-blur-md z-10 border-b border-slate-800">
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Market Feed</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Asset</th>
                <th className="py-3 px-3">Direction</th>
                <th className="py-3 px-3 text-cyan-400">IST Entry Time</th>
                <th className="py-3 px-3 text-slate-400">PRILLS AI Window</th>
                <th className="py-3 px-3">Expiry</th>
                <th className="py-3 px-3">Pub. Time (IST)</th>
                <th className="py-3 px-3">Rec. Time (IST)</th>
                <th className="py-3 px-3">Reported Result</th>
                <th className="py-3 px-3">Result Time (IST)</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {signals.map((sig) => {
                const isCall = sig.direction === 'CALL';
                const isWin = sig.status === 'WIN';
                const isLoss = sig.status === 'LOSS';
                const isPending = sig.status === 'PENDING';
                const isUnknown = sig.status === 'UNKNOWN';
                const isReview = sig.status === 'NEEDS_REVIEW';

                return (
                  <tr key={sig.id} className="hover:bg-slate-900/60 transition-colors group">
                    <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {formatDateIST(sig.signal_published_at)}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap font-medium text-slate-300">
                      {sig.market_category === 'OTC' ? 'Quotex OTC Engine' : 'Global Interbank Forex'}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          sig.market_category === 'OTC'
                            ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/50'
                            : 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/50'
                        }`}
                      >
                        {sig.market_category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-extrabold text-white whitespace-nowrap">
                      {sig.asset}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          isCall ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isCall ? (
                          <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 stroke-[3]" />
                        )}
                        {sig.direction_display}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-mono font-black text-cyan-300">
                        {(sig.entry_time_converted || `${sig.entry_time_announced} IST`).replace(/\s+on the following day/i, '')}
                        {sig.is_late && (
                          <span title={`Late by ${sig.late_by_seconds}s`} className="ml-1 text-amber-400">
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap font-mono text-slate-400">
                      {sig.entry_time_announced}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {sig.expiry_duration}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {formatIST(sig.signal_published_at)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {formatIST(sig.website_received_at)}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {isWin && (
                        <span className="font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                          WIN
                        </span>
                      )}
                      {isLoss && (
                        <span className="font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/60">
                          LOSS
                        </span>
                      )}
                      {isUnknown && (
                        <span className="font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60" title="No result reported in Telegram within 5 minutes">
                          UNKNOWN
                        </span>
                      )}
                      {isPending && (
                        <span className="text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60">
                          PENDING
                        </span>
                      )}
                      {isReview && (
                        <span className="font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                          REVIEW
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {formatIST(sig.result_reported_at)}
                    </td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => onSelectSignal(sig)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3 text-cyan-400" /> Audit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Scroll Hint */}
      <div className="flex items-center justify-between mt-2.5 px-1 text-[11px] text-slate-500 sm:hidden">
        <span className="flex items-center gap-1">&larr; Swipe table for full audit &rarr;</span>
        <span className="font-mono text-cyan-400/80">{signals.length} displayed</span>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="text-center sm:text-left">
          Showing page <span className="font-bold text-white">{page}</span> of{' '}
          <span className="font-bold text-white">{totalPages || 1}</span> ({total} signals recorded)
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-center active:scale-95"
          >
            Previous
          </button>
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-center active:scale-95"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
