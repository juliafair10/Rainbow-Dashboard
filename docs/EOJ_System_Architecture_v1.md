# Rainbow EOJ System — Architecture & Reference

*Generated June 30, 2026. Canonical documentation for the Rainbow Restoration End of Job system.*

---

## 1. Project Purpose

The EOJ (End of Job) system is the field data collection layer for Rainbow Restoration. Its primary purpose is to capture structured field reports from technicians immediately after each site visit and feed that data into Rainbow's operational intelligence layer.

Before the EOJ system, technicians reported verbally or via unstructured text. Rainbow had no reliable timestamped record of what happened on a job, what equipment was on site, or what follow-up was needed. The EOJ app solves this by providing technicians with a mobile-optimized, minimal-typing web form that captures exactly the facts Rainbow needs — and nothing more.

The EOJ system is composed of two Google Apps Script projects that work together:

**EOJ App** (`eoj-app`) is the technician-facing web app. It provides the submission form, job search, job history lookup, and equipment persistence. It writes directly to the EOJ_Log sheet and returns a confirmation to the technician. It does not process, route, or act on the data it collects.

**EOJ Processing Engine** (`eoj-processing-engine`) runs on a 15-minute time trigger. It reads unprocessed rows from EOJ_Log, interprets them, writes outputs to the Rainbow Claims Database, creates Todoist tasks for office follow-up, and posts Google Chat notifications. It is entirely decoupled from the EOJ App.

The broader Rainbow system these projects serve:

- **Claims Database** — the operational record of every claim. The processing engine writes timeline events, conditions, alerts, and timestamp updates here.
- **Automation Dashboard** — the office-facing view of the Claims Database. Staff use it to review claim timelines, conditions, alerts, and EOJ history.
- **Claims Workspace** — the office environment for managing individual claims end-to-end.
- **Technician Workspace** — planned future project. Will give technicians visibility into their job history, scheduled visits, and equipment on site.

The EOJ app is intentionally narrow: capture facts quickly from the field. Rainbow orchestrates what happens with those facts.

---

## 2. High-Level Architecture

```
Technician (iPhone/Android)
        ↓
  EOJ App (GAS Web App)
  — Job search and selection
  — Form submission
  — Equipment auto-population
        ↓
  EOJ_Log (Google Sheet)
  — One row per EOJ submission
  — Processing_Status = 'New' on write
        ↓  (15-minute time trigger)
  EOJ Processing Engine
  — EOJReader: reads unprocessed rows
  — RawJsonParser: parses Raw_JSON payload
  — EOJInterpreter: builds structured output objects
  — ProcessingWriter: writes output to EOJ_Processing_Output
        ↓
  ClaimsBridge
  — Timeline_Events: one row per event per EOJ
  — Claim_Conditions: open conditions (deduplicated)
  — Claim_Alerts: attention/review alerts
  — Claims: timestamp updates (Last_EOJ_At, Last_Meaningful_Activity_At)
  — Claim_Service_Log: audit trail
        ↓
  TodoistService
  — Creates follow-up tasks when technician flagged Office Follow-Up Needed
  — Assigns to Julia or Clarence based on technician selection
        ↓
  GoogleChatNotifier
  — Posts plain-text notification to Google Chat space via webhook
        ↓
  Processing_Status updated to 'Processed' (or 'Error')
```

**Processing status values:**

- `New` — written by eoj-app at submission time. Picked up by the engine on next run.
- `Processed` — engine completed successfully.
- `Error` — engine encountered an error during processing. The EOJ data is still valid; equipment counts and history remain readable. The engine will not retry Error rows.
- `Skipped` — manually set to exclude a row from processing and from equipment history lookups.

---

## 3. Project Structure

### EOJ App (`eoj-app`)

**`Config.js`** — single source of truth for all runtime constants. Contains spreadsheet IDs, technician list, visit types, and processing status constants. Change technician names or visit types here only.

```javascript
CONFIG.EOJ_DATABASE_ID       // Google Sheet ID for EOJ_Log
CONFIG.CLAIMS_DATABASE_ID    // Google Sheet ID for Claims Database
CONFIG.EOJ_LOG_SHEET_NAME    // 'EOJ_Log'
CONFIG.TECHNICIANS           // ['Blake', 'Tyler', 'Cooper', 'Patricia', 'Clarence', 'Joe']
CONFIG.VISIT_TYPES           // ['Inspection', 'Demo', 'Mitigation', 'Monitoring', 'Pickup / Completion', 'Other']
```

**`Code.js`** — server-side entry point and all `google.script.run` callable functions. Key functions:

