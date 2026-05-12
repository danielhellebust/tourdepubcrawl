from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from .default_route import DEFAULT_ROUTE_ID, default_route_detail
from .models import ChatMessage, DrinkEvent, MoodEvent, Pub, RouteCreateRequest, RouteDetail, RouteSummary, User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MockStore:
    """
    In-memory mock store that mimics the MongoDB-backed behaviors used by the Dash app.
    This is intentionally simple so we can swap in a real persistence layer later.
    """

    def __init__(self) -> None:
        self._lock = RLock()

        self.routes: dict[str, RouteDetail] = {DEFAULT_ROUTE_ID: default_route_detail()}

        self.users: dict[str, User] = {}
        self.chat: list[ChatMessage] = [
            ChatMessage(nickname="Ola", timestamp=utcnow(), message="Hei! Hvor er dere nå?"),
            ChatMessage(nickname="Kari", timestamp=utcnow(), message="Vi er på Bar #4, kom hit!"),
            ChatMessage(nickname="Per", timestamp=utcnow(), message="🍻🍻🍻"),
        ]

    def _default_user(self, email: str) -> User:
        nick = email.split("@")[0] if "@" in email else email
        # User must explicitly join a route after "login".
        return User(email=email, nickname=nick, route_id=None, current_pub="")

    def get_or_create_user(self, email: str) -> User:
        with self._lock:
            if email not in self.users:
                self.users[email] = self._default_user(email)
            return self.users[email]

    def set_nickname(self, email: str, nickname: str) -> User:
        with self._lock:
            user = self.get_or_create_user(email)
            user.nickname = nickname
            return user

    def list_routes(self) -> list[RouteSummary]:
        with self._lock:
            routes = [
                RouteSummary(id=r.id, name=r.name, pub_count=len(r.pubs))
                for r in self.routes.values()
            ]
            routes.sort(key=lambda x: x.name.lower())
            return routes

    def list_routes_detail(self) -> list[RouteDetail]:
        with self._lock:
            routes = list(self.routes.values())
            routes.sort(key=lambda r: r.name.lower())
            return routes

    def create_route(self, body: RouteCreateRequest) -> RouteDetail:
        with self._lock:
            rid = uuid4().hex
            polyline = [(p.lat, p.lng) for p in body.pubs]
            route = RouteDetail(id=rid, name=body.name, pubs=body.pubs, polyline=polyline)
            self.routes[rid] = route
            return route

    def get_route(self, route_id: str) -> RouteDetail:
        with self._lock:
            if route_id not in self.routes:
                raise KeyError(route_id)
            return self.routes[route_id]

    def join_route(self, email: str, route_id: str) -> User:
        with self._lock:
            user = self.get_or_create_user(email)
            route = self.get_route(route_id)
            user.route_id = route.id
            user.current_pub = route.pubs[0].name if route.pubs else ""
            return user

    def get_user_route(self, email: str) -> RouteDetail | None:
        with self._lock:
            user = self.get_or_create_user(email)
            if not user.route_id:
                return None
            try:
                return self.get_route(user.route_id)
            except KeyError:
                user.route_id = None
                user.current_pub = ""
                return None

    def reset_route(self, email: str) -> User:
        with self._lock:
            user = self.get_or_create_user(email)
            route = self.get_user_route(email)
            if not route:
                return user
            user.current_pub = route.pubs[0].name if route.pubs else ""
            return user

    def advance_to_next_pub(self, email: str) -> User:
        with self._lock:
            user = self.get_or_create_user(email)
            route = self.get_user_route(email)
            if not route:
                return user
            names = [p.name for p in route.pubs]
            try:
                idx = names.index(user.current_pub)
            except ValueError:
                idx = 0
            if idx < len(names) - 1:
                user.current_pub = names[idx + 1]
            return user

    def post_chat(self, email: str, message: str) -> ChatMessage:
        with self._lock:
            user = self.get_or_create_user(email)
            msg = ChatMessage(nickname=user.nickname, timestamp=utcnow(), message=message)
            self.chat.append(msg)
            return msg

    def get_chat(self, limit: int = 50) -> list[ChatMessage]:
        with self._lock:
            return list(reversed(self.chat[-limit:]))

    def add_drink(self, email: str, drink_type: str, volume: float) -> User:
        with self._lock:
            user = self.get_or_create_user(email)
            user.drinks.append(
                DrinkEvent(type=drink_type, volume=volume, location=user.current_pub, timestamp=utcnow())
            )
            return user

    def set_mood(self, email: str, mood_value: str) -> User:
        with self._lock:
            user = self.get_or_create_user(email)
            user.moods.append(MoodEvent(value=mood_value, location=user.current_pub, timestamp=utcnow()))
            return user

    def liters_per_bar(self) -> dict[str, float]:
        with self._lock:
            totals: dict[str, float] = defaultdict(float)
            for user in self.users.values():
                for d in user.drinks:
                    totals[d.location] += float(d.volume)
            # Ensure all bars from all routes are present
            for r in self.routes.values():
                for p in r.pubs:
                    totals.setdefault(p.name, 0.0)
            return dict(totals)

    def total_liters(self) -> float:
        per_bar = self.liters_per_bar()
        return float(sum(per_bar.values()))

    def user_count(self) -> int:
        with self._lock:
            return len(self.users)

    def beer_kom(self) -> str:
        with self._lock:
            if not self.users:
                return "Anonym"
            liters_by_user: list[tuple[str, float]] = []
            for u in self.users.values():
                liters_by_user.append((u.email, sum(float(d.volume) for d in u.drinks)))
            liters_by_user.sort(key=lambda x: x[1], reverse=True)
            winner_email, _ = liters_by_user[0]
            return self.users[winner_email].nickname

    def pils_pilot(self, email: str, query: str) -> tuple[int, str]:
        with self._lock:
            user = self.get_or_create_user(email)
            if user.pils_pilot_credit <= 0:
                return 0, "Beklager du har ingen flere credits."
            user.pils_pilot_credit -= 1
            output = (
                f"### PilsPilot (mock)\n\n"
                f"Du spurte: **{query}**\n\n"
                f"- Prøv en klassisk pils på neste stopp.\n"
                f"- Husk vann mellom slagene.\n"
                f"- Skål og god tur videre!\n"
            )
            return user.pils_pilot_credit, output

    def mood_report(self, email: str) -> tuple[int, str]:
        with self._lock:
            user = self.get_or_create_user(email)
            if user.mood_credit <= 0:
                return 0, "Beklager du har ingen flere credits."
            user.mood_credit -= 1
            output = (
                "### Stemningsrapport (mock)\n\n"
                "Stemninga er solid: folk smiler, praten flyter, og ruta ligger foran dere.\n\n"
                "- Tips: ta et lite matstopp hvis energien synker.\n"
                "- Hold sammen, og pass på hverandre.\n"
            )
            return user.mood_credit, output

