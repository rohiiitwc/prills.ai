import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import pytz
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload

from backend.app.database import get_db
from backend.app.models import ParsedSignal, TelegramSource, SignalAuditLog
from backend.app.schemas import SignalResponse, SignalPagination, DashboardStats
from backend.app.config import settings
from backend.app.telegram_service import telegram_service
from backend.app.websocket_manager import ws_manager

router = APIRouter(prefix="/signals", tags=["signals"])

def clean_source_name(category: Optional[str]) -> str:
    return "Quotex OTC Engine" if category == "OTC" else "Global Forex Stream"

@router.get("", response_model=SignalPagination)
async def get_signals(
    market: Optional[str] = Query(None, description="OTC or LIVE"),
    source_username: Optional[str] = Query(None),
    asset: Optional[str] = Query(None),
    direction: Optional[str] = Query(None, description="CALL or PUT"),
    status: Optional[str] = Query(None, description="WIN, LOSS, DRAW, PENDING, NEEDS_REVIEW"),
    search: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("-signal_published_at"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves paginated, filtered signals from the permanent database."""
    filters = []

    if market:
        filters.append(ParsedSignal.market_category == market.upper())
    
    if source_username:
        # Join source
        filters.append(TelegramSource.username == source_username.lower())

    if asset:
        filters.append(ParsedSignal.asset.ilike(f"%{asset.strip()}%"))

    if direction:
        filters.append(ParsedSignal.direction == direction.upper())

    if status:
        filters.append(ParsedSignal.status == status.upper())

    if search:
        search_term = f"%{search.strip()}%"
        filters.append(
            or_(
                ParsedSignal.asset.ilike(search_term),
                ParsedSignal.raw_signal_text.ilike(search_term),
                TelegramSource.name.ilike(search_term)
            )
        )

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            filters.append(ParsedSignal.signal_published_at >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
            filters.append(ParsedSignal.signal_published_at < end_dt)
        except ValueError:
            pass

    # Count query
    count_query = select(func.count(ParsedSignal.id)).join(ParsedSignal.source)
    if filters:
        count_query = count_query.where(and_(*filters))
    
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    # Data query
    query = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source), selectinload(ParsedSignal.audit_logs))
    )
    if filters:
        query = query.where(and_(*filters))

    # Sorting
    if sort_by == "-signal_published_at":
        query = query.order_by(desc(ParsedSignal.signal_published_at))
    elif sort_by == "signal_published_at":
        query = query.order_by(asc(ParsedSignal.signal_published_at))
    elif sort_by == "-website_received_at":
        query = query.order_by(desc(ParsedSignal.website_received_at))
    else:
        query = query.order_by(desc(ParsedSignal.signal_published_at))

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    signals = result.scalars().all()

    # Format items
    items = []
    for s in signals:
        item = SignalResponse(
            id=s.id,
            source_id=s.source_id,
            source_name=clean_source_name(s.market_category),
            market_category=s.market_category,
            asset=s.asset,
            direction=s.direction,
            direction_display=s.direction_display,
            entry_time_announced=s.entry_time_announced,
            entry_time_converted=s.entry_time_converted,
            expiry_duration=s.expiry_duration,
            signal_published_at=s.signal_published_at,
            website_received_at=s.website_received_at,
            is_late=s.is_late,
            late_by_seconds=s.late_by_seconds,
            status=s.status,
            reported_result=s.reported_result,
            result_reported_at=s.result_reported_at,
            raw_signal_text=s.raw_signal_text,
            raw_result_text=s.raw_result_text,
            review_reason=s.review_reason,
            is_test_data=s.is_test_data,
            created_at=s.created_at,
            updated_at=s.updated_at,
            audit_logs=s.audit_logs
        )
        items.append(item)

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

    return SignalPagination(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/latest")
async def get_latest_signals(db: AsyncSession = Depends(get_db)):
    """Returns the latest OTC signal, latest Live market signal, and pending signals."""
    # Latest valid OTC signal
    stmt_otc = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.market_category == "OTC",
                ParsedSignal.direction.in_(["CALL", "PUT"]),
                ParsedSignal.status != "NEEDS_REVIEW"
            )
        )
        .order_by(desc(ParsedSignal.signal_published_at), desc(ParsedSignal.id))
        .limit(1)
    )
    res_otc = await db.execute(stmt_otc)
    latest_otc = res_otc.scalar_one_or_none()

    # Latest valid LIVE market signal
    stmt_live = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.market_category == "LIVE",
                ParsedSignal.direction.in_(["CALL", "PUT"]),
                ParsedSignal.status != "NEEDS_REVIEW"
            )
        )
        .order_by(desc(ParsedSignal.signal_published_at), desc(ParsedSignal.id))
        .limit(1)
    )
    res_live = await db.execute(stmt_live)
    latest_live = res_live.scalar_one_or_none()

    # Latest Results (OTC market)
    stmt_results_otc = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.market_category == "OTC",
                ParsedSignal.reported_result.isnot(None),
                ParsedSignal.direction.in_(["CALL", "PUT"]),
                ParsedSignal.status.in_(["WIN", "LOSS", "DRAW"])
            )
        )
        .order_by(desc(ParsedSignal.result_reported_at), desc(ParsedSignal.id))
        .limit(5)
    )
    res_results_otc = await db.execute(stmt_results_otc)
    recent_otc_results = res_results_otc.scalars().unique().all()

    # Latest Results (LIVE market)
    stmt_results_live = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.market_category == "LIVE",
                ParsedSignal.reported_result.isnot(None),
                ParsedSignal.direction.in_(["CALL", "PUT"]),
                ParsedSignal.status.in_(["WIN", "LOSS", "DRAW"])
            )
        )
        .order_by(desc(ParsedSignal.result_reported_at), desc(ParsedSignal.id))
        .limit(5)
    )
    res_results_live = await db.execute(stmt_results_live)
    recent_live_results = res_results_live.scalars().unique().all()

    # Combined Latest Results (last 10 completed results)
    stmt_results = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.reported_result.isnot(None),
                ParsedSignal.direction.in_(["CALL", "PUT"]),
                ParsedSignal.status.in_(["WIN", "LOSS", "DRAW"])
            )
        )
        .order_by(desc(ParsedSignal.result_reported_at), desc(ParsedSignal.id))
        .limit(10)
    )
    res_results = await db.execute(stmt_results)
    recent_results = res_results.scalars().unique().all()

    # Pending signals awaiting results (OTC)
    stmt_pending_otc = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.market_category == "OTC",
                ParsedSignal.status == "PENDING",
                ParsedSignal.direction.in_(["CALL", "PUT"])
            )
        )
        .order_by(desc(ParsedSignal.signal_published_at), desc(ParsedSignal.id))
        .limit(6)
    )
    res_pending_otc = await db.execute(stmt_pending_otc)
    pending_otc_signals = res_pending_otc.scalars().unique().all()

    # Pending signals awaiting results (LIVE)
    stmt_pending_live = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.market_category == "LIVE",
                ParsedSignal.status == "PENDING",
                ParsedSignal.direction.in_(["CALL", "PUT"])
            )
        )
        .order_by(desc(ParsedSignal.signal_published_at), desc(ParsedSignal.id))
        .limit(6)
    )
    res_pending_live = await db.execute(stmt_pending_live)
    pending_live_signals = res_pending_live.scalars().unique().all()

    # Combined Pending signals awaiting results
    stmt_pending = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .where(
            and_(
                ParsedSignal.status == "PENDING",
                ParsedSignal.direction.in_(["CALL", "PUT"])
            )
        )
        .order_by(desc(ParsedSignal.signal_published_at), desc(ParsedSignal.id))
        .limit(10)
    )
    res_pending = await db.execute(stmt_pending)
    pending_signals = res_pending.scalars().unique().all()

    def map_sig(s):
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
            "signal_published_at": s.signal_published_at.isoformat(),
            "website_received_at": s.website_received_at.isoformat(),
            "is_late": s.is_late,
            "late_by_seconds": s.late_by_seconds,
            "status": s.status,
            "reported_result": s.reported_result,
            "result_reported_at": s.result_reported_at.isoformat() if s.result_reported_at else None,
            "raw_signal_text": s.raw_signal_text,
            "raw_result_text": s.raw_result_text,
            "is_test_data": s.is_test_data
        }

    return {
        "latest_otc": map_sig(latest_otc),
        "latest_live": map_sig(latest_live),
        "recent_results": [map_sig(s) for s in recent_results],
        "recent_otc_results": [map_sig(s) for s in recent_otc_results],
        "recent_live_results": [map_sig(s) for s in recent_live_results],
        "pending_signals": [map_sig(s) for s in pending_signals],
        "pending_otc_signals": [map_sig(s) for s in pending_otc_signals],
        "pending_live_signals": [map_sig(s) for s in pending_live_signals]
    }

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Computes real-time dashboard metrics for today."""
    now_utc = datetime.now(timezone.utc)
    # Today start in Asia/Kolkata
    tz = pytz.timezone(settings.DISPLAY_TIMEZONE)
    local_now = now_utc.astimezone(tz)
    today_start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_local.astimezone(timezone.utc)

    # Base query for today
    stmt_base = ParsedSignal.signal_published_at >= today_start_utc

    # Total today
    stmt_today = select(func.count(ParsedSignal.id)).where(stmt_base)
    total_today = (await db.execute(stmt_today)).scalar() or 0

    # Wins today
    stmt_wins = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "WIN"))
    wins_today = (await db.execute(stmt_wins)).scalar() or 0

    # Losses today
    stmt_loss = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "LOSS"))
    loss_today = (await db.execute(stmt_loss)).scalar() or 0

    # Draw today
    stmt_draw = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "DRAW"))
    draw_today = (await db.execute(stmt_draw)).scalar() or 0

    # Pending today
    stmt_pending = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.status == "PENDING"))
    pending_today = (await db.execute(stmt_pending)).scalar() or 0

    # OTC count today
    stmt_otc = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "OTC"))
    otc_today = (await db.execute(stmt_otc)).scalar() or 0

    # OTC Wins & Losses today
    stmt_otc_wins = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "OTC", ParsedSignal.status == "WIN"))
    otc_wins_today = (await db.execute(stmt_otc_wins)).scalar() or 0

    stmt_otc_loss = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "OTC", ParsedSignal.status == "LOSS"))
    otc_loss_today = (await db.execute(stmt_otc_loss)).scalar() or 0

    otc_decided = otc_wins_today + otc_loss_today
    otc_win_rate = round((otc_wins_today / otc_decided * 100), 1) if otc_decided > 0 else 0.0

    # Live count today
    stmt_live = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "LIVE"))
    live_today = (await db.execute(stmt_live)).scalar() or 0

    # Live Wins & Losses today
    stmt_live_wins = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "LIVE", ParsedSignal.status == "WIN"))
    live_wins_today = (await db.execute(stmt_live_wins)).scalar() or 0

    stmt_live_loss = select(func.count(ParsedSignal.id)).where(and_(stmt_base, ParsedSignal.market_category == "LIVE", ParsedSignal.status == "LOSS"))
    live_loss_today = (await db.execute(stmt_live_loss)).scalar() or 0

    live_decided = live_wins_today + live_loss_today
    live_win_rate = round((live_wins_today / live_decided * 100), 1) if live_decided > 0 else 0.0

    # Win rate: wins / (wins + losses) * 100
    decided = wins_today + loss_today
    win_rate = round((wins_today / decided * 100), 1) if decided > 0 else 0.0

    tg_status = telegram_service.get_status()

    return DashboardStats(
        today_signal_count=total_today,
        today_win_count=wins_today,
        today_loss_count=loss_today,
        today_draw_count=draw_today,
        today_pending_count=pending_today,
        win_rate_percentage=win_rate,
        otc_signals_today=otc_today,
        live_signals_today=live_today,
        otc_win_count=otc_wins_today,
        otc_loss_count=otc_loss_today,
        otc_win_rate_percentage=otc_win_rate,
        live_win_count=live_wins_today,
        live_loss_count=live_loss_today,
        live_win_rate_percentage=live_win_rate,
        telegram_connected=tg_status["is_connected"],
        telegram_auth_status=tg_status["status"],
        last_sync_at=telegram_service.last_sync_at,
        source_1_status=tg_status["sources"][0]["status"],
        source_2_status=tg_status["sources"][1]["status"]
    )

