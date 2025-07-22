from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import fastf1
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict the allowed domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cache_dir = os.environ.get("F1_CACHE_DIR", "/tmp/f1_cache")
if not os.path.exists(cache_dir):
    os.makedirs(cache_dir)

fastf1.Cache.enable_cache(cache_dir)

@app.get("/")
def root():
    return {"message": "API is running!"}

@app.get("/healthcheck")
def healthcheck():
    return {"status": "ok"}

@app.get("/races/{year}")
def get_races(year: int):
    schedule = fastf1.get_event_schedule(year)
    races = schedule[['EventName', 'EventDate']].to_dict(orient='records')
    return {"year": year, "races": races}

@app.get("/drivers/{year}/{event}/{session_name}")
def get_drivers(year: int, event: str, session_name: str):
    try:
        session = fastf1.get_session(year, event, session_name)
        session.load()

        drivers_list = []
        for drv_code in session.drivers:
            drv_info = session.get_driver(drv_code)

            # Add tyre info
            laps = session.laps.pick_driver(drv_code)
            fastest_lap = laps.pick_fastest()
            tyre = None
            if fastest_lap is not None:
                tyre = getattr(fastest_lap, 'Compound', None) or getattr(fastest_lap, 'TyreCompound', None)

            drivers_list.append({
                "Abbreviation": drv_info['Abbreviation'],
                "FullName": drv_info['FullName'],
                "TyreCompound": tyre if tyre else "Unknown"
            })

        return {
            "year": year,
            "event": event,
            "session": session_name,
            "drivers": drivers_list
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/telemetry/{year}/{event}/{session_name}")
def get_telemetry(
    year: int,
    event: str,
    session_name: str,
    drivers: str = Query(..., description="Comma-separated driver codes"),
    analyses: str = Query(..., description="Comma-separated analysis types (RPM, Speed, Throttle, Brake, nGear)")
):
    try:
        session = fastf1.get_session(year, event, session_name)
        session.load()

        driver_list = drivers.split(",")
        analyses_list = analyses.split(",")

        data = {}

        for driver in driver_list:
            laps = session.laps.pick_driver(driver)
            fastest_lap = laps.pick_fastest()
            if fastest_lap is None:
                continue
            telemetry = fastest_lap.get_telemetry()
            telemetry_data = {}
            for analysis in analyses_list:
                if analysis in telemetry.columns:
                    telemetry_data[analysis] = telemetry[analysis].tolist()
            
            # Add tyre info
            tyre = getattr(fastest_lap, 'Compound', None) or getattr(fastest_lap, 'TyreCompound', None)
            telemetry_data['tire'] = tyre if tyre else "Unknown"

            data[driver] = telemetry_data

        return {"year": year, "event": event, "session": session_name, "data": data}
    except Exception as e:
        return {"error": str(e)}

@app.get("/laptimes/{year}/{event}/{session_name}")
def get_lap_times(
    year: int,
    event: str,
    session_name: str,
    drivers: str = Query(..., description="Comma-separated driver codes")
):
    try:
        session = fastf1.get_session(year, event, session_name)
        session.load()

        driver_list = drivers.split(",")
        data = {}

        for driver in driver_list:
            laps = session.laps.pick_driver(driver).sort_values(by='LapNumber')

            if laps.empty:
                data[driver] = {"error": "No laps found for this driver"}
                continue

            if 'LapTime' not in laps.columns:
                data[driver] = {"error": "LapTime column missing"}
                continue

            if not laps['LapTime'].empty:
                sample_lap_time = laps['LapTime'].iloc[0]
                if not hasattr(sample_lap_time, 'total_seconds'):
                    data[driver] = {"error": "LapTime column is not timedelta type"}
                    continue

            lap_times_sec = laps['LapTime'].dt.total_seconds().tolist()
            lap_times_min = [round(t / 60, 4) for t in lap_times_sec]

            # Collect tyre info per lap (in lap order)
            tyre_compounds = []
            for _, lap in laps.iterrows():
                tyre = getattr(lap, 'Compound', None) or getattr(lap, 'TyreCompound', None)
                tyre_compounds.append(tyre if tyre else "Unknown")

            data[driver] = {
                "lap_times_min": lap_times_min,
                "tyre_compounds": tyre_compounds
            }

        return {
            "year": year,
            "event": event,
            "session": session_name,
            "lap_times": data
        }

    except Exception as e:
        return {"error": f"Exception: {str(e)}"}
