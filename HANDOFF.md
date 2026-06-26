# Rainbow Claims System — Handoff Document
Generated: 2026-06-26

---

## Project overview

Multi-project Google Apps Script system for managing insurance claims. Three separate GAS runtimes — they cannot call each other's functions.

| Project | Purpose |
|---|---|
| `insurance-intake-automation` | Gmail trigger — processes incoming insurance emails, creates Drive folders, saves external links |
| `claims-service` | Claim Foundation — canonical Claims sheet, External_Links sheet, timeline, enrichment |
| `automation-dashboard` | Dashboard / web app UI |
| `eoj-processing-engine` | End-of-job processing |

All projects share the same Google Spreadsheet (Claim Foundation) via `CLAIMS_DATABASE_SPREADSHEET_ID = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c'`.

---

## Key technical concepts

### External_Links dual schema
The `External_Links` sheet is written by **two separate runtimes** in two incompatible formats:

**Wide-format rows** (written by `insurance-intake-automation`):
- One row per claim/job
- Columns: `Claim ID`, `Job Number`, `Claim Number` *(new)*, `Fusion URL`, `Drive Folder`, `XactAnalysis`, `Symbility`, `ClaimX`
- Row matched by: `Claim ID` OR `Job Number` OR `Claim Number` against `Job Number`

**Normalized rows** (written by `claims-service`):
- One row per link
- Columns: `External_Link_ID`, `Claim_ID`, `Link_Type`, `URL`, `Label`, `Created_At`, etc.

`ClaimExternalLinkService` in `claims-service` reads both formats.

### Normalization functions
- `normalizeElhName_(value)` — `.toLowerCase().replace(/[^a-z0-9]/g, '')` — used for header-resilient column matching. `'Claim Number'` → `'claimnumber'`
- `normalizeElhKey_(value)` — `.trim().toUpperCase().replace(/\s+/g, '')` — used for identifier comparison
- `normalizeLookupKey_(value)` (in ReportImportService) — same as `normalizeElhKey_`

### Fallback Claim_Number detection
A Claim_Number is a "fallback" (not a real insurance claim number) when:
```javascript
var isFallback = !currentClaimNumber || (normalizeElhKey_(currentClaimNumber) === normalizeElhKey_(jobNumber));
```
This catches: blank, exact match, case differences, and whitespace differences.

### Stable Claim_ID format
`CLM-{SUFFIX}` where suffix is the Job_Number (preferred) or Claim_Number, sanitized to `[A-Z0-9-]` with consecutive hyphens collapsed. Derived by `deriveStableClaimId_(jobNumber, claimNumber)` in `ClaimService.js`.

### Sheet row number formula
`headerRowIndex (0-based) + 2 + relativeIndex (0-based from first data row)` = 1-based sheet row number.

---

## Files modified in this session

### `insurance-intake-automation/Code.js`
**New functions added:**
- `isRealIntakeClaimNumber_(claimNumber, rainbowJobNumber)` — returns false if claimNumber is blank or equals rainbowJobNumber (fallback guard). Uses `.toUpperCase().replace(/\s+/g, '')` normalization.
- `ensureExternalLinksClaimNumberColumn()` — standalone setup function. Opens External_Links, checks whether `Claim Number` header exists, appends it to row 1 if missing. Idempotent. Returns `{ success, status, claimNumberColumn, headersBefore, headersAfter }`.
- `previewExternalLinksClaimNumberColumn()` — diagnostic. Logs column presence, index, all headers, first 5 data rows.
- `testInsuranceIntakeClaimNumberPersistence()` — 7 in-memory test cases for `isRealIntakeClaimNumber_`. No sheet access.

**Functions modified:**
- `buildInsuranceIntakeExternalLinkColumnMap_(headers)` — added `claimNumber: normalized.indexOf('claim number')` to the returned map.
- `upsertInsuranceIntakeWideExternalLinks_(sheet, claimData, linksToSave)` — now:
  1. Auto-ensures `Claim Number` column header on the sheet (idempotent inline check)
  2. Calls `isRealIntakeClaimNumber_(claimNumber, jobNumber)` before any write
  3. On new row: includes `claimNumber` in the appended row if real
  4. On existing row: writes `claimNumber` to blank `Claim Number` cell only if real
  5. Returns additional diagnostic fields: `claimNumberWritten`, `claimNumberSkippedReason`

