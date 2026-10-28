import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
import pytz
from backend.app.config import settings

# Recognized currency pairs and assets (Forex, OTC, Commodities, Crypto)
CURRENCY_REGEX = re.compile(
    r"\b([A-Za-z]{3}/?[A-Za-z]{3}(?:[-_ ]?OTC[Qq]?)?|[A-Za-z]{6}(?:[-_ ]?OTC[Qq]?)?|[A-Za-z0-9]{3,10}(?:[-_ ]?OTC[Qq]?)?)\b"
)

# Direction indicators
CALL_PATTERNS = [
    re.compile(r"\bCALL\s*UP\b", re.IGNORECASE),
    re.compile(r"\bCALL\b", re.IGNORECASE),
    re.compile(r"\bUP\b", re.IGNORECASE),
    re.compile(r"\bBUY\b", re.IGNORECASE),
    re.compile(r"\bHIGHER\b", re.IGNORECASE),
    re.compile(r"🟢|🟩|⬆️|⬆|🔼"),
]

PUT_PATTERNS = [
    re.compile(r"\bPUT\s*DOWN\b", re.IGNORECASE),
    re.compile(r"\bPUT\b", re.IGNORECASE),
    re.compile(r"\bDOWN\b", re.IGNORECASE),
    re.compile(r"\bSELL\b", re.IGNORECASE),
    re.compile(r"\bLOWER\b", re.IGNORECASE),
    re.compile(r"🔴|🟥|⬇️|⬇|🔽"),
]

# Time extraction (e.g. 11:12, 10:21:00, 09:54:00, with optional clock emoji)
TIME_REGEX = re.compile(r"(?:⏰\s*)?([0-2]?[0-9]:[0-5][0-9](?::[0-5][0-9])?)\b")

# Expiry duration (e.g. 1 Minutes, 1 Min, 1M, M1, 5 Minutes)
EXPIRY_REGEX = re.compile(
    r"\b([0-9]+\s*(?:Minutes?|Min|M|Seconds?|Sec)|M[0-9]+)\b",
    re.IGNORECASE
)

# Result patterns (DO NOT include 🟢/🔴 because those indicate CALL/PUT direction!)
RESULT_WIN_PATTERNS = [
    re.compile(r"\b(PROFIT|WIN|ITM|WON|SUCCESS|PLUS)\b", re.IGNORECASE),
    re.compile(r"✅|💰|💸"),
]

RESULT_LOSS_PATTERNS = [
    re.compile(r"\b(LOSS|LOSE|OTM|LOST|MINUS)\b", re.IGNORECASE),
    re.compile(r"❌|🛑|☑"),
]

RESULT_DRAW_PATTERNS = [
    re.compile(r"\b(DRAW|TIE|REFUND|ATM|DOJI|EQUAL)\b", re.IGNORECASE),
    re.compile(r"🔁|⚪|⚖️|⚖"),
]


def clean_asset_name(raw_asset: str) -> str:
    """
    Standardizes asset string:
    - Strips leading emojis (📊, 🗓, etc.)
    - Removes slashes and spaces
    - Normalizes OTC suffix (AUDCAD-OTCq -> AUDCAD-OTC)
    """
    # Remove leading non-alphanumeric chars
    asset = re.sub(r"^[^\w]+", "", raw_asset.strip()).upper().replace("/", "").replace(" ", "")
    
    # Strip trailing Quotex OTC 'Q' suffix (e.g. CADJPY-OTCQ -> CADJPY-OTC)
    if "OTCQ" in asset:
        asset = asset.replace("OTCQ", "OTC")
    elif asset.endswith("Q") and len(asset) > 6 and "OTC" not in asset:
        asset = asset[:-1]
        
    if "OTC" in asset:
        base = asset.replace("-OTC", "").replace("_OTC", "").replace("OTC", "")
        return f"{base}-OTC"
    return asset


