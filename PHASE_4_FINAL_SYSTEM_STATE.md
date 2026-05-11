

# PHASE 4 FINAL SYSTEM STATE

## Overview

Rainbow Dashboard is now an operational automation platform built on Google Apps Script.

Current architecture:

```text
Central Dashboard Web App
    ↓
Individual Automation Web Apps
    ↓
Structured JSON Responses
    ↓
Operational Dashboard Rendering
```

The platform evolved from isolated Gmail automations into:
- operational monitoring
- retry/recovery workflows
- queue health visibility
- operational inspection tooling
- centralized dashboard execution

---

# Core Platform Principles

## 1. Do Not Rebuild Working Automations
Existing stable automations are preserved and wrapped by the dashboard architecture.

## 2. Dashboard as Control Plane
The dashboard is now:
- execution layer
- monitoring layer
- operational visibility layer
- recovery tooling layer

—not just a launcher UI.

## 3. Standardized JSON Responses
Automations return structured JSON payloads for:
- status
- messages
- metrics
- queue health
- inspection items
- operational rendering

## 4. Stable Web App URLs
Dashboard integrations use deployed `/exec` Apps Script URLs only.

Never use:
- `googleusercontent.com`
- Apps Script editor URLs
- `@HEAD`
- temporary execution URLs

---

# Current Dashboard Architecture

## Dashboard Project

```text
~/Rainbow-Dashboard/apps-script-projects/automation-dashboard
```

Live deployment:

```text
https://script.google.com/macros/s/AKfycbwQRIs6b0N75BBvNU1EGz73t1jt4YHdQM2Di3NthVMolJKAcvx0VlnIgSw_zA2HquuJ_g/exec
```

## Dashboard Roles

### business
Core production automations.

### monitoring
Queue health + operational monitoring workflows.

### operations
Inspection, retry, and recovery tooling.

---

# Insurance Intake Automation

## Project

```text
~/Rainbow-Dashboard/apps-script-projects/insurance-intake-automation
```

## Current Capabilities

- Insurance Intake processing
- Asbestos attachment intake
- Itel attachment intake
- Queue health monitoring
- Pending claim folder inspection
- Retry workflows
- Scheduled retry triggers

## Current Deployment Requirements

Apps Script deployment settings:

```text
Execute as: Me
Who has access: Anyone
```

Required because dashboard `UrlFetchApp()` calls do not carry browser session authentication.

---

# Operational Features Completed

## Queue Health Monitoring

Supports:
- Insurance Intake
- Asbestos
- Itel

Tracks:
- active queue
- pending claim folders
- retries
- retry limits
- errors
- review queues

---

# Operations Center

Dashboard now supports:
- operational summaries
- inspection rendering
- Gmail deep links
- inline operational actions
- retry execution
- queue visibility

---

# Retry Architecture

Implemented:
- retry workflows
- scheduled retry triggers
- retry state labels
- retry recovery tracking
- retry limit handling

Current retry labels:

```text
Retry/Ready
Retry/In Progress
Retry/Recovered
Retry/Blocked
Retry/Limit Reached
```

---

# Gmail Label Standards

## Insurance Intake

```text
Intake-Insurance Assignment
Intake-Processed
Intake-Pending Review
Intake-Error
intake-duplicate
```

## Asbestos

```text
Asbestos
Asbestos/Processed/Asbestos
Asbestos/Error
Asbestos/Needs Review
Asbestos/Pending Claim Folder
```

## Itel

```text
Itel
Itel/Processed/Itel
Itel/Error
Itel/Needs Review
Itel/Pending Claim Folder
```

---

# Git / Deployment Workflow

Standard workflow:

```bash
git status
git add .
git commit -m "message"
git push
```

Apps Script deployment:

```bash
clasp push
```

---

# Phase 5 Starting Point

Phase 5 will focus on:
- UI redesign
- platform abstraction
- automation scalability
- operational APIs
- shared utilities
- frontend/backend separation

Phase 4 successfully established:
- stable operational architecture
- recovery tooling
- centralized dashboard control
- monitoring visibility
- retry/recovery workflows
- deployment/versioning discipline