**Key behavior:** `parseInsuranceIntakeThread()` sets `claimNumber = fusionJobNumber` as fallback when no real claim number is found. The new code checks for this and never writes that fallback value into the `Claim Number` column.

---

### `claims-service/ExternalLinkService.js`
**New functions added (at end, before test functions):**
- `previewEnrichClaimNumbersFromExternalLinks()` — dry-run
- `enrichClaimNumbersFromExternalLinks()` — apply (writes only `Claim_Number` cells)
- `runEnrichClaimNumbersFromExternalLinks_(dryRun)` — core logic:
  1. Reads External_Links once. Builds `jobNumber → claimNumber` map from the `Claim Number` column. Skips EL entries where Claim Number is blank or equals Job Number. Detects conflicts (two EL rows for same Job_Number with different Claim Numbers).
  2. Reads Claims once. For each row: requires Job_Number, confirms current Claim_Number is blank or fallback, checks EL map, proposes update.
  3. Writes only `Claim_Number` cell per eligible row. Single `flush()` at end.

**Return object fields:**
```
claimsChecked, fallbackClaimNumbersFound,
externalLinkRowsChecked, jobNumbersWithStoredClaimNumbers,
eligibleUpdates, conflicts, rowsUpdated,
skippedNoJobNumber, skippedNotFallback, skippedNoElRow, skippedConflict,
sampleProposals (first 10: claimId, jobNumber, currentClaimNumber, proposedClaimNumber, customerName)
```

**Previously added to this file (prior session):**
- `normalizeElhName_()`, `findElhHeaderRowIndex_()`, `buildElhColumnIndexMap_()`, `normalizeElhKey_()`
- `associateClaimIdToExternalLinkRows(claimId, jobNumber, claimNumber, dryRun)` — writes Claim_ID to blank External_Links cells matching by Job_Number or Claim_Number
- `previewBackfillExternalLinkClaimIds()` / `backfillExternalLinkClaimIds()` → `runExternalLinkClaimIdBackfill_(dryRun)` — batch backfill of Claim_ID onto wide-format EL rows

---

### `claims-service/ClaimService.js`
**Added in prior session:**
- `sanitizeClaimIdSuffix_(value)` — strips non-`[A-Z0-9-]` chars, collapses hyphens
- `deriveStableClaimId_(jobNumber, claimNumber)` — returns `'CLM-' + suffix` preferring Job_Number
- `buildClaimsColumnMap_(values)` — header-resilient column map for Claims sheet: `{ claimId, claimNumber, jobNumber, customerName }`
- `previewBackfillMissingClaimIds()` / `backfillMissingClaimIds()` → `runClaimIdBackfill_(dryRun)` — fills blank Claim_ID cells on Claims rows using stable derived IDs. Collision detection against existing IDs and within-run proposals.

---

### `claims-service/ReportImportService.js`
**Added in prior session:**
- `previewEnrichBootstrappedClaimNumbersFromDailyOpenJobs()` / `enrichBootstrappedClaimNumbersFromDailyOpenJobs()` → `runBootstrappedClaimNumberEnrichment_(dryRun)`
  - Loads Daily Open Jobs XLSX via `getLatestReportImportFile()` → `convertXlsxToGoogleSheet_()` → `readReportSheetRows_()`
  - Builds conflict-aware `job_number → claim_number` index from report
  - For each Claims row where Claim_Number is blank or equals Job_Number: updates from report if report has a different value
  - Seven safety guards (blank job number, not fallback, no report row, blank report claim number, report claim number equals job number, conflict, never touch Claim_ID)
  - Always calls `cleanupConvertedReportSheet_()` in `finally`

---

## Complete run order (all enrichment functions)

Run in this sequence to fully enrich a claims dataset:

```
// Step 1 — fill blank Claim_IDs on Claims rows (ClaimService.js)
previewBackfillMissingClaimIds()
backfillMissingClaimIds()

// Step 2 — update fallback Claim_Numbers from Daily Open Jobs report (ReportImportService.js)
previewEnrichBootstrappedClaimNumbersFromDailyOpenJobs()
enrichBootstrappedClaimNumbersFromDailyOpenJobs()

// Step 3 — update fallback Claim_Numbers from External_Links.Claim Number (ExternalLinkService.js)
previewEnrichClaimNumbersFromExternalLinks()
enrichClaimNumbersFromExternalLinks()

// Step 4 — backfill Claim_ID onto wide-format External_Links rows (ExternalLinkService.js)
previewBackfillExternalLinkClaimIds()
backfillExternalLinkClaimIds()
```

Steps 3 and 4 depend on `insurance-intake-automation` having processed real intake emails under the new logic (which persists `Claim Number` into External_Links). If `eligibleUpdates = 0` in step 3, that is expected until intake emails are processed.

---

## Setup / first-time deploy checklist for insurance-intake-automation

Run these once in the Apps Script editor (insurance-intake-automation project) before processing live threads:

```
ensureExternalLinksClaimNumberColumn()   // adds Claim Number header to External_Links
previewExternalLinksClaimNumberColumn()  // confirm column is present
testInsuranceIntakeClaimNumberPersistence()  // confirm 7/7 cases pass
```

---

## Sheet schema

### Claims sheet (CLAIM_SHEET_NAMES.claims = 'Claims')
Relevant columns: `Claim_ID`, `Claim_Number`, `Job_Number`, `Customer_Name`, `Property_Address`, `Carrier`, ...

### External_Links sheet (CLAIM_SHEET_NAMES.externalLinks = 'External_Links')
Wide-format rows (written by insurance-intake-automation):
- `Claim ID` / `claim id`
- `Job Number` / `job number`
- `Claim Number` / `claim number` ← **new column, added this session**
- `Fusion URL`, `Drive Folder`, `XactAnalysis`, `Symbility`, `ClaimX`

Normalized rows (written by claims-service): `External_Link_ID`, `Claim_ID`, `Link_Type`, `URL`, `Label`, `Created_At`, `Updated_At`, `Notes`

---

## Key config

```javascript
// claims-service/Config.js
const CLAIMS_DATABASE_SPREADSHEET_ID = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';

const CLAIM_SHEET_NAMES = {
  claims:        'Claims',
  externalLinks: 'External_Links',
  // ...
};
```

```javascript
// insurance-intake-automation — spreadsheet ID resolved by:
getInsuranceIntakeClaimFoundationSpreadsheetId_()
// checks script properties: RAINBOW_CLAIM_FOUNDATION_SPREADSHEET_ID,
// CLAIM_FOUNDATION_SPREADSHEET_ID, RAINBOW_CLAIMS_DATABASE_SPREADSHEET_ID,
// CONFIG.claimFoundationSpreadsheetId, then falls back to hardcoded ID above
```

---

## What has NOT been done (advisory)

1. **Backfill of Claim_Number from External_Links into historical Claims rows** — now implemented (`enrichClaimNumbersFromExternalLinks`), but will only have data to work with once intake emails are processed under the new logic.

2. **Connecting `processInsuranceIntake()` to `processIntakeClaim()` in claims-service** — these two pipelines are fully parallel with no connection. `IntakeIntegrationService.processIntakeClaim()` exists but is never called from `insurance-intake-automation`. This was intentionally out of scope for this session.

3. **Backfill of existing External_Links rows' `Claim Number` cells** — the new column exists and future intake will populate it, but historical wide-format rows written before this deploy will have the `Claim Number` cell blank. A separate one-time backfill from Gmail history or another source would be needed if historical enrichment is desired.

---

## Brace balance verification (all modified files)

| File | Open | Close | Balance |
|---|---|---|---|
| `insurance-intake-automation/Code.js` | 173 | 173 | 0 ✓ |
| `claims-service/ExternalLinkService.js` | 150 | 150 | 0 ✓ |
| `claims-service/ClaimService.js` | 158 | 158 | 0 ✓ |
| `claims-service/ReportImportService.js` | 270 | 270 | 0 ✓ |
