'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '../../components/Navbar';
import { SignalTable } from '../../components/SignalTable';
import { SignalModal } from '../../components/SignalModal';
import { Signal, PaginatedSignals, TelegramStatus, DashboardStats } from '../../lib/types';
import { fetchSignals, fetchTelegramStatus, fetchDashboardStats, getWsBaseUrl, getExportCsvUrl } from '../../lib/api';
import {
  History,
  ArrowLeft,
  Download,
  Layers,
  Globe,
  Columns,
  TrendingUp,
  CheckCircle2,
  XCircle,
  BarChart3,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

function HistoryContent() {
  const searchParams = useSearchParams();
  const initialMarket = searchParams.get('market')?.toUpperCase();

  const [activeTab, setActiveTab] = useState<'DIVIDED' | 'OTC' | 'LIVE' | 'ALL'>(
    initialMarket === 'LIVE' ? 'LIVE' : initialMarket === 'OTC' ? 'OTC' : initialMarket === 'ALL' ? 'ALL' : 'DIVIDED'
  );

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // 1. Quotex OTC Dedicated Signals State
  const [otcSignalsData, setOtcSignalsData] = useState<PaginatedSignals>({
    items: [],
    total: 0,
    page: 1,
    page_size: 15,
    total_pages: 1
  });
  const [otcFilters, setOtcFilters] = useState<Record<string, string | number | boolean | undefined>>({
    market: 'OTC',
    page: 1,
    page_size: 15
  });
  const [otcLoading, setOtcLoading] = useState(true);

  // 2. Live Market Dedicated Signals State
  const [liveSignalsData, setLiveSignalsData] = useState<PaginatedSignals>({
    items: [],
    total: 0,
    page: 1,
    page_size: 15,
    total_pages: 1
  });
  const [liveFilters, setLiveFilters] = useState<Record<string, string | number | boolean | undefined>>({
    market: 'LIVE',
    page: 1,
    page_size: 15
  });
  const [liveLoading, setLiveLoading] = useState(true);

  // 3. Combined / All Signals State
  const [allSignalsData, setAllSignalsData] = useState<PaginatedSignals>({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
    total_pages: 1
  });
  const [allFilters, setAllFilters] = useState<Record<string, string | number | boolean | undefined>>({
    page: 1,
    page_size: 25
  });
  const [allLoading, setAllLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);

  const loadOtcData = async (f = otcFilters) => {
    setOtcLoading(true);
    try {
      const data = await fetchSignals({ ...f, market: 'OTC' });
      setOtcSignalsData(data);
    } catch (err) {
      console.warn('Error loading OTC history:', err);
    } finally {
      setOtcLoading(false);
    }
  };

  const loadLiveData = async (f = liveFilters) => {
    setLiveLoading(true);
    try {
      const data = await fetchSignals({ ...f, market: 'LIVE' });
      setLiveSignalsData(data);
    } catch (err) {
      console.warn('Error loading Live history:', err);
    } finally {
      setLiveLoading(false);
    }
  };

  const loadAllData = async (f = allFilters) => {
    setAllLoading(true);
    try {
      const data = await fetchSignals(f);
      setAllSignalsData(data);
    } catch (err) {
      console.warn('Error loading All history:', err);
    } finally {
      setAllLoading(false);
    }
  };

  const refreshAllHistory = async () => {
    try {
      const tg = await fetchTelegramStatus();
      setTelegramStatus(tg);
    } catch {}
    await Promise.all([loadOtcData(), loadLiveData(), loadAllData()]);
  };

  // Initial Load
  useEffect(() => {
    let isUnmounted = false;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    Promise.all([
      fetchSignals({ ...otcFilters, market: 'OTC' }),
      fetchSignals({ ...liveFilters, market: 'LIVE' }),
      fetchSignals(allFilters),
      fetchDashboardStats(),
      fetchTelegramStatus()
    ]).then(([otc, live, all, sData, tg]) => {
      if (!isUnmounted) {
        setOtcSignalsData(otc);
        setLiveSignalsData(live);
        setAllSignalsData(all);
        setStats(sData);
        setTelegramStatus(tg);
        setOtcLoading(false);
        setLiveLoading(false);
        setAllLoading(false);
      }
    }).catch(err => {
      console.warn('History initial load error:', err);
      if (!isUnmounted) {
        setOtcLoading(false);
        setLiveLoading(false);
        setAllLoading(false);
      }
    });

    // Real-time WebSocket sync
    const connectWs = () => {
      if (isUnmounted) return;
      try {
        const ws = new WebSocket(getWsBaseUrl());
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) {
            ws.close();
            return;
          }
          setWsConnected(true);
        };

        ws.onmessage = (e) => {
          if (isUnmounted || !e.data || e.data === 'pong') return;
          try {
            const msg = JSON.parse(e.data);
            if (msg.event === 'NEW_SIGNAL' || msg.event === 'SIGNAL_UPDATED') {
              fetchDashboardStats().then(setStats).catch(() => {});
              if (msg.data?.market_category === 'OTC') {
                loadOtcData(otcFilters);
              } else if (msg.data?.market_category === 'LIVE') {
                loadLiveData(liveFilters);
              }
              loadAllData(allFilters);
            }
          } catch {}
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          reconnectTimeout = setTimeout(() => {
            if (!isUnmounted) connectWs();
          }, 3000);
        };

        ws.onerror = () => {};
      } catch {
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connectWs, 5000);
        }
      }
    };

    connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col text-slate-100 selection:bg-cyan-500 selection:text-black">
      <Navbar
        isConnected={wsConnected}
        telegramStatus={telegramStatus?.status}
        lastSyncAt={telegramStatus?.last_sync_at}
        onSync={refreshAllHistory}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-8">
        
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 mb-2 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">Permanent Signal History</h1>
                <p className="text-xs text-slate-400">
                  Isolated repositories for Quotex OTC and Live Forex streams with full verification audits.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <a
              href={getExportCsvUrl('OTC')}
              download
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-cyan-950/70 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 font-bold text-xs transition-colors shadow-lg active:scale-95 text-center"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export OTC CSV</span>
            </a>
            <a
              href={getExportCsvUrl('LIVE')}
              download
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-indigo-950/70 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 font-bold text-xs transition-colors shadow-lg active:scale-95 text-center"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Live CSV</span>
            </a>
          </div>
        </div>

        {/* PROMINENT MARKET SEGREGATION SWITCHER (TABS) */}
        <div suppressHydrationWarning className="glass-panel p-1.5 sm:p-2 rounded-2xl border border-slate-800/80 mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-1.5 sm:gap-2">
          
          {/* TAB 1: DIVIDED SEPARATED VIEW */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab('DIVIDED')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'DIVIDED'
                ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>DIVIDED (SEPARATED TABLES)</span>
          </button>

          {/* TAB 2: QUOTEX OTC ONLY */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab('OTC')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'OTC'
                ? 'bg-cyan-950/90 text-cyan-200 border-2 border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>QUOTEX OTC HISTORY</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 font-mono">
              {otcSignalsData.total}
            </span>
          </button>

          {/* TAB 3: LIVE MARKET ONLY */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab('LIVE')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'LIVE'
                ? 'bg-indigo-950/90 text-indigo-200 border-2 border-indigo-400 shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>LIVE MARKET HISTORY</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 font-mono">
              {liveSignalsData.total}
            </span>
          </button>

          {/* TAB 4: COMBINED ALL */}
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-emerald-950/90 text-emerald-200 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>ALL COMBINED ARCHIVE</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 font-mono">
              {allSignalsData.total}
            </span>
          </button>

        </div>

        {/* PERFORMANCE SNAPSHOT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          
          {/* OTC Accuracy */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-cyan-500/30 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Quotex OTC Accuracy
              </span>
              <span className="text-[10px] text-cyan-400/80 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded">
                OTC Engine
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-cyan-400">{stats?.otc_win_rate_percentage ?? 0}%</span>
              <span className="text-xs text-slate-400">({otcSignalsData.total} signals total)</span>
            </div>
            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-2 font-medium">
              <span>{stats?.otc_win_count ?? 0} Wins</span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400">{stats?.otc_loss_count ?? 0} Losses</span>
            </div>
          </div>

          {/* Live Market Accuracy */}
          <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Live Forex Accuracy
              </span>
              <span className="text-[10px] text-indigo-400/80 font-mono bg-indigo-950/60 px-1.5 py-0.5 rounded">
                FX Stream
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-indigo-400">{stats?.live_win_rate_percentage ?? 0}%</span>
              <span className="text-xs text-slate-400">({liveSignalsData.total} signals total)</span>
            </div>
            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-2 font-medium">
              <span>{stats?.live_win_count ?? 0} Wins</span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400">{stats?.live_loss_count ?? 0} Losses</span>
            </div>
          </div>

          {/* Total Signals In Archive */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Total Ingested Signals
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-white">{allSignalsData.total}</span>
              <span className="text-xs text-slate-400">permanent records</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Persisted in SQLite database across reboots</p>
          </div>

          {/* Status Integrity */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Segregation Engine
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">100% Isolated</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Zero cross-pair contamination between feeds</p>
          </div>

        </div>

        {/* VIEW MODE 1: DIVIDED SEPARATED TABLES (BOTH MARKETS SHOWN IN THEIR OWN DEDICATED SECTIONS) */}
        {activeTab === 'DIVIDED' && (
          <div className="space-y-12">
            
            {/* 1. Dedicated Quotex OTC Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-cyan-800/40 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      QUOTEX OTC MARKET SIGNAL HISTORY
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                        {otcSignalsData.total} Signals
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">Strictly isolated Quotex Over-the-Counter derivative signals</p>
                  </div>
                </div>

                <a
                  href={getExportCsvUrl('OTC')}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-xs font-semibold transition-colors w-fit"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download OTC CSV</span>
                </a>
              </div>

              <SignalTable
                signals={otcSignalsData.items}
                total={otcSignalsData.total}
                page={otcSignalsData.page}
                pageSize={otcSignalsData.page_size}
                totalPages={otcSignalsData.total_pages}
                onPageChange={(p) => {
                  const updated = { ...otcFilters, page: p };
                  setOtcFilters(updated);
                  loadOtcData(updated);
                }}
                onFilterChange={(f) => {
                  const updated = { ...f, market: 'OTC' };
                  setOtcFilters(updated);
                  loadOtcData(updated);
                }}
                currentFilters={otcFilters}
                onSelectSignal={setSelectedSignal}
                loading={otcLoading}
                hideMarketFilter={true}
              />
            </div>

            {/* 2. Dedicated Live Market Pairs Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-800/40 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      LIVE MARKET PAIRS SIGNAL HISTORY
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800">
                        {liveSignalsData.total} Signals
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">Strictly isolated live broker forex & interbank currency pairs</p>
                  </div>
                </div>

                <a
                  href={getExportCsvUrl('LIVE')}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 text-xs font-semibold transition-colors w-fit"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Live Forex CSV</span>
                </a>
              </div>

              <SignalTable
                signals={liveSignalsData.items}
                total={liveSignalsData.total}
                page={liveSignalsData.page}
                pageSize={liveSignalsData.page_size}
                totalPages={liveSignalsData.total_pages}
                onPageChange={(p) => {
                  const updated = { ...liveFilters, page: p };
                  setLiveFilters(updated);
                  loadLiveData(updated);
                }}
                onFilterChange={(f) => {
                  const updated = { ...f, market: 'LIVE' };
                  setLiveFilters(updated);
                  loadLiveData(updated);
                }}
                currentFilters={liveFilters}
                onSelectSignal={setSelectedSignal}
                loading={liveLoading}
                hideMarketFilter={true}
              />
            </div>

          </div>
        )}

        {/* VIEW MODE 2: QUOTEX OTC FOCUSED VIEW */}
        {activeTab === 'OTC' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-cyan-800/40 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    QUOTEX OTC DEDICATED HISTORY
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                      {otcSignalsData.total} Records
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">Strictly isolated Quotex Over-the-Counter derivative signals</p>
                </div>
              </div>

              <a
                href={getExportCsvUrl('OTC')}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-950/70 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 font-bold text-xs transition-colors shadow-lg w-fit"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Quotex OTC CSV</span>
              </a>
            </div>

            <SignalTable
              signals={otcSignalsData.items}
              total={otcSignalsData.total}
              page={otcSignalsData.page}
              pageSize={otcSignalsData.page_size}
              totalPages={otcSignalsData.total_pages}
              onPageChange={(p) => {
                const updated = { ...otcFilters, page: p };
                setOtcFilters(updated);
                loadOtcData(updated);
              }}
              onFilterChange={(f) => {
                const updated = { ...f, market: 'OTC' };
                setOtcFilters(updated);
                loadOtcData(updated);
              }}
              currentFilters={otcFilters}
              onSelectSignal={setSelectedSignal}
              loading={otcLoading}
              hideMarketFilter={true}
            />
          </div>
        )}

        {/* VIEW MODE 3: LIVE MARKET FOCUSED VIEW */}
        {activeTab === 'LIVE' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-800/40 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    LIVE MARKET PAIRS DEDICATED HISTORY
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800">
                      {liveSignalsData.total} Records
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">Strictly isolated live broker forex & interbank currency pairs</p>
                </div>
              </div>

              <a
                href={getExportCsvUrl('LIVE')}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-950/70 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 font-bold text-xs transition-colors shadow-lg w-fit"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Live Forex CSV</span>
              </a>
            </div>

            <SignalTable
              signals={liveSignalsData.items}
              total={liveSignalsData.total}
              page={liveSignalsData.page}
              pageSize={liveSignalsData.page_size}
              totalPages={liveSignalsData.total_pages}
              onPageChange={(p) => {
                const updated = { ...liveFilters, page: p };
                setLiveFilters(updated);
                loadLiveData(updated);
              }}
              onFilterChange={(f) => {
                const updated = { ...f, market: 'LIVE' };
                setLiveFilters(updated);
                loadLiveData(updated);
              }}
              currentFilters={liveFilters}
              onSelectSignal={setSelectedSignal}
              loading={liveLoading}
              hideMarketFilter={true}
            />
          </div>
        )}

        {/* VIEW MODE 4: COMBINED ALL ARCHIVE */}
        {activeTab === 'ALL' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-700">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    ALL MARKETS AGGREGATED HISTORY
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {allSignalsData.total} Records
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">Combined audit trail with market filter controls</p>
                </div>
              </div>

              <a
                href={getExportCsvUrl(
                  typeof allFilters.market === 'string' ? allFilters.market : undefined,
                  typeof allFilters.status === 'string' ? allFilters.status : undefined
                )}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors shadow-lg w-fit"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Combined CSV</span>
              </a>
            </div>

            <SignalTable
              signals={allSignalsData.items}
              total={allSignalsData.total}
              page={allSignalsData.page}
              pageSize={allSignalsData.page_size}
              totalPages={allSignalsData.total_pages}
              onPageChange={(p) => {
                const updated = { ...allFilters, page: p };
                setAllFilters(updated);
                loadAllData(updated);
              }}
              onFilterChange={(f) => {
                setAllFilters(f);
                loadAllData(f);
              }}
              currentFilters={allFilters}
              onSelectSignal={setSelectedSignal}
              loading={allLoading}
              hideMarketFilter={false}
            />
          </div>
        )}

      </main>

      {/* Signal Details Audit Modal */}
      <SignalModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080d1a]" />}>
      <HistoryContent />
    </Suspense>
  );
}
