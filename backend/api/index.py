"""
Vercel Python entrypoint. Vercel's Python builder detects the `app`
variable in an /api/*.py file and serves it as an ASGI app — so this file
just re-exports the real FastAPI app from app/main.py. vercel.json rewrites
every /api/* request to this single function, letting FastAPI's own router
handle all the individual routes.
"""

from app.main import app  # noqa: F401  (re-exported for Vercel's Python runtime)