- `doGet(e)` — serves the web app. Also serves the PWA manifest when `?manifest=1` is present.
- `getAppBootstrapData()` — returns technician list and visit types to the client on load.
- `submitEOJ(payload)` — validates and writes an EOJ. Called on form submit.
- `validateBasicEOJ(payload)` — enforces required fields, future-date check, and negative equipment guard.
- `getJobsForLookup()` — returns active claims from the Claims Database sorted by most recent EOJ first. Excludes terminal lifecycle states ('Operationally Complete', 'Not Sold'). Caps display at 10 in the client but returns all active claims to support search.
- `getEquipmentForJob(claimId)` — returns the most recent equipment After counts from EOJ_Log for a given claim. Used to pre-populate Before fields on the next visit.
- `getJobSummaryForLookup(claimId)` — returns claim detail and EOJ history for the Job History tab.
- `setupEOJLogSheet()` — creates or resets EOJ_Log with the canonical 50-column spec. Run once on new sheets.
- `repairEOJLogColumns()` — adds any missing columns to a live EOJ_Log without disturbing existing data.

**`SheetService.js`** — sheet write utilities.

- `getEOJLogHeaderIndex_(sheet)` — builds a `{ headerName: columnIndex }` map from row 1. All writes use this; column positions are never hardcoded.
- `appendRowByHeaders_(sheet, idx, valueMap)` — writes a `{ columnName: value }` map into the correct columns. Silently skips any column not present in the header. This is the only write path for EOJ_Log.
- `appendEOJRecord(payload)` — the canonical EOJ write function. Builds the full value map from the submission payload, including equipment counts, MICA fields, temp job fields, and the raw JSON payload. Generates `EOJ_ID` as `EOJ-YYYYMMDD-HHmmss`.

**`ResponseService.js`** — standardizes server responses.

- `successResponse(data)` — returns `{ ok: true, data }`.
- `errorResponse(message, extras)` — returns `{ ok: false, error: message }`.

**`Index.html`** — the outer HTML shell. Includes the viewport meta, Rainbow branding, PWA meta tags (theme color, apple-mobile-web-app tags), and `<?= include('...') ?>` calls to inline Styles.html and Client.html. The logo is loaded server-side via `getLogoDataUri()` as a base64 data URI, avoiding CORS issues.

**`Styles.html`** — all CSS. Key structural decisions:

- Breakpoints are set at 1200px+ for desktop-only rules (not 768px or 900px). This is intentional: Google Apps Script wraps web apps in an iframe that reports ~980px CSS viewport on an iPhone. Standard mobile breakpoints fire in "desktop" mode inside GAS. Using 1200px ensures mobile devices always receive the mobile layout.
- A `@media screen and (max-width: 1100px)` block at the very end forces full-width layout with `!important` overrides on all container elements. This is the belt-and-suspenders override for GAS's iframe wrapper.
- `input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"])` selectors are used for width overrides to prevent radio card inputs from being stretched to full width.

**`Client.html`** — all client-side JavaScript. Loaded inline via `<?= include('Client.html') ?>`. Responsibilities:

- Bootstrap: calls `getAppBootstrapData()` on load to populate technician and visit type selectors.
- Job search: calls `getJobsForLookup()`, renders the top 10 most recent by default, renders all matches when a search query is active.
- Job selection: populates form fields from the selected job, then calls `getEquipmentForJob()` to pre-populate equipment Before counts.
- Visit type cards: renders clickable radio cards, shows/hides visit-specific sections.
- Equipment stepper: plus/minus controls for Air Movers, Dehumidifiers, HEPA. Before values auto-loaded from previous EOJ.
- MICA section: shown on all visit types. Internal field names use `mica` prefix; displayed to user as "Mitigate" throughout.
- Office follow-up: shows action buttons and assignee selector when enabled.
- Form submission: serializes form state to JSON payload, calls `submitEOJ()`, resets form on success.
- Job History tab: calls `getJobsForLookup()` with full result set, renders lookup cards with Claim ID, claim number, address. Calls `getJobSummaryForLookup()` to show EOJ history for a selected job.
- Temporary EOJ: creates a local temp job entry, allows submission without a Claims Database match.

---

### EOJ Processing Engine (`eoj-processing-engine`)

**`Config.js`** — runtime constants for the engine, including spreadsheet IDs, column specs, Todoist property names, and processing status constants.

**`Code.js`** — the trigger entry point.

- `createProcessingTrigger()` — sets up the 15-minute time-based trigger on `processUnprocessedEOJs`. Safe to re-run; removes old triggers first.
- `processUnprocessedEOJs()` — the main processing loop. For each unprocessed row: parses raw JSON, interprets, writes output, calls ClaimsBridge, calls TodoistService, calls GoogleChatNotifier, marks the row Processed. Each downstream call (ClaimsBridge, Todoist, Chat) is wrapped in its own try/catch. Failures in any of these are logged but do not fail the processing row or prevent it from being marked Processed.

**`EOJReader.js`** — reads unprocessed rows from EOJ_Log.

