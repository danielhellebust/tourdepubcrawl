"""Classic Tour de Trondheimsveien — pubs and map polyline as a single route definition."""

from __future__ import annotations

from .models import Pub, RouteDetail

DEFAULT_ROUTE_ID = "default"
DEFAULT_ROUTE_NAME = "Tour de Trondheimsveien"

# Stops in crawl order (name + WGS84).
DEFAULT_PUBS: list[Pub] = [
    Pub(name="Rendevous Kro", lat=59.93498989098532, lng=10.780328058613252),
    Pub(name="Li Li's", lat=59.93118724388547, lng=10.77861276691262),
    Pub(name="Wings Bar", lat=59.92977387943943, lng=10.780331137142344),
    Pub(name="Pizzeria Valentino", lat=59.92942066428848, lng=10.77829610612493),
    Pub(name="Bella Notte", lat=59.92646493278491, lng=10.775931126366864),
    Pub(name="Szechuan Chengdu", lat=59.92318950272041, lng=10.771788011608823),
    Pub(name="Perla", lat=59.92268279074624, lng=10.769334381118076),
    Pub(name="Pane & Vino", lat=59.92102450083967, lng=10.770355137948018),
    Pub(name="Ocean Cafe & Bar", lat=59.920022667376934, lng=10.76613985851109),
    Pub(name="Konoji", lat=59.91978391264513, lng=10.765486111688837),
    Pub(name="Gråbein Bar", lat=59.91866942341721, lng=10.765035500608464),
    Pub(name="Ludus Cafe & sportsbar", lat=59.91907006470726, lng=10.763638853258064),
    Pub(name="Hersleb Grill og Bar AS", lat=59.918762197736235, lng=10.762615589294827),
    Pub(name="Schouskjelleren Mikrobryggeri", lat=59.918279544998, lng=10.760290672930624),
]

# Lightweight polyline along the street (not only pub vertices) for a nicer map line.
DEFAULT_POLYLINE: list[tuple[float, float]] = [
    (59.9351816485413, 10.780315299805943),
    (59.934600, 10.780100),
    (59.933200, 10.779700),
    (59.93118724388547, 10.77861276691262),
    (59.92977387943943, 10.780331137142344),
    (59.92646493278491, 10.775931126366864),
    (59.92318950272041, 10.771788011608823),
    (59.92268279074624, 10.769334381118076),
    (59.92102450083967, 10.770355137948018),
    (59.920022667376934, 10.76613985851109),
    (59.91978391264513, 10.765486111688837),
    (59.91866942341721, 10.765035500608464),
    (59.91907006470726, 10.763638853258064),
    (59.918279544998, 10.760290672930624),
]


def default_route_detail() -> RouteDetail:
    return RouteDetail(
        id=DEFAULT_ROUTE_ID,
        name=DEFAULT_ROUTE_NAME,
        pubs=list(DEFAULT_PUBS),
        polyline=list(DEFAULT_POLYLINE),
    )
