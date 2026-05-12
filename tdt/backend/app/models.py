from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Pub(BaseModel):
    name: str
    lat: float
    lng: float


class QuizPostRequest(BaseModel):
    pub: str
    question: str
    answer: str

class RouteResponse(BaseModel):
    pubs: list[Pub]
    polyline: list[tuple[float, float]]  # (lat, lng)


class RouteSummary(BaseModel):
    id: str
    name: str
    pub_count: int


class RouteDetail(BaseModel):
    id: str
    name: str
    pubs: list[Pub]
    polyline: list[tuple[float, float]]  # (lat, lng)


class RouteCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    pubs: list[Pub] = Field(min_length=1)


class JoinRouteRequest(BaseModel):
    route_id: str = Field(min_length=1, max_length=128)


DrinkType = Literal["beer", "wine", "shot"]
MoodType = Literal["happy", "normal", "dizzy", "drunk"]


class DrinkEvent(BaseModel):
    type: DrinkType
    volume: float = Field(gt=0)
    location: str
    timestamp: datetime


class MoodEvent(BaseModel):
    value: MoodType
    location: str
    timestamp: datetime


class User(BaseModel):
    email: str
    nickname: str
    route_id: Optional[str] = None
    current_pub: str
    pils_pilot_credit: int = 100
    mood_credit: int = 14
    drinks: list[DrinkEvent] = Field(default_factory=list)
    moods: list[MoodEvent] = Field(default_factory=list)


class ChatMessage(BaseModel):
    nickname: str
    timestamp: datetime
    message: str


class StatsResponse(BaseModel):
    user_count: int
    total_liters: float
    beer_kom: str
    liters_per_bar: list[dict[str, object]]  # { bar: str, liters: float }


class ProfileResponse(BaseModel):
    email: str
    nickname: str
    route_id: Optional[str] = None
    route_name: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=64)


class ChatPostRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class DrinkPostRequest(BaseModel):
    type: DrinkType
    volume: float = Field(gt=0)


class MoodPostRequest(BaseModel):
    value: MoodType


class AiQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)


class AiQueryResponse(BaseModel):
    credit_left: int
    output_markdown: str

