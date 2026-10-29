import pytest
import pytest_asyncio
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from backend.app.database import Base
from backend.app.models import TelegramSource, TelegramMessage, ParsedSignal, SignalAuditLog
from backend.app.matcher import match_result_to_signal
from backend.app.telegram_service import TelegramService

@pytest_asyncio.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    
    await engine.dispose()

@pytest.mark.asyncio
async def test_signal_result_matching_and_audit(test_db: AsyncSession):
    # 1. Create source
    source = TelegramSource(
        name="QUOTEX OFFICIAL VIP BOT",
        link="https://t.me/quotexofficialvipbot",
        username="quotexofficialvipbot",
        category="LIVE",
        is_active=True
    )
    test_db.add(source)
    await test_db.commit()
    await test_db.refresh(source)

    # 2. Add signal message
    now = datetime.now(timezone.utc)
    sig_msg = TelegramMessage(
        source_id=source.id,
        message_id=101,
        raw_text="EURJPY\n11:12\n1 Minutes\nCALL UP",
        published_at=now,
        received_at=now,
        is_processed=True
    )
    test_db.add(sig_msg)
    await test_db.commit()
    await test_db.refresh(sig_msg)

    signal = ParsedSignal(
        source_id=source.id,
        telegram_message_id=sig_msg.id,
        market_category="LIVE",
        asset="EURJPY",
        direction="CALL",
        direction_display="CALL UP",
        entry_time_announced="11:12",
        expiry_duration="1 Minutes",
        signal_published_at=now,
        website_received_at=now,
        status="PENDING",
        reported_result=None,
        raw_signal_text=sig_msg.raw_text
    )
    test_db.add(signal)
    await test_db.commit()
    await test_db.refresh(signal)

    # 3. Add result message: "EURJPY Loss"
    result_time = now + timedelta(minutes=2)
    res_msg = TelegramMessage(
        source_id=source.id,
        message_id=102,
        raw_text="EURJPY Loss",
        published_at=result_time,
        received_at=result_time,
        is_processed=True
    )
    test_db.add(res_msg)
    await test_db.commit()
    await test_db.refresh(res_msg)

    # 4. Match result
    matched_signal, error = await match_result_to_signal(
        db=test_db,
        source=source,
        result_message=res_msg,
        parsed_result={"asset": "EURJPY", "reported_result": "LOSS", "raw_result_text": "EURJPY Loss"}
    )

    assert error is None
    assert matched_signal is not None
    assert matched_signal.id == signal.id
    assert matched_signal.status == "LOSS"
    assert matched_signal.reported_result == "LOSS"
    assert matched_signal.result_telegram_message_id == res_msg.id
    assert matched_signal.raw_result_text == "EURJPY Loss"

    # Verify audit log exists
    stmt = select(SignalAuditLog).where(SignalAuditLog.signal_id == signal.id)
    res = await test_db.execute(stmt)
    logs = res.scalars().all()
    assert len(logs) == 1
    assert logs[0].action == "RESULT_MATCHED"