def parse_telegram_message(
    raw_text: str,
    published_at: datetime,
    received_at: Optional[datetime] = None,
    channel_category: str = "LIVE"
) -> Dict[str, Any]:
    """
    Parses a Telegram message:
    1. If message contains direction or signal syntax -> parse as SIGNAL
    2. Else if contains result syntax -> parse as RESULT
    3. Else flag as NEEDS_REVIEW
    """
    if received_at is None:
        received_at = datetime.now(timezone.utc)
    
    text = raw_text.strip()
    if not text:
        return {
            "type": "UNKNOWN",
            "reason": "Empty message content"
        }
    
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # 1. Check if this is a SIGNAL message FIRST (signals contain CALL/PUT direction)
    is_direction_present = any(p.search(text) for p in CALL_PATTERNS + PUT_PATTERNS)
    if is_direction_present:
        signal_data = parse_signal_message(text, lines, published_at, received_at, channel_category)
        if signal_data:
            return {
                "type": "SIGNAL",
                "data": signal_data,
                "raw_text": text
            }

    # 2. Check if this is a RESULT message
    result_data = parse_result_message(text, lines)
    if result_data:
        return {
            "type": "RESULT",
            "data": result_data,
            "raw_text": text
        }

    # Could not parse with high confidence -> mark for review
    return {
        "type": "NEEDS_REVIEW",
        "reason": "Message format does not match recognized signal or result syntax",
        "raw_text": text
    }


def parse_result_message(text: str, lines: list) -> Optional[Dict[str, Any]]:
    """
    Extracts asset and outcome from result messages like:
    🗓 CADJPY-OTCq Profit ✅
    🗓 AUDCAD-OTCq Loss ☑
    🗓 AUDJPY-OTCq Doji ⚖
    EURJPY Loss
    USDJPY Profit
    """
    # Detect outcome
    outcome = None
    for p in RESULT_WIN_PATTERNS:
        if p.search(text):
            outcome = "WIN"
            break
            
    if not outcome:
        for p in RESULT_LOSS_PATTERNS:
            if p.search(text):
                outcome = "LOSS"
                break
                
    if not outcome:
        for p in RESULT_DRAW_PATTERNS:
            if p.search(text):
                outcome = "DRAW"
                break

    if not outcome:
        return None

    # Detect asset
    asset = None
    for line in lines:
        match = CURRENCY_REGEX.search(line)
        if match:
            candidate = match.group(1)
            # Avoid common keywords
            if candidate.upper() not in ["PROFIT", "LOSS", "WIN", "DOJI", "DRAW"]:
                asset = clean_asset_name(candidate)
                break
            
    if not asset:
        words = text.split()
        for word in words:
            cleaned = word.strip(":,.-_!#?🗓📊")
            match = CURRENCY_REGEX.match(cleaned)
            if match and match.group(1).upper() not in ["PROFIT", "LOSS", "WIN", "DOJI", "DRAW"]:
                asset = clean_asset_name(match.group(1))
                break

    if not asset:
        return None

    # Martingale step indicators (e.g. Profit ✅1 or 1 MTG)
    mtg_step = 0
    if re.search(r"✅\s*1|\b1\s*(?:ST|STEP|MTG|MARTINGALE)", text, re.IGNORECASE):
        mtg_step = 1
    elif re.search(r"✅\s*2|\b2\s*(?:ND|STEP|MTG|MARTINGALE)", text, re.IGNORECASE):
        mtg_step = 2

    return {
        "asset": asset,
        "reported_result": outcome,
        "mtg_step": mtg_step,
        "raw_result_text": text
    }


