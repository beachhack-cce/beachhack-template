# 🏭 Explainable Predictive Maintenance System  
## Decision‑Trace–First Architecture with Maintenance Agent

---

## 📌 Project Overview

Industrial machines generate massive sensor data, yet maintenance decisions are still
- distrusted,
- delayed,
- and poorly explained.

Most predictive maintenance systems fail **not because predictions are wrong**, but because:
- engineers cannot see *how* decisions were made,
- system logic cannot be audited,
- alerts do not translate into clear actions.

This project solves that problem by building a **trace‑first predictive maintenance system**
where **every decision is recorded, explained, and acted upon**.

> **Core philosophy:**  
> *If a system cannot show how it reasoned, it should not be trusted.*

---

## 🎯 Problem Statement

Existing predictive maintenance solutions suffer from:

- ❌ Black‑box AI alerts
- ❌ Logical mismatch between expected and real outcomes
- ❌ Alert fatigue due to poor explanations
- ❌ No direct path from alert → maintenance action

Our solution focuses on:
- **decision transparency**
- **logical correctness**
- **human trust**
- **workflow integration**

---

## 🧠 Core Idea: Decision Trace First

Explainability is **not added later**.

The system is built around a **Decision Trace Engine** that records:
- what was evaluated,
- which rules fired,
- how risk evolved,
- why the final decision occurred.

Everything else (explanations, actions, learning) is built **on top of the trace**.

---

## 🏗️ Full Architecture Overview

### Top‑Level Flow

```mermaid
flowchart TD

%% =========================
%% Sensor & Data Reality Layer
%% =========================
subgraph L1[Sensor & Data Reality Layer]
    S1[Sensor 1<br/>Vibration Sensor]
    S2[Sensor 2<br/>Temperature Sensor]
    S3[Sensor 3<br/>Load Sensor]

    SD[Sensor Data Stream<br/>Time-Series Data]
    S1 --> SD
    S2 --> SD
    S3 --> SD
end

%% =========================
%% Reasoning Engine
%% =========================
subgraph L2[Reasoning Engine]
    FE[Feature Extraction<br/>• Vibration trend<br/>• Temp delta<br/>• Load stability]
    RL[Deterministic Reasoning<br/>• Rule evaluation<br/>• Threshold checks]

    FE --> RL
end

%% =========================
%% Decision Trace Engine
%% =========================
subgraph L3[Decision Trace Engine]
    DT[Decision Trace Builder<br/>• Rules triggered<br/>• Intermediate risks]
    JS[Trace Storage<br/>JSON Decision Trace]
    FD[Final Decision<br/>Decision + Confidence]

    DT --> FD
    DT --> JS
end

%% =========================
%% Explainability Agent
%% =========================
subgraph L4[Explainability & Agentic Layer]
    TI[Trace Ingestion<br/>Reads Decision Trace]
    LLM[Explainability Agent (LLM)<br/>Trace → Text]
    EX[Human-Readable Explanation<br/>Why decision happened]

    TI --> LLM
    LLM --> EX
end

%% =========================
%% Maintenance Agent & Workflow
%% =========================
subgraph L5[Maintenance Agent & Workflow Layer]
    MA[Maintenance Decision Agent<br/>• Inspect<br/>• Schedule<br/>• Monitor]
    WO[Work Order Generator<br/>Priority + Action]
    FB[Engineer Feedback<br/>Confirm / Reject]
end

%% =========================
%% Connections Between Layers
%% =========================
SD --> FE
RL --> DT
FD --> TI
EX --> MA
MA --> WO
WO --> FB
FB --> DT

