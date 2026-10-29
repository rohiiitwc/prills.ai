import pytest
from datetime import datetime, timezone
from backend.app.parser import (
    parse_telegram_message,
    clean_asset_name,
    check_if_late
)

def test_clean_asset_name():
    assert clean_asset_name("EURUSD") == "EURUSD"
    assert clean_asset_name("AUDCAD-OTC") == "AUDCAD-OTC"
    assert clean_asset_name("USDINR_OTC") == "USDINR-OTC"
    assert clean_asset_name("GBP/USD OTC") == "GBPUSD-OTC"

def test_parse_live_signal():
    msg = """EURJPY
11:12
1 Minutes
CALL UP"""
    now = datetime.now(timezone.utc)
    res = parse_telegram_message(msg, published_at=now, received_at=now, channel_category="LIVE")
    assert res["type"] == "SIGNAL"
    data = res["data"]
    assert data["asset"] == "EURJPY"
    assert data["direction"] == "CALL"
    assert data["direction_display"] == "CALL UP"
    assert data["entry_time_announced"] == "11:12"
    assert data["expiry_duration"] == "1 Minutes"
    assert data["market_category"] == "LIVE"

def test_parse_otc_signal():
    msg = """AUDCAD-OTC
10:21:00
1 Minutes
CALL UP"""
    now = datetime.now(timezone.utc)
    res = parse_telegram_message(msg, published_at=now, received_at=now, channel_category="OTC")
    assert res["type"] == "SIGNAL"
    data = res["data"]
    assert data["asset"] == "AUDCAD-OTC"
    assert data["direction"] == "CALL"
    assert data["entry_time_announced"] == "10:21:00"
    assert data["market_category"] == "OTC"

def test_parse_put_signal():
    msg = """USDJPY
11:16
1 Minutes
PUT DOWN"""
    now = datetime.now(timezone.utc)
    res = parse_telegram_message(msg, published_at=now, received_at=now, channel_category="LIVE")
    assert res["type"] == "SIGNAL"
    data = res["data"]
    assert data["asset"] == "USDJPY"
    assert data["direction"] == "PUT"
    assert data["direction_display"] == "PUT DOWN"
    assert data["entry_time_announced"] == "11:16"

def test_parse_result_messages():
    now = datetime.now(timezone.utc)
    
    # Loss test
    res1 = parse_telegram_message("EURJPY Loss", published_at=now, received_at=now)
    assert res1["type"] == "RESULT"
    assert res1["data"]["asset"] == "EURJPY"
    assert res1["data"]["reported_result"] == "LOSS"

    # Profit test
    res2 = parse_telegram_message("USDJPY Profit", published_at=now, received_at=now)
    assert res2["type"] == "RESULT"
    assert res2["data"]["asset"] == "USDJPY"
    assert res2["data"]["reported_result"] == "WIN"

    # OTC Loss test
    res3 = parse_telegram_message("AUDCAD-OTC Loss", published_at=now, received_at=now)
    assert res3["type"] == "RESULT"
    assert res3["data"]["asset"] == "AUDCAD-OTC"
    assert res3["data"]["reported_result"] == "LOSS"

def test_parse_real_quotex_otc_signal():
    msg = """📊 AUDCAD-OTCq
⏰ 10:21:00 🔔 GET READY
⏳ 1 Minutes
🟢 CALL UP ⬆

🚧 Quotex 1M FREE 🚧"""
    now = datetime.now(timezone.utc)
    res = parse_telegram_message(msg, published_at=now, received_at=now, channel_category="OTC")
    assert res["type"] == "SIGNAL"
    data = res["data"]
    assert data["asset"] == "AUDCAD-OTC"
    assert data["direction"] == "CALL"
    assert data["direction_display"] == "CALL UP"
    assert data["entry_time_announced"] == "10:21:00"

