# Analysis Logic

This document explains **how ZeroHour decides what matters first**.

---

## Core Question

> If this code fails, **what breaks the business first?**

All logic exists to answer this.

---

## What Is Analyzed

ZeroHour analyzes **failure-prone characteristics**, including:

- Single points of failure
- Highly reused logic
- Central orchestration code
- Tight coupling across modules
- Error-handling absence in critical paths

It focuses on **impact**, not correctness.

---

## What Is NOT Analyzed

ZeroHour does NOT analyze:
- Known vulnerabilities (CVEs)
- Input sanitization issues
- Authentication flaws
- Cryptography misuse
- Dependency versions

Those belong to SAST or security scanners.

---

## Failure Signals (Conceptual)

Signals used to estimate failure impact may include:

- Fan-in / fan-out imbalance
- Centralized control flow
- High dependency gravity
- Low isolation of critical logic
- Failure propagation potential

Signals are **structural**, not semantic.

---

## Failure Impact Estimation

Impact is estimated based on:
- How much code depends on the component
- Whether failure propagates or is contained
- Whether recovery paths exist
- Whether failure blocks core workflows

No numeric risk score is shown to the user.

---

## Forced Prioritization Rule

- Only **top 3** findings are reported
- Everything else is discarded

This is intentional.

ZeroHour optimizes for **decision-making**, not completeness.

---

## Explainability

Each reported issue includes:
- Why this area is risky
- How failure propagates
- What breaks if it fails
- Where to look in the code

No black-box decisions.

---

## Determinism Guarantee

- Same input → same output
- No randomness
- No learning
- No environment dependence

---

## Known Limitations

- Static-only analysis
- Language and framework dependent
- Cannot see runtime behavior
- Cannot infer business logic intent

These limits are explicit by design.
