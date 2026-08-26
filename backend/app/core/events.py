import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator, Set, Dict, Any, Optional
from app.core.logging import logger

class EventBroadcaster:
    """
    Lightweight, robust Server-Sent Events (SSE) broadcaster for real-time
    event distribution to connected web clients.
    """
    def __init__(self):
        self._listeners: Set[asyncio.Queue] = set()

    @property
    def listener_count(self) -> int:
        return len(self._listeners)

    async def subscribe(self) -> AsyncGenerator[str, None]:
        """
        Subscribes a client to the event bus and yields SSE formatted event frames.
        Includes a 15-second heartbeat ping (: ping\n\n) to prevent HTTP connection timeouts.
        """
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._listeners.add(queue)
        logger.info(f"New SSE client connected. Active listeners: {len(self._listeners)}")

        # Yield initial connection handshake
        initial_event = {
            "type": "CONNECTION_ESTABLISHED",
            "data": {"status": "LIVE", "server_time": datetime.utcnow().isoformat()},
            "timestamp": datetime.utcnow().isoformat()
        }
        yield f"data: {json.dumps(initial_event)}\n\n"

        try:
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(message)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP streaming alive
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self._listeners.discard(queue)
            logger.info(f"SSE client disconnected. Active listeners: {len(self._listeners)}")

    def broadcast_sync(self, event_type: str, data: Dict[str, Any]):
        """
        Synchronous wrapper to broadcast an event to all connected clients.
        Safe to call from sync FastAPI route handlers or background workers.
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(event_type, data))
        except RuntimeError:
            # Fallback if outside running loop (e.g. CLI or background thread)
            asyncio.run(self.broadcast(event_type, data))

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        """
        Broadcasts an event message non-blockingly to all active client queues.
        """
        payload = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }

        dead_queues = []
        for queue in list(self._listeners):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning("Listener queue is full. Dropping stale events.")
            except Exception:
                dead_queues.append(queue)

        for q in dead_queues:
            self._listeners.discard(q)

        logger.debug(f"Broadcast event '{event_type}' to {len(self._listeners)} listeners.")

event_broadcaster = EventBroadcaster()