- `getUnprocessedEOJRows()` — returns all rows where `Processing_Status` is not 'Processed' or 'Error'. Calls `ensureEOJLogProcessingColumns_()` to add missing processing columns if needed. Uses header-based column resolution. Falls back to right-to-left JSON scan if the `Raw_JSON` column value does not parse (handles column drift between app versions).

**`RawJsonParser.js`** — parses the `Raw_JSON` payload string stored in EOJ_Log into a structured object for interpretation.

**`EOJInterpreter.js`** — the interpretation layer. Takes the parsed payload and the row metadata, returns a fully structured `interpreted` object consumed by all downstream writers.

Builds the following output objects:
- `base` — core identity fields (technician, job, claim, visit date/type)
- `equipmentOutput` — before/added/removed/after counts per equipment type, totals, pickup detection
- `followUpOutput` — whether follow-up is required, assigned to, description
- `monitoringOutput` — monitoring status, next date required
- `asbestosOutput` — test required, samples taken, count
- `itelOutput` — flooring removed, sample required
- `reviewOutput` — whether the EOJ has any data quality issues requiring office review
- `conditionOutput` — conditions to open in Claims Database (monitoring active, asbestos pending)
- `alertOutput` — alerts to write (follow-up required, asbestos attention, itel attention, review needed)
- `timelineEvent` — one or more timeline events to write (one per significant fact on the EOJ)
- `operationalObjects` — structured operational object array (schema version `EOJ_OPERATIONAL_OBJECTS_V1`)

**`ProcessingWriter.js`** — writes the interpreted output to `EOJ_Processing_Output` sheet for audit.

**`StatusUpdater.js`** — marks rows as Processed or Error in EOJ_Log.

**`ClaimsBridge.js`** — writes interpreted EOJ outputs to the Rainbow Claims Database. Documented in full in Section 10.

**`TodoistService.js`** — creates Todoist tasks for office follow-up. Documented in full in Section 8.

**`GoogleChatNotifier.js`** — posts Google Chat notifications. Documented in full in Section 9.

**`SetupProperties.js`** — helper to verify that all required Script Properties are set.

**`TestRunner.js`** — diagnostic functions for end-to-end testing.

**`LegacyCleanup.js`** — utilities for managing legacy or malformed rows.

---

## 4. EOJ Submission Workflow

**Step 1 — Technician opens the app.** The GAS web app loads. `getAppBootstrapData()` is called and returns the technician list and visit types. The app renders the Submit tab by default.

**Step 2 — Job selection.** The technician searches for their job by name, claim number, or address. The search queries `getJobsForLookup()` which returns active claims from the Claims Database sorted by most recent EOJ first. The default view shows 10 jobs; typing filters all active claims. Selecting a job populates `jobName`, `claimId`, `claimNumber`, `customerName`, and `propertyAddress` in the form. `getEquipmentForJob(claimId)` is immediately called to load the previous EOJ's After counts into the Before fields.

**Step 3 — Form completion.** Technician selects their name, visit date (cannot be future), visit type, and job status. Work Performed is required. Visit-type-specific sections appear dynamically (see Section 5). Equipment counts are entered as changes from the pre-loaded Before values. MICA/Mitigate section is always shown. Office Follow-Up section appears if the technician toggles it on.

**Step 4 — Validation.** `validateBasicEOJ()` runs server-side on submit. Required fields: technician, jobName, visitDate, visitType, workPerformed. Visit date cannot be in the future. Equipment After counts cannot be negative.

**Step 5 — Write to EOJ_Log.** `appendEOJRecord()` generates an `EOJ_ID` (`EOJ-YYYYMMDD-HHmmss`), builds the full value map, and writes via header-based mapping. `Processing_Status` is set to `New`. The complete payload is serialized to `Raw_JSON`. The EOJ_ID and submission timestamp are returned to the client.

**Step 6 — Confirmation.** The client displays a success message with the EOJ_ID. The form fully resets: all fields clear, job selection deselects, equipment returns to zero.

**Step 7 — Processing (up to 15 minutes later).** The processing engine picks up the row on its next trigger run. It parses `Raw_JSON`, interprets the EOJ, writes to the Claims Database, creates Todoist task if needed, posts Google Chat notification, and marks the row `Processed`.

---

## 5. Visit Types

### Inspection

An initial assessment visit. Technician documents conditions found, scope of work, and any immediate follow-up needed.

Required fields: Technician, Visit Date, Visit Type, Work Performed.

Special logic: Mitigation Plan Updated checkbox is shown. MICA section is always shown.

### Demo

Demolition visit. Removal of damaged materials.

Required fields: same as Inspection.

Special logic: Itel sample requirement is triggered if flooring is flagged as removed (interpreted by processing engine). MICA section shown.

### Mitigation

Active drying and mitigation visit. Equipment is actively on site.

