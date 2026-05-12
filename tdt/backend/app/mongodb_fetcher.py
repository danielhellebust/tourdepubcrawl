from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timezone
from uuid import uuid4

from pymongo import MongoClient
from pymongo.collection import ReturnDocument

from .default_route import DEFAULT_ROUTE_ID, default_route_detail
from .models import ChatMessage, DrinkEvent, MoodEvent, Pub, RouteCreateRequest, RouteDetail, RouteSummary, User

from dotenv import load_dotenv

load_dotenv()

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class MongoStore:
    """
    MongoDB-backed store that persists data using MONGODB_URI and MONGODB_DATABASE.
    Optimized to return structures matching the frontend API client.
    """

    def __init__(self) -> None:
        uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.environ.get("MONGODB_DATABASE", "tourdepubcrawl")

        self.client = MongoClient(uri)
        self.db = self.client[db_name]

        # Define collections
        self.users_coll = self.db["users"]
        self.routes_coll = self.db["routes"]
        self.chat_coll = self.db["chat"]
        self.quiz_coll = self.db["quiz"]

        # Ensure the default route exists on startup
        if not self.routes_coll.find_one({"id": DEFAULT_ROUTE_ID}):
            default_route = default_route_detail()
            self.routes_coll.insert_one(self._to_dict(default_route))

    # --- Helper Methods ---

    def _to_dict(self, model_obj) -> dict:
        """Helper to safely convert models to dicts (supports both Pydantic v1 and v2)."""
        if hasattr(model_obj, "model_dump"):
            return model_obj.model_dump()
        if hasattr(model_obj, "dict"):
            return model_obj.dict()
        return vars(model_obj)

    def _strip_id(self, doc: dict) -> dict:
        """Removes the MongoDB internal _id before passing to Pydantic models."""
        if doc and "_id" in doc:
            del doc["_id"]
        return doc

    def _default_user(self, email: str) -> User:
        nick = email.split("@")[0] if "@" in email else email
        return User(email=email, nickname=nick, route_id=None, current_pub="")

    # --- Core Methods ---

    def get_or_create_user(self, email: str) -> User:
        doc = self.users_coll.find_one({"email": email})
        if not doc:
            user = self._default_user(email)
            self.users_coll.insert_one(self._to_dict(user))
            return user
        return User(**self._strip_id(doc))

    def set_nickname(self, email: str, nickname: str) -> User:
        doc = self.users_coll.find_one_and_update(
            {"email": email},
            {"$set": {"nickname": nickname}},
            return_document=ReturnDocument.AFTER
        )
        if not doc:
            user = self._default_user(email)
            user.nickname = nickname
            self.users_coll.insert_one(self._to_dict(user))
            return user
        return User(**self._strip_id(doc))

    def get_state(self, email: str) -> dict:
        user = self.get_or_create_user(email)
        return {
            "current_pub": user.current_pub,
            "pils_pilot_credit": getattr(user, "pils_pilot_credit", 0),
            "mood_credit": getattr(user, "mood_credit", 0)
        }

    def list_routes(self) -> list[RouteSummary]:
        routes = []
        for doc in self.routes_coll.find().sort("name", 1):
            route_detail = RouteDetail(**self._strip_id(doc))
            routes.append(
                RouteSummary(
                    id=route_detail.id,
                    name=route_detail.name,
                    pub_count=len(route_detail.pubs)
                )
            )
        return routes

    def list_routes_detail(self) -> list[RouteDetail]:
        return [RouteDetail(**self._strip_id(doc)) for doc in self.routes_coll.find().sort("name", 1)]

    def create_route(self, body: RouteCreateRequest) -> RouteDetail:
        rid = uuid4().hex
        polyline = [(p.lat, p.lng) for p in body.pubs]
        route = RouteDetail(id=rid, name=body.name, pubs=body.pubs, polyline=polyline)

        self.routes_coll.insert_one(self._to_dict(route))
        return route

    def get_route(self, route_id: str) -> RouteDetail:
        doc = self.routes_coll.find_one({"id": route_id})
        if not doc:
            raise KeyError(route_id)
        return RouteDetail(**self._strip_id(doc))

    def get_user_route(self, email: str) -> RouteDetail | None:
        user = self.get_or_create_user(email)
        if not user.route_id:
            return None
        try:
            return self.get_route(user.route_id)
        except KeyError:
            self.users_coll.update_one(
                {"email": email},
                {"$set": {"route_id": None, "current_pub": ""}}
            )
            return None

    def join_route(self, email: str, route_id: str) -> dict:
        route = self.get_route(route_id)
        current_pub = route.pubs[0].name if route.pubs else ""

        self.get_or_create_user(email)
        self.users_coll.find_one_and_update(
            {"email": email},
            {"$set": {"route_id": route.id, "current_pub": current_pub}},
            return_document=ReturnDocument.AFTER
        )
        return {
            "ok": True,
            "route_id": route.id,
            "route_name": route.name,
            "current_pub": current_pub
        }

    def reset_route(self, email: str) -> dict:
        user = self.get_or_create_user(email)
        route = self.get_user_route(email)
        if not route:
            return {"current_pub": user.current_pub}

        current_pub = route.pubs[0].name if route.pubs else ""
        self.users_coll.find_one_and_update(
            {"email": email},
            {"$set": {"current_pub": current_pub}},
            return_document=ReturnDocument.AFTER
        )
        return {"current_pub": current_pub}

    def advance_to_next_pub(self, email: str) -> dict:
        user = self.get_or_create_user(email)
        route = self.get_user_route(email)
        if not route:
            return {"current_pub": user.current_pub}

        names = [p.name for p in route.pubs]
        try:
            idx = names.index(user.current_pub)
        except ValueError:
            idx = 0

        if idx < len(names) - 1:
            next_pub = names[idx + 1]
            self.users_coll.find_one_and_update(
                {"email": email},
                {"$set": {"current_pub": next_pub}},
                return_document=ReturnDocument.AFTER
            )
            return {"current_pub": next_pub}
        return {"current_pub": user.current_pub}

    def post_chat(self, email: str, message: str) -> ChatMessage:
        user = self.get_or_create_user(email)
        msg = ChatMessage(nickname=user.nickname, timestamp=utcnow(), message=message)
        self.chat_coll.insert_one(self._to_dict(msg))
        return msg

    def get_chat(self, limit: int = 50) -> dict:
        docs = list(self.chat_coll.find().sort("timestamp", -1).limit(limit))
        messages = [ChatMessage(**self._strip_id(doc)) for doc in reversed(docs)]
        return {"messages": messages}

    def add_drink(self, email: str, drink_type: str, volume: float) -> dict:
        user = self.get_or_create_user(email)
        drink = DrinkEvent(type=drink_type, volume=volume, location=user.current_pub, timestamp=utcnow())

        self.users_coll.find_one_and_update(
            {"email": email},
            {"$push": {"drinks": self._to_dict(drink)}},
            return_document=ReturnDocument.AFTER
        )
        return {"status": "ok"}

    def set_mood(self, email: str, mood_value: str) -> dict:
        user = self.get_or_create_user(email)
        mood = MoodEvent(value=mood_value, location=user.current_pub, timestamp=utcnow())

        self.users_coll.find_one_and_update(
            {"email": email},
            {"$push": {"moods": self._to_dict(mood)}},
            return_document=ReturnDocument.AFTER
        )
        return {"status": "ok"}

    def get_stats(self, email: str) -> dict:
        """Consolidates liters, user count, beer KOM, quiz stats, and active user locations for the current route."""
        user = self.get_or_create_user(email)
        route_id = user.route_id

        # Return zeroes if user hasn't joined a route
        if not route_id:
            return {
                "user_count": 0,
                "beer_kom": "Anonym",
                "total_liters": 0.0,
                "liters_per_bar": [],
                "quiz_stats": [],
                "users": []
            }

        # 1. Base list of bars strictly on this route
        route = self.get_route(route_id)
        totals: dict[str, float] = {p.name: 0.0 for p in route.pubs}

        # 2. Match only users who are participating in this specific route
        match_route = {"$match": {"route_id": route_id}}

        # Aggregate liters per bar for this route
        liters_pipeline = [
            match_route,
            {"$unwind": "$drinks"},
            {"$group": {
                "_id": "$drinks.location",
                "total_volume": {"$sum": "$drinks.volume"}
            }}
        ]
        for result in self.users_coll.aggregate(liters_pipeline):
            if result["_id"] in totals:
                totals[result["_id"]] += float(result["total_volume"])

        total_liters = sum(totals.values())
        liters_per_bar = [{"bar": k, "liters": round(v, 2)} for k, v in totals.items()]

        # 3. Find the Beer KOM (top drinker) on this route
        kom_pipeline = [
            match_route,
            {"$unwind": "$drinks"},
            {"$group": {
                "_id": "$email",
                "total": {"$sum": "$drinks.volume"},
                "nickname": {"$first": "$nickname"}
            }},
            {"$sort": {"total": -1}},
            {"$limit": 1}
        ]
        k_result = list(self.users_coll.aggregate(kom_pipeline))
        beer_kom = k_result[0]["nickname"] if k_result else "Anonym"

        # 4. Fetch list of all users active on this route for the map markers
        active_users_cursor = self.users_coll.find({"route_id": route_id})
        user_list = []
        for u in active_users_cursor:
            user_list.append({
                "nickname": u.get("nickname", "Anonym"),
                "current_pub": u.get("current_pub"),
                "picture_url": u.get("picture_url")  # Ensure your Auth0 sync saves this to the DB
            })

        # --- Quiz Aggregation ---
        quiz_pipeline = [
            {"$match": {"pub": {"$in": [p.name for p in route.pubs]}}},
            {"$group": {
                "_id": {"pub": "$pub", "question": "$question", "answer": "$answer"},
                "count": {"$sum": 1}
            }},
            {"$group": {
                "_id": {"pub": "$_id.pub", "question": "$_id.question"},
                "answers": {"$push": {"answer": "$_id.answer", "count": "$count"}}
            }},
            {"$project": {
                "_id": 0,
                "pub": "$_id.pub",
                "question": "$_id.question",
                "answers": 1
            }}
        ]

        quiz_stats = list(self.quiz_coll.aggregate(quiz_pipeline))
        for q in quiz_stats:
            q["answers"] = sorted(q["answers"], key=lambda x: x["count"], reverse=True)

        return {
            "user_count": len(user_list),
            "beer_kom": beer_kom,
            "total_liters": round(total_liters, 2),
            "liters_per_bar": liters_per_bar,
            "quiz_stats": quiz_stats,
            "users": user_list  # New key for frontend map rendering
        }

    def pils_pilot(self, email: str, query: str) -> dict:
        self.get_or_create_user(email)

        doc = self.users_coll.find_one_and_update(
            {"email": email, "pils_pilot_credit": {"$gt": 0}},
            {"$inc": {"pils_pilot_credit": -1}},
            return_document=ReturnDocument.AFTER
        )

        if not doc:
            return {
                "credit_left": 0,
                "output_markdown": "Beklager du har ingen flere credits."
            }

        output = (
            f"### PilsPilot (mock)\n\n"
            f"Du spurte: **{query}**\n\n"
            f"- Prøv en klassisk pils på neste stopp.\n"
            f"- Husk vann mellom slagene.\n"
            f"- Skål og god tur videre!\n"
        )
        return {"credit_left": doc["pils_pilot_credit"], "output_markdown": output}

    def mood_report(self, email: str) -> dict:
        self.get_or_create_user(email)

        doc = self.users_coll.find_one_and_update(
            {"email": email, "mood_credit": {"$gt": 0}},
            {"$inc": {"mood_credit": -1}},
            return_document=ReturnDocument.AFTER
        )

        if not doc:
            return {
                "credit_left": 0,
                "output_markdown": "Beklager du har ingen flere credits."
            }

        output = (
            "### Stemningsrapport (mock)\n\n"
            "Stemninga er solid: folk smiler, praten flyter, og ruta ligger foran dere.\n\n"
            "- Tips: ta et lite matstopp hvis energien synker.\n"
            "- Hold sammen, og pass på hverandre.\n"
        )
        return {"credit_left": doc["mood_credit"], "output_markdown": output}

    def post_quiz_answer(self, email: str, pub: str, question: str, answer: str) -> dict:
        doc = {
            "email": email,
            "pub": pub,
            "question": question,
            "answer": answer.strip(),
            "timestamp": utcnow()
        }
        self.quiz_coll.insert_one(doc)
        return {"status": "ok"}