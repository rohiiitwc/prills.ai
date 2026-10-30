export interface Signal {
  id: number;
  source_id: number;
  source_name: string | null;
  market_category: 'OTC' | 'LIVE';
  asset: string;
  direction: 'CALL' | 'PUT' | 'UNKNOWN';
  direction_display: string;
  entry_time_announced: string;
  entry_time_converted?: string | null;
  expiry_duration: string;
  signal_published_at: string;
  website_received_at: string;
  is_late: boolean;
  late_by_seconds: number;
  status: 'PENDING' | 'WIN' | 'LOSS' | 'DRAW' | 'NEEDS_REVIEW' | 'UNKNOWN';
  reported_result: 'WIN' | 'LOSS' | 'DRAW' | 'UNKNOWN' | null;
  result_reported_at: string | null;
  raw_signal_text: string;
  raw_result_text: string | null;
  review_reason: string | null;
  is_test_data: boolean;
  created_at: string;
  updated_at: string;
  audit_logs?: AuditLog[];
}

export interface AuditLog {
  id: number;
  action: string;
  details: string;
  old_values: string | null;
  new_values: string | null;
  timestamp: string;
}

export interface DashboardStats {
  today_signal_count: number;
  today_win_count: number;
  today_loss_count: number;
  today_draw_count: number;
  today_pending_count: number;
  today_unknown_count?: number;
  win_rate_percentage: number;
  otc_signals_today: number;
  live_signals_today: number;
  otc_win_count?: number;
  otc_loss_count?: number;
  otc_unknown_count?: number;
  otc_win_rate_percentage?: number;
  live_win_count?: number;
  live_loss_count?: number;
  live_unknown_count?: number;
  live_win_rate_percentage?: number;
  telegram_connected: boolean;
  telegram_auth_status: string;
  last_sync_at: string | null;
  source_1_status: string;
  source_2_status: string;
}

export interface LatestSignalsData {
  latest_otc: Signal | null;
  latest_live: Signal | null;
  recent_results: Signal[];
  pending_signals: Signal[];
  recent_otc_results?: Signal[];
  recent_live_results?: Signal[];
  pending_otc_signals?: Signal[];
  pending_live_signals?: Signal[];
}

export interface TelegramStatus {
  is_connected: boolean;
  status: string;
  error_message: string | null;
  last_sync_at: string | null;
  sources: Array<{
    name: string;
    link: string;
    username: string;
    category: string;
    status: string;
  }>;
}

export interface PaginatedSignals {
  items: Signal[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ==========================================
// AI LEARNING LAB TYPES (ISOLATED EDUCATIONAL)
// ==========================================

export interface CandleData {
  timestamp: string;
  iso_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
}

export interface TechnicalIndicators {
  rsi: number;
  ema9: number;
  sma20: number;
  macd_line: number;
  macd_signal: number;
  macd_hist: number;
  bb_upper: number;
  bb_lower: number;
  support: number;
  resistance: number;
  pattern: string;
  primary_trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  volatility_status: string;
}

export interface AIProviderAnalysis {
  provider_name: 'OpenAI' | 'Gemini' | 'Groq';
  model_name: string;
  detected_trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  confidence_score: number;
  technical_observations: string;
  supporting_indicators: string[];
  reasons_for_analysis: string;
  agreement_with_consensus: boolean;
  limitations_uncertainty: string;
  is_fallback?: boolean;
}

export interface MultiAIAnalysis {
  consensus_trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  agreement_percentage: number;
  consensus_notes: string;
  providers: {
    openai: AIProviderAnalysis;
    gemini: AIProviderAnalysis;
    groq: AIProviderAnalysis;
  };
}

export interface SimulatedCandle {
  start_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  outcome: 'UP' | 'DOWN' | 'NEUTRAL';
  ticks: Array<{
    second: number;
    price: number;
  }>;
}

export interface SimulatedOutcome {
  prediction: 'UP' | 'DOWN';
  candle_outcome: 'UP' | 'DOWN' | 'NEUTRAL';
  simulated_result: 'WIN' | 'LOSS' | 'DRAW';
  is_simulation_only: boolean;
  disclaimer: string;
}

export interface QuotexTradeResult {
  asset: string;
  market_category: 'OTC' | 'LIVE';
  direction: 'CALL' | 'PUT';
  strike_price: number;
  close_price: number;
  delta: string;
  candle_outcome: 'UP' | 'DOWN' | 'NEUTRAL';
  trade_outcome: 'WIN' | 'LOSS' | 'DRAW';
  profit_percentage: number;
  payout_label: string;
  settlement_delay_seconds: number;
  settled_at: string;
  verification_notice: string;
}

export interface UpcomingSignal {
  asset: string;
  market_category: 'OTC' | 'LIVE';
  direction: 'CALL' | 'PUT' | 'WAIT';
  direction_display: string;
  trade_status?: 'QUALIFIED_TRADE' | 'NO_TRADE';
  confidence_threshold?: number;
  entry_time: string; // e.g. "11:23:00 IST"
  entry_time_raw: string;
  announced_at: string;
  seconds_to_entry: number;
  timing_notice: string;
  expiry_duration: string;
  strike_price: number;
  confidence_percentage: number;
  model_consensus: string;
  technical_trigger: string;
  quotex_execution_notes: string;
}

export interface AIAnalysisPayload {
  session_id: number;
  market_category: 'OTC' | 'LIVE';
  asset: string;
  timeframe: string;
  chart_data_source: string;
  timestamp_ist: string;
  candles: CandleData[];
  indicators: TechnicalIndicators;
  ai_analysis: MultiAIAnalysis;
  simulated_candle: SimulatedCandle;
  simulated_outcome: SimulatedOutcome;
  upcoming_signal?: UpcomingSignal;
  quotex_trade_result?: QuotexTradeResult;
}

export interface AILabStats {
  total_analyses: number;
  otc_analyses: number;
  live_analyses: number;
  ai_agreement_rate: number;
  candle_outcomes: {
    up_count: number;
    down_count: number;
    neutral_count: number;
  };
  simulated_results: {
    wins: number;
    losses: number;
    draws: number;
    win_rate: number;
  };
  disclaimer: string;
}

export interface AILabHistoryItem {
  id: number;
  market_category: 'OTC' | 'LIVE';
  asset: string;
  timeframe: string;
  chart_data_source: string;
  timestamp_ist: string;
  start_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  candle_outcome: 'UP' | 'DOWN' | 'NEUTRAL';
  rsi: number;
  primary_trend: string;
  detected_pattern: string;
  simulated_prediction: string;
  simulated_result: string;
  consensus_agreement_pct: number;
  status: string;
  providers_count: number;
  providers: AIProviderAnalysis[];
}

export interface PaginatedAILabHistory {
  items: AILabHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