Required fields: same as Inspection. Equipment section is prominent; Before values are pre-populated from the previous EOJ.

Special logic: Equipment counts (Air Movers, Dehumidifiers, HEPA) are tracked. Added and Removed values drive the After count. MICA section shown and especially relevant here — technicians should update Mitigate after each mitigation visit.

### Monitoring

Check-in visit during active drying. Technician records moisture readings or drying progress in Work Performed.

Required fields: same as Inspection.

Special logic: Monitoring Status and Next Monitoring Date fields appear. If next monitoring is required and the date is missing, the processing engine flags this as a review issue. MICA section shown.

### Pickup / Completion

Equipment removal and job close-out visit.

Required fields: same as Inspection.

Special logic: Equipment removal is expected. If total removed > 0 and total After = 0, the processing engine automatically generates an `Equipment Pickup Completed` timeline event in addition to the standard visit event.

### Other

Catch-all for any visit that doesn't fit the above categories.

Required fields: same as Inspection.

Special logic: none beyond the standard sections. MICA shown.

---

## 6. Equipment Persistence

Equipment tracking across visits is handled by reading the most recent EOJ in EOJ_Log for a given claim and using its After counts as the Before counts for the next visit.

**How it works:**

When a technician selects a job, `getEquipmentForJob(claimId)` is called. This function walks backwards through EOJ_Log looking for the most recent row matching that Claim_ID where `Processing_Status` is not 'Skipped'. It returns `Air_Movers_After`, `Dehumidifiers_After`, and `HEPA_After` from that row.

These values are loaded into the Before fields in the equipment section. The technician only enters how many were added or removed today. The After count is calculated automatically: `After = Before + Added - Removed`. After cannot go below zero.

**Important behavior:**

Rows with `Processing_Status = 'Error'` are included in the equipment lookup. The processing engine may mark a row Error if Todoist or Google Chat fail — but the EOJ data itself, including equipment counts, is valid. Excluding Error rows would cause equipment to appear to vanish when any downstream service errors.

Rows with `Processing_Status = 'Skipped'` are excluded. Skipped is a manual administrative flag for rows that should not affect equipment history.

**Chain across visits:**

- Visit 1: Before=0, Added=6, Removed=0, After=6. Written to EOJ_Log.
- Visit 2: `getEquipmentForJob()` finds Visit 1, returns After=6. Technician sees Before=6. They remove 2. After=4. Written to EOJ_Log.
- Visit 3: `getEquipmentForJob()` finds Visit 2, returns After=4. And so on.

**When the chain is broken:**

If a submission occurred before equipment auto-load was working (or the technician submitted with equipment fields left at zero), the Before on that row will be zero. Subsequent After values on that row will only reflect what was entered, not what was actually on site. This is data, not a bug — the values in the sheet represent what the app recorded at the time.

---

## 7. Temporary EOJs

Temporary EOJs exist to handle situations where a job has not yet been entered into the Claims Database. This happens when an insurance claim is newly assigned and the office hasn't had time to create the claim record before the technician is on site.

**When used:** When the technician searches for a job and cannot find it in the list.

**How they work:** The technician taps "Create Temporary EOJ" in the Submit tab. They enter a carrier and loss type. The app creates a local entry with a generated `Temp_Job_ID` and allows the form to be submitted normally. The submitted row has `Is_Temp_Job = true`, `Temp_Carrier`, `Temp_Loss_Type`, and `Pending_Claim_Link = 'Pending'`.

**Processing behavior:** The processing engine processes temp EOJ rows the same way as regular EOJs. However, since there is no `Claim_ID`, ClaimsBridge will skip all Claims Database writes (`No claimId — skipping Claims Database writes`). The EOJ data is preserved in EOJ_Log and Raw_JSON.

**Linking:** Once the claim is created in the Claims Database, `linkClaimToTempEoj()` (in Code.js) can be called to update the temp row with the real `Claim_ID`, `Claim_Number`, `Customer_Name`, and `Property_Address`, and set `Pending_Claim_Link = 'Linked'`. After linking, the row can be reprocessed by clearing its `Processing_Status` (or the ClaimsBridge can be run directly with the updated interpreted object).

---

## 8. Todoist Integration

### Architecture

`TodoistService.js` in the processing engine creates Todoist tasks when a technician flags Office Follow-Up as needed. It runs as the third step in `processUnprocessedEOJs()`, after ClaimsBridge. All errors are non-fatal and logged.

### Trigger conditions

A task is created only when `payload.followUpNeeded === true` and a `followUpAction` is present. If either is missing, the function returns early with `{ ok: false, reason: '...' }` and no task is created.

### Task content

Task title format: `Customer Name - Claim # | Action`

Example: `RAFI, MIRZA - 0822508719 | Call adjuster`

Task description includes: Customer, Claim #, Action, Note (if provided), Technician, Visit Date, Visit Type, Claim ID.

