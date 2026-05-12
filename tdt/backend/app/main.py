from __future__ import annotations

import os
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .mongodb_fetcher import MongoStore
from .mock_store import MockStore
from .models import (
    AiQueryRequest,
    AiQueryResponse,
    ChatPostRequest,
    JoinRouteRequest,
    ProfileResponse,
    ProfileUpdateRequest,
    RouteCreateRequest,
    RouteDetail,
    RouteResponse,
    RouteSummary,
    StatsResponse,
    DrinkPostRequest,
    MoodPostRequest,
)

store = MongoStore()


# Explicitly define the Quiz model for FastAPI validation
class QuizPostRequest(BaseModel):
    pub: str
    question: str
    answer: str


def get_user_email(x_user_email: Optional[str] = Header(default=None)) -> str:
    # For mock/local dev we accept a header; frontend will set it from localStorage.
    if not x_user_email:
        raise HTTPException(status_code=401, detail="Missing X-User-Email header")
    return x_user_email


app = FastAPI(title="TDT BFF", version="0.1.0")

allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,https://tourdepubcrawl-46150979625.europe-west1.run.app",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/route", response_model=RouteResponse)
def get_route(email: str = Depends(get_user_email)) -> RouteResponse:
    r = store.get_user_route(email)
    if not r:
        raise HTTPException(status_code=409, detail="User must join a route")
    return RouteResponse(pubs=r.pubs, polyline=r.polyline)


@app.get("/api/routes", response_model=list[RouteSummary])
def list_routes() -> list[RouteSummary]:
    return store.list_routes()


@app.get("/api/routes/detail", response_model=list[RouteDetail])
def list_routes_detail() -> list[RouteDetail]:
    return store.list_routes_detail()


@app.post("/api/routes", response_model=RouteDetail)
def create_route(body: RouteCreateRequest) -> RouteDetail:
    return store.create_route(body)


@app.post("/api/routes/join")
def join_route(body: JoinRouteRequest, email: str = Depends(get_user_email)) -> dict[str, object]:
    try:
        return store.join_route(email, body.route_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Route not found")


@app.get("/api/me", response_model=ProfileResponse)
def get_profile(email: str = Depends(get_user_email)) -> ProfileResponse:
    u = store.get_or_create_user(email)
    route_name = None
    if u.route_id:
        try:
            route_name = store.get_route(u.route_id).name
        except KeyError:
            route_name = None
    return ProfileResponse(email=u.email, nickname=u.nickname, route_id=u.route_id, route_name=route_name)


@app.put("/api/me", response_model=ProfileResponse)
def update_profile(body: ProfileUpdateRequest, email: str = Depends(get_user_email)) -> ProfileResponse:
    u = store.set_nickname(email, body.nickname)
    route_name = None
    if u.route_id:
        try:
            route_name = store.get_route(u.route_id).name
        except KeyError:
            route_name = None
    return ProfileResponse(email=u.email, nickname=u.nickname, route_id=u.route_id, route_name=route_name)


@app.get("/api/state")
def get_state(email: str = Depends(get_user_email)) -> dict[str, object]:
    u = store.get_or_create_user(email)
    if not u.route_id:
        raise HTTPException(status_code=409, detail="User must join a route")

    return {
        "current_pub": u.current_pub,
        "pils_pilot_credit": getattr(u, "pils_pilot_credit", 0),
        "mood_credit": getattr(u, "mood_credit", 0),
    }


@app.post("/api/state/next")
def next_pub(email: str = Depends(get_user_email)) -> dict[str, str]:
    res = store.advance_to_next_pub(email)
    return res


@app.post("/api/state/reset")
def reset(email: str = Depends(get_user_email)) -> dict[str, str]:
    res = store.reset_route(email)
    return res


@app.get("/api/stats")
def stats(email: str = Depends(get_user_email)) -> dict:
    return store.get_stats(email)

@app.get("/api/chat")
def chat() -> dict[str, object]:
    return store.get_chat(limit=100)


@app.post("/api/chat")
def post_chat(body: ChatPostRequest, email: str = Depends(get_user_email)) -> dict[str, object]:
    msg = store.post_chat(email, body.message)
    return {"ok": True,
            "message": {"nickname": msg.nickname, "timestamp": msg.timestamp.isoformat(), "message": msg.message}}


@app.post("/api/events/drink")
def post_drink(body: DrinkPostRequest, email: str = Depends(get_user_email)) -> dict[str, object]:
    store.add_drink(email, body.type, body.volume)
    u = store.get_or_create_user(email)
    return {"ok": True, "current_pub": u.current_pub}


@app.post("/api/events/mood")
def post_mood(body: MoodPostRequest, email: str = Depends(get_user_email)) -> dict[str, object]:
    store.set_mood(email, body.value)
    u = store.get_or_create_user(email)
    return {"ok": True, "current_pub": u.current_pub}


@app.post("/api/events/quiz")
def post_quiz(body: QuizPostRequest, email: str = Depends(get_user_email)) -> dict[str, object]:
    store.post_quiz_answer(email, body.pub, body.question, body.answer)
    return {"ok": True}


@app.post("/api/ai/pils-pilot", response_model=AiQueryResponse)
def ai_pils_pilot(body: AiQueryRequest, email: str = Depends(get_user_email)) -> AiQueryResponse:
    res = store.pils_pilot(email, body.query)
    return AiQueryResponse(**res)


@app.post("/api/ai/mood-report", response_model=AiQueryResponse)
def ai_mood_report(email: str = Depends(get_user_email)) -> AiQueryResponse:
    res = store.mood_report(email)
    return AiQueryResponse(**res)