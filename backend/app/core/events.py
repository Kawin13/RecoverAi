import asyncio
import collections
import json
from datetime import datetime, timezone
from typing import AsyncGenerator, Set, Dict, Any, Optional
from app.core.logging import logger
from app.models.workspaces import DEFAULT_WORKSPACE_ID

class EventBroadcaster:
    """
    Lightweight, robust Server-Sent Events (SSE) broadcaster with tenant workspace scoping.
    Ensures events emitted within Workspace A are never leaked to clients in Workspace B.
    """
    def __init__(self):
        # Maps workspace_id -> Set of asyncio.Queue listeners
        self._listeners: Dict[str, Set[asyncio.Queue]] = collections.defaultdict(set)

    @property
    def listener_count(self) -> int:
        return sum(len(queues) for queues in self._listeners.values())

    def workspace_listener_count(self, workspace_id: str) -> int:
        return len(self._listeners.get(str(workspace_id), set()))

    async def subscribe(self, workspace_id: str = DEFAULT_WORKSPACE_ID, max_events: Optional[int] = None) -> AsyncGenerator[str, None]:
        """
        Subscribes a client to the event bus scoped strictly to a specific workspace_id.
        Includes a 15-second heartbeat ping (: ping\n\n) to prevent HTTP connection timeouts.
        If max_events is specified, terminates cleanly after yielding the requested number of events.
        """
        ws_key = str(workspace_id)
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._listeners[ws_key].add(queue)
        logger.info(f"New SSE client connected to workspace '{ws_key}'. Active listeners in workspace: {len(self._listeners[ws_key])}")

        # Yield initial connection handshake
        now_utc = datetime.now(timezone.utc).isoformat()
        initial_event = {
            "type": "CONNECTION_ESTABLISHED",
            "data": {
                "status": "LIVE",
                "workspace_id": ws_key,
                "server_time": now_utc
            },
            "timestamp": now_utc
        }
        yield f"data: {json.dumps(initial_event)}\n\n"
        yielded_count = 1

        if max_events is not None and yielded_count >= max_events:
            if ws_key in self._listeners:
                self._listeners[ws_key].discard(queue)
                if not self._listeners[ws_key]:
                    self._listeners.pop(ws_key, None)
            return

        try:
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(message)}\n\n"
                    yielded_count += 1
                    if max_events is not None and yielded_count >= max_events:
                        break
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP streaming alive
                    yield ": ping\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            if ws_key in self._listeners:
                self._listeners[ws_key].discard(queue)
                if not self._listeners[ws_key]:
                    self._listeners.pop(ws_key, None)
            logger.info(f"SSE client disconnected from workspace '{ws_key}'.")

    def broadcast_sync(self, event_type: str, data: Dict[str, Any], workspace_id: Optional[str] = None):
        """
        Synchronous wrapper to broadcast an event scoped to a target workspace.
        Safe to call from sync FastAPI route handlers or background workers.
        """
        target_ws = workspace_id or data.get("workspace_id")
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(event_type, data, workspace_id=target_ws))
        except RuntimeError:
            asyncio.run(self.broadcast(event_type, data, workspace_id=target_ws))

    async def broadcast(self, event_type: str, data: Dict[str, Any], workspace_id: Optional[str] = None):
        """
        Broadcasts an event message non-blockingly to clients in the specified workspace.
        If workspace_id is provided, delivers ONLY to listeners in that workspace.
        """
        target_ws = str(workspace_id) if workspace_id is not None else (str(data.get("workspace_id")) if data.get("workspace_id") is not None else None)
        payload = {
            "type": event_type,
            "data": data,
            "workspace_id": target_ws,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Determine target queues
        if target_ws is not None:
            queues_to_notify = list(self._listeners.get(target_ws, set()))
        else:
            # Global broadcast fallback if no workspace is designated
            queues_to_notify = [q for queues in self._listeners.values() for q in queues]

        dead_queues = []
        for queue in queues_to_notify:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning("Listener queue is full. Dropping stale events.")
            except Exception:
                dead_queues.append(queue)

        for q in dead_queues:
            for ws_id, queues in list(self._listeners.items()):
                queues.discard(q)
                if not queues:
                    self._listeners.pop(ws_id, None)

        logger.debug(f"Broadcast event '{event_type}' to workspace '{target_ws}' ({len(queues_to_notify)} listeners).")

event_broadcaster = EventBroadcaster()