Due date and deadline are set to today.

### Office follow-up actions

The form provides action buttons (not free text) to ensure consistency in Todoist:

- Call adjuster
- Send documents
- Schedule re-inspection
- Contact customer
- Escalate to management
- Other (free text)

The selected action value is what appears in the task title.

### Assignee resolution

The technician selects who should handle the follow-up: Julia or Clarence. The service resolves this to a Todoist user ID via Script Properties:

- `Julia` → `TODOIST_ASSIGNEE_ID_JULIA`
- `Clarence` → `TODOIST_ASSIGNEE_ID_CLARENCE`

If the assignee property is not set, the task is created without an assignee.

### Required Script Properties (eoj-processing-engine)

| Property | Description |
|---|---|
| `TODOIST_API_TOKEN` | Todoist REST API token (preferred). Falls back to `TODOIST_TOKEN`. |
| `TODOIST_PROJECT_ID` | Numeric ID of the target Todoist project. |
| `TODOIST_ASSIGNEE_ID_JULIA` | Todoist user ID for Julia. |
| `TODOIST_ASSIGNEE_ID_CLARENCE` | Todoist user ID for Clarence. |
| `TODOIST_SECTION_ID` | (Optional) Section within the project to place tasks. |

**Do not modify the Insurance Intake Automation Todoist workflow.** The `TODOIST_API_TOKEN` is shared between projects but each project uses its own `TODOIST_PROJECT_ID` and target sections.

### Failure behavior

All Todoist errors are caught, logged with `Logger.log()`, and returned as `{ ok: false, reason: '...' }`. The processing row is still marked `Processed`. A Todoist API outage does not prevent EOJ processing from completing.

---

## 9. Google Chat Integration

### Architecture

`GoogleChatNotifier.js` posts a plain-text message to a Google Chat space via an incoming webhook. It runs as the fourth step in `processUnprocessedEOJs()`, after TodoistService. All errors are non-fatal.

### Notification format

The message uses Google Chat's `*bold*` markup for labels. No emoji, no header card, no EOJ ID in the message body.

```
*Technician:* Clarence
*Customer:* RAFI, MIRZA
*Claim #:* 0822508719
*Date:* Jun 30, 2026
*Visit Type:* Pickup / Completion
*Status:* Job Complete – Ready to Task Out

Complete.

*Office Follow-Up Needed*
*Action:* Call adjuster → Julia
*Note:* Adjuster needs updated scope
```

The work summary is included when `workPerformed` is non-empty, truncated to 300 characters. The follow-up block is included only when `followUpNeeded` is true.

### Required Script Properties (eoj-processing-engine)

| Property | Description |
|---|---|
| `GOOGLE_CHAT_WEBHOOK_URL` | Incoming webhook URL from the Google Chat space. Generate in Chat: open space → Apps → Manage webhooks → Add webhook. |

### Failure behavior

All Google Chat errors are caught, logged, and returned as `{ ok: false, reason: '...' }`. The processing row is still marked `Processed`. A webhook failure or network error does not affect processing or Todoist task creation.

---

## 10. Claims Bridge

`ClaimsBridge.js` is the translation layer between the EOJ Processing Engine and the Rainbow Claims Database. It writes to five sheets in a single `SpreadsheetApp.openById()` call.

### Timeline Events (`Timeline_Events`)

One row is written per timeline event generated by the interpreter. Events include:

- `Inspection Completed` / `Monitoring Visit Completed` / `Demo Visit Completed` / `Equipment Pickup Visit Completed` / `[Visit Type] Completed` — always written, one per EOJ
- `Equipment Updated` — written when any equipment was added, removed, or on site
- `Equipment Pickup Completed` — written when all equipment was removed
- `Monitoring Updated` — written when monitoring status or next date was set
- `Follow-Up Requested` — written when follow-up was flagged
- `Asbestos Testing Requested` / `Asbestos Samples Taken` — written when asbestos fields are set
- `Itel Sample Required` — written when flooring removal is indicated

Each row includes both underscore and space-header variants of column names to support either schema in the Timeline_Events sheet.

### Claim Conditions (`Claim_Conditions`)

Open conditions are written when the interpreter flags them. Current condition types:

- `Monitoring Active` — when monitoring status is set or next monitoring is required
- `Asbestos Testing Pending` — when testing is required and samples have not yet been taken

**Deduplication:** Before writing a condition, the bridge checks whether an Open condition of the same type already exists for the claim. If so, it skips the write. A condition is only written once per claim per type until it is closed in the Claims Database by office staff.

### Claim Alerts (`Claim_Alerts`)

Alerts are written for attention or review items:

- `Follow-Up Required` (severity: attention) — when follow-up was requested
- `Asbestos Testing Pending` (severity: attention) — when asbestos test was flagged
- `Itel Sample Required` (severity: attention) — when flooring removal was indicated
- `EOJ Review Required` (severity: review) — when the interpreter detected data quality issues

