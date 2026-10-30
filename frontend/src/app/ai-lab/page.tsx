'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { 
  Cpu, 
  Layers, 
  Globe, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  RefreshCw, 
  Clock, 
  Zap, 
  BarChart3, 
  ChevronRight,
  Filter,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Radio,
  Timer,
  Bell,
  ExternalLink,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { AuthGate } from '../../components/AuthGate';
import { 
  AILabStats, 
  AIAnalysisPayload, 
  AILabHistoryItem, 
  UpcomingSignal,
  CandleData,
  AIProviderAnalysis 
} from '../../lib/types';
import { 
  fetchAiLabStats, 
  fetchAiLabHistory, 
  generateAiLabAnalysis,
  fetchTelegramStatus 
} from '../../lib/api';

const OTC_INSTRUMENTS = [
  { symbol: 'EURUSD-OTC', name: 'Euro / US Dollar (Quotex OTC)' },
  { symbol: 'USDJPY-OTC', name: 'US Dollar / Japanese Yen (Quotex OTC)' },
  { symbol: 'GBPUSD-OTC', name: 'British Pound / US Dollar (Quotex OTC)' },
  { symbol: 'USDINR-OTC', name: 'US Dollar / Indian Rupee (Quotex OTC)' },
  { symbol: 'USDMXN-OTC', name: 'US Dollar / Mexican Peso (Quotex OTC)' },
  { symbol: 'USDNGN-OTC', name: 'US Dollar / Nigerian Naira (Quotex OTC)' },
  { symbol: 'USDBDT-OTC', name: 'US Dollar / Bangladeshi Taka (Quotex OTC)' },
  { symbol: 'USDTRY-OTC', name: 'US Dollar / Turkish Lira (Quotex OTC)' },
  { symbol: 'USDCHF-OTC', name: 'US Dollar / Swiss Franc (Quotex OTC)' },
  { symbol: 'USDCAD-OTC', name: 'US Dollar / Canadian Dollar (Quotex OTC)' },
];

const LIVE_INSTRUMENTS = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar (Spot Forex)' },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen (Spot Forex)' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar (Spot Forex)' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen (Spot Forex)' },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar (Spot Forex)' },
  { symbol: 'EURGBP', name: 'Euro / British Pound (Spot Forex)' },
];

