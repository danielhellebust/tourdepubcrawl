from __future__ import annotations

import os


def _env(key: str, default: str) -> str:
    v = os.getenv(key)
    return v if v is not None and v.strip() else default


# MongoDB placeholders (not wired yet; store is still in-memory MockStore).
# Set these in your environment when you swap in a real Mongo persistence layer.
MONGODB_URI: str = _env("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB: str = _env("MONGODB_DB", "tdt")
MONGODB_USERS_COLLECTION: str = _env("MONGODB_USERS_COLLECTION", "users")
MONGODB_ROUTES_COLLECTION: str = _env("MONGODB_ROUTES_COLLECTION", "routes")
MONGODB_CHAT_COLLECTION: str = _env("MONGODB_CHAT_COLLECTION", "chat")
MONGODB_EVENTS_COLLECTION: str = _env("MONGODB_EVENTS_COLLECTION", "events")

