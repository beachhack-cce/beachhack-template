# Limitations

This document lists **explicit, intentional limits** of ZeroHour.

---

## No Vulnerability Detection
- No CVE matching
- No dependency scanning
- No security rule engines

Use SAST tools for this.

---

## No Business Logic Awareness
ZeroHour cannot infer:
- Revenue impact
- User intent
- Domain-specific importance

It estimates impact structurally, not semantically.

---

## Language and Framework Dependence
Analysis quality depends on:
- Supported languages
- Recognizable project structures

---

## Not a Risk Scoring Tool
- No numeric severity
- No confidence scores

Explainability is prioritized over metrics.

