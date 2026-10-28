'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { SignalCard } from '../../components/SignalCard';
import { SignalTable } from '../../components/SignalTable';
import { SignalModal } from '../../components/SignalModal';
import { Signal, PaginatedSignals, TelegramStatus, DashboardStats } from '../../lib/types';
import { fetchSignals, fetchTelegramStatus, fetchDashboardStats, getWsBaseUrl } from '../../lib/api';
import { Layers, ExternalLink, ShieldCheck, ArrowLeft, TrendingUp, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';

export default function QuotexOtcPage() {
  const [signalsData, setSignalsData] = useState<PaginatedSignals>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [latestSignal, setLatestSignal] = useState<Signal | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string | number | boolean | undefined>>({ market: 'OTC', page: 1, page_size: 20 });
  const wsRef = useRef<WebSocket | null>(null);

  const loadData = async (f = filters) => {
    try {
      const [data, tgStatus, sData] = await Promise.all([
        fetchSignals({ ...f, market: 'OTC' }),
        fetchTelegramStatus(),
        fetchDashboardStats()
      ]);
      setSignalsData(data);
      if (data.items.length > 0 && !latestSignal) {
        setLatestSignal(data.items[0]);
      }
      setTelegramStatus(tgStatus);
      setStats(sData);
    } catch (err) {
      console.warn('Error fetching OTC signals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isUnmounted = false;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    Promise.all([
      fetchSignals({ ...filters, market: 'OTC' }),
      fetchTelegramStatus(),
      fetchDashboardStats()
    ]).then(([data, tgStatus, sData]) => {
      if (!isUnmounted) {
        setSignalsData(data);
        if (data.items.length > 0 && !latestSignal) {
          setLatestSignal(data.items[0]);
        }
        if (tgStatus) setTelegramStatus(tgStatus);
        if (sData) setStats(sData);
      }
    }).catch(err => {
      console.warn('Error fetching OTC signals:', err);
    }).finally(() => {
      if (!isUnmounted) setLoading(false);
    });

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

        ws.onmessage = (event) => {
          if (isUnmounted || !event.data || event.data === 'pong') return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'NEW_SIGNAL' && msg.data.market_category === 'OTC') {
              const newSig: Signal = msg.data;
              setLatestSignal(newSig);
              setSignalsData((prev) => ({
                ...prev,
                items: [newSig, ...prev.items],
                total: prev.total + 1
              }));
            } else if (msg.event === 'SIGNAL_UPDATED' && msg.data.market_category === 'OTC') {
              const updated: Signal = msg.data;
              setSignalsData((prev) => ({
                ...prev,
                items: prev.items.map((item) => (item.id === updated.id ? updated : item))
              }));
              if (latestSignal?.id === updated.id) {
                setLatestSignal(updated);
              }
            } else if (msg.event === 'CONNECTED' || msg.event === 'CONNECTION_STATUS') {
              const tg = msg.telegram_status || msg.data;
              if (tg) setTelegramStatus(tg);
            }
          } catch {
            // safe ignore
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          reconnectTimeout = setTimeout(() => {
            if (!isUnmounted) connectWs();
          }, 3000);
        };

        ws.onerror = () => {
          // Handled via onclose
        };
      } catch (err) {
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

  const handleFilterChange = (newFilters: Record<string, string | number | boolean | undefined>) => {
    setFilters(newFilters);
    loadData(newFilters);
  };

  const handlePageChange = (newPage: number) => {
    const updated = { ...filters, page: newPage };
    setFilters(updated);
    loadData(updated);
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col text-slate-100">
      <Navbar
        isConnected={wsConnected}
        telegramStatus={telegramStatus?.status}
        lastSyncAt={telegramStatus?.last_sync_at}
        onSync={() => loadData()}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 mb-2 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white">QUOTEX OTC MARKETS</h1>
                <p className="text-xs text-slate-400">
                  Strictly isolated high-frequency feed for Quotex Over-the-Counter derivative assets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-400 font-bold text-xs shrink-0 shadow-lg select-none">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Feed: Quotex OTC Engine</span>
          </div>
        </div>

        {/* Quotex OTC Performance Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-cyan-500/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quotex OTC Win Rate</span>
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-cyan-400 tracking-tight">{stats?.otc_win_rate_percentage ?? 0}%</span>
              <span className="text-xs text-slate-400 font-medium">accuracy</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {stats?.otc_win_count ?? 0} Wins
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {stats?.otc_loss_count ?? 0} Losses
              </span>
            </div>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">OTC Signals Today</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{stats?.otc_signals_today ?? signalsData.total}</span>
              <span className="text-xs text-slate-400 font-medium">signals received</span>
            </div>
            <div className="mt-3 text-xs text-slate-400">
              Isolated Quotex OTC proprietary algorithmic feed
            </div>
          </div>

          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 relative overflow-hidden group col-span-1 sm:col-span-2 md:col-span-1">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Engine Verified</span>
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-white tracking-tight">Quotex OTC Engine</span>
            </div>
            <div className="mt-3 text-xs text-cyan-400 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Direct Low-Latency Feed · Active</span>
            </div>
          </div>
        </div>

        {/* Featured Latest OTC Signal */}
        <div className="mb-8">
          <SignalCard
            signal={latestSignal}
            title="Active / Latest Quotex OTC Signal"
            category="OTC"
            sourceName="Quotex OTC Engine"
            onViewDetails={setSelectedSignal}
          />
        </div>

        {/* OTC Signal History Table */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">Quotex OTC Permanent Signal History</h2>
            <p className="text-xs text-slate-400">Complete archive of OTC signals with exact announced times and outcomes.</p>
          </div>

          <SignalTable
            signals={signalsData.items}
            total={signalsData.total}
            page={signalsData.page}
            pageSize={signalsData.page_size}
            totalPages={signalsData.total_pages}
            onPageChange={handlePageChange}
            onFilterChange={handleFilterChange}
            currentFilters={filters}
            onSelectSignal={setSelectedSignal}
            loading={loading}
          />
        </div>

      </main>

      <SignalModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
      />
    </div>
  );
}
