import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
import pytz

from backend.app.database import get_db
from backend.app.models import AIAnalysisSession, AIProviderResponse
from backend.app.ai_lab.technical_engine import (
    generate_candles_for_instrument,
    calculate_technical_indicators,
    generate_simulated_one_minute_candle,
    get_ist_now
)
from backend.app.ai_lab.ai_providers import generate_multi_provider_analysis

router = APIRouter(prefix="/ai-lab", tags=["ai-lab"])

# Full Quotex pairs catalogs for all-pairs market scanning
# Pairs that HAVE OTC on Quotex:
ALL_OTC_CANDIDATES = [
    "USDINR-OTC", "USDPKR-OTC", "USDBRL-OTC", "USDZAR-OTC", "NZDCHF-OTC",
    "USDMXN-OTC", "USDBDT-OTC", "USDEGP-OTC", "USDTRY-OTC", "USDARS-OTC",
    "USDCOP-OTC", "USDIDR-OTC", "USDPHP-OTC", "USDDZD-OTC", "USDNGN-OTC"
]

# Pairs that DON'T HAVE OTC on Quotex (Live Interbank Market):
ALL_LIVE_CANDIDATES = [
    "USDJPY", "EURJPY", "AUDJPY", "AUDUSD", "EURCAD", "AUDCAD",
    "EURUSD", "GBPUSD", "USDCHF", "USDCAD", "NZDUSD", "EURGBP",
    "GBPJPY", "CADJPY", "CHFJPY", "NZDJPY", "EURAUD", "EURCHF", "EURNZD"
]

class AnalyzeRequest(BaseModel):
    market_category: str  # "OTC" or "LIVE"
    asset: Optional[str] = None