def parse_signal_message(
    text: str,
    lines: list,
    published_at: datetime,
    received_at: datetime,
    channel_category: str
) -> Optional[Dict[str, Any]]:
    """
    Extracts signal parameters:
    Asset, Entry Time (Given & Converted), Expiry, Direction.
    """
    # 1. Direction extraction
    direction = None
    direction_display = None

    if any(p.search(text) for p in CALL_PATTERNS):
        direction = "CALL"
        direction_display = "CALL UP"
    elif any(p.search(text) for p in PUT_PATTERNS):
        direction = "PUT"
        direction_display = "PUT DOWN"

    if not direction:
        return None

    # 2. Asset extraction
    asset = None
    for line in lines:
        if direction_display and (direction_display in line.upper() or "CALL" in line.upper() or "PUT" in line.upper()):
            continue
        match = CURRENCY_REGEX.search(line)
        if match:
            candidate = match.group(1)
            if candidate.upper() not in ["MINUTE", "MINUTES", "QUOTEX", "FREE", "READY", "PROFIT", "REPORT"]:
                asset = clean_asset_name(candidate)
                break

    if not asset:
        return None

    # 3. Entry time extraction (Given Announced Time)
    entry_time = None
    for line in lines:
        match = TIME_REGEX.search(line)
        if match:
            entry_time = match.group(1)
            break

    if not entry_time:
        return None

    # 4. Expiry extraction
    expiry = "1 Minutes"
    for line in lines:
        match = EXPIRY_REGEX.search(line)
        if match:
            expiry_raw = match.group(1).strip()
            if expiry_raw.upper() in ["M1", "1M"]:
                expiry = "1 Minutes"
            elif expiry_raw.upper() in ["M5", "5M"]:
                expiry = "5 Minutes"
            else:
                expiry = expiry_raw
            break

    # Market category
    market_category = "OTC" if ("-OTC" in asset or channel_category.upper() == "OTC") else "LIVE"

    # 5. Compute Converted Entry Time (IST = Telegram time + 8h 30m) & Late Status
    converted_entry_time, is_late, late_by_seconds = compute_entry_and_latency(
        entry_time_str=entry_time,
        published_at_utc=published_at,
        received_at_utc=received_at,
        source_category=market_category
    )

    return {
        "asset": asset,
        "direction": direction,
        "direction_display": direction_display,
        "entry_time_announced": entry_time,
        "entry_time_converted": converted_entry_time,
        "expiry_duration": expiry,
        "market_category": market_category,
        "is_late": is_late,
        "late_by_seconds": late_by_seconds,
        "raw_signal_text": text
    }


def convert_telegram_time_to_ist(
    entry_time_str: str,
    base_date: Optional[datetime] = None,
    source_category: Optional[str] = None
) -> Tuple[str, bool]:
    """
    MANDATORY TIME ZONE CONVERSION:
    IST = Telegram trade time + 8 hours + 30 minutes.

    Requirements:
    1. Automatically adds 8 hours and 30 minutes (configurable via settings).
    2. Applies to both Telegram sources (QUOTEX OFFICIAL VIP BOT and Quotex Vip Bot Signal).
    3. Handles date rollover into the next day cleanly:
       - Same day: '19:42 IST'
       - Following day: '04:45 IST on the following day'
    4. Guard against double-conversion: if 'IST' is already present, does not convert again.
    5. Preserves seconds if present in source (e.g. '09:54:00' -> '18:24:00 IST').
    6. Preserves original Telegram message and publication timestamp for auditing.
    """
    if not entry_time_str:
        return "", False

    clean_str = str(entry_time_str).strip()

    # Requirement 7: Guard against applying conversion twice to an already-converted timestamp
    if "IST" in clean_str.upper():
        is_next = "FOLLOWING DAY" in clean_str.upper() or "NEXT DAY" in clean_str.upper()
        return clean_str, is_next

    # Requirement 8: Keep conversion rule configurable in settings
    if source_category and source_category.upper() == "LIVE":
        offset_hours = getattr(settings, "SOURCE_1_OFFSET_HOURS", settings.ENTRY_TIME_OFFSET_HOURS)
        offset_minutes = getattr(settings, "SOURCE_1_OFFSET_MINUTES", settings.ENTRY_TIME_OFFSET_MINUTES)
    elif source_category and source_category.upper() == "OTC":
        offset_hours = getattr(settings, "SOURCE_2_OFFSET_HOURS", settings.ENTRY_TIME_OFFSET_HOURS)
        offset_minutes = getattr(settings, "SOURCE_2_OFFSET_MINUTES", settings.ENTRY_TIME_OFFSET_MINUTES)
    else:
        offset_hours = settings.ENTRY_TIME_OFFSET_HOURS
        offset_minutes = settings.ENTRY_TIME_OFFSET_MINUTES

    try:
        parts = [int(p) for p in clean_str.split(":")]
        hour = parts[0]
        minute = parts[1]
        second = parts[2] if len(parts) > 2 else 0

        # Base date for anchoring (from publication timestamp or current date)
        if base_date:
            ref_dt = base_date
        else:
            ref_dt = datetime.now(timezone.utc)

        original_dt = datetime(
            year=ref_dt.year,
            month=ref_dt.month,
            day=ref_dt.day,
            hour=hour,
            minute=minute,
            second=second
        )

        # Requirement 1: Add 8 hours and 30 minutes
        offset = timedelta(hours=offset_hours, minutes=offset_minutes)
        converted_dt = original_dt + offset

        # Requirement 5: Handle date changes correctly (update displayed date if moves into next day)
        is_next_day = converted_dt.date() > original_dt.date()

        # Format time
        time_part = converted_dt.strftime("%H:%M:%S" if len(parts) > 2 else "%H:%M")

        converted_entry = f"{time_part} IST"

        return converted_entry, is_next_day
    except Exception:
        return f"{clean_str} IST", False


