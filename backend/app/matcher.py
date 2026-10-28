import json
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from backend.app.models import ParsedSignal, SignalAuditLog, TelegramMessage, TelegramSource

async def match_result_to_signal(
    db: AsyncSession,
    source: TelegramSource,
    result_message: TelegramMessage,
    parsed_result: dict
) -> Tuple[Optional[ParsedSignal], Optional[str]]:
    """
    Associates an incoming result message (e.g. 'EURJPY Loss', 'USDJPY Profit')
    with the correct earlier pending signal.
    Preserves audit trail.
    """
    asset = parsed_result.get("asset")
    outcome = parsed_result.get("reported_result") # WIN, LOSS, DRAW
    raw_result = parsed_result.get("raw_result_text")

    if not asset or not outcome:
        return None, "Invalid parsed result data"

    # SQLite stores naive datetimes; normalize comparison target to naive UTC
    ref_pub_at = result_message.published_at
    if ref_pub_at and ref_pub_at.tzinfo is not None:
        ref_pub_at = ref_pub_at.replace(tzinfo=None)

    # Search for the latest PENDING signal for this asset in the same source channel
    # published BEFORE or AT the result message timestamp
    stmt = (
        select(ParsedSignal)
        .where(
            and_(
                ParsedSignal.source_id == source.id,
                ParsedSignal.asset == asset,
                ParsedSignal.status == "PENDING",
                ParsedSignal.signal_published_at <= ref_pub_at
            )
        )
        .order_by(desc(ParsedSignal.signal_published_at))
        .limit(1)
    )
    
    result = await db.execute(stmt)
    pending_signal = result.scalar_one_or_none()

    if not pending_signal:
        # Check if there is a pending signal in the same market category (e.g. if source IDs differ)
        stmt_fallback = (
            select(ParsedSignal)
            .where(
                and_(
                    ParsedSignal.market_category == source.category,
                    ParsedSignal.asset == asset,
                    ParsedSignal.status == "PENDING",
                    ParsedSignal.signal_published_at <= ref_pub_at
                )
            )
            .order_by(desc(ParsedSignal.signal_published_at))
            .limit(1)
        )
        res_fb = await db.execute(stmt_fallback)
        pending_signal = res_fb.scalar_one_or_none()

    if not pending_signal:
        # Check if recent signal can be updated by a Martingale win (e.g. Profit ✅1)
        if outcome == "WIN":
            stmt_mtg = (
                select(ParsedSignal)
                .where(
                    and_(
                        ParsedSignal.source_id == source.id,
                        ParsedSignal.asset == asset,
                        ParsedSignal.status.in_(["LOSS", "PENDING"]),
                        ParsedSignal.signal_published_at <= ref_pub_at
                    )
                )
                .order_by(desc(ParsedSignal.signal_published_at))
                .limit(1)
            )
            res_mtg = await db.execute(stmt_mtg)
            pending_signal = res_mtg.scalar_one_or_none()

    if pending_signal:
        # Found the matching signal! Update it
        old_status = pending_signal.status
        old_result = pending_signal.reported_result

        pending_signal.status = outcome
        pending_signal.reported_result = outcome
        pending_signal.result_telegram_message_id = result_message.id
        pending_signal.result_reported_at = result_message.published_at
        pending_signal.raw_result_text = raw_result
        pending_signal.updated_at = datetime.now(timezone.utc)

        # Create audit trail entry
        audit = SignalAuditLog(
            signal_id=pending_signal.id,
            action="RESULT_MATCHED",
            details=f"Result matched to message #{result_message.message_id} from {source.name} ({outcome})",
            old_values=json.dumps({"status": old_status, "reported_result": old_result}),
            new_values=json.dumps({
                "status": outcome,
                "reported_result": outcome,
                "result_reported_at": result_message.published_at.isoformat(),
                "raw_result_text": raw_result
            }),
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit)

        # Also resolve any other older pending signals for this same asset preceding this result
        stmt_other_pending = (
            select(ParsedSignal)
            .where(
                and_(
                    ParsedSignal.source_id == source.id,
                    ParsedSignal.asset == asset,
                    ParsedSignal.status == "PENDING",
                    ParsedSignal.id != pending_signal.id,
                    ParsedSignal.signal_published_at <= ref_pub_at
                )
            )
        )
        res_others = await db.execute(stmt_other_pending)
        for other_sig in res_others.scalars().all():
            other_sig.status = outcome
            other_sig.reported_result = outcome
            other_sig.result_telegram_message_id = result_message.id
            other_sig.result_reported_at = result_message.published_at
            other_sig.raw_result_text = raw_result
            other_sig.updated_at = datetime.now(timezone.utc)

            other_audit = SignalAuditLog(
                signal_id=other_sig.id,
                action="RESULT_MATCHED",
                details=f"Session result auto-matched to message #{result_message.message_id} ({outcome})",
                old_values=json.dumps({"status": "PENDING"}),
                new_values=json.dumps({"status": outcome, "reported_result": outcome}),
                timestamp=datetime.now(timezone.utc)
            )
            db.add(other_audit)

        await db.commit()
        await db.refresh(pending_signal)
        return pending_signal, None
    else:
        # No matching pending signal found -> flag for review
        unmatched_signal = ParsedSignal(
            source_id=source.id,
            telegram_message_id=result_message.id,
            market_category=source.category,
            asset=asset,
            direction="UNKNOWN",
            direction_display="UNKNOWN",
            entry_time_announced="N/A",
            expiry_duration="N/A",
            signal_published_at=result_message.published_at,
            website_received_at=result_message.received_at,
            status="NEEDS_REVIEW",
            reported_result=outcome,
            result_telegram_message_id=result_message.id,
            result_reported_at=result_message.published_at,
            raw_signal_text=f"[Result Message without Prior Signal] {raw_result}",
            raw_result_text=raw_result,
            review_reason=f"Unmatched result: No active PENDING signal found for {asset} in {source.name}"
        )
        db.add(unmatched_signal)
        await db.commit()
        await db.refresh(unmatched_signal)

        audit = SignalAuditLog(
            signal_id=unmatched_signal.id,
            action="FLAGGED_FOR_REVIEW",
            details=f"Unmatched result logged for manual review: {raw_result}",
            old_values=None,
            new_values=json.dumps({"status": "NEEDS_REVIEW", "reason": unmatched_signal.review_reason}),
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit)
        await db.commit()
        return None, unmatched_signal.review_reason
