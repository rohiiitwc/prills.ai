from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Index, Float
from sqlalchemy.orm import relationship
from backend.app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class TelegramSource(Base):
    __tablename__ = "telegram_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    link = Column(String(255), nullable=False)
    username = Column(String(100), nullable=False, unique=True, index=True)
    category = Column(String(20), nullable=False)  # "LIVE" or "OTC"
    is_active = Column(Boolean, default=True)
    connection_status = Column(String(50), default="DISCONNECTED") # CONNECTED, DISCONNECTED, AUTH_REQUIRED, ERROR
    error_message = Column(Text, nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    messages = relationship("TelegramMessage", back_populates="source", cascade="all, delete-orphan")
    signals = relationship("ParsedSignal", back_populates="source")

class TelegramMessage(Base):
    __tablename__ = "telegram_messages"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("telegram_sources.id"), nullable=False, index=True)
    message_id = Column(Integer, nullable=False, index=True)
    raw_text = Column(Text, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=False)
    received_at = Column(DateTime(timezone=True), default=utcnow)
    is_edited = Column(Boolean, default=False)
    edit_timestamp = Column(DateTime(timezone=True), nullable=True)
    is_processed = Column(Boolean, default=False)
    processing_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Unique constraint on source_id and message_id to prevent duplicates!
    __table_args__ = (
        UniqueConstraint("source_id", "message_id", name="uq_source_message_id"),
        Index("idx_source_published", "source_id", "published_at"),
    )

    source = relationship("TelegramSource", back_populates="messages")
    signal_origin = relationship("ParsedSignal", foreign_keys="ParsedSignal.telegram_message_id", back_populates="signal_message")
    result_origin = relationship("ParsedSignal", foreign_keys="ParsedSignal.result_telegram_message_id", back_populates="result_message")

class ParsedSignal(Base):
    __tablename__ = "parsed_signals"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("telegram_sources.id"), nullable=False, index=True)
    telegram_message_id = Column(Integer, ForeignKey("telegram_messages.id"), nullable=True, index=True)
    
    market_category = Column(String(20), nullable=False, index=True) # "LIVE" or "OTC"
    asset = Column(String(50), nullable=False, index=True) # e.g. "EURJPY", "AUDCAD-OTC"
    direction = Column(String(10), nullable=False, index=True) # "CALL" or "PUT"
    direction_display = Column(String(20), nullable=False) # "CALL UP" or "PUT DOWN"
    entry_time_announced = Column(String(20), nullable=False) # e.g. "11:12" or "10:21:00" (Source Given Time)
    entry_time_converted = Column(String(20), nullable=True)  # e.g. "18:24:00" (Local IST Time)
    expiry_duration = Column(String(30), nullable=False) # e.g. "1 Minutes"
    
    signal_published_at = Column(DateTime(timezone=True), nullable=False, index=True)
    website_received_at = Column(DateTime(timezone=True), default=utcnow)
    
    is_late = Column(Boolean, default=False, index=True)
    late_by_seconds = Column(Integer, default=0)
    
    # Status: PENDING, WIN, LOSS, DRAW, NEEDS_REVIEW
    status = Column(String(30), default="PENDING", index=True)
    reported_result = Column(String(20), nullable=True, index=True) # "WIN", "LOSS", "DRAW"
    result_telegram_message_id = Column(Integer, ForeignKey("telegram_messages.id"), nullable=True)
    result_reported_at = Column(DateTime(timezone=True), nullable=True) # actual source timestamp when result published
    
    raw_signal_text = Column(Text, nullable=False)
    raw_result_text = Column(Text, nullable=True)
    review_reason = Column(Text, nullable=True)
    
    is_test_data = Column(Boolean, default=False, index=True) # Distinguishes test messages from real Telegram signals
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    source = relationship("TelegramSource", back_populates="signals")
    signal_message = relationship("TelegramMessage", foreign_keys=[telegram_message_id], back_populates="signal_origin")
    result_message = relationship("TelegramMessage", foreign_keys=[result_telegram_message_id], back_populates="result_origin")
    audit_logs = relationship("SignalAuditLog", back_populates="signal", cascade="all, delete-orphan")