def test_parse_real_quotex_results():
    now = datetime.now(timezone.utc)
    
    # Profit with checkmark
    res1 = parse_telegram_message("🗓 CADJPY-OTCq Profit ✅", published_at=now, received_at=now)
    assert res1["type"] == "RESULT"
    assert res1["data"]["asset"] == "CADJPY-OTC"
    assert res1["data"]["reported_result"] == "WIN"

    # Loss with checkbox ☑
    res2 = parse_telegram_message("🗓 AUDCAD-OTCq Loss ☑", published_at=now, received_at=now)
    assert res2["type"] == "RESULT"
    assert res2["data"]["asset"] == "AUDCAD-OTC"
    assert res2["data"]["reported_result"] == "LOSS"

    # Doji / Draw with scale emoji ⚖
    res3 = parse_telegram_message("🗓 AUDJPY-OTCq Doji ⚖", published_at=now, received_at=now)
    assert res3["type"] == "RESULT"
    assert res3["data"]["asset"] == "AUDJPY-OTC"
    assert res3["data"]["reported_result"] == "DRAW"

    # MTG Profit ✅1
    res4 = parse_telegram_message("🗓 USDMXN-OTCq Profit ✅1", published_at=now, received_at=now)
    assert res4["type"] == "RESULT"
    assert res4["data"]["asset"] == "USDMXN-OTC"
    assert res4["data"]["reported_result"] == "WIN"
    assert res4["data"]["mtg_step"] == 1

def test_unparseable_message_marked_for_review():
    msg = "Welcome to the VIP club! Check our new guide."
    now = datetime.now(timezone.utc)
    res = parse_telegram_message(msg, published_at=now, received_at=now)
    assert res["type"] == "NEEDS_REVIEW"

def test_convert_telegram_time_to_ist_standard():
    from backend.app.parser import convert_telegram_time_to_ist
    # Example 1 from requirement: 11:12 -> 19:42 IST
    conv, next_day = convert_telegram_time_to_ist("11:12")
    assert conv == "19:42 IST"
    assert next_day is False

    # With seconds: 09:54:00 -> 18:24:00 IST
    conv_sec, next_day_sec = convert_telegram_time_to_ist("09:54:00")
    assert conv_sec == "18:24:00 IST"
    assert next_day_sec is False

def test_convert_telegram_time_to_ist_next_day():
    from backend.app.parser import convert_telegram_time_to_ist
    # Rollover case: 20:15 -> 04:45 IST (next day flag true)
    conv, next_day = convert_telegram_time_to_ist("20:15")
    assert conv == "04:45 IST"
    assert next_day is True

def test_convert_telegram_time_double_conversion_guard():
    from backend.app.parser import convert_telegram_time_to_ist
    # Requirement: Do not apply the conversion twice to an already-converted timestamp
    already_converted = "19:42 IST"
    conv1, next1 = convert_telegram_time_to_ist(already_converted)
    assert conv1 == "19:42 IST"
    assert next1 is False

    already_next_day = "04:45 IST"
    conv2, next2 = convert_telegram_time_to_ist(already_next_day)
    assert conv2 == "04:45 IST"
    assert next2 is False

def test_signals_use_converted_ist_entry_time():
    now = datetime.now(timezone.utc)
    
    # Live market signal
    msg_live = """EURJPY
11:12
1 Minutes
CALL UP"""
    res_live = parse_telegram_message(msg_live, published_at=now, received_at=now, channel_category="LIVE")
    assert res_live["data"]["entry_time_announced"] == "11:12"
    assert res_live["data"]["entry_time_converted"] == "19:42 IST"
    assert res_live["data"]["direction"] == "CALL"
    assert res_live["data"]["asset"] == "EURJPY"

    # Quotex OTC market signal with next-day rollover
    msg_otc = """📊 CADJPY-OTCq
⏰ 20:15:00 🔔 GET READY
⏳ 1 Minutes
🔴 PUT DOWN ⬇"""
    res_otc = parse_telegram_message(msg_otc, published_at=now, received_at=now, channel_category="OTC")
    assert res_otc["data"]["entry_time_announced"] == "20:15:00"
    assert res_otc["data"]["entry_time_converted"] == "04:45:00 IST"
    assert res_otc["data"]["direction"] == "PUT"
    assert res_otc["data"]["asset"] == "CADJPY-OTC"