Alerts are not deduplicated; one alert per EOJ per condition is written.

### Claims Row Update (`Claims`)

The bridge finds the claim row by `Claim_ID` and updates three timestamp fields in place: `Last_EOJ_At`, `Last_Meaningful_Activity_At`, `Updated_At`. Supports both underscore and space variants of these column names.

### Service Log (`Claim_Service_Log`)

One audit row is written per processing run per EOJ, recording the EOJ_ID, run ID, action, status, and a count of what was written (timeline events, conditions, alerts). Used for debugging and operational audit.

### Non-fatal design

All five write operations are wrapped in individual try/catch blocks. A failure in any one (e.g., a sheet not existing, a column not found) is logged and added to the result's error list, but does not prevent the remaining writes or cause the EOJ to be marked Error.

---

## 11. Job Lookup

### Submit Tab — Job Search

Job search is powered by `getJobsForLookup()`, which reads the Claims Database and returns active claims. Filtering rules: must have a `Claim_ID` value; `Lifecycle_State` must not be `Operationally Complete` or `Not Sold`.

Results are sorted by most recent EOJ date descending, determined by cross-referencing EOJ_Log. Claims with no EOJ history sort to the bottom alphabetically.

Default display shows 10 jobs. When the search box has a query, all matching claims are shown. Searchable fields: `customerName`, `displayName`, `propertyAddress`, `claimNumber`, `claimId`.

### Submit Tab — Job Selection

Selecting a job card populates the form with job details and triggers `getEquipmentForJob(claimId)` to pre-populate equipment Before counts from the most recent EOJ.

### Submit Tab — Temporary Jobs

If a job is not in the Claims Database, the technician can create a Temporary EOJ (see Section 7). Temporary job entries appear in the job card list during the session with a "Temp" indicator.

### Job History Tab

The Job History tab allows lookup of any active claim's full EOJ history. It uses the same `getJobsForLookup()` endpoint. Selecting a job calls `getJobSummaryForLookup(claimId)`, which returns:

- Claim details from the Claims Database (customer name, property address, lifecycle state, loss type, primary owner)
- Up to 10 most recent EOJs from EOJ_Log (visit date, visit type, technician, job status, work performed summary, Mitigate status, follow-up action, equipment After counts)

Job cards in the history tab display: customer name, claim number, Claim_ID, and property address to distinguish jobs with the same customer name (e.g., a customer with both a WTR and CUS claim).

---

## 12. Mobile UI

### PWA Configuration

The EOJ app is configured as a Progressive Web App. Key elements in `Index.html`:

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` — no `minimum-scale` or `maximum-scale` constraints.
- `<meta name="apple-mobile-web-app-capable" content="yes">` — enables standalone mode on iOS.
- `<meta name="theme-color" content="#1e3a5f">` — Rainbow navy theme color in the browser chrome.
- Web App Manifest served at `?manifest=1` — enables "Add to Home Screen" on Android with correct icons, name, and display mode.

### Rainbow Branding

Colors: Navy `#1e3a5f` (primary), White `#ffffff` (text on navy), Light grey backgrounds for cards and form sections. The Rainbow Restoration logo is loaded as a base64 data URI from Google Drive to avoid CORS restrictions inherent in GAS web app hosting.

### Responsive Behavior

Standard mobile CSS media queries (`max-width: 768px`, `max-width: 900px`) do not work inside a Google Apps Script web app on iPhone. GAS wraps the app in an iframe and the outer GAS page sets the CSS viewport to approximately 980px regardless of physical screen size. Standard breakpoints fire in "desktop" mode.

The solution implemented:
1. All `max-width` breakpoints for desktop-only rules are set at 1200px or higher.
2. A `@media screen and (max-width: 1100px)` block at the very end of `Styles.html` applies `!important` overrides to force all container elements to `width: 100vw`. This catches GAS's ~980px reported viewport.
3. Radio and checkbox inputs are explicitly excluded from the `width: 100%` override to prevent visit type card layout from breaking.

### Known GAS Limitations

Google Apps Script web apps always display a "Google banner" at the top of the page (showing the logged-in Google account). This cannot be removed. It does not affect app functionality but adds visual noise.

Script execution quotas apply: 6 minutes per execution for consumer accounts, 30 minutes for Workspace. `processUnprocessedEOJs()` runs on a 15-minute trigger and processes all unprocessed rows per run, which is well within limits for typical volumes.

---

## 13. Script Properties

### EOJ App (`eoj-app`)

This project uses no Script Properties. All configuration is in `Config.js`. Spreadsheet IDs are hardcoded in Config.js as named constants.

### EOJ Processing Engine (`eoj-processing-engine`)

All properties set in: Apps Script editor → Project Settings → Script Properties.

