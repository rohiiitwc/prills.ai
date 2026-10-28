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
