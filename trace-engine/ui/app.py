import streamlit as st
import sys
import os

# -------------------------------------------------
# Make trace-engine importable
# -------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(PROJECT_ROOT)

from integration.run_live_simulation import run_live_simulation


# -------------------------------------------------
# Streamlit Page Config
# -------------------------------------------------
st.set_page_config(
    page_title="Industrial Trace Engine Demo",
    layout="wide"
)

st.title("Industrial Trace Engine — Live Simulation Demo")

st.markdown(
    """
    This demo runs an **end-to-end pipeline**:
    
    **Sensor Simulation → Feature Extraction → Decision Trace**
    
    Click the button below to generate data and inspect **how and why**
    decisions are made.
    """
)

# -------------------------------------------------
# Run Simulation Button
# -------------------------------------------------
if st.button("▶ Run Simulation"):
    st.info("Running simulation pipeline...")

    results = run_live_simulation()

    st.success("Simulation completed.")

    # -------------------------------------------------
    # Display Results
    # -------------------------------------------------
    for idx, result in enumerate(results, start=1):
        st.divider()
        st.subheader(f"Event {idx} — Component: {result['component']}")
        st.caption(f"Timestamp: {result['timestamp']}")

        st.markdown("### Extracted Features")
        st.json(result["features"])

        st.markdown("### Decision Trace")
        st.json(result["trace"])

        st.caption(f"Trace saved at: {result['trace_path']}")
