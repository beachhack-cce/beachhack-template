"""
Live simulation runner for demo UI.

This simulates:
- raw sensor data
- feature extraction
- trace engine evaluation

This is intentionally simple and deterministic for demo clarity.
"""

import random
from datetime import datetime

from trace_engine.rule_engine import RuleEngine


# ----------------------------
# 1. SIMULATE RAW SENSOR DATA
# ----------------------------

def simulate_raw_sensor_data():
    return {
        "vibration": random.uniform(2.0, 7.0),
        "temperature": random.uniform(50.0, 120.0),
        "load": random.uniform(30.0, 100.0)
    }


# ----------------------------
# 2. FEATURE EXTRACTION (DEMO)
# ----------------------------

def extract_features(raw_data):
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "component": "COMPRESSOR",  # fixed for demo
        "features": {
            "vibration_rms": round(raw_data["vibration"], 2),
            "vibration_trend": round(random.uniform(0.1, 2.0), 2),
            "vibration_delta": round(random.uniform(0.1, 3.0), 2),
            "temperature_c": round(raw_data["temperature"], 2),
            "temperature_delta": round(random.uniform(0.5, 10.0), 2),
            "load_avg": round(raw_data["load"], 2)
        }
    }


# ----------------------------
# 3. RUN TRACE ENGINE
# ----------------------------

def run_live_simulation():
    raw_data = simulate_raw_sensor_data()
    feature_event = extract_features(raw_data)

    engine = RuleEngine()
    trace, trace_path = engine.evaluate(feature_event)

    return {
        "raw_data": raw_data,
        "features": feature_event,
        "trace": trace,
        "trace_path": trace_path
    }
