"""
Backboard integration ("Best Use of Backboard" prize track) — persistent,
cross-session memory for each MedCheck user, so the app remembers a user's
medications, flagged interactions, and anything else they tell it (an
allergy, a preference) without the user having to repeat themselves on
every visit.

Backed by the official backboard-sdk (https://docs.backboard.io). One
Backboard "assistant" per MedCheck user — created lazily on first use and
cached in the `user_memory` Supabase table (see supabase_sql/schema.sql) so we
never create more than one assistant per user.

Every public function here is best-effort: a missing/invalid
BACKBOARD_API_KEY, a Backboard outage, or any other failure logs a warning
and degrades gracefully (empty memory list / silently-skipped save) instead
of raising — this feature should never be able to break saving a medication
or checking interactions, which is why main.py always calls `remember()`
via BackgroundTasks rather than awaiting it inline on the request path.
"""

import asyncio
import os
from typing import List, Optional

from app.supabase_client import get_supabase_client

_client = None
_client_checked = False


def _get_client():
    """
    Lazily builds (and caches) the Backboard SDK client. Returns None —
    never raises — if BACKBOARD_API_KEY isn't set or the SDK can't be
    constructed, so every caller can treat "no client" as "feature off."
    """
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True

    api_key = os.environ.get("BACKBOARD_API_KEY")
    if not api_key:
        print("Backboard: BACKBOARD_API_KEY not set — memory features disabled.")
        return None

    try:
        from backboard import BackboardClient  # backboard-sdk package

        _client = BackboardClient(api_key=api_key)
    except Exception as e:
        print(f"Backboard: failed to initialize client: {e}")
        _client = None
    return _client


async def _ensure_assistant_id(user_id: str) -> Optional[str]:
    """
    Looks up this user's Backboard assistant id in Supabase, creating one
    (via the Backboard API) and caching it on first use. Returns None on
    any failure so callers can no-op instead of crashing.
    """
    client = _get_client()
    if not client:
        return None

    try:
        # supabase-py is synchronous under the hood — run it on a worker
        # thread rather than blocking this async function (and, in turn,
        # the shared event loop every other request depends on) for
        # however long the Supabase round trip takes. Same fix and reason
        # as /api/check-interactions and /api/voice/transcribe in main.py.
        def _lookup():
            return (
                get_supabase_client()
                .table("user_memory")
                .select("backboard_assistant_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        existing = await asyncio.to_thread(_lookup)
        if existing.data:
            return existing.data[0]["backboard_assistant_id"]
    except Exception as e:
        print(f"Backboard: failed to look up existing assistant for {user_id}: {e}")
        # Fall through and try to create one anyway — worst case is a
        # duplicate assistant next time, not a crash now.

    try:
        created = await client.create_assistant(
            name=f"medcheck-{user_id}"[:255],
            system_prompt=(
                "You hold persistent memory for a single MedCheck user: their "
                "medications, any drug interactions flagged for them, and any "
                "preferences or health notes (like allergies) they've shared. "
                "You never give medical advice yourself."
            ),
        )
        assistant_id = created.assistant_id
    except Exception as e:
        print(f"Backboard: failed to create assistant for {user_id}: {e}")
        return None

    try:
        def _upsert():
            get_supabase_client().table("user_memory").upsert(
                {"user_id": user_id, "backboard_assistant_id": assistant_id}
            ).execute()

        await asyncio.to_thread(_upsert)
    except Exception as e:
        print(f"Backboard: failed to cache assistant id for {user_id}: {e}")
        # Not fatal — worst case we create a new assistant next time too.

    return assistant_id


async def remember(user_id: str, content: str, metadata: Optional[dict] = None) -> None:
    """Best-effort: store one fact/note for this user. Never raises."""
    if not user_id or not content:
        return

    client = _get_client()
    if not client:
        return

    assistant_id = await _ensure_assistant_id(user_id)
    if not assistant_id:
        return

    try:
        await client.add_memory(assistant_id, content=content, metadata=metadata or {})
    except Exception as e:
        print(f"Backboard: failed to save memory for {user_id}: {e}")


async def recall_memories(user_id: str, page: int = 1, page_size: int = 25) -> List[dict]:
    """Best-effort: fetch this user's remembered facts. Returns [] on any failure."""
    if not user_id:
        return []

    client = _get_client()
    if not client:
        return []

    try:
        def _lookup():
            return (
                get_supabase_client()
                .table("user_memory")
                .select("backboard_assistant_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

        existing = await asyncio.to_thread(_lookup)
        if not existing.data:
            return []  # nothing remembered yet — don't create an assistant just to read
        assistant_id = existing.data[0]["backboard_assistant_id"]
    except Exception as e:
        print(f"Backboard: failed to look up assistant for {user_id}: {e}")
        return []

    try:
        result = await client.get_memories(assistant_id, page=page, page_size=page_size)
        # Normalize a couple of plausible response shapes defensively rather
        # than assuming one exact attribute name from the SDK.
        if hasattr(result, "memories"):
            return [_serialize_memory(m) for m in result.memories]
        if isinstance(result, list):
            return [_serialize_memory(m) for m in result]
        return []
    except Exception as e:
        print(f"Backboard: failed to fetch memories for {user_id}: {e}")
        return []


def _serialize_memory(memory) -> dict:
    if isinstance(memory, dict):
        return memory
    return {
        "id": getattr(memory, "id", None) or getattr(memory, "memory_id", None),
        "content": getattr(memory, "content", None) or str(memory),
        "metadata": getattr(memory, "metadata", None),
    }
