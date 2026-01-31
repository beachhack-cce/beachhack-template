# Architecture

This document explains **how ZeroHour is structured**.

---

## High-Level Flow

 &nbsp;&nbsp;&nbsp;&nbsp;
Codebase <br>
	&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;↓
 <br> &nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;Scanner <br>
&nbsp;&nbsp;&nbsp;&nbsp;
	&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;
↓
 <br>Signal Extraction <br>
&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;	&nbsp;&nbsp;&nbsp;&nbsp;
↓
 <br>Failure Analysis <br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;
	↓
 <br>&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;Ranking <br>
	&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;&nbsp;
&nbsp;&nbsp;&nbsp;↓
 <br>&nbsp;&nbsp;&nbsp;Report (Top 10) <br>


---

## Core Components

### 1. Scanner
- Traverses the target directory
- Identifies relevant source files
- Ignores non-code artifacts (configurable)

Input:
- Directory path

Output:
- List of analyzable files

---

### 2. Signal Extraction
Extracts structural signals from code, such as:
- Entry points
- Critical paths
- Dependency concentration
- Reused logic hotspots

No execution. No runtime behavior.

---

### 3. Failure Analysis Engine
- Correlates extracted signals
- Applies deterministic heuristics
- Estimates failure blast radius

This is **rule-based**, not probabilistic.

---

### 4. Ranking Engine
- Aggregates failure impact
- Forces prioritization
- Outputs **only the top 10**

No configurable thresholds.
No long tail.

---

### 5. Reporter
- Converts analysis into human-readable output
- Explains:
  - What can fail
  - Why it matters
  - What the consequence is
  - What to look at next

Supports:
- Boxed output
- Plain text output

---

## Design Constraints

- Terminal-only
- No persistent state
- No external services
- No ML or training data
- Predictable and auditable output

---

## What Architecture Does NOT Include

- Vulnerability databases
- CVE matching
- Runtime profiling
- Dynamic analysis
