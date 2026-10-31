# Official Quotex WebSocket Live Telemetry Sync Service
# Connects to wss://ws2.quotex.com with authenticated session token (SSID)
# and streams authentic 1:1 prices and candle completions directly from Quotex.

import asyncio
import json
import logging
from typing import Dict, Any, Optional
import websockets

logger = logging.getLogger(__name__)

# Global memory cache for live Quotex quotes and candles
LATEST_QUOTEX_TICKS: Dict[str, Dict[str, Any]] = {}
LATEST_QUOTEX_CANDLES: Dict[str, list] = {}
QUOTEX_CONNECTION_STATE = {
    "status": "DISCONNECTED",
    "ssid_configured": False,
    "last_tick_time": None,
    "subscribed_assets_count": 0,
    "error_message": None
}

ACTIVE_WS_TASK: Optional[asyncio.Task] = None
CURRENT_SSID: Optional[str] = None

# Asset mapping from platform symbol to Quotex internal symbol
SYMBOL_TO_QUOTEX = {
    "USDINR-OTC": "USDINR_otc",
    "USDPKR-OTC": "USDPKR_otc",
    "USDBRL-OTC": "USDBRL_otc",
    "USDZAR-OTC": "USDZAR_otc",
    "NZDCHF-OTC": "NZDCHF_otc",
    "USDMXN-OTC": "USDMXN_otc",
    "USDBDT-OTC": "USDBDT_otc",
    "USDEGP-OTC": "USDEGP_otc",
    "USDTRY-OTC": "USDTRY_otc",
    "USDARS-OTC": "USDARS_otc",
    "USDCOP-OTC": "USDCOP_otc",
    "USDIDR-OTC": "USDIDR_otc",
    "USDPHP-OTC": "USDPHP_otc",
    "USDDZD-OTC": "USDDZD_otc",
    "USDNGN-OTC": "USDNGN_otc",
    "USDJPY": "USDJPY",
    "EURJPY": "EURJPY",
    "AUDJPY": "AUDJPY",
    "EURUSD": "EURUSD",
    "GBPUSD": "GBPUSD",
    "GBPJPY": "GBPJPY",
    "AUDUSD": "AUDUSD",
    "EURGBP": "EURGBP",
    "USDCHF": "USDCHF",
    "USDCAD": "USDCAD",
    "NZDUSD": "NZDUSD",
    "AUDCAD": "AUDCAD",
    "EURCAD": "EURCAD"
}

QUOTEX_TO_SYMBOL = {v: k for k, v in SYMBOL_TO_QUOTEX.items()}

async def quotex_ws_worker(ssid: str):
    global QUOTEX_CONNECTION_STATE
    url = "wss://ws2.quotex.com/socket.io/?EIO=3&transport=websocket"
    headers = {
        "Origin": "https://quotex.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    QUOTEX_CONNECTION_STATE["status"] = "CONNECTING"
    QUOTEX_CONNECTION_STATE["ssid_configured"] = True
    QUOTEX_CONNECTION_STATE["error_message"] = None

    while True:
        try:
            async with websockets.connect(url, additional_headers=headers, open_timeout=10) as ws:
                # 1. Receive Engine.IO handshake (0{"sid":...})
                handshake = await ws.recv()
                # 2. Send Engine.IO connect ack (40)
                await ws.send("40")
                await ws.recv()

                # 3. Send authorization frame
                auth_payload = "42" + json.dumps(["authorization", {"session": ssid, "isDemo": 1, "tournamentId": 0}])
                await ws.send(auth_payload)

                QUOTEX_CONNECTION_STATE["status"] = "AUTHENTICATING"

                # 4. Listen for auth confirmation & subscribe to instruments
                while True:
                    msg = await ws.recv()
                    if isinstance(msg, bytes):
                        continue

                    # Engine.IO ping/pong
                    if msg == "2":
                        await ws.send("3")
                        continue

                    if msg.startswith("42"):
                        try:
                            data = json.loads(msg[2:])
                            event_name = data[0] if isinstance(data, list) and len(data) > 0 else None
                            payload = data[1] if isinstance(data, list) and len(data) > 1 else None

                            if event_name == "authorization/success" or event_name == "profile/current":
                                QUOTEX_CONNECTION_STATE["status"] = "CONNECTED"
                                QUOTEX_CONNECTION_STATE["error_message"] = None

                                # Subscribe to key pairs
                                sub_count = 0
                                for q_sym in SYMBOL_TO_QUOTEX.values():
                                    sub_msg = "42" + json.dumps(["subscribe_candles", {"asset": q_sym, "timeframe": 60}])
                                    await ws.send(sub_msg)
                                    sub_count += 1
                                QUOTEX_CONNECTION_STATE["subscribed_assets_count"] = sub_count

                            elif event_name == "authorization/reject":
                                QUOTEX_CONNECTION_STATE["status"] = "AUTH_FAILED"
                                QUOTEX_CONNECTION_STATE["error_message"] = "Quotex rejected the session token (SSID). Please copy a fresh ssid cookie from Chrome DevTools."
                                return

                            elif event_name in ["candle", "candles", "depth/follow", "tick", "quotes"]:
                                # Process incoming live price tick or candle update
                                if isinstance(payload, dict):
                                    q_asset = payload.get("asset") or payload.get("symbol")
                                    our_sym = QUOTEX_TO_SYMBOL.get(q_asset, q_asset)
                                    close_price = payload.get("close") or payload.get("price") or payload.get("rate")
                                    if our_sym and close_price is not None:
                                        LATEST_QUOTEX_TICKS[our_sym] = {
                                            "price": float(close_price),
                                            "time": payload.get("time") or payload.get("timestamp")
                                        }
                                        QUOTEX_CONNECTION_STATE["last_tick_time"] = asyncio.get_event_loop().time()
                        except Exception as parse_err:
                            pass
        except asyncio.CancelledError:
            QUOTEX_CONNECTION_STATE["status"] = "DISCONNECTED"
            break
        except Exception as conn_err:
            QUOTEX_CONNECTION_STATE["status"] = "RECONNECTING"
            QUOTEX_CONNECTION_STATE["error_message"] = str(conn_err)
            await asyncio.sleep(5)

def start_quotex_sync(ssid: str):
    global ACTIVE_WS_TASK, CURRENT_SSID
    CURRENT_SSID = ssid.strip()
    if ACTIVE_WS_TASK and not ACTIVE_WS_TASK.done():
        ACTIVE_WS_TASK.cancel()
    
    loop = asyncio.get_event_loop()
    ACTIVE_WS_TASK = loop.create_task(quotex_ws_worker(CURRENT_SSID))
    return {"success": True, "message": "Quotex live stream worker launched."}

def get_quotex_sync_status() -> Dict[str, Any]:
    return {
        "status": QUOTEX_CONNECTION_STATE["status"],
        "ssid_configured": QUOTEX_CONNECTION_STATE["ssid_configured"],
        "subscribed_assets_count": QUOTEX_CONNECTION_STATE["subscribed_assets_count"],
        "cached_ticks_count": len(LATEST_QUOTEX_TICKS),
        "error_message": QUOTEX_CONNECTION_STATE["error_message"]
    }

def get_live_tick_for_asset(asset: str) -> Optional[float]:
    clean = asset.strip().upper().replace("/", "").replace(" ", "")
    if clean in LATEST_QUOTEX_TICKS:
        return LATEST_QUOTEX_TICKS[clean]["price"]
    if f"{clean}-OTC" in LATEST_QUOTEX_TICKS:
        return LATEST_QUOTEX_TICKS[f"{clean}-OTC"]["price"]
    return None