class SignalAuditLog(Base):
    __tablename__ = "signal_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(Integer, ForeignKey("parsed_signals.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False) # "CREATED", "RESULT_MATCHED", "CORRECTED", "EDITED"
    details = Column(Text, nullable=False)
    old_values = Column(Text, nullable=True) # JSON string
    new_values = Column(Text, nullable=True) # JSON string
    timestamp = Column(DateTime(timezone=True), default=utcnow)

    signal = relationship("ParsedSignal", back_populates="audit_logs")

class TelegramAuthSession(Base):
    __tablename__ = "telegram_auth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(50), nullable=True)
    phone_code_hash = Column(String(100), nullable=True)
    auth_state = Column(String(50), default="NOT_AUTHENTICATED") # NOT_AUTHENTICATED, CODE_REQUESTED, PASSWORD_REQUIRED, AUTHENTICATED, ERROR
    session_string = Column(Text, nullable=True)
    last_error = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)


# ==========================================
# AI LEARNING LAB (ISOLATED EDUCATIONAL MODELS)
# ==========================================

class AIAnalysisSession(Base):
    __tablename__ = "ai_analysis_sessions"

    id = Column(Integer, primary_key=True, index=True)
    market_category = Column(String(20), nullable=False, index=True) # "OTC" or "LIVE"
    asset = Column(String(50), nullable=False, index=True) # e.g. "AUDCAD-OTC", "EURUSD"
    timeframe = Column(String(20), default="1m")
    chart_data_source = Column(String(100), nullable=False) # e.g. "Quotex OTC Engine Replay"
    
    opened_at = Column(DateTime(timezone=True), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=False)
    
    start_price = Column(Float, nullable=False)
    high_price = Column(Float, nullable=False)
    low_price = Column(Float, nullable=False)
    close_price = Column(Float, nullable=False)
    candle_outcome = Column(String(20), nullable=False) # "UP", "DOWN", "NEUTRAL"
    
    # Technical Indicators
    rsi_value = Column(Float, nullable=True)
    macd_value = Column(Float, nullable=True)
    macd_signal = Column(Float, nullable=True)
    macd_hist = Column(Float, nullable=True)
    ema9 = Column(Float, nullable=True)
    sma20 = Column(Float, nullable=True)
    bb_upper = Column(Float, nullable=True)
    bb_lower = Column(Float, nullable=True)
    detected_pattern = Column(String(100), nullable=True)
    primary_trend = Column(String(50), nullable=False) # "BULLISH", "BEARISH", "RANGING"
    
    # Paper-trading simulated outcome
    simulated_prediction = Column(String(20), nullable=False) # "UP", "DOWN"
    simulated_result = Column(String(20), nullable=False) # "WIN", "LOSS", "DRAW"
    consensus_agreement_pct = Column(Float, default=100.0)
    
    status = Column(String(30), default="COMPLETED")
    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    provider_responses = relationship("AIProviderResponse", back_populates="session", cascade="all, delete-orphan")


class AIProviderResponse(Base):
    __tablename__ = "ai_provider_responses"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("ai_analysis_sessions.id"), nullable=False, index=True)
    provider_name = Column(String(50), nullable=False) # "OpenAI", "Gemini", "Groq"
    model_name = Column(String(100), nullable=False)
    
    detected_trend = Column(String(50), nullable=False) # "BULLISH", "BEARISH", "RANGING"
    confidence_score = Column(Float, default=75.0)
    technical_observations = Column(Text, nullable=False)
    supporting_indicators = Column(Text, nullable=True) # JSON list or dict
    reasons_for_analysis = Column(Text, nullable=False)
    agreement_with_consensus = Column(Boolean, default=True)
    limitations_uncertainty = Column(Text, nullable=False)
    is_fallback = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    session = relationship("AIAnalysisSession", back_populates="provider_responses")

