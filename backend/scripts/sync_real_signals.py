import sys
from pathlib import Path

# Ensure project root is in sys.path
_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

import asyncio
import logging
from telethon import TelegramClient
from telethon.sessions import StringSession
from datetime import datetime, timezone
from backend.app.config import settings
from backend.app.database import AsyncSessionLocal
from backend.app.models import TelegramAuthSession, TelegramMessage, ParsedSignal, SignalAuditLog
from backend.app.telegram_service import telegram_service
from sqlalchemy import select, delete

logging.basicConfig(level=logging.INFO)

async def backfill_and_clean():
    async with AsyncSessionLocal() as db:
        # Delete old synthetic test data
        print("Purging old synthetic test data...")
        await db.execute(delete(SignalAuditLog))
        await db.execute(delete(ParsedSignal).where(ParsedSignal.is_test_data == True))
        await db.execute(delete(TelegramMessage).where(TelegramMessage.message_id < 1000))
        await db.commit()
        print("Old test data purged.")

        # Ensure sources exist
        await telegram_service._ensure_sources(db)

        # Get authenticated session
        res = await db.execute(
            select(TelegramAuthSession)
            .where(TelegramAuthSession.auth_state == "AUTHENTICATED")
            .order_by(TelegramAuthSession.id.desc())
            .limit(1)
        )
        auth = res.scalar_one_or_none()
        if not auth or not auth.session_string:
            print("No authenticated session found!")
            return
        session_str = auth.session_string

    client = TelegramClient(StringSession(session_str), settings.TELEGRAM_API_ID, settings.TELEGRAM_API_HASH)
    await client.connect()

    for username, source in telegram_service.channel_map.items():
        print(f"\n--- Backfilling from @{username} ({source.name}) ---")
        entity = await client.get_entity(username)
        messages = await client.get_messages(entity, limit=40)
        print(f"Fetched {len(messages)} messages. Processing in chronological order...")
        
        for msg in reversed(messages):
            if not msg or not msg.message:
                continue
            pub_at = msg.date.replace(tzinfo=timezone.utc) if msg.date else datetime.now(timezone.utc)
            res = await telegram_service.process_incoming_message(
                source=source,
                message_id=msg.id,
                raw_text=msg.message,
                published_at=pub_at,
                is_edit=False,
                is_test_data=False
            )
            status = res.get("status")
            if status == "SIGNAL_CREATED":
                print(f"  [SIGNAL] {res.get('asset')} | Given: {res.get('entry_time')} -> IST: {res.get('entry_time_converted')} | Dir: {res.get('direction')}")
            elif status == "RESULT_MATCHED":
                print(f"  [RESULT MATCHED] {res.get('asset')} -> {res.get('result')} for Signal ID {res.get('signal_id')}")
            elif status == "UNMATCHED_RESULT":
                print(f"  [UNMATCHED RESULT] {res.get('asset')} -> {res.get('result')} ({res.get('reason')})")

    await client.disconnect()
    print("\nSync complete! All real messages processed.")

if __name__ == "__main__":
    asyncio.run(backfill_and_clean())