def compute_entry_and_latency(
    entry_time_str: str,
    published_at_utc: datetime,
    received_at_utc: datetime,
    source_category: Optional[str] = None
) -> Tuple[str, bool, int]:
    """
    1. Converts announced trade entry time to IST:
       IST = Telegram trade time + 8 hours + 30 minutes.
    2. Determines if the signal was published after the announced entry time (Late Signal).
    """
    converted_entry, _ = convert_telegram_time_to_ist(
        entry_time_str=entry_time_str,
        base_date=published_at_utc,
        source_category=source_category
    )

    # Normalize both datetimes to UTC to prevent offset-naive/aware subtraction errors
    if published_at_utc is not None and published_at_utc.tzinfo is None:
        published_at_utc = published_at_utc.replace(tzinfo=timezone.utc)
    if received_at_utc is not None and received_at_utc.tzinfo is None:
        received_at_utc = received_at_utc.replace(tzinfo=timezone.utc)

    is_late = False
    late_by = 0

    try:
        parts = [int(p) for p in entry_time_str.strip().split(":")]
        hour, minute = parts[0], parts[1]
        second = parts[2] if len(parts) > 2 else 0

        ref_pub = published_at_utc or datetime.now(timezone.utc)
        # Announced Telegram time + 3 hours = trade entry time in UTC (since IST = TG + 8h30m and IST = UTC + 5h30m)
        trade_entry_utc = datetime(
            ref_pub.year, ref_pub.month, ref_pub.day,
            hour, minute, second,
            tzinfo=timezone.utc
        ) + timedelta(hours=3)

        # Handle potential day rollover
        if (ref_pub - trade_entry_utc).total_seconds() > 43200:
            trade_entry_utc += timedelta(days=1)
        elif (trade_entry_utc - ref_pub).total_seconds() > 43200:
            trade_entry_utc -= timedelta(days=1)

        # A signal is late only if Telegram published it more than 15s after announced trade entry time
        # (15s grace tolerance accounts for network broadcast propagation & candle entry window)
        delay_seconds = int((ref_pub - trade_entry_utc).total_seconds())
        if delay_seconds > 15:
            is_late = True
            late_by = delay_seconds
    except Exception:
        pass

    return converted_entry, is_late, late_by


def check_if_late(entry_time_str: str, received_at_utc: datetime) -> Tuple[bool, int]:
    """Compatibility helper for unit tests."""
    _, is_late, late_by = compute_entry_and_latency(entry_time_str, received_at_utc, received_at_utc)
    return is_late, late_by
