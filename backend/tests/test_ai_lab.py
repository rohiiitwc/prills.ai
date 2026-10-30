import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.database import init_db
from backend.app.ai_lab.technical_engine import (
    generate_candles_for_instrument,
    calculate_technical_indicators,
    generate_simulated_one_minute_candle
)
from backend.app.ai_lab.ai_providers import generate_multi_provider_analysis

def test_generate_candles_for_instrument():
    # Test OTC
    otc_candles = generate_candles_for_instrument("EURUSD-OTC", "OTC", count=30)
    assert len(otc_candles) == 30
    assert otc_candles[0]["open"] > 0
    assert "timestamp" in otc_candles[0]

    # Test Live
    live_candles = generate_candles_for_instrument("EURUSD", "LIVE", count=30)
    assert len(live_candles) == 30
    assert live_candles[0]["high"] >= live_candles[0]["low"]

def test_calculate_technical_indicators():
    candles = generate_candles_for_instrument("EURUSD", "LIVE", count=30)
    indicators = calculate_technical_indicators(candles)
    
    assert "rsi" in indicators
    assert 0 <= indicators["rsi"] <= 100
    assert "ema9" in indicators
    assert "sma20" in indicators
    assert "macd_line" in indicators
    assert "bb_upper" in indicators
    assert "bb_lower" in indicators
    assert "pattern" in indicators
    assert indicators["primary_trend"] in ["BULLISH", "BEARISH", "RANGING"]

def test_generate_simulated_one_minute_candle():
    sim = generate_simulated_one_minute_candle(1.0850, "BULLISH")
    assert sim["start_price"] == 1.0850
    assert sim["high_price"] >= sim["low_price"]
    assert sim["outcome"] in ["UP", "DOWN", "NEUTRAL"]
    assert len(sim["ticks"]) > 5

@pytest.mark.asyncio
async def test_generate_multi_provider_analysis():
    candles = generate_candles_for_instrument("EURUSD-OTC", "OTC", count=30)
    indicators = calculate_technical_indicators(candles)
    analysis = await generate_multi_provider_analysis("EURUSD-OTC", "OTC", indicators, candles)

    assert "consensus_trend" in analysis
    assert "agreement_percentage" in analysis
    assert "providers" in analysis
    assert "openai" in analysis["providers"]
    assert "gemini" in analysis["providers"]
    assert "groq" in analysis["providers"]
    assert analysis["providers"]["openai"]["provider_name"] == "OpenAI"
    assert analysis["providers"]["gemini"]["provider_name"] == "Gemini"
    assert analysis["providers"]["groq"]["provider_name"] == "Groq"

@pytest.mark.asyncio
async def test_ai_lab_endpoints():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Analyze OTC
        otc_res = await client.post("/api/v1/ai-lab/analyze", json={
            "market_category": "OTC",
            "asset": "EURUSD-OTC"
        })
        assert otc_res.status_code == 200
        otc_data = otc_res.json()
        assert otc_data["market_category"] == "OTC"
        assert otc_data["asset"] == "EURUSD-OTC"
        assert "simulated_outcome" in otc_data
        assert otc_data["simulated_outcome"]["simulated_result"] in ["WIN", "LOSS", "DRAW"]

        # 2. Analyze Live
        live_res = await client.post("/api/v1/ai-lab/analyze", json={
            "market_category": "LIVE",
            "asset": "EURUSD"
        })
        assert live_res.status_code == 200
        live_data = live_res.json()
        assert live_data["market_category"] == "LIVE"
        assert live_data["asset"] == "EURUSD"

        # 3. Stats endpoint
        stats_res = await client.get("/api/v1/ai-lab/stats")
        assert stats_res.status_code == 200
        stats = stats_res.json()
        assert stats["total_analyses"] >= 2
        assert stats["otc_analyses"] >= 1
        assert stats["live_analyses"] >= 1

        # 4. History endpoint - OTC only
        hist_otc = await client.get("/api/v1/ai-lab/history?market=OTC")
        assert hist_otc.status_code == 200
        items_otc = hist_otc.json()["items"]
        assert all(item["market_category"] == "OTC" for item in items_otc)

        # 6. Analyze All Pairs (Auto-Scan when asset is ALL or empty)
        all_res = await client.post("/api/v1/ai-lab/analyze", json={
            "market_category": "OTC",
            "asset": "ALL"
        })
        assert all_res.status_code == 200
        all_data = all_res.json()
        assert all_data["market_category"] == "OTC"
        assert all_data["asset"] != ""
        assert "upcoming_signal" in all_data
        assert all_data["upcoming_signal"]["confidence_percentage"] >= 0
        assert all_data["upcoming_signal"]["entry_time"].endswith(":00 IST")