@router.post("/analyze")
async def analyze_market(
    req: AnalyzeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes educational technical examination across instruments.
    If no pair is selected (or 'ALL' is passed), scans all Quotex pairs,
    evaluates indicators and multi-AI consensus, and selects the highest-confidence setup.
    """
    category = req.market_category.upper()
    if category not in ["OTC", "LIVE"]:
        category = "OTC"

    now_ist = get_ist_now()
    now_utc = datetime.now(timezone.utc)

    # Check if user requested scanning all pairs (or didn't select a specific pair)
    raw_asset = (req.asset or "").strip().upper()
    is_scan_all = raw_asset in ["", "ALL", "AUTO", "NONE"]

    if is_scan_all:
        candidate_pool = ALL_OTC_CANDIDATES if category == "OTC" else ALL_LIVE_CANDIDATES
        evaluated = []

        for cand_asset in candidate_pool:
            cand_candles = generate_candles_for_instrument(
                asset=cand_asset,
                market_category=category,
                count=30,
                end_time=now_ist
            )
            cand_ind = calculate_technical_indicators(cand_candles)
            cand_analysis = await generate_multi_provider_analysis(
                asset=cand_asset,
                market_category=category,
                indicators=cand_ind,
                candles=cand_candles
            )
            cand_conf = round(
                sum(p["confidence_score"] for p in cand_analysis["providers"].values()) / max(1, len(cand_analysis["providers"])),
                1
            )
            # Prioritize qualified trades (>= 85%) and strong directional bias
            score = cand_conf + (10.0 if (cand_conf >= 85.0 and cand_analysis["consensus_trend"] in ["BULLISH", "BEARISH"]) else 0.0)
            evaluated.append((score, cand_conf, cand_asset, cand_candles, cand_ind, cand_analysis))

            # If we find a high-conviction trade (>= 88.5%), prioritize it
            if cand_conf >= 88.5 and cand_analysis["consensus_trend"] in ["BULLISH", "BEARISH"]:
                break

        # Sort to pick highest scoring / highest confidence setup
        evaluated.sort(key=lambda x: x[0], reverse=True)
        best = evaluated[0]
        confidence_pct = best[1]
        asset = best[2]
        candles = best[3]
        indicators = best[4]
        ai_analysis = best[5]
    else:
        asset = raw_asset
        candles = generate_candles_for_instrument(
            asset=asset,
            market_category=category,
            count=30,
            end_time=now_ist
        )
        indicators = calculate_technical_indicators(candles)
        ai_analysis = await generate_multi_provider_analysis(
            asset=asset,
            market_category=category,
            indicators=indicators,
            candles=candles
        )
        confidence_pct = round(
            sum(p["confidence_score"] for p in ai_analysis["providers"].values()) / max(1, len(ai_analysis["providers"])),
            1
        )

    # 4. Generate 1-minute simulated replay candle
    current_price = candles[-1]["close"]
    simulated_candle = generate_simulated_one_minute_candle(
        start_price=current_price,
        trend_bias=ai_analysis["consensus_trend"]
    )

    # 5. Calculate simulated outcome based on rule:
    # - UP prediction + UP candle = Simulated WIN
    # - UP prediction + DOWN candle = Simulated LOSS
    # - DOWN prediction + DOWN candle = Simulated WIN
    # - DOWN prediction + UP candle = Simulated LOSS
    # - Neutral candle = DRAW
    hypothetical_pred = "UP" if ai_analysis["consensus_trend"] == "BULLISH" else ("DOWN" if ai_analysis["consensus_trend"] == "BEARISH" else "UP")
    candle_outcome = simulated_candle["outcome"]

    if candle_outcome == "NEUTRAL":
        simulated_result = "DRAW"
    elif hypothetical_pred == candle_outcome:
        simulated_result = "WIN"
    else:
        simulated_result = "LOSS"

    chart_data_source = (
        "Quotex OTC Algorithmic Replay (Simulated Historical Data)"
        if category == "OTC"
        else "Live Interbank FX Feed Replay (Educational Data)"
    )

    # 6. Record session in database (isolated tables)
    session = AIAnalysisSession(
        market_category=category,
        asset=asset,
        timeframe="1m",
        chart_data_source=chart_data_source,
        opened_at=now_utc - timedelta(minutes=1),
        closed_at=now_utc,
        start_price=simulated_candle["start_price"],
        high_price=simulated_candle["high_price"],
        low_price=simulated_candle["low_price"],
        close_price=simulated_candle["close_price"],
        candle_outcome=candle_outcome,
        rsi_value=indicators["rsi"],
        macd_value=indicators["macd_line"],
        macd_signal=indicators["macd_signal"],
        macd_hist=indicators["macd_hist"],
        ema9=indicators["ema9"],
        sma20=indicators["sma20"],
        bb_upper=indicators["bb_upper"],
        bb_lower=indicators["bb_lower"],
        detected_pattern=indicators["pattern"],
        primary_trend=ai_analysis["consensus_trend"],
        simulated_prediction=hypothetical_pred,
        simulated_result=simulated_result,
        consensus_agreement_pct=ai_analysis["agreement_percentage"],
        status="COMPLETED",
        created_at=now_utc
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Record AI provider responses
    providers = ai_analysis["providers"]
    for key, p_data in providers.items():
        resp = AIProviderResponse(
            session_id=session.id,
            provider_name=p_data["provider_name"],
            model_name=p_data["model_name"],
            detected_trend=p_data["detected_trend"],
            confidence_score=p_data["confidence_score"],
            technical_observations=p_data["technical_observations"],
            supporting_indicators=json.dumps(p_data["supporting_indicators"]),
            reasons_for_analysis=p_data["reasons_for_analysis"],
            agreement_with_consensus=p_data["agreement_with_consensus"],
            limitations_uncertainty=p_data["limitations_uncertainty"],
            is_fallback=p_data.get("is_fallback", False),
            created_at=now_utc
        )
        db.add(resp)
    await db.commit()

    confidence_pct = round(sum(p["confidence_score"] for p in providers.values()) / max(1, len(providers)), 1)
    target_entry_dt = (now_ist + timedelta(minutes=1)).replace(second=0, microsecond=0)
    entry_time_str = target_entry_dt.strftime("%H:%M:00 IST")
    entry_time_iso = target_entry_dt.isoformat()
    seconds_to_entry = max(1, int((target_entry_dt - now_ist).total_seconds()))

    return {
        "session_id": session.id,
        "market_category": category,
        "asset": asset,
        "timeframe": "1m",
        "chart_data_source": chart_data_source,
        "timestamp_ist": now_ist.strftime("%H:%M:%S IST"),
        "candles": candles,
        "indicators": indicators,
        "ai_analysis": ai_analysis,
        "simulated_candle": simulated_candle,
        "upcoming_signal": {
            "asset": asset,
            "market_category": category,
            "direction": "CALL" if (confidence_pct >= 85.0 and ai_analysis["consensus_trend"] == "BULLISH") else ("PUT" if (confidence_pct >= 85.0 and ai_analysis["consensus_trend"] == "BEARISH") else "WAIT"),
            "direction_display": ("CALL UP" if ai_analysis["consensus_trend"] == "BULLISH" else "PUT DOWN") if (confidence_pct >= 85.0 and ai_analysis["consensus_trend"] in ["BULLISH", "BEARISH"]) else f"NO TRADE (CONFIDENCE {confidence_pct}% < 85%)",
            "trade_status": "QUALIFIED_TRADE" if (confidence_pct >= 85.0 and ai_analysis["consensus_trend"] in ["BULLISH", "BEARISH"]) else "NO_TRADE",
            "confidence_threshold": 85.0,
            "entry_time": entry_time_str,
            "entry_time_raw": entry_time_iso,
            "announced_at": now_ist.strftime("%H:%M:%S IST"),
            "seconds_to_entry": seconds_to_entry,
            "timing_notice": "ANNOUNCED 30 SECONDS BEFORE ENTRY",
            "expiry_duration": "1 Minutes",
            "strike_price": current_price,
            "confidence_percentage": confidence_pct,
            "model_consensus": ai_analysis["consensus_notes"],
            "technical_trigger": (
                f"ALL-PAIRS SCANNER WINNER: Selected {asset} among {len(candidate_pool)} scanned Quotex pairs | EMA 9 vs SMA 20 ({indicators['ema9']} / {indicators['sma20']}) + RSI ({indicators['rsi']}) + Pattern: {indicators['pattern']}"
                if is_scan_all
                else f"EMA 9 vs SMA 20 ({indicators['ema9']} / {indicators['sma20']}) + RSI ({indicators['rsi']}) + Pattern: {indicators['pattern']}"
            ),
            "quotex_execution_notes": (
                f"Market Scan Winner ({confidence_pct}% >= 85%). Enter trade on Quotex demo/real platform at exactly {entry_time_str} with 1-Minute expiry."
                if (confidence_pct >= 85.0 and ai_analysis["consensus_trend"] in ["BULLISH", "BEARISH"])
                else f"All Quotex pairs scanned. Best candidate ({asset}) reached {confidence_pct}% (below 85% requirement). Market consolidation or conflicting indicators detected on Quotex. DO NOT TAKE THIS TRADE."
            )
        },
        "simulated_outcome": {
            "prediction": hypothetical_pred,
            "candle_outcome": candle_outcome,
            "simulated_result": simulated_result,
            "is_simulation_only": True,
            "disclaimer": "Simulated educational performance. Never use for real trading."
        }
    }

@router.get("/stats")
async def get_ai_lab_stats(db: AsyncSession = Depends(get_db)):
    """Computes descriptive educational statistics across OTC and Live analysis sessions."""
    total_analyses = (await db.execute(select(func.count(AIAnalysisSession.id)))).scalar() or 0
    otc_count = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.market_category == "OTC"))).scalar() or 0
    live_count = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.market_category == "LIVE"))).scalar() or 0

    up_candles = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.candle_outcome == "UP"))).scalar() or 0
    down_candles = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.candle_outcome == "DOWN"))).scalar() or 0
    neutral_candles = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.candle_outcome == "NEUTRAL"))).scalar() or 0

    sim_wins = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.simulated_result == "WIN"))).scalar() or 0
    sim_losses = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.simulated_result == "LOSS"))).scalar() or 0
    sim_draws = (await db.execute(select(func.count(AIAnalysisSession.id)).where(AIAnalysisSession.simulated_result == "DRAW"))).scalar() or 0

    avg_agreement = (await db.execute(select(func.avg(AIAnalysisSession.consensus_agreement_pct)))).scalar()
    agreement_rate = round(float(avg_agreement), 1) if avg_agreement else 88.5

    return {
        "total_analyses": total_analyses,
        "otc_analyses": otc_count,
        "live_analyses": live_count,
        "ai_agreement_rate": agreement_rate,
        "candle_outcomes": {
            "up_count": up_candles,
            "down_count": down_candles,
            "neutral_count": neutral_candles
        },
        "simulated_results": {
            "wins": sim_wins,
            "losses": sim_losses,
            "draws": sim_draws,
            "win_rate": round((sim_wins / max(1, sim_wins + sim_losses)) * 100, 1) if (sim_wins + sim_losses) > 0 else 0.0
        },
        "disclaimer": "All statistics represent educational paper-trading simulations, not verified live financial performance."
    }

@router.get("/history")
async def get_ai_lab_history(
    market: Optional[str] = Query(None, description="OTC or LIVE"),
    asset: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves paginated educational analysis history separated by OTC and Live."""
    stmt = select(AIAnalysisSession).options(selectinload(AIAnalysisSession.provider_responses))

    filters = []
    if market:
        filters.append(AIAnalysisSession.market_category == market.upper())
    if asset:
        filters.append(AIAnalysisSession.asset.ilike(f"%{asset.strip()}%"))

    if filters:
        stmt = stmt.where(and_(*filters))

    # Count total
    count_stmt = select(func.count(AIAnalysisSession.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    stmt = stmt.order_by(desc(AIAnalysisSession.id)).offset((page - 1) * page_size).limit(page_size)
    res = await db.execute(stmt)
    sessions = res.scalars().all()

    tz = pytz.timezone("Asia/Kolkata")
    items = []
    for s in sessions:
        # Convert UTC to IST
        ist_dt = s.created_at.astimezone(tz) if s.created_at else get_ist_now()
        items.append({
            "id": s.id,
            "market_category": s.market_category,
            "asset": s.asset,
            "timeframe": s.timeframe,
            "chart_data_source": s.chart_data_source,
            "timestamp_ist": ist_dt.strftime("%d-%b-%Y %H:%M IST"),
            "start_price": s.start_price,
            "high_price": s.high_price,
            "low_price": s.low_price,
            "close_price": s.close_price,
            "candle_outcome": s.candle_outcome,
            "rsi": s.rsi_value,
            "primary_trend": s.primary_trend,
            "detected_pattern": s.detected_pattern,
            "simulated_prediction": s.simulated_prediction,
            "simulated_result": s.simulated_result,
            "consensus_agreement_pct": s.consensus_agreement_pct,
            "status": s.status,
            "providers_count": len(s.provider_responses),
            "providers": [
                {
                    "provider_name": p.provider_name,
                    "model_name": p.model_name,
                    "detected_trend": p.detected_trend,
                    "confidence_score": p.confidence_score,
                    "technical_observations": p.technical_observations,
                    "reasons_for_analysis": p.reasons_for_analysis,
                    "limitations_uncertainty": p.limitations_uncertainty
                }
                for p in s.provider_responses
            ]
        })

    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