@router.get("/export")
async def export_signals_csv(
    market: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Exports permanent signal history as CSV with all requested columns."""
    filters = []
    if market:
        filters.append(ParsedSignal.market_category == market.upper())
    if status:
        filters.append(ParsedSignal.status == status.upper())

    query = (
        select(ParsedSignal)
        .join(ParsedSignal.source)
        .options(selectinload(ParsedSignal.source))
        .order_by(desc(ParsedSignal.signal_published_at))
    )
    if filters:
        query = query.where(and_(*filters))

    result = await db.execute(query)
    signals = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Required columns (includes converted IST time and scheduled entry time)
    writer.writerow([
        "Date",
        "Market Feed",
        "Market Category",
        "Asset",
        "Direction",
        "IST Entry Time",
        "PRILLS AI Window",
        "Expiry",
        "Signal Publication Time (UTC)",
        "Website Reception Time (UTC)",
        "Reported Result",
        "Result Publication Time (UTC)",
        "Is Late",
        "Late By (Sec)",
        "Status",
        "Is Test Data",
        "Signal Payload"
    ])

    for s in signals:
        writer.writerow([
            s.signal_published_at.strftime("%Y-%m-%d"),
            clean_source_name(s.market_category),
            s.market_category,
            s.asset,
            s.direction_display,
            s.entry_time_converted or f"{s.entry_time_announced} IST",
            s.entry_time_announced,
            s.expiry_duration,
            s.signal_published_at.isoformat(),
            s.website_received_at.isoformat(),
            s.reported_result or "PENDING",
            s.result_reported_at.isoformat() if s.result_reported_at else "N/A",
            "YES" if s.is_late else "NO",
            s.late_by_seconds,
            s.status,
            "YES" if s.is_test_data else "NO",
            s.raw_signal_text.replace("\n", " | ")
        ])

    csv_data = output.getvalue()
    filename = f"signals_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal_detail(signal_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves full details of a specific signal, including audit logs."""
    query = (
        select(ParsedSignal)
        .options(selectinload(ParsedSignal.source), selectinload(ParsedSignal.audit_logs))
        .where(ParsedSignal.id == signal_id)
    )
    res = await db.execute(query)
    signal = res.scalar_one_or_none()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    return SignalResponse(
        id=signal.id,
        source_id=signal.source_id,
        source_name=clean_source_name(signal.market_category),
        market_category=signal.market_category,
        asset=signal.asset,
        direction=signal.direction,
        direction_display=signal.direction_display,
        entry_time_announced=signal.entry_time_announced,
        expiry_duration=signal.expiry_duration,
        signal_published_at=signal.signal_published_at,
        website_received_at=signal.website_received_at,
        is_late=signal.is_late,
        late_by_seconds=signal.late_by_seconds,
        status=signal.status,
        reported_result=signal.reported_result,
        result_reported_at=signal.result_reported_at,
        raw_signal_text=signal.raw_signal_text,
        raw_result_text=signal.raw_result_text,
        review_reason=signal.review_reason,
        is_test_data=signal.is_test_data,
        created_at=signal.created_at,
        updated_at=signal.updated_at,
        audit_logs=signal.audit_logs
    )
