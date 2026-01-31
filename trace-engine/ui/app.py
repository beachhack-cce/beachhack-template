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
# Streamlit Page Config & Theme
# -------------------------------------------------
st.set_page_config(
    page_title="Industrial Trace Engine Desktop Dashboard",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS to strictly match the reference image
st.markdown("""
<style>
    /* 1. Global Reset & Dark Theme */
    .stApp {
        background-color: #0d1117;
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #c9d1d9;
    }
    
    /* 2. Controls & Widgets */
    .stButton > button {
        background-color: #1f6feb;
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        padding: 0.5rem 1rem;
    }
    .stButton > button:hover {
        background-color: #388bfd;
    }
    .stButton > button:disabled {
        background-color: #161b22;
        color: #484f58;
        border: 1px solid #30363d;
    }
    
    /* 3. Status Banner (Red Strip) */
    .status-banner {
        width: 100%;
        padding: 1rem 2rem;
        margin-top: 1rem;
        margin-bottom: 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
        font-weight: bold;
        border-radius: 4px;
    }
    .banner-danger { background-color: #da3633; box-shadow: 0 4px 12px rgba(218, 54, 51, 0.2); }
    .banner-normal { background-color: #238636; box-shadow: 0 4px 12px rgba(35, 134, 54, 0.2); }
    .banner-borderline { background-color: #d29922; color: #1a1a1a; }

    /* 4. Panels (Cards) */
    .panel-container {
        background-color: #0d1117; /* Matches bg, distinct by layout */
        border: 1px solid #30363d; /* Subtle border */
        border-radius: 6px;
        padding: 0;
        overflow: hidden;
        height: 100%;
        box-shadow: 0 0 0 1px #30363d;
    }
    .panel-header {
        background-color: #161b22;
        padding: 1rem;
        border-bottom: 1px solid #30363d;
        font-weight: 600;
        color: #8b949e;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
    }
    .panel-icon { margin-right: 8px; }
    
    /* 4a. Left Panel: Features */
    .feature-list {
        padding: 1rem;
    }
    .feature-item {
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #21262d;
        font-size: 0.95rem;
    }
    .feature-key { color: #58a6ff; font-weight: 500; }
    .feature-val { color: #f0f6fc; font-weight: 700; font-family: monospace; }
    
    /* 4b. Right Panel: Trace Steps */
    .trace-container {
        padding: 1.5rem;
    }
    .trace-step {
        background-color: #0d1117;
        border: 1px solid #21262d;
        border-radius: 6px;
        padding: 1.25rem;
        margin-bottom: 1rem;
        position: relative;
    }
    .trace-step-header {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    }
    .step-circle {
        background-color: #1f6feb;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        font-weight: bold;
        margin-right: 12px;
    }
    .node-name {
        color: #8b949e;
        font-weight: 700;
        font-size: 0.85rem;
        text-transform: uppercase;
    }
    .logic-box {
        background-color: #0d1117;
        padding: 8px 0;
        font-family: monospace;
        font-size: 1.1rem;
        color: #e6edf3;
    }
    .val-highlight { color: #ff7b72; font-weight: bold; } /* Red for values */
    .result-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
        margin-right: 8px;
    }
    .res-fired { background-color: #3b2323; color: #ff7b72; border: 1px solid #ff7b72; }
    .res-pass { background-color: #1a2e23; color: #3fb950; border: 1px solid #3fb950; }
    
    /* 5. Custom Tabs (Buttons) */
    .tab-row {
        display: flex;
        gap: 10px;
        margin-bottom: 1rem;
    }
    
    /* Footer */
    .footer-bar {
        margin-top: 3rem;
        border-top: 1px solid #30363d;
        padding-top: 1rem;
        display: flex;
        justify-content: space-between;
        color: #484f58;
        font-size: 0.75rem;
        font-family: sans-serif;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)


# -------------------------------------------------
# State Management
# -------------------------------------------------
if "simulation_results" not in st.session_state:
    st.session_state.simulation_results = []
    
if "active_event_idx" not in st.session_state:
    st.session_state.active_event_idx = 0


# -------------------------------------------------
# UI Components
# -------------------------------------------------
def render_header():
    c1, c2 = st.columns([3, 1])
    with c1:
        st.markdown("## 📊 Industrial Trace Engine Desktop Dashboard")
    with c2:
        # 2. TOP BAR - Run Button (Always enabled)
        if st.button("▶ Run Simulation", use_container_width=True):
            with st.spinner("Loading..."):
                st.session_state.simulation_results = run_live_simulation()
            st.session_state.active_event_idx = 0 # Reset to first event
            st.rerun()

def render_status_banner(trace, component):
    decision = trace.get("decision", "UNKNOWN")
    conf = trace.get("final_confidence", 0.0)
    
    css_class = "banner-normal"
    if decision == "DANGER": css_class = "banner-danger"
    elif decision == "BORDERLINE": css_class = "banner-borderline"
    
    # 3. STATUS BANNER
    st.markdown(f"""
    <div class="status-banner {css_class}">
        <div style="font-size: 1.25rem; display: flex; align-items: center;">
            <span style="font-size: 1.5rem; margin-right: 12px;">⚠</span> 
            STATUS: {decision}
            <span style="opacity: 0.6; margin: 0 1rem;">|</span>
            <span style="font-size: 1rem; font-weight: normal;">Severity Score: {conf:.2f}</span>
        </div>
        <div style="text-align: right;">
            <div style="font-size: 0.7rem; opacity: 0.8; letter-spacing: 1px;">ACTIVE MONITORING</div>
            <div style="font-size: 1rem;">COMPONENT: {component}</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

def render_features_panel(result):
    # HEADER
    st.markdown("""
    <div class="panel-header">
        <span class="panel-icon">💾</span> EXTRACTED FEATURES
    </div>
    """, unsafe_allow_html=True)
    
    # LIST CONTENT
    # Strict single-line construction to avoid Markdown code blocks
    html_content = '<div class="feature-list">'
    features = result["features"]
    for k, v in features.items():
        # Build each item as a single line string
        html_content += f'<div class="feature-item"><span class="feature-key">{k}</span><span class="feature-val">{v}</span></div>'
    html_content += '</div>'
    
    st.markdown(html_content, unsafe_allow_html=True)

def render_trace_panel(trace):
    # HEADER
    st.markdown("""
    <div class="panel-header">
        <span class="panel-icon">🔗</span> DECISION TRACE & REASONING
    </div>
    """, unsafe_allow_html=True)
    
    # STEPS - Iterative rendering
    reasoning = trace.get("reasoning_trace", [])
    
    for i, step in enumerate(reasoning, 1):
        rule = step.get("rule", "UNKNOWN")
        val = step.get("feature_value", 0)
        thresh = step.get("threshold", 0)
        comp = step.get("comparison", ">")
        res = step.get("rule_result", "N/A")
        cond_text = "Condition check"
        if res == "FIRED": cond_text = "Threshold exceeded"
        
        res_class = "res-fired" if res == "FIRED" else "res-pass"
        val_style = "val-highlight" if res == "FIRED" else ""
        
        # Build HTML as a single concatenated string to avoid indentation issues
        step_html = f'<div class="trace-step">'
        step_html += f'<div class="trace-step-header"><span class="step-circle">{i}</span><span class="node-name">NODE: {rule}</span></div>'
        step_html += f'<div class="logic-box">Value: <span class="{val_style}">{val}</span> {comp} Threshold: {thresh}</div>'
        step_html += f'<div style="margin-top: 8px; display: flex; align-items: center;"><span class="result-badge {res_class}">RESULT: {res}</span><span style="font-size: 0.8rem; color: #8b949e;">Condition: {cond_text}</span></div>'
        step_html += '</div>'
        
        st.markdown(step_html, unsafe_allow_html=True)
        
    # Action Trigger (Final Step)
    if trace.get("decision") == "DANGER":
        final_html = '<div class="trace-step" style="border: 1px solid #1f6feb; background: rgba(31, 111, 235, 0.1);">'
        final_html += '<div class="trace-step-header"><span class="step-circle" style="background:#1f6feb;">!</span><span class="node-name" style="color: #58a6ff;">LOGIC: CONJUNCTIVE_TRIGGER(FINAL)</span></div>'
        final_html += '<h4 style="margin: 0; color: #f0f6fc;">⚡ ACTION: TRIGGER_DANGER_SEQUENCE</h4>'
        final_html += '<p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #8b949e;">Critical thresholds breached. Automatic emergency shutdown protocol recommended.</p>'
        final_html += '</div>'
        
        st.markdown(final_html, unsafe_allow_html=True)


# -------------------------------------------------
# Main Layout Logic
# -------------------------------------------------
render_header()

if st.session_state.simulation_results:
    results = st.session_state.simulation_results
    
    # Validation of index
    if st.session_state.active_event_idx >= len(results):
        st.session_state.active_event_idx = 0
        
    active_res = results[st.session_state.active_event_idx]
    active_trace = active_res["trace"]
    
    # 4. Main Columns
    col_left, col_right = st.columns([1, 1.5]) # Adjusted ratio for better balance
    
    # --- LEFT COLUMN: Navigation & Status & Features ---
    with col_left:
        # A. EVENT TABS (Custom Buttons)
        # Use columns to make them full width together
        t_cols = st.columns(3, gap="small")
        
        def set_tab(idx):
             st.session_state.active_event_idx = idx
        
        for i in range(3):
            if i < len(results):
                label = f"Event {i+1}"
                is_active = (i == st.session_state.active_event_idx)
                # Tab styling
                if t_cols[i].button(
                    label, 
                    key=f"tab_{i}", 
                    type="primary" if is_active else "secondary", 
                    use_container_width=True
                ):
                    set_tab(i)
                    st.rerun()
            else:
                t_cols[i].button(f"Event {i+1}", disabled=True, key=f"tab_disable_{i}", use_container_width=True)
        
        st.markdown("<div style='margin-bottom: 1rem;'></div>", unsafe_allow_html=True)

        # B. STATUS BANNER (Under Tabs)
        render_status_banner(active_trace, active_res["component"])
        
        # C. FEATURES PANEL
        render_features_panel(active_res)
        
    # --- RIGHT COLUMN: Decision Trace ---
    with col_right:
        # 1. Visual Trace
        render_trace_panel(active_trace)
        
        # 2. Scrollable JSON Trace
        # HEADER
        st.markdown("""
        <div class="panel-header" style="margin-top: 2rem;">
            <span class="panel-icon">📜</span> RAW TRACE DATA
        </div>
        """, unsafe_allow_html=True)
        
        # SCROLLABLE CONTENT BLOCK
        json_html = '<div style="height: 400px; overflow-y: auto; padding: 1rem; background-color: #0d1117;">'
        
        # Build list items
        for k, v in active_trace.items():
            disp_val = v
            if isinstance(v, (dict, list)):
                sanitized_val = str(v).replace("<", "&lt;").replace(">", "&gt;")
                disp_val = f"<span style='opacity:0.6; font-size:0.85em;'>{sanitized_val}</span>"
            
            # Single line string construction
            json_html += f'<div class="feature-item"><span class="feature-key">{k}</span><span class="feature-val">{disp_val}</span></div>'
            
        json_html += "</div>"
        st.markdown(json_html, unsafe_allow_html=True)
        
    # 5. FOOTER
    st.markdown("""
    <div class="footer-bar">
        <div>ENGINE ID: TR-0922-PROD | LAST SYNC: 0.2MS AGO</div>
        <div style="color: #3fb950; display: flex; align-items: center;">
            <span class="status-dot"></span> ENGINE ONLINE
        </div>
    </div>
    """, unsafe_allow_html=True)

else:
    # Empty State
    st.info("System Ready. Click 'Run Simulation' to begin analysis.")
