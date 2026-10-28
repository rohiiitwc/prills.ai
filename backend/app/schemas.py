from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field

class AuditLogSchema(BaseModel):
    id: int
    action: str
    details: str
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class SignalResponse(BaseModel):
    id: int
    source_id: int
    source_name: Optional[str] = None
    market_category: str
    asset: str
    direction: str
    direction_display: str
    entry_time_announced: str
    entry_time_converted: Optional[str] = None
    expiry_duration: str
    signal_published_at: datetime
    website_received_at: datetime
    is_late: bool
    late_by_seconds: int
    status: str
    reported_result: Optional[str] = None
    result_reported_at: Optional[datetime] = None
    raw_signal_text: str
    raw_result_text: Optional[str] = None
    review_reason: Optional[str] = None
    is_test_data: bool
    created_at: datetime
    updated_at: datetime
    audit_logs: List[AuditLogSchema] = []

    class Config:
        from_attributes = True

class SignalPagination(BaseModel):
    items: List[SignalResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class DashboardStats(BaseModel):
    today_signal_count: int
    today_win_count: int
    today_loss_count: int
    today_draw_count: int
    today_pending_count: int
    win_rate_percentage: float
    otc_signals_today: int
    live_signals_today: int
    otc_win_count: Optional[int] = 0
    otc_loss_count: Optional[int] = 0
    otc_win_rate_percentage: Optional[float] = 0.0
    live_win_count: Optional[int] = 0
    live_loss_count: Optional[int] = 0
    live_win_rate_percentage: Optional[float] = 0.0
    telegram_connected: bool
    telegram_auth_status: str
    last_sync_at: Optional[datetime] = None
    source_1_status: str
    source_2_status: str

class TelegramAuthRequest(BaseModel):
    phone_number: Optional[str] = None
    api_id: Optional[int] = None
    api_hash: Optional[str] = None

class TelegramSubmitCode(BaseModel):
    phone_code: str
    phone_number: Optional[str] = None

class TelegramSubmit2FA(BaseModel):
    password: str

class SyntheticInjectRequest(BaseModel):
    source_username: str = Field(description="quotexofficialvipbot or quotex0o")
    raw_text: str = Field(description="Telegram message content")
    is_test: bool = True
