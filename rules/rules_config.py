"""
Static threshold-based rules for IOT components.
This file contains manually curated rules for the Rule Engine.
"""

RULES = {
    "PUMP": [
        {
            "rule": "PUMP_CRITICAL_TEMP",
            "feature": "temperature",
            "comparison": ">",
            "threshold": 95.0,
            "confidence_delta": 0.4
        },
        {
            "rule": "PUMP_HIGH_VIBRATION",
            "feature": "vibration",
            "comparison": ">",
            "threshold": 4.5,
            "confidence_delta": 0.3
        },
        {
            "rule": "PUMP_LOW_FLOW_CAVITATION",
            "feature": "flow_rate",
            "comparison": "<",
            "threshold": 10.0,
            "confidence_delta": 0.2
        }
    ],
    "CONVEYOR": [
        {
            "rule": "CONVEYOR_BELT_SLIP",
            "feature": "belt_speed",
            "comparison": "<",
            "threshold": 1.5,
            "confidence_delta": 0.3
        },
        {
            "rule": "CONVEYOR_MOTOR_OVERLOAD",
            "feature": "motor_current",
            "comparison": ">",
            "threshold": 50.0,
            "confidence_delta": 0.25
        },
        {
            "rule": "CONVEYOR_BEARING_HEAT",
            "feature": "bearing_temp",
            "comparison": ">",
            "threshold": 85.0,
            "confidence_delta": 0.2
        }
    ],
    "COMPRESSOR": [
        {
            "rule": "COMPRESSOR_OVERPRESSURE",
            "feature": "outlet_pressure",
            "comparison": ">",
            "threshold": 120.0,
            "confidence_delta": 0.5
        },
        {
            "rule": "COMPRESSOR_OVERHEAT",
            "feature": "discharge_temp",
            "comparison": ">",
            "threshold": 110.0,
            "confidence_delta": 0.3
        },
        {
            "rule": "COMPRESSOR_LOW_OIL_LEVEL",
            "feature": "oil_pressure",
            "comparison": "<",
            "threshold": 25.0,
            "confidence_delta": 0.4
        }
    ]
}