@pytest.mark.asyncio
async def test_pending_timeout_transitions_to_unknown(test_db: AsyncSession):
    # 1. Create source
    source = TelegramSource(
        name="Quotex Vip Bot Signal",
        link="https://t.me/quotex0o",
        username="quotex0o",
        category="OTC",
        is_active=True
    )
    test_db.add(source)
    await test_db.commit()
    await test_db.refresh(source)

    now = datetime.now(timezone.utc)
    old_time = now - timedelta(minutes=6)
    fresh_time = now - timedelta(minutes=2)

    # 2. Add an old signal (>5 min)
    old_signal = ParsedSignal(
        source_id=source.id,
        market_category="OTC",
        asset="AUDUSD-OTC",
        direction="CALL",
        direction_display="CALL UP",
        entry_time_announced="00:01",
        expiry_duration="1 Minutes",
        signal_published_at=old_time,
        website_received_at=old_time,
        status="PENDING",
        reported_result=None,
        raw_signal_text="AUDUSD-OTC\n00:01\n1 Minutes\nCALL UP"
    )
    # 3. Add a fresh signal (<5 min)
    fresh_signal = ParsedSignal(
        source_id=source.id,
        market_category="OTC",
        asset="GBPUSD-OTC",
        direction="PUT",
        direction_display="PUT DOWN",
        entry_time_announced="16:56",
        expiry_duration="1 Minutes",
        signal_published_at=fresh_time,
        website_received_at=fresh_time,
        status="PENDING",
        reported_result=None,
        raw_signal_text="GBPUSD-OTC\n16:56\n1 Minutes\nPUT DOWN"
    )
    test_db.add(old_signal)
    test_db.add(fresh_signal)
    await test_db.commit()
    await test_db.refresh(old_signal)
    await test_db.refresh(fresh_signal)

    # 4. Check timeouts with 300s cutoff
    cutoff_naive = (now - timedelta(seconds=300)).replace(tzinfo=None)
    stmt = select(ParsedSignal).where(
        ParsedSignal.status == "PENDING",
        ParsedSignal.signal_published_at <= cutoff_naive
    )
    res = await test_db.execute(stmt)
    expired = res.scalars().all()

    for s in expired:
        s.status = "UNKNOWN"
        s.reported_result = "UNKNOWN"
        s.review_reason = "No result reported in Telegram within 5 minutes"
        audit = SignalAuditLog(
            signal_id=s.id,
            action="TIMEOUT_UNKNOWN",
            details="Signal timed out after 300s without reported result in Telegram.",
            timestamp=now
        )
        test_db.add(audit)
    await test_db.commit()
    await test_db.refresh(old_signal)
    await test_db.refresh(fresh_signal)

    # Verify old signal is UNKNOWN
    assert old_signal.status == "UNKNOWN"
    assert old_signal.reported_result == "UNKNOWN"
    assert "within 5 minutes" in (old_signal.review_reason or "")

    # Verify fresh signal is still PENDING
    assert fresh_signal.status == "PENDING"
    assert fresh_signal.reported_result is None

@pytest.mark.asyncio
async def test_late_result_reconciles_unknown_signal(test_db: AsyncSession):
    # 1. Create source
    source = TelegramSource(
        name="Quotex Vip Bot Signal",
        link="https://t.me/quotex0o",
        username="quotex0o",
        category="OTC",
        is_active=True
    )
    test_db.add(source)
    await test_db.commit()
    await test_db.refresh(source)

    now = datetime.now(timezone.utc)
    sig_time = now - timedelta(minutes=10)

    # 2. Add an already timed-out signal (status: UNKNOWN)
    sig = ParsedSignal(
        source_id=source.id,
        market_category="OTC",
        asset="USDJPY-OTC",
        direction="CALL",
        direction_display="CALL UP",
        entry_time_announced="12:00",
        expiry_duration="1 Minutes",
        signal_published_at=sig_time,
        website_received_at=sig_time,
        status="UNKNOWN",
        reported_result="UNKNOWN",
        raw_signal_text="USDJPY-OTC\n12:00\n1 Minutes\nCALL UP"
    )
    test_db.add(sig)
    await test_db.commit()
    await test_db.refresh(sig)

    # 3. A late result arrives 7 minutes later
    res_time = sig_time + timedelta(minutes=7)
    res_msg = TelegramMessage(
        source_id=source.id,
        message_id=202,
        raw_text="USDJPY-OTC Profit",
        published_at=res_time,
        received_at=res_time,
        is_processed=True
    )
    test_db.add(res_msg)
    await test_db.commit()
    await test_db.refresh(res_msg)

    # 4. Match late result to the UNKNOWN signal
    matched, err = await match_result_to_signal(
        db=test_db,
        source=source,
        result_message=res_msg,
        parsed_result={"asset": "USDJPY-OTC", "reported_result": "WIN", "raw_result_text": "USDJPY-OTC Profit"}
    )

    assert err is None
    assert matched is not None
    assert matched.id == sig.id
    assert matched.status == "WIN"
    assert matched.reported_result == "WIN"
