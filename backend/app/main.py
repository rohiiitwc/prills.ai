import sys
from pathlib import Path

# Ensure project root is in sys.path so running from any directory works
_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import init_db
from backend.app.telegram_service import telegram_service
from backend.app.websocket_manager import ws_manager
from backend.app.routes import signals, telegram, channels, auth

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables and telegram service
    await init_db()
    await telegram_service.initialize()
    yield
    # Shutdown
    if telegram_service.client and telegram_service.client.is_connected():
        await telegram_service.client.disconnect()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Real-Time Telegram Binary Trading Signal Ingestion & Broadcasting Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(signals.router, prefix=settings.API_V1_STR)
app.include_router(telegram.router, prefix=settings.API_V1_STR)
app.include_router(channels.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "channels": [
            {"name": settings.SOURCE_1_NAME, "category": settings.SOURCE_1_CATEGORY, "link": settings.SOURCE_1_LINK},
            {"name": settings.SOURCE_2_NAME, "category": settings.SOURCE_2_CATEGORY, "link": settings.SOURCE_2_LINK}
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "telegram_status": telegram_service.get_status()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time WebSocket connection endpoint for client browsers."""
    await ws_manager.connect(websocket)
    # Send initial connection acknowledgment & telegram status
    try:
        await websocket.send_json({
            "event": "CONNECTED",
            "message": "Connected to real-time signal stream",
            "telegram_status": telegram_service.get_status(),
            "data": telegram_service.get_status()
        })
        while True:
            # Keep connection open and respond to ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception:
        await ws_manager.disconnect(websocket)
