from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.app.database import get_db
from backend.app.models import TelegramSource

router = APIRouter(prefix="/channels", tags=["channels"])

@router.get("")
async def get_channels(db: AsyncSession = Depends(get_db)):
    """Returns configured Telegram channels."""
    stmt = select(TelegramSource)
    res = await db.execute(stmt)
    sources = res.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "link": s.link,
            "username": s.username,
            "category": s.category,
            "is_active": s.is_active,
            "connection_status": s.connection_status,
            "last_sync_at": s.last_sync_at.isoformat() if s.last_sync_at else None
        }
        for s in sources
    ]
