"""WebSocket connection manager — maintains per-user connection sets."""

import logging
import uuid
from typing import Any

from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per user (supports multi-device)."""

    def __init__(self) -> None:
        # {user_id: set[WebSocket]}
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}

    async def connect(self, user_id: uuid.UUID, ws: WebSocket) -> None:
        await ws.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(ws)
        logger.info(
            "WS connected: user=%s (total=%d)",
            user_id,
            len(self._connections[user_id]),
        )

    def disconnect(self, user_id: uuid.UUID, ws: WebSocket) -> None:
        conns = self._connections.get(user_id)
        if conns:
            conns.discard(ws)
            if not conns:
                del self._connections[user_id]
        logger.info("WS disconnected: user=%s", user_id)

    async def send_to_user(self, user_id: uuid.UUID, message: dict[str, Any]) -> None:
        """Send a JSON message to all connections of a user."""
        conns = self._connections.get(user_id)
        if not conns:
            return
        stale = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            conns.discard(ws)
        if not conns:
            self._connections.pop(user_id, None)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send a JSON message to all connected users."""
        for user_id in list(self._connections):
            await self.send_to_user(user_id, message)

    @property
    def active_connections(self) -> int:
        return sum(len(s) for s in self._connections.values())
