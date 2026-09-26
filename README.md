
# WeatherTrace

A permission-based location weather app built as a learning project.

## What it does

1. The visitor clicks **Use My Location**.
2. The browser asks for location permission.
3. The browser returns latitude, longitude, accuracy, and other available position data.
4. JavaScript sends the location to the Python FastAPI backend.
5. The backend stores the latest location points in `location_history.json`.
6. The backend requests weather for those coordinates from Open-Meteo.
7. The frontend shows current conditions, the previous 5 days, today, and the next 5 days.

## Setup on macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
python3 -m uvicorn backend.main:app --reload
```

Open:

http://127.0.0.1:8000

For a public deployment, use HTTPS. Browser geolocation requires a secure context.

## Important privacy behavior

Location is requested only after the visitor clicks the button and the browser grants permission.

The demo stores up to the latest 500 location points. A production system should add authentication, access controls, clear retention rules, and user controls before storing precise location history.

## Architecture

```text
Browser
  |
  | permission-based Geolocation API
  v
latitude + longitude
  |
  | POST /api/location
  v
FastAPI
  |
  +--> location_history.json
  |
  +--> Open-Meteo
          |
          +--> previous 5 days
          +--> today
          +--> next 5 days
```
