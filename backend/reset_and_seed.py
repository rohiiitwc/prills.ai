import sys
from pathlib import Path

# Ensure project root is in sys.path
_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

import asyncio
from datetime import datetime, timezone, timedelta
import pytz
from sqlalchemy import select, delete
from backend.app.database import AsyncSessionLocal, init_db, engine
from backend.app.models import TelegramSource, TelegramMessage, ParsedSignal, SignalAuditLog
from backend.app.telegram_service import telegram_service
from backend.app.config import settings

async def reset_and_seed():
    await init_db()
    await telegram_service.initialize()
    async with AsyncSessionLocal() as db:
        print("Cleaning up old test records...")
        await db.execute(delete(SignalAuditLog))
        await db.execute(delete(ParsedSignal))
        await db.execute(delete(TelegramMessage))
        await db.commit()

        # Ensure sources
        stmt = select(TelegramSource)
        res = await db.execute(stmt)
        sources = res.scalars().all()
        source_map = {s.username.lower(): s for s in sources}
        
        otc_source = source_map.get("quotex0o")
        live_source = source_map.get("quotexofficialvipbot")

    now_utc = datetime.now(timezone.utc)
    tz = pytz.timezone(settings.DISPLAY_TIMEZONE)
    local_now = now_utc.astimezone(tz)
    
    # Generate times around current time
    t_past2 = local_now - timedelta(minutes=15)
    t_past1 = local_now - timedelta(minutes=7)
    t_pending = local_now + timedelta(minutes=1)

    time_past2_str = t_past2.strftime("%H:%M:%S")
    time_past1_str = t_past1.strftime("%H:%M:%S")
    time_pending_str = t_pending.strftime("%H:%M:%S")
    time_live_pending = t_pending.strftime("%H:%M")

    print("\n1. Injecting OTC Signal 1 (Completed WIN)...")
    await telegram_service.process_incoming_message(
        source=otc_source,
        message_id=201,
        raw_text=f"📊 CADJPY-OTCq\n⏰ {time_past2_str} 🔔 GET READY\n⏳ 1 Minutes\n🟢 CALL UP ⬆\n\n🚧 Quotex 1M FREE 🚧",
        published_at=now_utc - timedelta(minutes=15),
        is_test_data=True
    )

    print("   Injecting Result for CADJPY-OTCq (Profit)...")
    await telegram_service.process_incoming_message(
        source=otc_source,
        message_id=202,
        raw_text=f"🗓 CADJPY-OTCq Profit ✅",
        published_at=now_utc - timedelta(minutes=14),
        is_test_data=True
    )

    print("\n2. Injecting Live Market Signal 1 (Completed WIN)...")
    await telegram_service.process_incoming_message(
        source=live_source,
        message_id=203,
        raw_text=f"USDJPY\n{t_past1.strftime('%H:%M')}\n1 Minutes\nPUT DOWN",
        published_at=now_utc - timedelta(minutes=7),
        is_test_data=True
    )

    print("   Injecting Result for USDJPY (Profit)...")
    await telegram_service.process_incoming_message(
        source=live_source,
        message_id=204,
        raw_text=f"USDJPY Profit",
        published_at=now_utc - timedelta(minutes=6),
        is_test_data=True
    )

    print("\n3. Injecting Live Market Signal 2 (Completed LOSS)...")
    await telegram_service.process_incoming_message(
        source=live_source,
        message_id=205,
        raw_text=f"EURJPY\n{t_past2.strftime('%H:%M')}\n1 Minutes\nCALL UP",
        published_at=now_utc - timedelta(minutes=15),
        is_test_data=True
    )

    print("   Injecting Result for EURJPY (Loss)...")
    await telegram_service.process_incoming_message(
        source=live_source,
        message_id=206,
        raw_text=f"EURJPY Loss",
        published_at=now_utc - timedelta(minutes=14),
        is_test_data=True
    )

    print("\n4. Injecting Active PENDING OTC Signal...")
    await telegram_service.process_incoming_message(
        source=otc_source,
        message_id=207,
        raw_text=f"📊 AUDCAD-OTCq\n⏰ {time_pending_str} 🔔 GET READY\n⏳ 1 Minutes\n🟢 CALL UP ⬆\n\n🚧 Quotex 1M FREE 🚧",
        published_at=now_utc,
        is_test_data=True
    )

    print("\n5. Injecting Active PENDING Live Signal...")
    await telegram_service.process_incoming_message(
        source=live_source,
        message_id=208,
        raw_text=f"GBPJPY\n{time_live_pending}\n1 Minutes\nCALL UP",
        published_at=now_utc,
        is_test_data=True
    )

    # Disconnect client and dispose engine so script terminates cleanly
    if telegram_service.client and telegram_service.client.is_connected():
        await telegram_service.client.disconnect()
    await engine.dispose()

    print("\nClean reset and seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(reset_and_seed())
