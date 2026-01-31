# Industrial IoT Predictive Maintenance System


An explainable **Industrial IoT Predictive Maintenance System** built entirely during **BeachHack**.  
The system focuses on **physics-based simulation**, **transparent feature extraction**, and **Explainable AI (XAI)** to generate trustworthy, auditable maintenance insights.

---

## 👤 My Contribution: Data Simulation & Feature Extraction

As **Member 1** of the team, I designed and implemented the **core data pipeline** that powers the system.  
This includes realistic sensor data simulation and pure signal-processing-based feature extraction to support explainable decision-making.

---

## 📊 Data Simulation Layer

Generates **physics-based sensor streams** that emulate real industrial asset degradation and failure behavior.

### Key Characteristics

- **Sensor Types**
  - Vibration (mm/s RMS)
  - Temperature (°C)
  - Load (%)

- **Failure Progression**
  - Normal → Degradation → Pre-failure → Failure Risk

- **Cross-Sensor Causality**
  - Vibration spikes precede temperature rise by **2–4 hours**
  - Load-dependent resonance effects

- **Industrial Realism**
  - Packet loss: **3%**
  - Timestamp jitter: **±8 seconds**
  - Non-stationary noise

- **Output Format**
  - CSV files with **ground-truth `failure_phase` labels**

### Sample CSV Output

```csv
timestamp,asset_id,vibration_rms,temperature_c,load_percent,failure_phase
2026-01-01 00:00:03,pump-001,3.05,44.8,75.2,0
2026-01-01 00:01:07,pump-001,3.12,45.1,76.1,0
```

---

## ⚙️ Feature Extraction Layer

Transforms raw sensor streams into **diagnostic-ready numerical features**.

⚠️ **No decision logic included — pure signal processing only**

### Extracted Features

| Feature | Meaning | Diagnostic Value |
|-------|--------|------------------|
| `vibration_rms` | Current shake intensity | Primary failure indicator |
| `vibration_trend` | Degradation rate (mm/s per min) | Predicts time-to-failure |
| `vibration_delta` | Change vs. 10 mins ago | Early warning signal |
| `temperature_c` | Current temperature | Secondary confirmation |
| `temperature_delta` | Thermal lag evidence | Proves vibration → heat causality |
| `load_avg` | Process demand context | Rules out load-induced false alarms |

### Output Format (JSON)

```json
{
  "timestamp": "2026-01-01T01:21:06Z",
  "component": "COMPRESSOR",
  "features": {
    "vibration_rms": 3.2,
    "vibration_trend": 0.007,
    "vibration_delta": 0.12,
    "temperature_c": 44.6,
    "temperature_delta": -0.4,
    "load_avg": 77.3
  }
}
```

---

## ✅ Why This Matters for Explainable AI (XAI)

- **Ground-truth labels (`failure_phase`)** enable verification of explanations
- **Physics-based causality** supports sensor-level reasoning
- **Clean feature separation** ensures decisions remain interpretable
- **Heterogeneous assets** (pump, conveyor, compressor) prove scalability

---

## 🚀 Full System Flow

```text
[Physics-Based Simulation]
          ↓ (CSV)
[Feature Extraction]
          ↓ (JSON)
[XAI Reasoning Engine]
          → Decision Trace
          → LLM Translator
          → Human-readable Work Orders
```

---

## 📌 Development Notes

- Built entirely during **BeachHack**
- No pre-existing code or datasets used
- Designed for industrial scalability and explainability

---

## 🔮 Future Work

- Online feature streaming with Kafka / MQTT
- Remaining Useful Life (RUL) estimation
- SHAP-based sensor attribution
- Integration with CMMS systems

---

*All components were built during BeachHack — no pre-existing code was used.*
