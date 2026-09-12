"""
Server-side Supabase client for our FastAPI endpoints.

IMPORTANT: this uses the SERVICE ROLE key, not the anon key.
The service role key bypasses Row Level Security, which is what lets these
endpoints read/write any user's rows when we haven't wired up full
JWT-based auth verification (fine for a hackathon; see README.md
"Security notes" before using this pattern in anything real).

Every endpoint that touches the DB must still filter by the `userId` it
receives in the request — the DB won't do that filtering for us anymore.
"""

from __future__ import annotations
import os
from supabase import create_client, Client

_cached_client: Client | None = None


def get_supabase_client() -> Client:
    global _cached_client
    if _cached_client is not None:
        return _cached_client

    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. "
            "Copy .env.example to .env, fill in your Supabase project values, and restart."
        )

    _cached_client = create_client(url, service_key)
    return _cached_client
