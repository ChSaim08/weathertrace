
from pathlib import Path
from datetime import datetime, timezone
import json
import math

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
LOCATION_FILE = BASE_DIR / "location_history.json"

app = FastAPI(title="WeatherTrace", version="1.0.0")


class LocationPayload(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    altitude: float | None = None
    speed: float | None = Field(default=None, ge=0)
    heading: float | None = None
    timestamp: int | None = None


def read_locations():
    if not LOCATION_FILE.exists():
        return []
    try:
        return json.loads(LOCATION_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def write_locations(locations):
    temp_file = LOCATION_FILE.with_suffix(".tmp")
    temp_file.write_text(json.dumps(locations, indent=2), encoding="utf-8")
    temp_file.replace(LOCATION_FILE)


def validate_coordinate(value: float) -> float:
    if not math.isfinite(value):
        raise HTTPException(status_code=400, detail="Invalid coordinate")
    return value


@app.get("/")
def home():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/app.js")
def app_js():
    return FileResponse(FRONTEND_DIR / "app.js", media_type="application/javascript")


@app.get("/style.css")
def style_css():
    return FileResponse(FRONTEND_DIR / "style.css", media_type="text/css")


@app.post("/api/location")
def save_location(payload: LocationPayload):
    lat = validate_coordinate(payload.latitude)
    lon = validate_coordinate(payload.longitude)

    item = {
        "latitude": lat,
        "longitude": lon,
        "accuracy_m": payload.accuracy,
        "altitude_m": payload.altitude,
        "speed_mps": payload.speed,
        "heading": payload.heading,
        "device_timestamp_ms": payload.timestamp,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }

    locations = read_locations()
    locations.append(item)
    locations = locations[-500:]
    write_locations(locations)

    return {"ok": True, "message": "Location saved", "location": item}


@app.get("/api/location/latest")
def latest_location():
    locations = read_locations()
    return {"location": locations[-1] if locations else None}


@app.get("/api/weather")
def weather(latitude: float, longitude: float):
    lat = validate_coordinate(latitude)
    lon = validate_coordinate(longitude)

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "is_day",
            "precipitation",
            "rain",
            "weather_code",
            "cloud_cover",
            "wind_speed_10m",
            "wind_direction_10m",
        ]),
        "daily": ",".join([
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "apparent_temperature_max",
            "apparent_temperature_min",
            "sunrise",
            "sunset",
            "precipitation_sum",
            "rain_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max",
        ]),
        "past_days": 5,
        "forecast_days": 6,
        "timezone": "auto",
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
    }

    try:
        response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params=params,
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Weather service request failed: {exc}",
        ) from exc


@app.get("/api/health")
def health():
    return {"ok": True, "service": "WeatherTrace"}
