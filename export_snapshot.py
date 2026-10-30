import asyncio
import json
import logging
from datetime import datetime, timezone
import pytz
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from backend.app.config import settings
from backend.app.database import AsyncSessionLocal
from backend.app.models import ParsedSignal, TelegramSource, TelegramMessage
from backend.app.routes.signals import clean_source_name, map_signal_to_dict

logging.basicConfig(level=logging.INFO)

async def export_snapshot():
    async with AsyncSessionLocal() as db:
        now_utc = datetime.now(timezone.utc)
        tz = pytz.timezone(settings.DISPLAY_TIMEZONE)
        local_now = now_utc.astimezone(tz)
        today_start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = today_start_local.astimezone(timezone.utc).replace(tzinfo=None)

        # Base query for today
        stmt_base = ParsedSignal.signal_published_at >= today_start_utc

        total_today = (await db.execute(select(func.count(ParsedSignal.id)).where(stmt_base))).scalar() or 0
        wins_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "WIN")))).scalar() or 0
        loss_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "LOSS")))).scalar() or 0
        draw_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "DRAW")))).scalar() or 0
        pending_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "PENDING")))).scalar() or 0
        unknown_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "UNKNOWN")))).scalar() or 0

        otc_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "OTC")))).scalar() or 0
        otc_wins_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "OTC", ParsedSignal.status == "WIN")))).scalar() or 0
        otc_loss_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "OTC", ParsedSignal.status == "LOSS")))).scalar() or 0
        otc_unknown_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "OTC", ParsedSignal.status == "UNKNOWN")))).scalar() or 0
        otc_decided = otc_wins_today + otc_loss_today
        otc_win_rate = round((otc_wins_today / otc_decided * 100), 1) if otc_decided > 0 else 0.0

        live_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "LIVE")))).scalar() or 0
        live_wins_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "LIVE", ParsedSignal.status == "WIN")))).scalar() or 0
        live_loss_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "LIVE", ParsedSignal.status == "LOSS")))).scalar() or 0
        live_unknown_today = (await db.execute(select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "LIVE", ParsedSignal.status == "UNKNOWN")))).scalar() or 0
        live_decided = live_wins_today + live_loss_today
        live_win_rate = round((live_wins_today / live_decided * 100), 1) if live_decided > 0 else 0.0

        decided = wins_today + loss_today
        win_rate = round((wins_today / decided * 100), 1) if decided > 0 else 0.0

        stats = {
            "today_signal_count": total_today,
            "today_win_count": wins_today,
            "today_loss_count": loss_today,
            "today_draw_count": draw_today,
            "today_pending_count": pending_today,
            "today_unknown_count": unknown_today,
            "win_rate_percentage": win_rate,
            "otc_signals_today": otc_today,
            "live_signals_today": live_today,
            "otc_win_count": otc_wins_today,
            "otc_loss_count": otc_loss_today,
            "otc_unknown_count": otc_unknown_today,
            "otc_win_rate_percentage": otc_win_rate,
            "live_win_count": live_wins_today,
            "live_loss_count": live_loss_today,
            "live_unknown_count": live_unknown_today,
            "live_win_rate_percentage": live_win_rate,
            "telegram_connected": True,
            "telegram_auth_status": "CONNECTED",
            "last_sync_at": now_utc.isoformat(),
            "source_1_status": "CONNECTED",
            "source_2_status": "CONNECTED"
        }

        # Latest OTC
        stmt_otc = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            and_(ParsedSignal.market_category == "OTC", ParsedSignal.direction.in_(["CALL", "PUT"]))
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(1)
        latest_otc = (await db.execute(stmt_otc)).scalar_one_or_none()

        # Latest LIVE
        stmt_live = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            and_(ParsedSignal.market_category == "LIVE", ParsedSignal.direction.in_(["CALL", "PUT"]))
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(1)
        latest_live = (await db.execute(stmt_live)).scalar_one_or_none()

        # Recent results
        stmt_recent = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            ParsedSignal.status.in_(["WIN", "LOSS", "DRAW", "UNKNOWN"])
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(10)
        recent_results = (await db.execute(stmt_recent)).scalars().unique().all()

        # Recent OTC results
        stmt_recent_otc = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            and_(ParsedSignal.market_category == "OTC", ParsedSignal.status.in_(["WIN", "LOSS", "DRAW", "UNKNOWN"]))
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(6)
        recent_otc = (await db.execute(stmt_recent_otc)).scalars().unique().all()

        # Recent LIVE results
        stmt_recent_live = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            and_(ParsedSignal.market_category == "LIVE", ParsedSignal.status.in_(["WIN", "LOSS", "DRAW", "UNKNOWN"]))
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(6)
        recent_live = (await db.execute(stmt_recent_live)).scalars().unique().all()

        # Pending OTC
        stmt_p_otc = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            and_(ParsedSignal.market_category == "OTC", ParsedSignal.status == "PENDING")
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(6)
        pending_otc = (await db.execute(stmt_p_otc)).scalars().unique().all()

        # Pending LIVE
        stmt_p_live = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            and_(ParsedSignal.market_category == "LIVE", ParsedSignal.status == "PENDING")
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(6)
        pending_live = (await db.execute(stmt_p_live)).scalars().unique().all()

        # All pending
        stmt_p_all = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source)).where(
            ParsedSignal.status == "PENDING"
        ).order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(10)
        pending_all = (await db.execute(stmt_p_all)).scalars().unique().all()

        def map_s(s):
            if not s:
                return None
            return {
                "id": s.id,
                "source_id": s.source_id,
                "source_name": clean_source_name(s.market_category),
                "market_category": s.market_category,
                "asset": s.asset,
                "direction": s.direction,
                "direction_display": s.direction_display,
                "entry_time_announced": s.entry_time_announced,
                "entry_time_converted": s.entry_time_converted,
                "expiry_duration": s.expiry_duration,
                "signal_published_at": s.signal_published_at.isoformat() if s.signal_published_at else None,
                "website_received_at": s.website_received_at.isoformat() if s.website_received_at else None,
                "is_late": s.is_late,
                "late_by_seconds": s.late_by_seconds,
                "status": s.status,
                "reported_result": s.reported_result,
                "result_reported_at": s.result_reported_at.isoformat() if s.result_reported_at else None,
                "raw_signal_text": s.raw_signal_text,
                "raw_result_text": s.raw_result_text,
                "review_reason": s.review_reason,
                "is_test_data": s.is_test_data
            }

        latest = {
            "latest_otc": map_s(latest_otc),
            "latest_live": map_s(latest_live),
            "recent_results": [map_s(s) for s in recent_results],
            "recent_otc_results": [map_s(s) for s in recent_otc],
            "recent_live_results": [map_s(s) for s in recent_live],
            "pending_signals": [map_s(s) for s in pending_all],
            "pending_otc_signals": [map_s(s) for s in pending_otc],
            "pending_live_signals": [map_s(s) for s in pending_live]
        }

        # Paginated lists
        async def get_page(category=None):
            stmt = select(ParsedSignal).join(ParsedSignal.source).options(selectinload(ParsedSignal.source))
            if category:
                stmt = stmt.where(ParsedSignal.market_category == category)
            stmt = stmt.order_by(ParsedSignal.signal_published_at.desc(), ParsedSignal.id.desc()).limit(50)
            items = (await db.execute(stmt)).scalars().unique().all()
            total_stmt = select(func.count(ParsedSignal.id))
            if category:
                total_stmt = total_stmt.where(ParsedSignal.market_category == category)
            tot = (await db.execute(total_stmt)).scalar() or len(items)
            return {
                "items": [map_s(s) for s in items],
                "total": tot,
                "page": 1,
                "page_size": 50,
                "total_pages": (tot + 49) // 50
            }

        signals_all = await get_page(None)
        signals_otc = await get_page("OTC")
        signals_live = await get_page("LIVE")

        tg_status = {
            "is_connected": True,
            "status": "CONNECTED",
            "error_message": None,
            "last_sync_at": now_utc.isoformat(),
            "sources": [
                {
                    "name": "QUOTEX OFFICIAL VIP BOT",
                    "category": "LIVE",
                    "status": "CONNECTED",
                    "username": "quotexofficialvipbot",
                    "link": "https://t.me/quotexofficialvipbot"
                },
                {
                    "name": "Quotex Vip Bot Signal",
                    "category": "OTC",
                    "status": "CONNECTED",
                    "username": "quotex0o",
                    "link": "https://t.me/quotex0o"
                }
            ]
        }

        snapshot_payload = {
            "stats": stats,
            "latest": latest,
            "all_signals": signals_all,
            "signals_otc": signals_otc,
            "signals_live": signals_live,
            "telegram_status": tg_status
        }

        with open("frontend/src/lib/snapshot.json", "w", encoding="utf-8") as f:
            json.dump(snapshot_payload, f, indent=2)

        print("Snapshot successfully exported with", len(signals_all["items"]), "signals!")
        print("Today signal count:", stats["today_signal_count"], "Win rate:", stats["win_rate_percentage"], "%")

if __name__ == "__main__":
    asyncio.run(export_snapshot())

