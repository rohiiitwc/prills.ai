'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/Navbar';
import { StatsCards } from '../components/StatsCards';
import { SignalCard } from '../components/SignalCard';
import { SignalModal } from '../components/SignalModal';
import { DashboardStats, LatestSignalsData, Signal, TelegramStatus } from '../lib/types';
import { fetchDashboardStats, fetchLatestSignals, fetchTelegramStatus, getWsBaseUrl } from '../lib/api';
import { Layers, Globe, Radio, RefreshCw, AlertCircle, ArrowRight, ShieldCheck, Zap, Columns } from 'lucide-react';

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [latestData, setLatestData] = useState<LatestSignalsData | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [resultsMarket, setResultsMarket] = useState<'ALL' | 'OTC' | 'LIVE'>('ALL');
  const [pendingMarket, setPendingMarket] = useState<'ALL' | 'OTC' | 'LIVE'>('ALL');
  const [, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  const loadAllData = async () => {
    try {
      const [sData, lData, tgData] = await Promise.all([
        fetchDashboardStats(),
        fetchLatestSignals(),
        fetchTelegramStatus()
      ]);
      setStats(sData);
      setLatestData(lData);
      setTelegramStatus(tgData);
    } catch (err) {
      console.warn('Dashboard data fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket Connection & Initial Load
  useEffect(() => {
    let isUnmounted = false;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    loadAllData();

    const connectWebSocket = () => {
      if (isUnmounted) return;

      try {
        const wsUrl = getWsBaseUrl();
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) {
            ws.close();
            return;
          }
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isUnmounted || !event.data || event.data === 'pong') return;
          try {
            const message = JSON.parse(event.data);

            if (message.event === 'NEW_SIGNAL') {
              const newSig: Signal = message.data;
              const isOtc = newSig.market_category === 'OTC';
              setLatestData((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  latest_otc: isOtc ? newSig : prev.latest_otc,
                  latest_live: !isOtc ? newSig : prev.latest_live,
                  pending_signals: [newSig, ...prev.pending_signals.filter(p => p.id !== newSig.id).slice(0, 9)],
                  pending_otc_signals: isOtc
                    ? [newSig, ...(prev.pending_otc_signals || []).filter(p => p.id !== newSig.id).slice(0, 5)]
                    : prev.pending_otc_signals,
                  pending_live_signals: !isOtc
                    ? [newSig, ...(prev.pending_live_signals || []).filter(p => p.id !== newSig.id).slice(0, 5)]
                    : prev.pending_live_signals
                };
              });
              fetchDashboardStats().then(setStats).catch(() => {});
            } else if (message.event === 'SIGNAL_UPDATED') {
              const updatedSig: Signal = message.data;
              const isOtc = updatedSig.market_category === 'OTC';
              setLatestData((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  latest_otc: prev.latest_otc?.id === updatedSig.id ? updatedSig : prev.latest_otc,
                  latest_live: prev.latest_live?.id === updatedSig.id ? updatedSig : prev.latest_live,
                  recent_results: [updatedSig, ...prev.recent_results.filter(r => r.id !== updatedSig.id).slice(0, 9)],
                  recent_otc_results: isOtc
                    ? [updatedSig, ...(prev.recent_otc_results || []).filter(r => r.id !== updatedSig.id).slice(0, 4)]
                    : prev.recent_otc_results,
                  recent_live_results: !isOtc
                    ? [updatedSig, ...(prev.recent_live_results || []).filter(r => r.id !== updatedSig.id).slice(0, 4)]
                    : prev.recent_live_results,
                  pending_signals: prev.pending_signals.filter(p => p.id !== updatedSig.id),
                  pending_otc_signals: (prev.pending_otc_signals || []).filter(p => p.id !== updatedSig.id),
                  pending_live_signals: (prev.pending_live_signals || []).filter(p => p.id !== updatedSig.id)
                };
              });
              fetchDashboardStats().then(setStats).catch(() => {});
            } else if (message.event === 'CONNECTED' || message.event === 'CONNECTION_STATUS') {
              const tg = message.telegram_status || message.data;
              if (tg) setTelegramStatus(tg);
            }
          } catch {
            // Safe JSON parse ignore
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          // Gracefully reconnect in 3 seconds
          reconnectTimeout = setTimeout(() => {
            if (!isUnmounted) {
              connectWebSocket();
            }
          }, 3000);
        };

        ws.onerror = () => {
          // In browsers, ws.onerror is followed by ws.onclose which handles retry safely.
          // Avoiding console.error prevents Next.js dev overlay interruption.
        };
      } catch {
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        }
      }
    };

    connectWebSocket();

    // Heartbeat ping interval
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 20000);

    return () => {
      isUnmounted = true;
      clearInterval(pingInterval);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Navbar */}
      <Navbar
        isConnected={wsConnected}
        telegramStatus={telegramStatus?.status}
        lastSyncAt={telegramStatus?.last_sync_at}
        onSync={loadAllData}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-8">
        

        {/* SECTION 2: TWO LARGE BUTTONS ON HOMEPAGE */}
        <section className="mb-8 sm:mb-10">
          <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
            <span className="text-xs font-bold tracking-widest uppercase text-cyan-400">SELECT TRADING MARKET</span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight mt-1">
              Real-Time Algorithmic Binary Signals
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Segregated institutional market feeds. Zero cross-pair mixing, exact scheduled entry windows, and automated outcome settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* BUTTON 1: QUOTEX OTC MARKETS */}
            <Link
              href="/otc"
              className="group glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 border-2 border-cyan-500/30 hover:border-cyan-400 hover:glow-cyan transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all pointer-events-none"></div>
              <div>
                <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-400">
                    MARKET FEED: QUOTEX OTC
                  </span>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white group-hover:text-cyan-300 transition-colors">
                  QUOTEX OTC MARKETS
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Dedicated Over-the-Counter assets streamed directly with sub-second execution and algorithmic validation.
                </p>
              </div>

              <div className="mt-6 sm:mt-8 flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>Open Dedicated OTC Terminal</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                  <ArrowRight className="w-4 h-4 text-white group-hover:text-slate-950" />
                </div>
              </div>
            </Link>

            {/* BUTTON 2: LIVE MARKET PAIRS */}
            <Link
              href="/live"
              className="group glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 border-2 border-indigo-500/30 hover:border-indigo-400 hover:glow-blue transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all pointer-events-none"></div>
              <div>
                <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800 text-indigo-400">
                    MARKET FEED: GLOBAL FOREX
                  </span>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white group-hover:text-indigo-300 transition-colors">
                  LIVE MARKET PAIRS
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Real interbank currency pairs and forex markets with live volatility tracking and automated settlement.
                </p>
              </div>

              <div className="mt-6 sm:mt-8 flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                  <span>Open Dedicated Live Terminal</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 group-hover:bg-indigo-500 group-hover:text-slate-950 transition-colors">
                  <ArrowRight className="w-4 h-4 text-white group-hover:text-slate-950" />
                </div>
              </div>
            </Link>

          </div>
        </section>

        {/* Dashboard Statistics */}
        <StatsCards stats={stats} />

        {/* SECTION 7: REAL-TIME DASHBOARD (LATEST SIGNALS) */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">LIVE FEED TERMINAL</span>
              <h2 className="text-2xl font-black text-white">Latest Announcments & Results</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">Auto-Updates via WebSocket</span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* LATEST OTC SIGNAL CARD */}
            <SignalCard
              signal={latestData?.latest_otc || null}
              title="Latest Quotex OTC Signal"
              category="OTC"
              sourceName="Quotex OTC Engine"
              onViewDetails={setSelectedSignal}
            />

            {/* LATEST LIVE MARKET SIGNAL CARD */}
            <SignalCard
              signal={latestData?.latest_live || null}
              title="Latest Live-Market Signal"
              category="LIVE"
              sourceName="Live Interbank FX Feed"
              onViewDetails={setSelectedSignal}
            />

          </div>

          {/* RECENT OUTCOMES & PENDING QUEUE (SEPARATED BY OTC & LIVE MARKETS) */}
          {(() => {
            const otcResults = latestData?.recent_otc_results && latestData.recent_otc_results.length > 0
              ? latestData.recent_otc_results
              : (latestData?.recent_results || []).filter(s => s.market_category === 'OTC');

            const liveResults = latestData?.recent_live_results && latestData.recent_live_results.length > 0
              ? latestData.recent_live_results
              : (latestData?.recent_results || []).filter(s => s.market_category === 'LIVE');

            const otcPending = latestData?.pending_otc_signals && latestData.pending_otc_signals.length > 0
              ? latestData.pending_otc_signals
              : (latestData?.pending_signals || []).filter(s => s.market_category === 'OTC');

            const livePending = latestData?.pending_live_signals && latestData.pending_live_signals.length > 0
              ? latestData.pending_live_signals
              : (latestData?.pending_signals || []).filter(s => s.market_category === 'LIVE');

            const renderResultRow = (sig: Signal, idx: number, prefix: string) => {
              const isWin = sig.reported_result === 'WIN';
              const isLoss = sig.reported_result === 'LOSS';
              const isOtc = sig.market_category === 'OTC';

              return (
                <div
                  key={`${prefix}-${sig.id}-${idx}`}
                  onClick={() => setSelectedSignal(sig)}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isOtc
                          ? 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60'
                          : 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60'
                      }`}
                    >
                      {sig.market_category}
                    </span>
                    <span className="font-extrabold text-white text-xs group-hover:text-cyan-300 transition-colors">
                      {sig.asset}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        sig.direction === 'CALL' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {sig.direction_display}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded border ${
                        isWin
                          ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800/80'
                          : isLoss
                          ? 'bg-rose-950/90 text-rose-400 border-rose-800/80'
                          : 'bg-amber-950/90 text-amber-400 border-amber-800/80'
                      }`}
                    >
                      {sig.reported_result || 'COMPLETED'}
                    </span>
                  </div>
                </div>
              );
            };

            const renderPendingRow = (sig: Signal, idx: number, prefix: string) => {
              const isOtc = sig.market_category === 'OTC';

              return (
                <div
                  key={`${prefix}-${sig.id}-${idx}`}
                  onClick={() => setSelectedSignal(sig)}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isOtc
                          ? 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60'
                          : 'bg-indigo-950/80 text-indigo-400 border-indigo-800/60'
                      }`}
                    >
                      {sig.market_category}
                    </span>
                    <span className="font-extrabold text-white text-xs group-hover:text-cyan-300 transition-colors">
                      {sig.asset}
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-bold">
                      Entry: {sig.entry_time_announced}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-amber-400/90 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded">
                    Awaiting Result
                  </span>
                </div>
              );
            };

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Segregated Latest Reported Results Card */}
                <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2.5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400 shrink-0" /> Latest Reported Results
                    </h3>
                    {/* Market Filter Tabs */}
                    <div suppressHydrationWarning className="flex items-center justify-between sm:justify-start gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 w-full sm:w-auto">
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setResultsMarket('ALL')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                          resultsMarket === 'ALL'
                            ? 'bg-slate-700 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setResultsMarket('OTC')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          resultsMarket === 'OTC'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 shadow-sm shadow-cyan-900/30'
                            : 'text-slate-400 hover:text-cyan-400'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        OTC Market
                      </button>
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setResultsMarket('LIVE')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          resultsMarket === 'LIVE'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm shadow-indigo-900/30'
                            : 'text-slate-400 hover:text-indigo-400'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        Live Market
                      </button>
                    </div>
                  </div>

                  {/* Mode: ALL (Segregated into 2 sections: OTC & LIVE) */}
                  {resultsMarket === 'ALL' && (
                    <div className="space-y-4">
                      {/* QUOTEX OTC SECTION */}
                      <div className="rounded-2xl p-3.5 bg-gradient-to-b from-cyan-950/25 to-slate-900/50 border border-cyan-900/40">
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-cyan-900/30">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                            <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                              QUOTEX OTC MARKET RESULTS
                            </span>
                          </div>
                          <span className="text-[10px] text-cyan-400/80 font-mono">
                            Quotex OTC Engine
                          </span>
                        </div>
                        {otcResults.length === 0 ? (
                          <div className="text-center py-3 text-slate-500 text-xs">
                            No completed OTC results recorded yet today.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {otcResults.slice(0, 3).map((sig, idx) => renderResultRow(sig, idx, 'all-otc'))}
                          </div>
                        )}
                      </div>

                      {/* LIVE MARKET SECTION */}
                      <div className="rounded-2xl p-3.5 bg-gradient-to-b from-indigo-950/25 to-slate-900/50 border border-indigo-900/40">
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-indigo-900/30">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                              LIVE MARKET PAIRS RESULTS
                            </span>
                          </div>
                          <span className="text-[10px] text-indigo-400/80 font-mono">
                            Global Forex Stream
                          </span>
                        </div>
                        {liveResults.length === 0 ? (
                          <div className="text-center py-3 text-slate-500 text-xs">
                            No completed Live results recorded yet today.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {liveResults.slice(0, 3).map((sig, idx) => renderResultRow(sig, idx, 'all-live'))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mode: OTC ONLY */}
                  {resultsMarket === 'OTC' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-cyan-900/30 text-xs text-cyan-400 font-bold">
                        <span>Quotex OTC Engine Outcomes</span>
                        <span className="text-[11px] text-slate-400 font-normal">{otcResults.length} recorded</span>
                      </div>
                      {otcResults.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                          No completed OTC results recorded yet today.
                        </div>
                      ) : (
                        otcResults.slice(0, 6).map((sig, idx) => renderResultRow(sig, idx, 'otc-only'))
                      )}
                    </div>
                  )}

                  {/* Mode: LIVE ONLY */}
                  {resultsMarket === 'LIVE' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-900/30 text-xs text-indigo-400 font-bold">
                        <span>Live Market Pairs Outcomes</span>
                        <span className="text-[11px] text-slate-400 font-normal">{liveResults.length} recorded</span>
                      </div>
                      {liveResults.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                          No completed Live results recorded yet today.
                        </div>
                      ) : (
                        liveResults.slice(0, 6).map((sig, idx) => renderResultRow(sig, idx, 'live-only'))
                      )}
                    </div>
                  )}
                </div>

                {/* Signals Awaiting Results (Pending Queue) */}
                <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2.5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" /> Signals Awaiting Reported Results
                    </h3>
                    {/* Market Filter Tabs */}
                    <div suppressHydrationWarning className="flex items-center justify-between sm:justify-start gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 w-full sm:w-auto">
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setPendingMarket('ALL')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                          pendingMarket === 'ALL'
                            ? 'bg-slate-700 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setPendingMarket('OTC')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          pendingMarket === 'OTC'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 shadow-sm shadow-cyan-900/30'
                            : 'text-slate-400 hover:text-cyan-400'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        OTC ({otcPending.length})
                      </button>
                      <button
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setPendingMarket('LIVE')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                          pendingMarket === 'LIVE'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 shadow-sm shadow-indigo-900/30'
                            : 'text-slate-400 hover:text-indigo-400'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        Live ({livePending.length})
                      </button>
                    </div>
                  </div>

                  {/* Mode: ALL Pending (Segregated into 2 sections) */}
                  {pendingMarket === 'ALL' && (
                    <div className="space-y-4">
                      {/* OTC Pending */}
                      <div className="rounded-2xl p-3.5 bg-gradient-to-b from-cyan-950/20 to-slate-900/50 border border-cyan-900/40">
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-cyan-900/30">
                          <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                            OTC Signals In-Flight
                          </span>
                          <span className="text-xs text-amber-400 font-semibold">{otcPending.length} active</span>
                        </div>
                        {otcPending.length === 0 ? (
                          <div className="text-center py-3 text-slate-500 text-xs">
                            No OTC signals awaiting results.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {otcPending.slice(0, 3).map((sig, idx) => renderPendingRow(sig, idx, 'all-otc-pending'))}
                          </div>
                        )}
                      </div>

                      {/* Live Pending */}
                      <div className="rounded-2xl p-3.5 bg-gradient-to-b from-indigo-950/20 to-slate-900/50 border border-indigo-900/40">
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-indigo-900/30">
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                            Live Market Signals In-Flight
                          </span>
                          <span className="text-xs text-amber-400 font-semibold">{livePending.length} active</span>
                        </div>
                        {livePending.length === 0 ? (
                          <div className="text-center py-3 text-slate-500 text-xs">
                            No Live signals awaiting results.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {livePending.slice(0, 3).map((sig, idx) => renderPendingRow(sig, idx, 'all-live-pending'))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mode: OTC Pending Only */}
                  {pendingMarket === 'OTC' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-cyan-900/30 text-xs text-cyan-400 font-bold">
                        <span>Quotex OTC Pending Signals</span>
                        <span className="text-xs text-amber-400 font-semibold">{otcPending.length} active</span>
                      </div>
                      {otcPending.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                          No OTC signals currently awaiting reported results.
                        </div>
                      ) : (
                        otcPending.slice(0, 5).map((sig, idx) => renderPendingRow(sig, idx, 'otc-pending-only'))
                      )}
                    </div>
                  )}

                  {/* Mode: LIVE Pending Only */}
                  {pendingMarket === 'LIVE' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-indigo-900/30 text-xs text-indigo-400 font-bold">
                        <span>Live Market Pending Signals</span>
                        <span className="text-xs text-amber-400 font-semibold">{livePending.length} active</span>
                      </div>
                      {livePending.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                          No Live signals currently awaiting reported results.
                        </div>
                      ) : (
                        livePending.slice(0, 5).map((sig, idx) => renderPendingRow(sig, idx, 'live-pending-only'))
                      )}
                    </div>
                  )}
                </div>

              </div>
            );
          })()}
        </section>

        {/* Call to Action: Segregated Signal History */}
        <section className="glass-panel rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-800/80 text-center relative overflow-hidden">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-lg sm:text-xl font-bold text-white">Need Complete Segregated Historical Audits?</h3>
            <p className="text-xs text-slate-400 mt-1 mb-5 sm:mb-6">
              Access permanent database repositories with isolated OTC & Live market tables, win/loss stats, and one-click CSV exports.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
              <a
                href="/history?market=OTC"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 font-bold text-xs shadow-lg shadow-cyan-900/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Quotex OTC History</span>
              </a>
              <a
                href="/history?market=LIVE"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-bold text-xs shadow-lg shadow-indigo-900/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>Live Market History</span>
              </a>
              <a
                href="/history?market=DIVIDED"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Columns className="w-4 h-4" />
                <span>Divided Dual History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* Signal Details / Audit Modal */}
      <SignalModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060a14] py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-slate-300">PRILLS.AI Pro Terminal</span> &bull; Institutional Binary Market Analytics &bull; &copy; 2026 All Rights Reserved
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Quotex OTC Engine Active</span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Live Interbank FX Stream Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