| Property | Required | Description |
|---|---|---|
| `TODOIST_API_TOKEN` | Yes | Todoist REST API token. Preferred over `TODOIST_TOKEN`. |
| `TODOIST_TOKEN` | Fallback | Legacy property name. Used if `TODOIST_API_TOKEN` is not set. |
| `TODOIST_PROJECT_ID` | Yes | Numeric Todoist project ID for follow-up tasks. |
| `TODOIST_ASSIGNEE_ID_JULIA` | Yes | Todoist user ID for Julia. Used when technician assigns to Julia. |
| `TODOIST_ASSIGNEE_ID_CLARENCE` | Yes | Todoist user ID for Clarence. Used when technician assigns to Clarence. |
| `TODOIST_SECTION_ID` | Optional | Section ID within the Todoist project. If not set, tasks go to the project inbox. |
| `GOOGLE_CHAT_WEBHOOK_URL` | Yes | Incoming webhook URL for the target Google Chat space. |

---

## 14. Deployment Process

### Deploying EOJ App changes

```bash
cd apps-script-projects/eoj-app
clasp push
```

After `clasp push`, open the Apps Script editor → Deploy → Manage Deployments → select the current deployment → Edit → increment version → Deploy.

**Important:** Simply pushing via `clasp` does not update the live web app URL. You must create a new version in the Manage Deployments dialog. The URL remains the same; the version under it changes.

### Deploying Processing Engine changes

```bash
cd apps-script-projects/eoj-processing-engine
clasp push
```

The processing engine runs on a time trigger, not a web app deployment. Pushing new code takes effect on the next trigger run (within 15 minutes). No redeployment step is required.

### Setting up the processing trigger

Run `createProcessingTrigger()` once from the Apps Script editor after initial deployment. This creates the 15-minute time trigger on `processUnprocessedEOJs`. Re-running the function is safe; it removes existing triggers before creating a new one.

### Adding the app to iPhone home screen

In Safari, navigate to the EOJ App URL. Tap the Share button → Add to Home Screen. The app will install with the Rainbow name and icon, and open in standalone mode (no browser chrome) using the PWA manifest configuration.

### Schema changes (adding columns to EOJ_Log)

1. Add the new column name to `EOJ_LOG_COLUMNS_` in `Code.js`.
2. Add the corresponding field to the `valueMap` in `appendEOJRecord()` in `SheetService.js`.
3. Push via `clasp push` and deploy.
4. Run `repairEOJLogColumns()` from the Apps Script editor once. This adds any missing columns to the live sheet without disturbing existing data or column order.

---

## 15. Operational Philosophy

**Fast technician reporting.** The single most important design constraint is that a technician on a job site can complete and submit an EOJ in under two minutes on a phone. Every field, every section, and every interaction is evaluated against this constraint. If something isn't essential to capture in the field, it doesn't go in the EOJ.

**Minimal typing.** Technicians should tap, not type. Job selection, technician name, visit type, job status, equipment counts, and follow-up actions are all tapped selections. Free text is reserved for Work Performed and notes — things that genuinely require narrative description.

**EOJ captures facts. Rainbow orchestrates.** The EOJ app is not a workflow engine. It doesn't know what a timeline event means, whether a condition should be opened, or who needs to be notified. It captures what happened on the visit and records it faithfully. The processing engine and the downstream Rainbow systems decide what to do with those facts.

**Operational intelligence belongs in Rainbow.** Reports, dashboards, timelines, conditions, and alerts live in the Claims Database and Automation Dashboard — not in the EOJ app. The EOJ app has one job and does it well.

**Non-fatal downstream failures.** A Google Chat outage, a Todoist API error, or a ClaimsBridge write failure must never prevent an EOJ from being recorded. The EOJ_Log is the authoritative record. Everything downstream is a downstream concern.

**Header-based sheet writes everywhere.** No function in this codebase writes to a spreadsheet by column position. All writes use header-based mapping (`getEOJLogHeaderIndex_`, `appendRowByHeaders_`). This means columns can be added, reordered, or renamed in the sheet without breaking the code. The column name is the contract.

---

## 16. Completed Features

This list reflects all implemented features as of June 30, 2026.

**Core Form**
- ✓ Technician selector (tap, no typing)
- ✓ Visit date field with future-date validation
- ✓ Visit type card selector (Inspection, Demo, Mitigation, Monitoring, Pickup/Completion, Other)
- ✓ Job status selector
- ✓ Work Performed (required text field)
- ✓ Technician Notes (optional)
- ✓ X1 Sketch Provided checkbox
- ✓ Waiting On selector
- ✓ Form resets fully after successful submission

**Job Selection**
- ✓ Live search across all active claims
- ✓ Default view shows 10 most recent (by EOJ date) active claims
- ✓ Search shows all matching results, no cap
- ✓ Claim ID shown on job cards to distinguish duplicate customer names
- ✓ Auto-excludes terminal lifecycle states (Operationally Complete, Not Sold)

