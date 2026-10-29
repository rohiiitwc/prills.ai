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
