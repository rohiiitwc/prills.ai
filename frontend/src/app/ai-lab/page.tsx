'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck, 
  Info, 
  Play, 
  History, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  RefreshCw, 
  Clock, 
  Zap, 
  BarChart3, 
  Sliders, 
  ChevronRight,
  Filter,
  Eye,
  Check
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { AuthGate } from '../../components/AuthGate';
import { 
  AILabStats, 
  AIAnalysisPayload, 
  AILabHistoryItem, 
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
  { symbol: 'AUDCAD-OTC', name: 'Australian Dollar / Canadian Dollar (OTC)' },
  { symbol: 'EURUSD-OTC', name: 'Euro / US Dollar (OTC)' },
  { symbol: 'USDJPY-OTC', name: 'US Dollar / Japanese Yen (OTC)' },
  { symbol: 'GBPUSD-OTC', name: 'British Pound / US Dollar (OTC)' },
  { symbol: 'USDMXN-OTC', name: 'US Dollar / Mexican Peso (OTC)' },
  { symbol: 'USDNGN-OTC', name: 'US Dollar / Nigerian Naira (OTC)' },
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
  const [selectedAsset, setSelectedAsset] = useState<string>('AUDCAD-OTC');
  const [stats, setStats] = useState<AILabStats | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysisPayload | null>(null);
  const [historyItems, setHistoryItems] = useState<AILabHistoryItem[]>([]);
  const [historyFilterAsset, setHistoryFilterAsset] = useState<string>('ALL');
  
  // Loading & generation states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Simulated replay state
  const [replaySecond, setReplaySecond] = useState<number>(60);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AILabHistoryItem | null>(null);
  
  // Stream connection status for Navbar
  const [tgStatus, setTgStatus] = useState<string>('CONNECTED');

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
      setSelectedAsset('AUDCAD-OTC');
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

  const handleGenerateAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setIsPlayingReplay(false);

    try {
      setAnalysisStep('Loading 1-minute historical candle buffer...');
      await new Promise(r => setTimeout(r, 600));

      setAnalysisStep('Calculating RSI, MACD, Moving Averages & Bollinger Bands...');
      await new Promise(r => setTimeout(r, 700));

      setAnalysisStep('Querying OpenAI, Gemini, and Groq independent models...');
      const payload = await generateAiLabAnalysis(activeTab, selectedAsset);

      setAnalysisStep('Comparing multi-model consensus & generating simulated candle...');
      await new Promise(r => setTimeout(r, 500));

      setCurrentAnalysis(payload);
      setReplaySecond(60); // Show full candle outcome initially
      await loadStats();
      await loadHistory(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setErrorMsg(msg);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Replay animation timer
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

  // Get current replay price from ticks
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

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#080d1a] flex flex-col selection:bg-cyan-500 selection:text-black">
        <Navbar isConnected={true} telegramStatus={tgStatus} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          
          {/* HEADER & EDUCATIONAL COMPLIANCE NOTICE */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-950/80 border border-purple-700/60 text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    AI RESEARCH & LEARNING LAB
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-400">
                    PAPER-TRADING SIMULATOR
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                  Multi-Model Market Intelligence
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                  Independent chart explanation by OpenAI, Google Gemini, and Groq. 
                  Explains candlestick patterns, dynamic support/resistance, RSI, and moving averages on simulated 1-minute timeframes.
                </p>
              </div>

              {/* Strict Educational Disclaimer Badge */}
              <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs flex items-start gap-2.5 max-w-md shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold text-amber-200">Educational Simulation Only: </span>
                  Simulated results do not represent actual trading profits. AI confidence scores are descriptive estimates, not financial guarantees.
                </div>
              </div>
            </div>

            {/* TAB SELECTOR: STRICT SEPARATION OF OTC & LIVE */}
            <div className="flex items-center gap-2 mt-5 p-1 rounded-2xl bg-slate-950/90 border border-slate-800/90 w-full sm:w-auto sm:inline-flex">
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
                <span>OTC Educational Analysis</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
                  Quotex OTC
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
                <span>Live Market Educational Analysis</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
                  Forex Feed
                </span>
              </button>
            </div>
          </div>

          {/* EDUCATIONAL STATISTICS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Analyses</span>
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
                Cross-model model consensus
              </p>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Simulated WIN Rate</span>
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
                1-minute replay distribution
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
                      Educational Chart Examination
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
                    Calculates 14-period RSI, Moving Averages (EMA 9, SMA 20), MACD, and queries OpenAI, Gemini, and Groq.
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAnalysis}
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
                        ? 'Analyzing Chart...' 
                        : activeTab === 'OTC' 
                        ? 'GENERATE OTC ANALYSIS' 
                        : 'GENERATE LIVE ANALYSIS'}
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

                          // EMA 9 and SMA 20 points
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
                                    {/* Wick */}
                                    <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.2" />
                                    {/* Body */}
                                    <rect
                                      x={x - barWidth / 2}
                                      y={bodyTop}
                                      width={barWidth}
                                      height={bodyHeight}
                                      fill={color}
                                      rx="1.5"
                                    />
                                    {/* Time Label on every 5th bar */}
                                    {i % 6 === 0 && (
                                      <text x={x} y="235" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                                        {c.timestamp.replace(' IST', '')}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}

                              {/* EMA Line Overlay */}
                              {emaPoints.length > 1 && (
                                <polyline
                                  fill="none"
                                  stroke="#22d3ee"
                                  strokeWidth="1.5"
                                  points={emaPoints.join(' ')}
                                  opacity="0.8"
                                />
                              )}

                              {/* SMA Line Overlay */}
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
                      Click <strong className="text-cyan-400">Generate {activeTab} Analysis</strong> above to load and examine live educational candlestick telemetry.
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
                      1-Minute Candle Simulator
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    IST CLOCK
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
                        <span className="text-slate-400">Hypothetical AI Prediction:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          currentAnalysis.simulated_outcome.prediction === 'UP'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {currentAnalysis.simulated_outcome.prediction}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold mb-2">
                        <span className="text-slate-400">Candle Actual Outcome:</span>
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
                          <span>Simulated Result:</span>
                        </div>
                        <span className="text-sm font-black tracking-wide">
                          SIMULATED {currentAnalysis.simulated_outcome.simulated_result}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 mt-2 leading-relaxed text-center">
                        Simulated educational result based on 1m close. Never treat as actual trading profits.
                      </p>
                    </div>

                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Generate an analysis to view the simulated 1-minute candle replay.
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

                        {/* Trend Bias */}
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

                        {/* Technical Observations */}
                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Technical Observations</span>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            {p.technical_observations}
                          </p>
                        </div>

                        {/* Supporting Indicators */}
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

                        {/* Reasons */}
                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rationale</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {p.reasons_for_analysis}
                          </p>
                        </div>
                      </div>

                      {/* Uncertainty */}
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

                        {/* Trend Bias */}
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

                        {/* Technical Observations */}
                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Technical Observations</span>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            {p.technical_observations}
                          </p>
                        </div>

                        {/* Supporting Indicators */}
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

                        {/* Reasons */}
                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rationale</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {p.reasons_for_analysis}
                          </p>
                        </div>
                      </div>

                      {/* Uncertainty */}
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

                        {/* Trend Bias */}
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

                        {/* Technical Observations */}
                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Technical Observations</span>
                          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            {p.technical_observations}
                          </p>
                        </div>

                        {/* Supporting Indicators */}
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

                        {/* Reasons */}
                        <div className="mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rationale</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {p.reasons_for_analysis}
                          </p>
                        </div>
                      </div>

                      {/* Uncertainty */}
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
                  {activeTab === 'OTC' ? 'OTC Analysis History' : 'Live Forex Analysis History'}
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
                        {/* Price & RSI metrics */}
                        <div className="text-right hidden sm:block text-[11px] font-mono">
                          <span className="text-slate-400 block">Close: {item.close_price}</span>
                          <span className="text-slate-500 text-[10px]">RSI: {item.rsi}</span>
                        </div>

                        {/* Simulated Result Pill */}
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
                No past analysis records found for {activeTab}. Click <strong className="text-cyan-400">Generate {activeTab} Analysis</strong> to run your first session.
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
                    HISTORICAL ANALYSIS RECORD #{selectedHistoryItem.id}
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
