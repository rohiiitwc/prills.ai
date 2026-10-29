import random
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import TelegramSource
from backend.app.schemas import (
    TelegramAuthRequest,
    TelegramSubmitCode,
    TelegramSubmit2FA,
    SyntheticInjectRequest
)
from backend.app.telegram_service import telegram_service

router = APIRouter(prefix="/telegram", tags=["telegram"])

async def verify_admin_access(x_admin_key: Optional[str] = Header(None)):
    """Ensures sensitive Telegram authentication and injection actions require admin credentials."""
    if x_admin_key and x_admin_key == settings.ADMIN_API_KEY:
        return True
    raise HTTPException(status_code=403, detail="Access denied: Admin credentials required to modify Telegram authorization.")

@router.get("/status")
async def get_telegram_status():
    """Returns Telegram connection and channel synchronization status without any credentials."""
    return telegram_service.get_status()

@router.post("/reconnect")
async def trigger_telegram_reconnect():
    """Forces an immediate reconnection of the Telegram client using stored session."""
    res = await telegram_service.reconnect()
    return res

@router.post("/sync")
async def trigger_telegram_sync():
    """Triggers an on-demand backfill and synchronization from both channels."""
    if not telegram_service.client or not telegram_service.is_authorized:
        # Attempt auto-reconnect if session exists
        if telegram_service.session_string or telegram_service._load_stored_session():
            rec = await telegram_service.reconnect()
            if not rec.get("success"):
                raise HTTPException(status_code=400, detail="Telegram client is not authorized or connected")
        else:
            raise HTTPException(status_code=400, detail="Telegram client is not authorized or connected")
    import asyncio
    asyncio.create_task(telegram_service._backfill_recent_messages(limit=300))
    return {"status": "SYNC_STARTED", "message": "Backfill and reconciliation initiated"}

@router.post("/auth/request-code", dependencies=[Depends(verify_admin_access)])
async def request_telegram_code(payload: TelegramAuthRequest):
    """Requests Telegram OTP code for user authentication (Admin Protected)."""
    result = await telegram_service.request_code(
        phone=payload.phone_number,
        api_id=payload.api_id,
        api_hash=payload.api_hash
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/auth/submit-code", dependencies=[Depends(verify_admin_access)])
async def submit_telegram_code(payload: TelegramSubmitCode):
    """Submits the Telegram verification code received by user (Admin Protected)."""
    result = await telegram_service.submit_code(
        code=payload.phone_code,
        phone=payload.phone_number
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/auth/submit-2fa", dependencies=[Depends(verify_admin_access)])
async def submit_telegram_2fa(payload: TelegramSubmit2FA):
    """Submits 2FA password if user's account requires two-step verification (Admin Protected)."""
    result = await telegram_service.submit_2fa(password=payload.password)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@router.post("/inject-test-message", dependencies=[Depends(verify_admin_access)])
async def inject_test_message(payload: SyntheticInjectRequest, db: AsyncSession = Depends(get_db)):
    """
    Simulates / injects a test message into the real pipeline (Admin Protected).
    Clearly marks is_test_data=True to satisfy testing requirements.
    Runs full duplicate checks, parsing, result matching, and real-time broadcasting.
    """
    stmt = select(TelegramSource).where(TelegramSource.username == payload.source_username.lower())
    res = await db.execute(stmt)
    source = res.scalar_one_or_none()

    if not source:
        raise HTTPException(
            status_code=404,
            detail=f"Source with username '{payload.source_username}' not found. Valid: 'quotexofficialvipbot', 'quotex0o'"
        )

    # Generate synthetic message ID (random high integer)
    synthetic_msg_id = random.randint(100000, 999999)
    now_utc = datetime.now(timezone.utc)

    result = await telegram_service.process_incoming_message(
        source=source,
        message_id=synthetic_msg_id,
        raw_text=payload.raw_text,
        published_at=now_utc,
        is_edit=False,
        is_test_data=payload.is_test
    )

    return {
        "success": True,
        "message": "Test message processed and broadcast via WebSocket.",
        "details": result
    }
