import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from fastapi import WebSocket

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts a JSON message to all connected clients."""
        payload = json.dumps(message, cls=CustomJSONEncoder)
        async with self._lock:
            disconnected = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(payload)
                except Exception:
                    disconnected.append(connection)
            
            for conn in disconnected:
                if conn in self.active_connections:
                    self.active_connections.remove(conn)

    async def broadcast_signal(self, event_type: str, signal_dict: Dict[str, Any]):
        await self.broadcast({
            "event": event_type,
            "data": signal_dict,
            "timestamp": datetime.now().isoformat()
        })

    async def broadcast_status(self, status_dict: Dict[str, Any]):
        await self.broadcast({
            "event": "CONNECTION_STATUS",
            "data": status_dict,
            "timestamp": datetime.now().isoformat()
        })

ws_manager = WebSocketManager()
