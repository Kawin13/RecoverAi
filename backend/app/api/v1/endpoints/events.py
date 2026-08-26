from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.core.events import event_broadcaster

router = APIRouter()

@router.get("/stream", summary="Real-Time Event Stream (Server-Sent Events)")
async def sse_event_stream():
    """
    Subscribes the client to the RecoverAI real-time event pipeline via SSE.
    Emits instant updates when payments, recovery cases, or audit entries change.
    """
    return StreamingResponse(
        event_broadcaster.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream"
        }
    )