**Equipment Tracking**
- ✓ Air Movers, Dehumidifiers, HEPA/Air Scrubbers
- ✓ Before / Added / Removed / After counts per type
- ✓ Before values auto-loaded from most recent EOJ for the same claim
- ✓ After count auto-calculated, cannot go below zero
- ✓ Equipment persistence reads Error rows (equipment data is valid even if processing errored)

**Mitigate (MICA) Section**
- ✓ Shown on all visit types
- ✓ Was Mitigate updated? (Yes / No radio)
- ✓ If No: reason selector + expected update date/time
- ✓ Internal field names use MICA prefix; all user-visible text says "Mitigate"

**Mitigation Plan Updated**
- ✓ Checkbox shown on every visit type
- ✓ Recorded as boolean in EOJ_Log (`Mitigation_Plan_Updated`)

**Asbestos Section**
- ✓ Test needed? (Yes / No / Not Sure)
- ✓ Number of samples taken (numeric input)
- ✓ Processing engine generates timeline event and alert when flagged

**Monitoring Section**
- ✓ Shown on Monitoring visit type
- ✓ Monitoring status selector
- ✓ Next monitoring date field
- ✓ Processing engine flags missing date as review issue

**Office Follow-Up**
- ✓ Toggle (shown when enabled)
- ✓ Action buttons: Call adjuster, Send documents, Schedule re-inspection, Contact customer, Escalate to management, Other
- ✓ Assignee selector: Julia or Clarence
- ✓ Follow-up note field
- ✓ Todoist task created automatically on processing
- ✓ Alert written to Claims Database

**Temporary EOJs**
- ✓ Create a temp job when claim isn't in the system yet
- ✓ Carrier and loss type fields
- ✓ Temp job entry persists in session for submission
- ✓ `Pending_Claim_Link = 'Pending'` written to EOJ_Log
- ✓ `linkClaimToTempEoj()` available for retroactive linking

**Job History Tab**
- ✓ Full active claim search
- ✓ Job cards show Claim ID, claim number, and address to distinguish duplicates
- ✓ Claim detail view: lifecycle state, loss type, primary owner
- ✓ EOJ history: up to 10 most recent, visit type, date, technician, status, work summary, Mitigate status, follow-up action, equipment After counts

**EOJ Processing Engine**
- ✓ 15-minute time trigger
- ✓ Header-based column mapping throughout
- ✓ Raw JSON fallback scan for column drift resilience
- ✓ ClaimsBridge writes (Timeline Events, Conditions, Alerts, Claim timestamps, Service Log)
- ✓ Condition deduplication (no duplicate Open conditions per claim per type)
- ✓ Todoist task creation for follow-up actions
- ✓ Google Chat notification on every processed EOJ
- ✓ All downstream failures non-fatal; row still marked Processed

**Mobile / PWA**
- ✓ PWA manifest served at `?manifest=1`
- ✓ Add to Home Screen support (iOS Safari and Android Chrome)
- ✓ Standalone display mode (no browser chrome when launched from home screen)
- ✓ Rainbow navy theme color
- ✓ Full-width layout on iPhone inside GAS iframe (1100px breakpoint override)
- ✓ Rainbow Restoration logo loaded as base64 data URI

---

## 17. Future Roadmap

These features were intentionally deferred. None of the architecture described above needs to be redesigned to support them.

**Technician Workspace** — a dedicated view for technicians to see all their jobs, upcoming visits, equipment currently on site per claim, and their EOJ history.

**Scheduling and follow-up visits** — ability to schedule the next visit from within the EOJ app, feeding into a job calendar.

**Calendar integration** — viewing and creating calendar events for visits, monitoring checks, and equipment pickups.

**Maps and navigation** — one-tap navigation to job site from the EOJ app or Technician Workspace.

**Customer communication** — templated customer-facing messages triggered by EOJ events (e.g., "Your moisture readings are improving. Estimated pickup in 3 days.").

**Claim timeline viewer** — technician-facing view of the full timeline for a claim, not just EOJ history.

**Equipment dashboard** — aggregate view of all equipment currently deployed across all active claims.

**Documents and photos** — attachment support on EOJ submissions (currently text-only).

**Photo documentation** — before/after photos associated with specific EOJ events.

**Offline support** — service worker and local storage to allow EOJ form completion without connectivity, with sync on reconnect.

**App hosting outside Google Apps Script** — migration to a standalone hosted app (React, Firebase, or similar) to eliminate the GAS iframe viewport constraints and Google account banner. The EOJ_Log schema and processing engine architecture are designed to be hosting-agnostic.

---

*End of document. For deployment history and sprint notes, see `build-log.md` in the `eoj-app` directory.*
