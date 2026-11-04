#!/usr/bin/env python3
"""THROWAWAY SPIKE (allotment weather). Never merged to main.

Fetches an Open-Meteo forecast and Open-Meteo historical data for one public
point (Church Fenton Met Office station) and prints a plain-text summary.
Stores nothing. Standard library only.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

LAT, LON = 53.836, -1.197  # Church Fenton station; do not change
TZ = "Europe/London"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_HOURLY = [
    "temperature_2m", "cloud_cover", "wind_speed_10m",
    "soil_temperature_0cm", "soil_temperature_6cm",
    "soil_temperature_18cm", "soil_temperature_54cm",
]
ARCHIVE_HOURLY = ["soil_temperature_0_to_7cm", "soil_temperature_7_to_28cm"]
ARCHIVE_DAILY = ["temperature_2m_min", "temperature_2m_max"]

errors = []


def get(name, url, params):
    full = url + "?" + urllib.parse.urlencode(params)
    t0 = time.monotonic()
    try:
        req = urllib.request.Request(full, headers={"User-Agent": "krishnabuilds-weather-spike"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        print(f"[ok]   {name}: HTTP 200 in {time.monotonic() - t0:.2f}s")
        return data
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        hint = " (RATE LIMITED)" if e.code == 429 else ""
        errors.append(f"{name}: HTTP {e.code}{hint}: {body}")
    except Exception as e:  # network, timeout, bad JSON
        errors.append(f"{name}: {type(e).__name__}: {e}")
    print(f"[FAIL] {name}: {errors[-1]}")
    return None


def fmt(v, unit="°C"):
    return "n/a" if v is None else f"{v:.1f}{unit}"


def forecast_summary(now):
    data = get("forecast", FORECAST_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ,
        "hourly": ",".join(FORECAST_HOURLY), "forecast_days": 2,
    })
    if not data:
        return
    h = data["hourly"]
    # Tonight = 18:00 today to 09:00 tomorrow, local time.
    start = now.replace(hour=18, minute=0, second=0, microsecond=0).replace(tzinfo=None)
    end = start + timedelta(hours=15)
    idx = [i for i, t in enumerate(h["time"]) if start <= datetime.fromisoformat(t) <= end]
    rows = [i for i in idx if h["temperature_2m"][i] is not None]
    if not rows:
        errors.append("forecast: no temperatures for tonight's window")
        return
    i_min = min(rows, key=lambda i: h["temperature_2m"][i])
    low = h["temperature_2m"][i_min]
    cloud = h["cloud_cover"][i_min]
    wind = h["wind_speed_10m"][i_min]
    if low <= 0:
        flag = "HIGH (air frost: low <= 0°C)"
    elif low <= 3 and (cloud or 0) < 50 and (wind or 0) < 10:
        flag = "POSSIBLE (ground frost: low <= 3°C, clear-ish, light wind)"
    else:
        flag = "LOW"
    print("\n== Forecast (Open-Meteo) ==")
    print(f"Tonight's window   : {start:%a %d %b %H:%M} to {end:%a %H:%M} local")
    print(f"Tonight's low      : {fmt(low)} at {h['time'][i_min][11:16]}")
    print(f"  at that hour     : cloud {cloud}%, wind {wind} km/h")
    print(f"Frost risk         : {flag}")
    soil = ", ".join(f"{v.split('_')[-1]} {fmt(h[v][i_min])}" for v in FORECAST_HOURLY if v.startswith("soil"))
    print(f"Soil temp at low   : {soil}")
    missing = [v for v in FORECAST_HOURLY if all(x is None for x in h.get(v, [None]))]
    if missing:
        errors.append(f"forecast: variables with no data: {missing}")


def observed_summary(today):
    start = today - timedelta(days=14)
    data = get("historical", ARCHIVE_URL, {
        "latitude": LAT, "longitude": LON, "timezone": TZ,
        "start_date": start.isoformat(), "end_date": today.isoformat(),
        "daily": ",".join(ARCHIVE_DAILY), "hourly": ",".join(ARCHIVE_HOURLY),
    })
    if not data:
        return
    d, h = data["daily"], data["hourly"]
    days = [i for i, t in enumerate(d["time"]) if d["temperature_2m_min"][i] is not None]
    print("\n== Observed / reanalysis (Open-Meteo historical) ==")
    if not days:
        errors.append("historical: no daily minimums in the last 14 days")
        print("No days with data in the last 14 days")
        return
    last = days[-1]
    last_day = date.fromisoformat(d["time"][last])
    print(f"Latest day with data: {last_day} (low {fmt(d['temperature_2m_min'][last])}, "
          f"high {fmt(d['temperature_2m_max'][last])})")
    print(f"Lag                : {(today - last_day).days} days behind today ({today})")
    for v in ARCHIVE_HOURLY:
        vals = [(t, x) for t, x in zip(h["time"], h[v]) if x is not None]
        if vals:
            t, x = vals[-1]
            print(f"Soil {v[17:]:<13} : latest {fmt(x)} at {t}")
        else:
            print(f"Soil {v[17:]:<13} : NO DATA")
            errors.append(f"historical: no data for {v}")


def main():
    t0 = time.monotonic()
    now = datetime.now(ZoneInfo(TZ))
    print(f"Weather spike for {LAT}, {LON} (Church Fenton) at {now:%Y-%m-%d %H:%M %Z}\n")
    forecast_summary(now)
    observed_summary(now.date())
    print("\n== Run ==")
    print(f"Runtime            : {time.monotonic() - t0:.2f}s (2 API calls)")
    print(f"Errors             : {len(errors)}")
    for e in errors:
        print(f"  - {e}")
    print("RESULT: PASS" if not errors else "RESULT: FAIL")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