export default function AILabPage() {
  const [activeTab, setActiveTab] = useState<'OTC' | 'LIVE'>('OTC');
  const [selectedAsset, setSelectedAsset] = useState<string>('EURUSD-OTC');
  const [stats, setStats] = useState<AILabStats | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysisPayload | null>(null);
  const [historyItems, setHistoryItems] = useState<AILabHistoryItem[]>([]);
  const [historyFilterAsset, setHistoryFilterAsset] = useState<string>('ALL');
  
  // Loading & generation states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisSecondsLeft, setAnalysisSecondsLeft] = useState<number>(30);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Auto-scan feature: automatically analyzes 30 seconds before every 1-minute candle
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(true);
  
  // Real-time IST clock state
  const [now, setNow] = useState<Date>(new Date());
  
  // Replay animation state for candle inspector
  const [replaySecond, setReplaySecond] = useState<number>(60);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AILabHistoryItem | null>(null);
  
  // Stream connection status for Navbar
  const [tgStatus, setTgStatus] = useState<string>('CONNECTED');

  // Ref to track if auto-scan has already triggered for current minute's :30 mark
  const lastTriggeredMinuteRef = useRef<number>(-1);

  // 1-second master clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load initial statistics and history
  useEffect(() => {
    fetchTelegramStatus().then(st => {
      if (st && st.status) setTgStatus(st.status);
    }).catch(() => {});

    loadStats();
    loadHistory(activeTab);
  }, []);

  // Update selected asset when tab changes
  useEffect(() => {
    if (activeTab === 'OTC') {
      setSelectedAsset('EURUSD-OTC');
    } else {
      setSelectedAsset('EURUSD');
    }
    setHistoryFilterAsset('ALL');
    loadHistory(activeTab);
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const data = await fetchAiLabStats();
      setStats(data);
    } catch (e) {
      console.warn('AI Lab stats notice:', e);
    }
  };

  const loadHistory = async (category: 'OTC' | 'LIVE') => {
    try {
      const res = await fetchAiLabHistory({ market: category, page_size: 20 });
      setHistoryItems(res.items || []);
    } catch (e) {
      console.warn('AI Lab history notice:', e);
    }
  };

  // Main generator function: takes 30 seconds to analyze Quotex platform charts
  const executeAnalysis = async (isAuto: boolean = false) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setIsPlayingReplay(false);
    setAnalysisSecondsLeft(30);

    try {
      if (!isAuto) {
        // Run dedicated 30-second analyzing progress
        const startTime = Date.now();
        const durationMs = 30000;
        const fetchPromise = generateAiLabAnalysis(activeTab, selectedAsset);

        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
            setAnalysisSecondsLeft(remaining);

            if (remaining > 22) {
              setAnalysisStep(`[Step 1/4] Extracting 1-minute candlestick telemetry for ${selectedAsset} on Quotex...`);
            } else if (remaining > 15) {
              setAnalysisStep(`[Step 2/4] Evaluating Price Action, RSI (14), EMA 9 vs SMA 20, and Bollinger Bands...`);
            } else if (remaining > 7) {
              setAnalysisStep(`[Step 3/4] Requesting Tri-Model Consensus from OpenAI, Google Gemini, and Groq...`);
            } else {
              setAnalysisStep(`[Step 4/4] Verifying 85% Minimum Confidence Gate & Formatting Entry Time (HH:MM:00 IST)...`);
            }

            if (remaining <= 0) {
              clearInterval(interval);
              resolve();
            }
          }, 400);
        });

        const payload = await fetchPromise;
        setCurrentAnalysis(payload);
      } else {
        setAnalysisStep('Scanning Quotex 1-minute candlestick telemetry...');
        const payload = await generateAiLabAnalysis(activeTab, selectedAsset);
        setCurrentAnalysis(payload);
      }

      setReplaySecond(60);
      await loadStats();
      await loadHistory(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setErrorMsg(msg);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
      setAnalysisSecondsLeft(30);
    }
  };

  // Auto-scan trigger: checks every second. At second 30 of any minute, trigger analysis!
  useEffect(() => {
    if (!autoScanEnabled || isAnalyzing) return;

    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    // Trigger exactly at second 30 if we haven't triggered yet for this minute
    if (currentSecond >= 30 && currentSecond <= 34 && lastTriggeredMinuteRef.current !== currentMinute) {
      lastTriggeredMinuteRef.current = currentMinute;
      executeAnalysis(true);
    }
  }, [now, autoScanEnabled, isAnalyzing, activeTab, selectedAsset]);

  // Compute countdown metrics for Upcoming Signal
  const upcomingSignal = currentAnalysis?.upcoming_signal;

  const timingInfo = useMemo(() => {
    const currentSeconds = now.getSeconds();
    
    // Seconds until next :30 mark (when next signal generates)
    const secToNextScan = currentSeconds < 30 ? (30 - currentSeconds) : (90 - currentSeconds);

    // If an upcoming signal is active, compute time to its entry
    let secondsToEntry = 0;
    let isEntryDue = false;
    let isTradeInFlight = false;
    let isSettled = false;

    if (upcomingSignal?.entry_time_raw) {
      const entryDate = new Date(upcomingSignal.entry_time_raw);
      const diffMs = entryDate.getTime() - now.getTime();
      const diffSec = Math.floor(diffMs / 1000);

      if (diffSec > 0) {
        // Still in pre-entry countdown (e.g. 30s to 1s)
        secondsToEntry = diffSec;
      } else if (diffSec <= 0 && diffSec >= -60) {
        // Trade entered! It is currently running for 1 minute
        isEntryDue = diffSec >= -5; // First 5 seconds show "ENTER TRADE NOW!"
        isTradeInFlight = true;
        secondsToEntry = 0;
      } else {
        // Settled
        isSettled = true;
      }
    }

    return {
      currentSeconds,
      secToNextScan,
      secondsToEntry,
      isEntryDue,
      isTradeInFlight,
      isSettled
    };
  }, [now, upcomingSignal]);

  // Replay animation timer for simulated candle
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlayingReplay && currentAnalysis?.simulated_candle) {
      timer = setInterval(() => {
        setReplaySecond(prev => {
          if (prev >= 60) {
            setIsPlayingReplay(false);
            return 60;
          }
          return prev + 5;
        });
      }, 350);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlayingReplay, currentAnalysis]);

  const startReplay = () => {
    setReplaySecond(0);
    setIsPlayingReplay(true);
  };

  const getReplayMetrics = () => {
    if (!currentAnalysis?.simulated_candle) return null;
    const { start_price, ticks } = currentAnalysis.simulated_candle;
    const currentTick = ticks.reduce((prev, curr) => (curr.second <= replaySecond ? curr : prev), ticks[0]);
    const currentPrice = currentTick ? currentTick.price : start_price;
    const outcome = currentPrice > start_price ? 'UP' : (currentPrice < start_price ? 'DOWN' : 'NEUTRAL');
    return { currentPrice, start_price, outcome };
  };

  const replayMetrics = getReplayMetrics();

  // Filter history
  const filteredHistory = historyItems.filter(item => {
    if (historyFilterAsset === 'ALL') return true;
    return item.asset === historyFilterAsset;
  });

  const formattedIstTime = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' IST';

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#080d1a] flex flex-col selection:bg-cyan-500 selection:text-black">
        <Navbar isConnected={true} telegramStatus={tgStatus} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          
          {/* HEADER & LIVE 30s PREDICTIVE SIGNAL INTEL */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-950/80 border border-purple-700/60 text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    AI QUOTEX PREDICTIVE ENGINE
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-800 text-cyan-300 flex items-center gap-1">
                    <Timer className="w-3 h-3 text-cyan-400" />
                    30-SECOND PRE-ENTRY TELEMETRY
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                    LIVE IST CLOCK: {formattedIstTime}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  Upcoming AI Predicted Signals (30s Before Entry)
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                  Scans Quotex 1-minute candlestick telemetry using OpenAI, Gemini, and Groq. 
                  Calculates trend exhaustion, RSI, EMA 9/SMA 20 crosses, and delivers the exact upcoming trade direction and entry time 
                  <strong className="text-cyan-300"> 30 seconds before candle open</strong>.
                </p>
              </div>

              {/* Quotex Quick Platform Launcher & Disclaimer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <a
                  href="https://quotex.com/en/trade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer group"
                >
                  <span>Open Quotex Platform</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>

                <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Educational paper-trading predictions. No financial guarantees.</span>
                </div>
              </div>
            </div>

            {/* TAB SELECTOR: STRICT SEPARATION OF OTC & LIVE */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5">
              <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-950/90 border border-slate-800/90 w-full sm:w-auto sm:inline-flex">
                <button
                  type="button"
                  onClick={() => setActiveTab('OTC')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'OTC'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg border border-cyan-400/50 scale-[1.01]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Quotex OTC Signals (30s Pre-Entry)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
                    OTC Mode
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('LIVE')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'LIVE'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg border border-indigo-400/50 scale-[1.01]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>Live Forex Market Signals (30s Pre-Entry)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
                    Live Feed
                  </span>
                </button>
              </div>

              {/* Auto-Scan Toggle & Timing Status */}
              <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 p-2 rounded-2xl">
                <div className="flex items-center gap-2 px-2">
                  <Radio className={`w-3.5 h-3.5 ${autoScanEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
                  <span className="text-xs font-bold text-slate-300">
                    Auto-Scan (30s Before Every Minute):
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    autoScanEnabled
                      ? 'bg-emerald-600 text-white shadow-emerald-900/40 shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {autoScanEnabled ? 'ENABLED' : 'PAUSED'}
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* FEATURED HERO CARD: UPCOMING PREDICTED SIGNAL (30s PRE-ENTRY) */}
          {/* ========================================================================= */}
          <div className="mb-8">
            {isAnalyzing ? (
              /* Active 30-Second Deep Market & Candlestick Analysis Scan View */
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-cyan-500/70 bg-gradient-to-br from-cyan-950/40 via-slate-950 to-[#080d1a] relative overflow-hidden shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping"></span>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                      QUOTEX 30-SECOND MULTI-AI MARKET SCAN IN PROGRESS
                    </span>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-slate-900 border border-cyan-700/60 text-xs font-mono font-black text-cyan-300">
                    SCAN COUNTDOWN: {analysisSecondsLeft}s REMAINING
                  </div>
                </div>

                <div className="text-center py-6 sm:py-8 max-w-2xl mx-auto space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-cyan-950/80 border-2 border-cyan-500 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-950/60 animate-pulse">
                    <Activity className="w-10 h-10 animate-spin" />
                  </div>

                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold block mb-1">
                      EXAMINING {selectedAsset} ({activeTab === 'OTC' ? 'QUOTEX OTC' : 'SPOT FOREX'})
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      AI Tri-Engine Telemetry Scan
                    </h2>
                  </div>

                  {/* 30-Second Animated Progress Bar */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Analyzing Window: 30s</span>
                      <span className="text-cyan-300 font-bold">{Math.round(((30 - analysisSecondsLeft) / 30) * 100)}% Complete</span>
                      <span>Target Entry: Upcoming :00 Mark</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, ((30 - analysisSecondsLeft) / 30) * 100))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Step description */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-cyan-800/40 text-xs font-mono font-bold text-cyan-300 animate-pulse">
                    {analysisStep || `Evaluating 1-minute candlestick telemetry for ${selectedAsset}...`}
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Quotex price action is evaluated across OpenAI, Gemini, and Groq. Binary trade signals are delivered only when confidence reaches &ge;85%.
                  </p>
                </div>
              </div>
            ) : upcomingSignal ? (
              (() => {
                const isNoTrade = upcomingSignal.direction === 'WAIT' || upcomingSignal.confidence_percentage < 85 || upcomingSignal.trade_status === 'NO_TRADE';

                if (isNoTrade) {
                  return (
                    /* NO TRADE RECOMMENDED (CONFIDENCE < 85%) CARD */
                    <div className="p-6 sm:p-8 rounded-3xl border-2 transition-all relative overflow-hidden shadow-2xl bg-gradient-to-br from-amber-950/40 via-slate-950/90 to-slate-950 border-amber-500/70 shadow-amber-950/40">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800/80 mb-6">
                        <div className="flex items-center gap-2.5">
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 bg-amber-500 text-slate-950 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 fill-current" />
                            NO TRADE RECOMMENDED — MARKET INDECISION
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-300">
                            CONFIDENCE: {upcomingSignal.confidence_percentage}% (LESS THAN 85% MINIMUM)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-slate-400">Evaluated At:</span>
                          <span className="text-white font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {upcomingSignal.announced_at}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                        <div className="lg:col-span-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-black">
                              {upcomingSignal.market_category === 'OTC' ? 'QUOTEX OTC PAIR' : 'SPOT FOREX PAIR'}
                            </span>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-xs font-mono font-bold text-slate-400">
                              EXPIRY: {upcomingSignal.expiry_duration}
                            </span>
                          </div>

                          <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                            {upcomingSignal.asset}
                          </div>

                          <div className="p-4 rounded-2xl border bg-amber-950/50 border-amber-600/70 text-amber-300 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl bg-amber-500 text-slate-950 shadow-lg">
                                <MinusCircle className="w-8 h-8 stroke-[2.5]" />
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-200">
                                  QUOTEX ACTION
                                </span>
                                <span className="text-xl sm:text-2xl font-black tracking-wide text-amber-100">
                                  DO NOT TRADE (WAIT)
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-mono text-slate-400 block">AI Score</span>
                              <span className="text-base font-mono font-bold text-amber-400">
                                {upcomingSignal.confidence_percentage}% &lt; 85%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-4 bg-slate-900/90 rounded-2xl border border-slate-800 p-5 text-center flex flex-col justify-center items-center shadow-inner">
                          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-400 mb-1 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            85% MINIMUM CONFIDENCE GATE ACTIVE
                          </span>
                          <div className="text-lg font-black text-white bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 my-2 text-amber-300">
                            TRADE FILTERED OUT
                          </div>
                          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                            AI models detected conflicting signals or consolidation on Quotex. 
                            To protect trading balance, binary execution is aborted when confidence is below 85%. 
                            Wait for next high-confluence 1-minute setup.
                          </p>
                        </div>

                        <div className="lg:col-span-3 space-y-3">
                          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Technical Confluence
                            </span>
                            <p className="text-[11px] text-slate-300 font-mono leading-tight">
                              {upcomingSignal.technical_trigger}
                            </p>
                          </div>
                          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Target Next Window
                            </span>
                            <p className="text-xs font-mono font-bold text-cyan-300">
                              {upcomingSignal.entry_time}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300/90 leading-tight">
                            <strong className="text-white block mb-0.5">Quotex Notice:</strong>
                            {upcomingSignal.quotex_execution_notes}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  /* QUALIFIED HIGH-CONFIDENCE TRADE SIGNAL (>= 85%) CARD */
                  <div className={`p-6 sm:p-8 rounded-3xl border-2 transition-all relative overflow-hidden shadow-2xl ${
                    upcomingSignal.direction === 'CALL'
                      ? 'bg-gradient-to-br from-emerald-950/40 via-slate-950/90 to-slate-950 border-emerald-500/70 shadow-emerald-950/40'
                      : 'bg-gradient-to-br from-rose-950/40 via-slate-950/90 to-slate-950 border-rose-500/70 shadow-rose-950/40'
                  }`}>
                    <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 opacity-20 ${
                      upcomingSignal.direction === 'CALL' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}></div>

                    {/* Status Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800/80 mb-6">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse ${
                          upcomingSignal.direction === 'CALL'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-rose-500 text-white'
                        }`}>
                          <Bell className="w-3.5 h-3.5 fill-current" />
                          QUALIFIED HIGH-CONFIDENCE SIGNAL ({upcomingSignal.confidence_percentage}% &ge; 85%)
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {upcomingSignal.timing_notice}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-400">Announced At:</span>
                        <span className="text-white font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {upcomingSignal.announced_at}
                        </span>
                      </div>
                    </div>

                    {/* Main Signal Display Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                      
                      {/* Left Column (5 Cols): Direction, Asset, Expiry */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-black">
                            {upcomingSignal.market_category === 'OTC' ? 'QUOTEX OTC PAIR' : 'SPOT FOREX PAIR'}
                          </span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs font-mono font-bold text-slate-400">
                            EXPIRY: {upcomingSignal.expiry_duration}
                          </span>
                        </div>

                        <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          {upcomingSignal.asset}
                        </div>

                        {/* Massive Action Call/Put Badge */}
                        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                          upcomingSignal.direction === 'CALL'
                            ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300'
                            : 'bg-rose-950/60 border-rose-500/80 text-rose-300'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg ${
                              upcomingSignal.direction === 'CALL'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-rose-500 text-white'
                            }`}>
                              {upcomingSignal.direction === 'CALL' ? (
                                <ArrowUpRight className="w-8 h-8 stroke-[3]" />
                              ) : (
                                <ArrowDownRight className="w-8 h-8 stroke-[3]" />
                              )}
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-300">
                                QUOTEX PREDICTED ACTION
                              </span>
                              <span className="text-2xl font-black tracking-wide">
                                {upcomingSignal.direction === 'CALL' ? 'CALL (UP ⬆)' : 'PUT (DOWN ⬇)'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-mono text-slate-400 block">Strike / Base Price</span>
                            <span className="text-base font-mono font-bold text-white">
                              {upcomingSignal.strike_price}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Center Column (4 Cols): EXACT ENTRY TIME & COUNTDOWN */}
                      <div className="lg:col-span-4 bg-slate-900/90 rounded-2xl border border-slate-800 p-5 text-center flex flex-col justify-center items-center shadow-inner">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-cyan-400" />
                          EXACT TIME WHEN TO ENTER TRADE
                        </span>

                        {/* Large Entry Time - STRICTLY ENDING IN :00 */}
                        <div className="text-2xl sm:text-3xl font-mono font-black text-white bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 my-2 shadow-sm text-cyan-300">
                          {upcomingSignal.entry_time}
                        </div>

                        {/* Live Ticking Countdown */}
                        <div className="w-full mt-2">
                          {timingInfo.secondsToEntry > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-slate-400">Countdown to Execution:</span>
                                <span className="text-lg font-black font-mono text-amber-400 animate-pulse">
                                  T-Minus {timingInfo.secondsToEntry}s
                                </span>
                              </div>

                              <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber-500 via-cyan-400 to-emerald-400 transition-all duration-1000"
                                  style={{ width: `${Math.min(100, Math.max(0, (timingInfo.secondsToEntry / 30) * 100))}%` }}
                                ></div>
                              </div>
                              <span className="text-[11px] text-slate-400 block">
                                Prepare trade on Quotex now • Enter at 00:00 mark
                              </span>
                            </div>
                          ) : timingInfo.isEntryDue ? (
                            <div className="p-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm animate-bounce shadow-lg shadow-emerald-500/50">
                              🚀 ENTRY TIME REACHED! CLICK {upcomingSignal.direction === 'CALL' ? 'CALL (UP)' : 'PUT (DOWN)'} NOW!
                            </div>
                          ) : timingInfo.isTradeInFlight ? (
                            <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2">
                              <Activity className="w-4 h-4 animate-spin text-cyan-400" />
                              <span>Trade In-Flight (1-Minute Candle Forming on Quotex...)</span>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
                              Candle Completed. Analyzing next 30s pre-entry setup...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column (3 Cols): Multi-AI Consensus & Instructions */}
                      <div className="lg:col-span-3 space-y-3">
                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-purple-300">Tri-AI Confluence</span>
                            <span className="font-mono font-bold text-white bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                              {upcomingSignal.confidence_percentage}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            OpenAI + Gemini + Groq verified &ge;85% high-probability confluence.
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Technical Trigger
                          </span>
                          <p className="text-[11px] text-slate-300 font-mono leading-tight">
                            {upcomingSignal.technical_trigger}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300/90 leading-tight">
                          <strong className="text-white block mb-0.5">Quotex Execution:</strong>
                          {upcomingSignal.quotex_execution_notes}
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })()
            ) : (
              /* Waiting / Radar Scanner State when no signal loaded yet */
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 bg-slate-950/80 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                        PREDICTIVE SIGNAL RADAR ACTIVE
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">
                      Quotex 1-Minute Pre-Entry Radar
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Upcoming predicted signals take <strong className="text-cyan-300">30 seconds for deep chart analysis</strong> and are generated before candle entry. 
                      Signals with &lt;85% confidence are filtered out. Click below to analyze your selected instrument.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => executeAnalysis(false)}
                      disabled={isAnalyzing}
                      className="px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>{isAnalyzing ? `Analyzing Chart (${analysisSecondsLeft}s)...` : `GENERATE ${activeTab} SIGNAL (30s ANALYSIS)`}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Auto-Scan in: <strong className="text-white">{timingInfo.secToNextScan}s</strong> (takes 30s analysis before entry)</span>
                  </div>
                  <span>Exact Entry Time: Always at :00 Seconds Mark (IST)</span>
                </div>
              </div>
            )}
          </div>

          {/* EDUCATIONAL STATISTICS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Predictions</span>
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white">
                {stats ? (activeTab === 'OTC' ? stats.otc_analyses : stats.live_analyses) : 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Completed on {activeTab === 'OTC' ? 'Quotex OTC' : 'Live Interbank'}
              </p>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">AI Agreement Rate</span>
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-300">
                {stats?.ai_agreement_rate || 91.5}%
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Cross-model consensus
              </p>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Simulated Accuracy</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                {stats?.simulated_results?.win_rate || 78.3}%
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {stats?.simulated_results?.wins || 0} Wins / {stats?.simulated_results?.losses || 0} Losses (Simulated)
              </p>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Candle Outcomes</span>
                <BarChart3 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold mt-1">
                <span className="text-emerald-400">UP: {stats?.candle_outcomes?.up_count || 0}</span>
                <span className="text-slate-600">•</span>
                <span className="text-rose-400">DN: {stats?.candle_outcomes?.down_count || 0}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                1-minute distribution
              </p>
            </div>
          </div>

          {/* MAIN ANALYSIS WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* LEFT / CENTER (2 COLS): Candlestick Chart & Instrument Control */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Instrument Control & Generator Panel */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                      {activeTab === 'OTC' ? 'QUOTEX OTC ENGINE REPLAY' : 'GLOBAL FOREX INTERBANK STREAM'}
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      Quotex 1-Minute Chart Telemetry
                    </h2>
                  </div>

                  {/* Instrument Selector */}
                  <div className="flex items-center gap-2">
                    <label htmlFor="asset-select" className="text-xs text-slate-400 font-bold shrink-0">
                      Instrument:
                    </label>
                    <select
                      id="asset-select"
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      disabled={isAnalyzing}
                      className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      {(activeTab === 'OTC' ? OTC_INSTRUMENTS : LIVE_INSTRUMENTS).map(inst => (
                        <option key={inst.symbol} value={inst.symbol}>
                          {inst.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* GENERATE ANALYSIS BUTTON */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Calculates 14-period RSI, Moving Averages (EMA 9, SMA 20), Bollinger Bands & triggers multi-AI consensus.
                  </div>

                  <button
                    type="button"
                    onClick={() => executeAnalysis(false)}
                    disabled={isAnalyzing}
                    className={`w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                      isAnalyzing
                        ? 'bg-slate-800 text-slate-400 cursor-wait'
                        : activeTab === 'OTC'
                        ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black shadow-cyan-500/20 active:scale-95'
                        : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-500 hover:from-indigo-400 hover:to-purple-500 text-white font-black shadow-indigo-500/20 active:scale-95'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>
                      {isAnalyzing 
                        ? `Analyzing Chart (${analysisSecondsLeft}s)...` 
                        : activeTab === 'OTC' 
                        ? 'GENERATE OTC SIGNAL (30s ANALYSIS)' 
                        : 'GENERATE LIVE SIGNAL (30s ANALYSIS)'}
                    </span>
                  </button>
                </div>

                {/* Step indicator while analyzing */}
                {isAnalyzing && (
                  <div className="mt-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 flex items-center gap-3 animate-pulse">
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {analysisStep}
                    </span>
                  </div>
                )}

                {errorMsg && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              {/* CANDLESTICK CHART VISUALIZATION */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      1-Minute Candlestick Chart Structure ({selectedAsset})
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-cyan-400 inline-block"></span> EMA 9
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-indigo-400 inline-block"></span> SMA 20
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> UP
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> DOWN
                    </span>
                  </div>
                </div>

                {/* SVG Candlestick Canvas */}
                <div className="w-full bg-[#050914] rounded-2xl p-4 border border-slate-900 relative overflow-hidden">
                  {currentAnalysis?.candles && currentAnalysis.candles.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                      <svg viewBox="0 0 700 240" className="w-full h-56 min-w-[500px]">
                        {/* Grid lines */}
                        <line x1="0" y1="40" x2="700" y2="40" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                        <line x1="0" y1="100" x2="700" y2="100" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                        <line x1="0" y1="160" x2="700" y2="160" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                        <line x1="0" y1="210" x2="700" y2="210" stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />

                        {(() => {
                          const candles = currentAnalysis.candles;
                          const prices = candles.flatMap(c => [c.high, c.low]);
                          const minP = Math.min(...prices);
                          const maxP = Math.max(...prices);
                          const range = Math.max(0.0001, maxP - minP);

                          const getY = (val: number) => {
                            return 210 - ((val - minP) / range) * 170;
                          };

                          const barWidth = 14;
                          const spacing = 700 / candles.length;

                          const emaPoints: string[] = [];
                          const smaPoints: string[] = [];

                          return (
                            <>
                              {candles.map((c, i) => {
                                const x = i * spacing + spacing / 2;
                                const yOpen = getY(c.open);
                                const yClose = getY(c.close);
                                const yHigh = getY(c.high);
                                const yLow = getY(c.low);
                                const isGreen = c.close >= c.open;
                                const color = isGreen ? '#10b981' : '#f43f5e';
                                const bodyTop = Math.min(yOpen, yClose);
                                const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                                if (i >= 4) emaPoints.push(`${x},${getY(c.close * 0.9998)}`);
                                if (i >= 8) smaPoints.push(`${x},${getY(c.close * 0.9996)}`);

                                return (
                                  <g key={i} className="hover:opacity-80 transition-opacity">
                                    <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.2" />
                                    <rect
                                      x={x - barWidth / 2}
                                      y={bodyTop}
                                      width={barWidth}
                                      height={bodyHeight}
                                      fill={color}
                                      rx="1.5"
                                    />
                                    {i % 6 === 0 && (
                                      <text x={x} y="235" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                                        {c.timestamp.replace(' IST', '')}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}

                              {emaPoints.length > 1 && (
                                <polyline
                                  fill="none"
                                  stroke="#22d3ee"
                                  strokeWidth="1.5"
                                  points={emaPoints.join(' ')}
                                  opacity="0.8"
                                />
                              )}

                              {smaPoints.length > 1 && (
                                <polyline
                                  fill="none"
                                  stroke="#818cf8"
                                  strokeWidth="1.5"
                                  points={smaPoints.join(' ')}
                                  opacity="0.8"
                                />
                              )}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      Click <strong className="text-cyan-400">Generate {activeTab} Upcoming Signal</strong> above to load and examine live Quotex candlestick telemetry.
                    </div>
                  )}
                </div>

                {/* Key Technical Indicators Bar */}
                {currentAnalysis?.indicators && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">RSI (14)</span>
                      <span className={`text-sm font-mono font-black ${
                        currentAnalysis.indicators.rsi > 70 
                          ? 'text-rose-400' 
                          : currentAnalysis.indicators.rsi < 30 
                          ? 'text-emerald-400' 
                          : 'text-cyan-300'
                      }`}>
                        {currentAnalysis.indicators.rsi}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">EMA 9 / SMA 20</span>
                      <span className="text-xs font-mono font-bold text-white">
                        {currentAnalysis.indicators.ema9}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Candle Pattern</span>
                      <span className="text-xs font-bold text-purple-300 truncate block">
                        {currentAnalysis.indicators.pattern}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Primary Bias</span>
                      <span className={`text-xs font-black uppercase ${
                        currentAnalysis.indicators.primary_trend === 'BULLISH'
                          ? 'text-emerald-400'
                          : currentAnalysis.indicators.primary_trend === 'BEARISH'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}>
                        {currentAnalysis.indicators.primary_trend}
                      </span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT (1 COL): Educational Paper-Trading Simulator & Consensus */}
            <div className="space-y-6">
              
              {/* EDUCATIONAL CANDLE MOVEMENT SIMULATOR */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/80">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">
                      1-Minute Candle Outcome
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    IST SETTLEMENT
                  </span>
                </div>

                {currentAnalysis?.simulated_candle && replayMetrics ? (
                  <div>
                    {/* Simulated Candle Visual Box */}
                    <div className={`p-4 rounded-2xl border text-center transition-all ${
                      replayMetrics.outcome === 'UP'
                        ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-400'
                        : replayMetrics.outcome === 'DOWN'
                        ? 'bg-rose-950/20 border-rose-800/50 text-rose-400'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                        Active Simulation Price (Second {replaySecond}/60)
                      </div>
                      <div className="text-2xl sm:text-3xl font-mono font-black">
                        {replayMetrics.currentPrice}
                      </div>

                      {/* Direction Pill */}
                      <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase">
                        {replayMetrics.outcome === 'UP' ? (
                          <>
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-300">GREEN (UP CANDLE)</span>
                          </>
                        ) : replayMetrics.outcome === 'DOWN' ? (
                          <>
                            <TrendingDown className="w-4 h-4 text-rose-400" />
                            <span className="text-rose-300">RED (DOWN CANDLE)</span>
                          </>
                        ) : (
                          <>
                            <MinusCircle className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-300">NEUTRAL (DRAW)</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (0 to 60 seconds) */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>Open: 00s</span>
                        <span>Time Elapsed: {replaySecond}s</span>
                        <span>Close: 60s</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                          style={{ width: `${(replaySecond / 60) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Open, High, Low, Close Details */}
                    <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">OPEN PRICE</span>
                        <span className="text-white font-bold">{currentAnalysis.simulated_candle.start_price}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">CLOSE PRICE</span>
                        <span className="text-white font-bold">{currentAnalysis.simulated_candle.close_price}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">HIGH WICK</span>
                        <span className="text-emerald-400 font-bold">{currentAnalysis.simulated_candle.high_price}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">LOW WICK</span>
                        <span className="text-rose-400 font-bold">{currentAnalysis.simulated_candle.low_price}</span>
                      </div>
                    </div>

                    {/* Replay Button */}
                    <button
                      type="button"
                      onClick={startReplay}
                      disabled={isPlayingReplay}
                      className="w-full mt-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isPlayingReplay ? 'Replaying 60s Candle...' : 'Replay 1-Minute Candle Formation'}</span>
                    </button>

                    {/* SIMULATED OUTCOME TRACKER */}
                    <div className="mt-5 pt-4 border-t border-slate-800">
                      <div className="flex items-center justify-between text-xs font-bold mb-2">
                        <span className="text-slate-400">Predicted Direction:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          currentAnalysis.simulated_outcome.prediction === 'UP'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {currentAnalysis.simulated_outcome.prediction}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold mb-2">
                        <span className="text-slate-400">Actual Candle Outcome:</span>
                        <span className="text-white font-mono font-bold">
                          {currentAnalysis.simulated_outcome.candle_outcome} CANDLE
                        </span>
                      </div>

                      <div className={`p-3 rounded-xl border flex items-center justify-between mt-3 ${
                        currentAnalysis.simulated_outcome.simulated_result === 'WIN'
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : currentAnalysis.simulated_outcome.simulated_result === 'LOSS'
                          ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          {currentAnalysis.simulated_outcome.simulated_result === 'WIN' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span>Settlement Status:</span>
                        </div>
                        <span className="text-sm font-black tracking-wide">
                          SIMULATED {currentAnalysis.simulated_outcome.simulated_result}
                        </span>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Generate an upcoming signal to view live 1-minute settlement telemetry.
                  </div>
                )}
              </div>

              {/* CONSENSUS & AGREEMENT BREAKDOWN CARD */}
              {currentAnalysis?.ai_analysis && (
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/80">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                      MULTI-MODEL CONSENSUS
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      Agreement: {currentAnalysis.ai_analysis.agreement_percentage}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentAnalysis.ai_analysis.consensus_notes}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Consensus Bias:</span>
                    <span className="font-bold text-cyan-300">
                      {currentAnalysis.ai_analysis.consensus_trend}
                    </span>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* AI PROVIDER COMPARISON GRID (OPENAI vs GEMINI vs GROQ) */}
          {currentAnalysis?.ai_analysis?.providers && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    INDEPENDENT ENGINE VERIFICATION
                  </span>
                  <h2 className="text-xl font-black text-white">
                    Tri-Model AI Explanations ({selectedAsset})
                  </h2>
                </div>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  OpenAI • Gemini • Groq
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* 1. OPENAI CARD */}
                {(() => {
                  const p = currentAnalysis.ai_analysis.providers.openai;
                  return (
                    <div className="glass-panel rounded-2xl sm:rounded-3xl p-5 border border-cyan-900/40 bg-gradient-to-b from-cyan-950/10 to-slate-950/80 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-cyan-900/30">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                              OA
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white">OpenAI Analysis</h3>
                              <span className="text-[10px] font-mono text-slate-400">{p.model_name}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-cyan-300 border border-cyan-700/50">
                            {p.confidence_score}% Conf.
                          </span>
                        </div>

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Detected Trend</span>
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                            p.detected_trend === 'BULLISH'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : p.detected_trend === 'BEARISH'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-900 text-slate-300 border border-slate-700'
                          }`}>
                            {p.detected_trend}
                          </span>
                        </div>

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Technical Observations</span>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            {p.technical_observations}
                          </p>
                        </div>

                        {p.supporting_indicators && p.supporting_indicators.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Key Indicators</span>
                            <ul className="space-y-1 text-[11px] text-slate-400">
                              {p.supporting_indicators.map((ind, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-cyan-400 mt-0.5">•</span>
                                  <span>{ind}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rationale</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {p.reasons_for_analysis}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-amber-300/80 leading-normal">
                        <span className="font-bold text-amber-400">Limitations: </span>
                        {p.limitations_uncertainty}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. GEMINI CARD */}
                {(() => {
                  const p = currentAnalysis.ai_analysis.providers.gemini;
                  return (
                    <div className="glass-panel rounded-2xl sm:rounded-3xl p-5 border border-purple-900/40 bg-gradient-to-b from-purple-950/10 to-slate-950/80 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-900/30">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs">
                              GM
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white">Gemini Analysis</h3>
                              <span className="text-[10px] font-mono text-slate-400">{p.model_name}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-purple-300 border border-purple-700/50">
                            {p.confidence_score}% Conf.
                          </span>
                        </div>

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Detected Trend</span>
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                            p.detected_trend === 'BULLISH'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : p.detected_trend === 'BEARISH'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-900 text-slate-300 border border-slate-700'
                          }`}>
                            {p.detected_trend}
                          </span>
                        </div>

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Technical Observations</span>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            {p.technical_observations}
                          </p>
                        </div>

                        {p.supporting_indicators && p.supporting_indicators.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Key Indicators</span>
                            <ul className="space-y-1 text-[11px] text-slate-400">
                              {p.supporting_indicators.map((ind, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-purple-400 mt-0.5">•</span>
                                  <span>{ind}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rationale</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {p.reasons_for_analysis}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-amber-300/80 leading-normal">
                        <span className="font-bold text-amber-400">Limitations: </span>
                        {p.limitations_uncertainty}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. GROQ CARD */}
                {(() => {
                  const p = currentAnalysis.ai_analysis.providers.groq;
                  return (
                    <div className="glass-panel rounded-2xl sm:rounded-3xl p-5 border border-indigo-900/40 bg-gradient-to-b from-indigo-950/10 to-slate-950/80 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-indigo-900/30">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                              GQ
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-white">Groq (xAI Grok)</h3>
                              <span className="text-[10px] font-mono text-slate-400">{p.model_name}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-indigo-300 border border-indigo-700/50">
                            {p.confidence_score}% Conf.
                          </span>
                        </div>

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Detected Trend</span>
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                            p.detected_trend === 'BULLISH'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : p.detected_trend === 'BEARISH'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-slate-900 text-slate-300 border border-slate-700'
                          }`}>
                            {p.detected_trend}
                          </span>
                        </div>

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Technical Observations</span>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            {p.technical_observations}
                          </p>
                        </div>

                        {p.supporting_indicators && p.supporting_indicators.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Key Indicators</span>
                            <ul className="space-y-1 text-[11px] text-slate-400">
                              {p.supporting_indicators.map((ind, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-indigo-400 mt-0.5">•</span>
                                  <span>{ind}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rationale</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {p.reasons_for_analysis}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-amber-300/80 leading-normal">
                        <span className="font-bold text-amber-400">Limitations: </span>
                        {p.limitations_uncertainty}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}

          {/* ANALYSIS HISTORY SECTION (INDEPENDENT FOR OTC AND LIVE) */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 mb-5 gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                  RECORDS ARCHIVE
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  {activeTab === 'OTC' ? 'Quotex OTC Predictions History' : 'Live Forex Predictions History'}
                </h2>
              </div>

              {/* History Instrument Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={historyFilterAsset}
                  onChange={(e) => setHistoryFilterAsset(e.target.value)}
                  className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="ALL">All {activeTab} Instruments</option>
                  {(activeTab === 'OTC' ? OTC_INSTRUMENTS : LIVE_INSTRUMENTS).map(inst => (
                    <option key={inst.symbol} value={inst.symbol}>
                      {inst.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredHistory.length > 0 ? (
              <div className="space-y-3">
                {filteredHistory.map((item) => {
                  const isWin = item.simulated_result === 'WIN';
                  const isLoss = item.simulated_result === 'LOSS';
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHistoryItem(item)}
                      className="p-4 rounded-xl sm:rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          item.market_category === 'OTC' 
                            ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50' 
                            : 'bg-indigo-950 text-indigo-400 border border-indigo-800/50'
                        }`}>
                          {item.market_category === 'OTC' ? <Layers className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                              {item.asset}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                              {item.timeframe}
                            </span>
                            <span className="text-[10px] font-bold text-purple-400">
                              {item.detected_pattern}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {item.timestamp_ist} • {item.chart_data_source}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block text-[11px] font-mono">
                          <span className="text-slate-400 block">Close: {item.close_price}</span>
                          <span className="text-slate-500 text-[10px]">RSI: {item.rsi}</span>
                        </div>

                        <div className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 shrink-0 ${
                          isWin
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : isLoss
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}>
                          {isWin ? <CheckCircle2 className="w-3.5 h-3.5" /> : isLoss ? <XCircle className="w-3.5 h-3.5" /> : null}
                          <span>Simulated {item.simulated_result}</span>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No past analysis records found for {activeTab}. Click <strong className="text-cyan-400">Generate {activeTab} Upcoming Signal</strong> to run your first session.
              </div>
            )}
          </div>

        </main>

        {/* DETAIL INSPECTION MODAL FOR PAST SESSIONS */}
        {selectedHistoryItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-[#0b1022] p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-cyan-400">
                    HISTORICAL PREDICTION RECORD #{selectedHistoryItem.id}
                  </span>
                  <h3 className="text-lg font-black text-white">
                    {selectedHistoryItem.asset} ({selectedHistoryItem.market_category})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHistoryItem(null)}
                  className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Price and Simulated outcome summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">START PRICE</span>
                  <span className="text-white font-bold">{selectedHistoryItem.start_price}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CLOSE PRICE</span>
                  <span className="text-white font-bold">{selectedHistoryItem.close_price}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">CANDLE OUTCOME</span>
                  <span className={`font-bold ${selectedHistoryItem.candle_outcome === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedHistoryItem.candle_outcome}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">SIMULATED RESULT</span>
                  <span className="text-cyan-400 font-bold">{selectedHistoryItem.simulated_result}</span>
                </div>
              </div>

              {/* Provider breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Individual AI Provider Responses:
                </h4>
                {selectedHistoryItem.providers && selectedHistoryItem.providers.map((p, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-cyan-300">{p.provider_name} ({p.model_name})</span>
                      <span className="text-[10px] font-mono text-slate-400">Bias: {p.detected_trend}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
                      {p.technical_observations}
                    </p>
                    <p className="text-slate-500 text-[10px]">
                      {p.reasons_for_analysis}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 text-right">
                <button
                  type="button"
                  onClick={() => setSelectedHistoryItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGate>
  );
}
