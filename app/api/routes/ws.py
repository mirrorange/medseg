"""WebSocket endpoint for real-time task status updates."""

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.ws import ConnectionManager

logger = logging.getLogger(__name__)

router = APIRouter()

# Singleton — shared with scheduler for pushing updates
manager = ConnectionManager()


@router.websocket("/api/ws/tasks")
async def ws_tasks(ws: WebSocket, token: str = Query(...)):
    """WebSocket endpoint — authenticate via query token, then receive task updates."""
    # Authenticate
    payload = decode_access_token(token)
    if payload is None:
        await ws.close(code=4001, reason="Invalid or expired token")
        return

    import uuid

    user_id = uuid.UUID(payload["sub"])

    await manager.connect(user_id, ws)
    try:
        # Keep connection alive; client doesn't need to send messages
        while True:
            # Wait for any client message (ping/pong or close)
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, ws)
