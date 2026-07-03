# Claims Database Write Map

Generated: 2026-07-03
Scope: local source inspection of `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/`.
Claims Database ID: `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`.

## Executive Summary

Local source confirms multiple Apps Script projects can write to the same Claims Database:

- `claims-service` is the broadest writer and the only project with an explicit Claims API surface: `doGet`/`doPost` route actions such as `createClaim`, `updateClaim`, `appendTimelineEvent`, `upsertCondition`, `createAlert`, `createFinancialTrack`, `attachExternalLink`, and `processEojOutputs` (`apps-script-projects/claims-service/Code.js:8`, `apps-script-projects/claims-service/Code.js:67`, `apps-script-projects/claims-service/Code.js:118`). It also has a scheduled trigger setup for `runRainbowMorningAutomation` (`apps-script-projects/claims-service/MorningAutomationService.js:257`).
- `eoj-processing-engine` directly writes EOJ-derived results into `Timeline_Events`, `Claim_Conditions`, `Claim_Alerts`, `Claims`, and `Claim_Service_Log` through `writeEojToClaimsDatabase_` (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:4`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:69`). It has local trigger setup for `processUnprocessedEOJs` every 15 minutes (`apps-script-projects/eoj-processing-engine/Code.js:6`, `apps-script-projects/eoj-processing-engine/Code.js:12`).
- `claims-data-foundation` still contains bulk import writers against the Claims Database ID configured in `Config.js` (`apps-script-projects/claims-data-foundation/Config.js:3`). These writers can clear and repopulate production-named sheets such as `Claims`, `Timeline_Events`, `External_Links`, `Compliance_Actions`, and `Claim_Summaries` (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:337`). Local source shows these as manual/test-style entry functions; live trigger/deployment status still requires Apps Script UI verification.
- `insurance-intake-automation` writes `External_Links` during its `process` web action path (`apps-script-projects/insurance-intake-automation/Code.js:28`, `apps-script-projects/insurance-intake-automation/Code.js:31`, `apps-script-projects/insurance-intake-automation/Code.js:366`).
- `automation-dashboard` writes `External_Links` from dashboard UI server calls (`apps-script-projects/automation-dashboard/IntakeScripts.html:278`, `apps-script-projects/automation-dashboard/ClaimsScripts.html:1402`, `apps-script-projects/automation-dashboard/Code.js:1211`).
- `eoj-app` reads the Claims Database for lookup, but local write operations found in that project target the EOJ database, not the Claims Database (`apps-script-projects/eoj-app/Code.js:65`, `apps-script-projects/eoj-app/Code.js:372`).

Local source cannot prove which triggers or deployments are live today. Anything labeled `Trigger candidate`, `Web app candidate`, or `Manual/unknown` needs Apps Script UI verification before retirement or consolidation.

## Project Inventory Table

| Project | Purpose | Claims DB? | Read only? | Writes? | Sheets written | Entry functions | Reachable from | Risk level |
|---|---|---:|---:|---:|---|---|---|---|
| `claims-service` | Canonical Claims API, morning automation, claim intelligence | YES | NO | YES | `Claims`, `Timeline_Events`, `Claim_Conditions`, `Claim_Alerts`, `Financial_Tracks`, `External_Links`, `Claim_Ownership_History`, `Claim_Health_History`, `Claim_Service_Log`, `Alert_Rules`, `Timeline_Rules`, `Condition_Audit`, legacy `Claim_Timeline` | `doGet`, `doPost`, `runRainbowMorningAutomation`, maintenance functions | Web app/API, trigger candidate, manual maintenance | Core production |
| `eoj-processing-engine` | Processes EOJ rows and bridges EOJ output into Claims DB | YES | NO | YES | `Timeline_Events`, `Claim_Conditions`, `Claim_Alerts`, `Claims`, `Claim_Service_Log` | `processUnprocessedEOJs`, `writeEojToClaimsDatabase_`, `runPhase35ClaimsSnapshotMigration` | Trigger candidate, manual migration | Core production / duplicate writer |
| `claims-data-foundation` | Legacy/import foundation builders and summaries | YES | NO | YES | `Claims`, `Timeline_Events`, `Claim_Crosswalk`, `External_Links`, `Import_Log`, `Compliance_Actions`, `Claim_Summaries` | `testWrite*`, `testClassifyTimelineEvents`, `testEnrichClaimsWithComplianceAddresses` | Manual/unknown in local source | Legacy / high-risk if live |
| `insurance-intake-automation` | Insurance email intake, folder/task creation, external link persistence | YES | NO | YES | `External_Links` | `doGet?action=process` -> `processInsuranceIntake` | Web app candidate; retry trigger code exists for retry processors | Core intake workflow / duplicate writer |
| `automation-dashboard` | Dashboard/home/intake workspace UI | YES | NO | YES | `External_Links` | `saveIntakeOperationalLink` | Dashboard UI / web app candidate | Operational duplicate writer |
| `eoj-app` | EOJ submission UI | YES | YES for Claims DB | NO to Claims DB | none in Claims DB; writes `EOJ_Log` in EOJ database | `doGet`, `setupEOJLogSheet`, `repairEOJLogColumns` | Web app for EOJ UI | Claims read-only |
| `apps-script-dashboard` | Dashboard registry/status | NO direct Claims DB ID found | N/A | NO to Claims DB | none | `doGet` | Web app | Out of Claims write scope |
| `historical-notes-sync` | Historical notes sync spreadsheet | NO direct Claims DB ID found | N/A | NO to Claims DB | none | `runDailyHistoricalNotesSyncWithLog` | Trigger candidate | Out of Claims write scope |
| `revision-intake-automation` | Revision intake staging/automation | NO direct Claims DB ID found | N/A | NO to Claims DB | none | `doGet` and revision functions | Web app/trigger candidates | Out of Claims write scope |
| Other project folders | Calendar/new-job/docs/test utilities | NO direct Claims DB ID found | N/A | NO to Claims DB | none | varies | varies | Out of Claims write scope |

## Confirmed Local Evidence

### `claims-service`

Claims Database identity and sheet names are configured in `Config.js`: `CLAIM_FOUNDATION_SPREADSHEET_ID` and `CLAIMS_DATABASE_SPREADSHEET_ID` both point to the Claims Database (`apps-script-projects/claims-service/Config.js:6`, `apps-script-projects/claims-service/Config.js:7`), and `CLAIM_SHEET_NAMES` defines core sheet names (`apps-script-projects/claims-service/Config.js:53`). Low-level writers are centralized in `SheetService.js`: `getClaimFoundationSpreadsheet_` opens the database (`apps-script-projects/claims-service/SheetService.js:5`), `appendRow` calls `sheet.appendRow(values)` (`apps-script-projects/claims-service/SheetService.js:62`, `apps-script-projects/claims-service/SheetService.js:67`), and `updateRowByKey` writes a full row with `setValues` (`apps-script-projects/claims-service/SheetService.js:91`, `apps-script-projects/claims-service/SheetService.js:118`). `writeServiceLog` appends to `Claim_Service_Log` (`apps-script-projects/claims-service/SheetService.js:151`).

API entry paths:

- `doGet` and `doPost` route through `routeClaimServiceRequest_` (`apps-script-projects/claims-service/Code.js:8`, `apps-script-projects/claims-service/Code.js:67`, `apps-script-projects/claims-service/Code.js:71`).
- `createClaim` action writes `Claims` via `createClaim` -> `appendRow(CLAIM_SHEET_NAMES.claims, claim)` (`apps-script-projects/claims-service/Code.js:118`, `apps-script-projects/claims-service/ClaimService.js:8`, `apps-script-projects/claims-service/ClaimService.js:83`).
- `updateClaim` action writes `Claims` via `updateRowByKey` (`apps-script-projects/claims-service/Code.js:121`, `apps-script-projects/claims-service/ClaimService.js:99`, `apps-script-projects/claims-service/ClaimService.js:116`).
- `appendTimelineEvent` and `createClaimActivityEvent` write `Timeline_Events`; `appendTimelineEvent` also may update `Claims.Last_Meaningful_Activity_At` (`apps-script-projects/claims-service/Code.js:124`, `apps-script-projects/claims-service/Code.js:127`, `apps-script-projects/claims-service/TimelineService.js:7`, `apps-script-projects/claims-service/TimelineService.js:20`, `apps-script-projects/claims-service/TimelineService.js:22`).
- `upsertCondition`/condition paths write `Claim_Conditions`, then may update `Claims`, append timeline, and service log (`apps-script-projects/claims-service/Code.js:135`, `apps-script-projects/claims-service/ConditionService.js:6`, `apps-script-projects/claims-service/ConditionService.js:51`, `apps-script-projects/claims-service/ConditionService.js:53`, `apps-script-projects/claims-service/ConditionService.js:67`). Manual test helpers also append conditions (`apps-script-projects/claims-service/ConditionService.js:264`, `apps-script-projects/claims-service/ConditionService.js:293`).
- Alert actions write `Claim_Alerts`, update `Claims`, append `Timeline_Events`, and service log (`apps-script-projects/claims-service/Code.js:141`, `apps-script-projects/claims-service/AlertService.js:51`, `apps-script-projects/claims-service/AlertService.js:85`, `apps-script-projects/claims-service/AlertService.js:87`, `apps-script-projects/claims-service/AlertService.js:91`). Resolve/dismiss paths update `Claim_Alerts` (`apps-script-projects/claims-service/AlertService.js:116`, `apps-script-projects/claims-service/AlertService.js:123`, `apps-script-projects/claims-service/AlertService.js:143`, `apps-script-projects/claims-service/AlertService.js:151`, `apps-script-projects/claims-service/AlertService.js:229`).
- Financial actions write `Financial_Tracks`, then append timeline/service log; updates use `updateRowByKey` (`apps-script-projects/claims-service/Code.js:162`, `apps-script-projects/claims-service/FinancialTrackService.js:11`, `apps-script-projects/claims-service/FinancialTrackService.js:74`, `apps-script-projects/claims-service/FinancialTrackService.js:104`, `apps-script-projects/claims-service/FinancialTrackService.js:112`).
- External link actions write `External_Links`, then append timeline/service log; updates use `updateRowByKey` (`apps-script-projects/claims-service/Code.js:168`, `apps-script-projects/claims-service/ExternalLinkService.js:8`, `apps-script-projects/claims-service/ExternalLinkService.js:33`, `apps-script-projects/claims-service/ExternalLinkService.js:92`, `apps-script-projects/claims-service/ExternalLinkService.js:100`).
- `processEojOutputs` action writes through claims-service services: timeline, conditions, alerts, ownership history, claims snapshot fields, and service log (`apps-script-projects/claims-service/Code.js:171`, `apps-script-projects/claims-service/EojIntegrationService.js:10`, `apps-script-projects/claims-service/EojIntegrationService.js:23`, `apps-script-projects/claims-service/EojIntegrationService.js:28`, `apps-script-projects/claims-service/EojIntegrationService.js:37`, `apps-script-projects/claims-service/EojIntegrationService.js:46`, `apps-script-projects/claims-service/EojIntegrationService.js:57`, `apps-script-projects/claims-service/EojIntegrationService.js:62`).
- Ownership writes `Claim_Ownership_History`, updates `Claims`, appends timeline, and logs service activity (`apps-script-projects/claims-service/OwnershipService.js:8`, `apps-script-projects/claims-service/OwnershipService.js:34`, `apps-script-projects/claims-service/OwnershipService.js:57`, `apps-script-projects/claims-service/OwnershipService.js:59`, `apps-script-projects/claims-service/OwnershipService.js:64`). No direct `Code.js` action was found for `setOwnership`; local reachability is through `processEojOutputs` and service calls.

Scheduled/morning paths:

- `createRainbowMorningAutomationTrigger` creates a daily trigger for `runRainbowMorningAutomation` (`apps-script-projects/claims-service/MorningAutomationService.js:257`, `apps-script-projects/claims-service/MorningAutomationService.js:259`).
- `runRainbowMorningAutomation` calls `runMorningDataRefresh` and `runMorningIntelligence` (`apps-script-projects/claims-service/MorningAutomationService.js:57`, `apps-script-projects/claims-service/MorningAutomationService.js:60`, `apps-script-projects/claims-service/MorningAutomationService.js:61`).
- Data refresh calls `importLatestDailyOpenJobsReport`, `reconcileDailyOpenJobsRemovedClaims`, `importNewHistoricalNotes`, and `synchronizeClaimsFoundation` (`apps-script-projects/claims-service/MorningAutomationService.js:104`, `apps-script-projects/claims-service/MorningAutomationService.js:109`, `apps-script-projects/claims-service/MorningAutomationService.js:123`, `apps-script-projects/claims-service/MorningAutomationService.js:128`).
- `reconcileDailyOpenJobsRemovedClaims` opens Claims and writes full claim rows with `setValues`, then appends removal timeline events (`apps-script-projects/claims-service/ReportImportService.js:676`, `apps-script-projects/claims-service/ReportImportService.js:691`, `apps-script-projects/claims-service/ReportImportService.js:802`, `apps-script-projects/claims-service/ReportImportService.js:808`).
- `synchronizeClaimsFoundation` calls repair/enrichment/backfill steps that write Claims and External_Links (`apps-script-projects/claims-service/ClaimSynchronizationService.js:80`, `apps-script-projects/claims-service/ClaimSynchronizationService.js:119`, `apps-script-projects/claims-service/ClaimSynchronizationService.js:138`, `apps-script-projects/claims-service/ClaimSynchronizationService.js:156`, `apps-script-projects/claims-service/ClaimSynchronizationService.js:178`, `apps-script-projects/claims-service/ClaimSynchronizationService.js:199`, `apps-script-projects/claims-service/ClaimSynchronizationService.js:218`). Supporting writes include customer-name repair (`apps-script-projects/claims-service/ReportImportService.js:1462`), claim-number enrichment (`apps-script-projects/claims-service/ReportImportService.js:1714`), External_Links Claim_ID backfill (`apps-script-projects/claims-service/ExternalLinkService.js:491`), Claims claim-number enrichment from External_Links (`apps-script-projects/claims-service/ExternalLinkService.js:721`), and Claims carrier enrichment from External_Links (`apps-script-projects/claims-service/ExternalLinkService.js:933`).
- `importNewHistoricalNotes` appends new rows to `Timeline_Events` (`apps-script-projects/claims-service/HistoricalNotesImportService.js:15`, `apps-script-projects/claims-service/HistoricalNotesImportService.js:314`).
- Timeline intelligence opens Claims and Timeline, then writes `Claims.Last_Meaningful_Activity_At` and `Claims.Last_Revision_At` in batches (`apps-script-projects/claims-service/TimelineEngineService.js:587`, `apps-script-projects/claims-service/TimelineEngineService.js:827`, `apps-script-projects/claims-service/TimelineEngineService.js:855`).
- Health intelligence writes Claims health fields and appends `Claim_Health_History` (`apps-script-projects/claims-service/HealthEngineService.js:409`, `apps-script-projects/claims-service/HealthEngineService.js:464`, `apps-script-projects/claims-service/HealthEngineService.js:1191`, `apps-script-projects/claims-service/HealthEngineService.js:1220`).

Maintenance/manual paths:

- `migrateClaimTimelinePhase5Columns` writes header columns to legacy `Claim_Timeline` (`apps-script-projects/claims-service/Code.js:12`, `apps-script-projects/claims-service/Code.js:14`, `apps-script-projects/claims-service/Code.js:56`).
- Schema helpers can create sheets/headers and delete blank condition rows (`apps-script-projects/claims-service/SheetService.js:169`, `apps-script-projects/claims-service/SheetService.js:202`, `apps-script-projects/claims-service/SheetService.js:215`, `apps-script-projects/claims-service/SheetService.js:268`).
- `syncClaimHealthToClaimsDatabase` writes health fields into Claims (`apps-script-projects/claims-service/ClaimsDatabaseSyncService.js:7`, `apps-script-projects/claims-service/ClaimsDatabaseSyncService.js:39`). Because this project points both foundation and database constants to the same spreadsheet, this is a same-spreadsheet health sync in local source (`apps-script-projects/claims-service/Config.js:6`, `apps-script-projects/claims-service/Config.js:7`).

### `eoj-processing-engine`

`ClaimsBridge.js` hardcodes the Claims Database ID (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:38`) and declares it writes `Timeline_Events`, `Claim_Conditions`, `Claim_Alerts`, `Claims`, and `Claim_Service_Log` (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:7`). The processing trigger setup creates a time-based trigger for `processUnprocessedEOJs` every 15 minutes (`apps-script-projects/eoj-processing-engine/Code.js:6`, `apps-script-projects/eoj-processing-engine/Code.js:12`). The processing path calls `writeEojToClaimsDatabase_` after interpreting EOJ rows (`apps-script-projects/eoj-processing-engine/Code.js:41`, `apps-script-projects/eoj-processing-engine/Code.js:54`, `apps-script-projects/eoj-processing-engine/Code.js:65`).

Write chain:

- `processUnprocessedEOJs` -> `writeEojToClaimsDatabase_` -> open Claims DB (`apps-script-projects/eoj-processing-engine/Code.js:65`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:69`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:88`).
- `Timeline_Events`: `appendByHeaderMap_` writes each event with `setValues` (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:92`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:96`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:650`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:658`).
- `Claim_Conditions`: appends new condition rows and updates existing monitoring follow-up dates (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:107`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:121`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:127`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:413`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:415`).
- `Claim_Alerts`: appends alert rows (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:139`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:147`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:154`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:162`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:172`).
- `Claims`: updates EOJ/MICA snapshot fields with `setValue` (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:185`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:187`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:371`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:373`).
- `Claim_Service_Log`: appends service log row (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:197`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:200`).
- Manual migration `runPhase35ClaimsSnapshotMigration` writes Claims header cells (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:441`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:442`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:469`).

### `claims-data-foundation`

`Config.js` points `CONFIG.database.spreadsheetId` at the Claims Database (`apps-script-projects/claims-data-foundation/Config.js:3`). `Code.js` contains `runReportIntake`, but that path locally calls email/file intake functions, not the write functions listed below (`apps-script-projects/claims-data-foundation/Code.js:1`, `apps-script-projects/claims-data-foundation/Code.js:4`). Confirmed Claims DB write entry points are test/manual-style functions:

- `testWriteDailyNotesIdentityTables` -> `writeClaimCrosswalk_`, `writeExternalLinks_`, `appendImportLog_` (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:199`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:215`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:216`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:217`). These open the Claims DB and write `Claim_Crosswalk`, `External_Links`, and `Import_Log` (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:233`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:262`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:268`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:296`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:302`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:315`). `clearDataRows_` clears content below row 2 before bulk writes (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:329`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:337`).
- `testWriteDailyNotesClaims` -> `writeClaimsFromDailyNotes_` clears and repopulates `Claims` (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:340`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:356`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:373`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:381`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:392`).
- `testWriteComplianceActions` -> `writeComplianceActions_` clears and repopulates `Compliance_Actions`, then logs import (`apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:171`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:187`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:203`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:211`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:233`).
- `testEnrichClaimsWithComplianceAddresses` opens `Claims` and `Compliance_Actions`, then rewrites Claims rows with address data (`apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:274`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:275`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:288`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:323`).
- `testWriteHistoricalNotesTimelineEvents` -> `writeHistoricalNotesTimelineEvents_` clears and repopulates `Timeline_Events`, then logs import (`apps-script-projects/claims-data-foundation/HistoricalNotesImportService.js:215`, `apps-script-projects/claims-data-foundation/HistoricalNotesImportService.js:225`, `apps-script-projects/claims-data-foundation/HistoricalNotesImportService.js:241`, `apps-script-projects/claims-data-foundation/HistoricalNotesImportService.js:249`, `apps-script-projects/claims-data-foundation/HistoricalNotesImportService.js:271`).
- `testWriteClaimSummaries` -> `writeClaimSummaries_` clears and repopulates `Claim_Summaries` (`apps-script-projects/claims-data-foundation/ClaimSummaryService.js:79`, `apps-script-projects/claims-data-foundation/ClaimSummaryService.js:84`, `apps-script-projects/claims-data-foundation/ClaimSummaryService.js:89`, `apps-script-projects/claims-data-foundation/ClaimSummaryService.js:97`, `apps-script-projects/claims-data-foundation/ClaimSummaryService.js:120`).
- `testClassifyTimelineEvents` rewrites `Timeline_Events` rows with classification values (`apps-script-projects/claims-data-foundation/TimelineIntelligenceService.js:44`, `apps-script-projects/claims-data-foundation/TimelineIntelligenceService.js:52`, `apps-script-projects/claims-data-foundation/TimelineIntelligenceService.js:58`, `apps-script-projects/claims-data-foundation/TimelineIntelligenceService.js:82`).

### `insurance-intake-automation`

`doGet?action=process` routes to `processInsuranceIntake` (`apps-script-projects/insurance-intake-automation/Code.js:28`, `apps-script-projects/insurance-intake-automation/Code.js:31`, `apps-script-projects/insurance-intake-automation/Code.js:186`). During processing, after claim folder map append, it calls `saveInsuranceIntakeExternalLinks_` (`apps-script-projects/insurance-intake-automation/Code.js:360`, `apps-script-projects/insurance-intake-automation/Code.js:366`).

Write chain:

- `saveInsuranceIntakeExternalLinks_` gets the Claims DB ID from script properties/config with a hardcoded fallback to the Claims Database (`apps-script-projects/insurance-intake-automation/Code.js:477`, `apps-script-projects/insurance-intake-automation/Code.js:489`, `apps-script-projects/insurance-intake-automation/Code.js:580`, `apps-script-projects/insurance-intake-automation/Code.js:587`).
- It opens the spreadsheet and gets `External_Links` (`apps-script-projects/insurance-intake-automation/Code.js:502`, `apps-script-projects/insurance-intake-automation/Code.js:503`).
- `upsertInsuranceIntakeWideExternalLinks_` writes missing `Claim Number`/`Carrier` headers (`apps-script-projects/insurance-intake-automation/Code.js:590`, `apps-script-projects/insurance-intake-automation/Code.js:609`, `apps-script-projects/insurance-intake-automation/Code.js:617`), appends a new row when no match exists (`apps-script-projects/insurance-intake-automation/Code.js:641`), writes link URLs (`apps-script-projects/insurance-intake-automation/Code.js:659`), writes claim number (`apps-script-projects/insurance-intake-automation/Code.js:674`), and writes carrier (`apps-script-projects/insurance-intake-automation/Code.js:692`).

### `automation-dashboard`

`HomepageDataService.js` hardcodes the same Claims Database ID for dashboard reads (`apps-script-projects/automation-dashboard/HomepageDataService.js:2`). `Code.js` uses `External_Links` for intake operational links (`apps-script-projects/automation-dashboard/Code.js:680`). The dashboard web app has `doGet` (`apps-script-projects/automation-dashboard/Code.js:717`). UI code calls `saveIntakeOperationalLink` from `IntakeScripts.html` and `ClaimsScripts.html` (`apps-script-projects/automation-dashboard/IntakeScripts.html:278`, `apps-script-projects/automation-dashboard/ClaimsScripts.html:1402`).

Write chain:

- `saveIntakeOperationalLink` validates the payload, gets the External_Links context, and calls `appendIntakeExternalLink_` (`apps-script-projects/automation-dashboard/Code.js:1211`, `apps-script-projects/automation-dashboard/Code.js:1246`, `apps-script-projects/automation-dashboard/Code.js:1278`).
- `getIntakeExternalLinksContext_` opens the Claims Database and gets `External_Links` (`apps-script-projects/automation-dashboard/Code.js:1977`, `apps-script-projects/automation-dashboard/Code.js:1978`, `apps-script-projects/automation-dashboard/Code.js:1979`).
- Normalized layout writes append a row (`apps-script-projects/automation-dashboard/Code.js:2285`, `apps-script-projects/automation-dashboard/Code.js:2349`). Wide layout writes an existing row cell or appends a row (`apps-script-projects/automation-dashboard/Code.js:2356`, `apps-script-projects/automation-dashboard/Code.js:2388`, `apps-script-projects/automation-dashboard/Code.js:2413`).
- After saving, it calls claims-service alert reconciliation through `fetchClaimsServiceJson_`, which is not a direct Claims DB write from this project but can trigger claims-service behavior (`apps-script-projects/automation-dashboard/Code.js:1303`, `apps-script-projects/automation-dashboard/Code.js:1327`).

### `eoj-app`

`eoj-app` references the Claims Database for read lookups (`apps-script-projects/eoj-app/Config.js:3`, `apps-script-projects/eoj-app/Code.js:65`, `apps-script-projects/eoj-app/Code.js:67`). Local write operations found in inspected evidence target the EOJ database (`CONFIG.EOJ_DATABASE_ID`), for example `setupEOJLogSheet` and `repairEOJLogColumns` (`apps-script-projects/eoj-app/Code.js:372`, `apps-script-projects/eoj-app/Code.js:380`, `apps-script-projects/eoj-app/Code.js:399`, `apps-script-projects/eoj-app/Code.js:416`). No local Claims DB write path was confirmed.

## Writer Matrix

| Claims Database sheet | Confirmed local writers | Writer count | Should there be one canonical writer? | Recommended canonical owner |
|---|---|---:|---:|---|
| `Claims` | `claims-service`, `eoj-processing-engine`, `claims-data-foundation` | 3 | YES | `claims-service` |
| `Timeline_Events` | `claims-service`, `eoj-processing-engine`, `claims-data-foundation` | 3 | YES | `claims-service` |
| `Claim_Conditions` | `claims-service`, `eoj-processing-engine` | 2 | YES | `claims-service` |
| `Claim_Alerts` | `claims-service`, `eoj-processing-engine` | 2 | YES | `claims-service` |
| `External_Links` | `claims-service`, `claims-data-foundation`, `insurance-intake-automation`, `automation-dashboard` | 4 | YES | Current: `insurance-intake-automation` + `automation-dashboard` + `claims-service`; future: `claims-service` API |
| `Financial_Tracks` | `claims-service` | 1 | YES | `claims-service` |
| `Claim_Ownership_History` | `claims-service` | 1 | YES | `claims-service` |
| `Claim_Health_History` | `claims-service` | 1 | YES | `claims-service` |
| `Claim_Service_Log` | `claims-service`, `eoj-processing-engine` | 2 | YES | `claims-service` |
| `Alert_Rules` | `claims-service` | 1 | YES | `claims-service` |
| `Timeline_Rules` | `claims-service` | 1 | YES | `claims-service` |
| `Condition_Audit` | `claims-service` | 1 | Optional | `claims-service` if retained |
| `Claim_Crosswalk` | `claims-data-foundation` | 1 | TBD | `claims-data-foundation` while legacy import retained; migrate to `claims-service` if production |
| `Compliance_Actions` | `claims-data-foundation` | 1 | TBD | `claims-data-foundation` while legacy import retained; migrate to `claims-service` if production |
| `Claim_Summaries` | `claims-data-foundation` | 1 | TBD | `claims-data-foundation` today; local claims-service comment says manual rebuild remains there (`apps-script-projects/claims-service/ClaimSynchronizationService.js:102`) |
| `Import_Log` | `claims-data-foundation` | 1 | TBD | Owner tied to legacy import system |
| legacy `Claim_Timeline` | `claims-service` maintenance migration only | 1 | No active writer found | Do not treat as canonical without schema verification |

## Duplicate Writers

Highest-risk duplicate writers by sheet:

1. `External_Links` has four local writers: claims-service API (`apps-script-projects/claims-service/ExternalLinkService.js:33`), claims-data-foundation bulk replace (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:296`), insurance intake upsert (`apps-script-projects/insurance-intake-automation/Code.js:641`), and automation dashboard operational link save (`apps-script-projects/automation-dashboard/Code.js:2349`). This is the largest collision surface.
2. `Claims` has three local writers: claims-service API/morning automation (`apps-script-projects/claims-service/ClaimService.js:83`, `apps-script-projects/claims-service/ReportImportService.js:805`), EOJ snapshot updates (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:373`), and claims-data-foundation bulk population/address enrichment (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:392`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:323`).
3. `Timeline_Events` has three local writers: claims-service (`apps-script-projects/claims-service/TimelineService.js:20`, `apps-script-projects/claims-service/HistoricalNotesImportService.js:314`), EOJ bridge (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:96`), and claims-data-foundation bulk historical import/classification (`apps-script-projects/claims-data-foundation/HistoricalNotesImportService.js:271`, `apps-script-projects/claims-data-foundation/TimelineIntelligenceService.js:82`).
4. `Claim_Conditions` has two local writers: claims-service (`apps-script-projects/claims-service/ConditionService.js:51`, `apps-script-projects/claims-service/ConditionEngineService.js:846`) and EOJ bridge (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:127`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:413`).
5. `Claim_Alerts` has two local writers: claims-service (`apps-script-projects/claims-service/AlertService.js:85`, `apps-script-projects/claims-service/AlertService.js:229`) and EOJ bridge (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:147`).
6. `Claim_Service_Log` has two local writers: claims-service (`apps-script-projects/claims-service/SheetService.js:151`) and EOJ bridge (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:200`).

## Unused Writers

These are not recommended for deletion here. They are write paths that appear manual, test-style, legacy, or superseded in local source and require live Apps Script verification before any retirement decision.

- `claims-data-foundation` bulk writers are named `testWrite...` or `testClassify...` and no local `doGet`, `doPost`, or `ScriptApp.newTrigger` route was found in the inspected evidence. They can still write production sheets if run manually (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:199`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:340`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:171`, `apps-script-projects/claims-data-foundation/HistoricalNotesImportService.js:215`, `apps-script-projects/claims-data-foundation/ClaimSummaryService.js:79`, `apps-script-projects/claims-data-foundation/TimelineIntelligenceService.js:44`).
- `claims-service` maintenance/test writers include legacy `Claim_Timeline` schema migration and direct test condition writes (`apps-script-projects/claims-service/Code.js:12`, `apps-script-projects/claims-service/ConditionService.js:264`, `apps-script-projects/claims-service/ConditionService.js:293`).
- `eoj-processing-engine` `runPhase35ClaimsSnapshotMigration` is a manual schema migration writer against `Claims` headers (`apps-script-projects/eoj-processing-engine/ClaimsBridge.js:441`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:469`).
- `claims-service` `syncClaimHealthToClaimsDatabase` appears to sync health from claim foundation to claims database, but local constants point both names at the same spreadsheet (`apps-script-projects/claims-service/ClaimsDatabaseSyncService.js:7`, `apps-script-projects/claims-service/ClaimsDatabaseSyncService.js:39`, `apps-script-projects/claims-service/Config.js:6`, `apps-script-projects/claims-service/Config.js:7`).

## Projects That Merely Read Claims Database

- `eoj-app` reads `Claims` for job lookup and writes only to the EOJ database in the inspected write paths (`apps-script-projects/eoj-app/Code.js:65`, `apps-script-projects/eoj-app/Code.js:67`, `apps-script-projects/eoj-app/Code.js:372`, `apps-script-projects/eoj-app/Code.js:380`).
- `automation-dashboard` reads the Claims Database broadly through `HomepageDataService.js`; its confirmed Claims DB write path is limited to `External_Links` in `Code.js` (`apps-script-projects/automation-dashboard/HomepageDataService.js:2`, `apps-script-projects/automation-dashboard/Code.js:1978`, `apps-script-projects/automation-dashboard/Code.js:2349`).
- `ClaimExternalLinkService.js` and `ClaimFinancialTrackService.js` inside `claims-service` read only in the inspected snippets (`apps-script-projects/claims-service/ClaimExternalLinkService.js:23`, `apps-script-projects/claims-service/ClaimFinancialTrackService.js:21`).

## Projects Requiring Manual Trigger Verification

Verify in Apps Script UI before retiring or centralizing:

- `claims-service`: whether a trigger for `runRainbowMorningAutomation` exists. Local setup code creates one (`apps-script-projects/claims-service/MorningAutomationService.js:257`, `apps-script-projects/claims-service/MorningAutomationService.js:259`).
- `eoj-processing-engine`: whether a trigger for `processUnprocessedEOJs` exists. Local setup code creates one every 15 minutes (`apps-script-projects/eoj-processing-engine/Code.js:6`, `apps-script-projects/eoj-processing-engine/Code.js:12`).
- `claims-data-foundation`: verify there are no active triggers for any `testWrite*`, `testClassifyTimelineEvents`, `testEnrichClaimsWithComplianceAddresses`, or other import writer function. Local source does not prove active triggers, but the functions remain capable of production writes.
- `insurance-intake-automation`: verify deployed web app and any retry triggers. Local `doGet?action=process` reaches Claims DB `External_Links` writes (`apps-script-projects/insurance-intake-automation/Code.js:31`, `apps-script-projects/insurance-intake-automation/Code.js:366`); retry trigger setup exists in `RetryWorkflow.js` (`apps-script-projects/insurance-intake-automation/RetryWorkflow.js:118`).

## Projects Requiring Manual Deployment Verification

- `claims-service`: verify current web deployment URL and deployed version because `doGet`/`doPost` expose write actions (`apps-script-projects/claims-service/Code.js:8`, `apps-script-projects/claims-service/Code.js:67`, `apps-script-projects/claims-service/Code.js:118`).
- `eoj-processing-engine`: verify whether it is deployed or only trigger-driven. The confirmed source write path is trigger-capable, not `doGet`/`doPost` based (`apps-script-projects/eoj-processing-engine/Code.js:41`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:69`).
- `insurance-intake-automation`: verify web app deployment because `doGet?action=process` reaches `External_Links` writes (`apps-script-projects/insurance-intake-automation/Code.js:28`, `apps-script-projects/insurance-intake-automation/Code.js:31`).
- `automation-dashboard`: verify dashboard web app deployment because client UI calls `saveIntakeOperationalLink` (`apps-script-projects/automation-dashboard/Code.js:717`, `apps-script-projects/automation-dashboard/IntakeScripts.html:278`, `apps-script-projects/automation-dashboard/ClaimsScripts.html:1402`).
- `claims-data-foundation`: verify whether any deployment exists. Local write entry points appear manual/test-style, but a deployment or installable trigger could still expose them.

## Projects That Write Claims Database

Confirmed direct local Claims Database writers:

- `claims-service`: core API and morning automation writer.
- `eoj-processing-engine`: direct EOJ bridge writer.
- `claims-data-foundation`: legacy/manual bulk import writer.
- `insurance-intake-automation`: direct `External_Links` writer.
- `automation-dashboard`: direct `External_Links` writer.

## Projects That Reference Other Web Apps

- `claims-service` hardcodes the automation-dashboard web app URL for homepage refresh (`apps-script-projects/claims-service/MorningAutomationService.js:219`).
- `automation-dashboard` stores the insurance intake web app URL in automation registry entries (`apps-script-projects/automation-dashboard/Code.js:156`, `apps-script-projects/automation-dashboard/Code.js:165`, `apps-script-projects/automation-dashboard/Code.js:174`, `apps-script-projects/automation-dashboard/Code.js:183`, `apps-script-projects/automation-dashboard/Code.js:192`, `apps-script-projects/automation-dashboard/Code.js:201`).
- `apps-script-dashboard` stores an insurance intake web app URL (`apps-script-projects/apps-script-dashboard/Code.js:83`).

## Safe Local Cleanup Candidates

No deletion is recommended from source-only evidence. The only local cleanup candidates are documentation/process candidates:

- Mark `claims-data-foundation` bulk writers as `manual verification required` before any retirement decision.
- Mark `claims-service` direct test writer functions as manual/test-only candidates, but keep until live usage is checked.
- Mark EOJ migration writers as one-time maintenance candidates, but keep until schema state and deployment history are checked.

## Do Not Delete Yet

Do not delete or retire these without live trigger/deployment verification:

- `claims-data-foundation`, because local source can clear and repopulate production-named Claims Database sheets (`apps-script-projects/claims-data-foundation/DailyNotesImportService.js:337`).
- `eoj-processing-engine/ClaimsBridge.js`, because local source shows scheduled EOJ processing can write directly to Claims DB (`apps-script-projects/eoj-processing-engine/Code.js:12`, `apps-script-projects/eoj-processing-engine/Code.js:65`).
- `insurance-intake-automation` External_Links persistence, because local source shows the intake process writes links during production-looking web action flow (`apps-script-projects/insurance-intake-automation/Code.js:31`, `apps-script-projects/insurance-intake-automation/Code.js:366`).
- `automation-dashboard` operational link save, because local UI code calls the server writer (`apps-script-projects/automation-dashboard/IntakeScripts.html:278`, `apps-script-projects/automation-dashboard/ClaimsScripts.html:1402`).

## Recommended Canonical Owner By Sheet

This recommendation is based on current local source ownership names and safest single-writer architecture direction. It does not assert live deployment state.

- `Claims` -> `claims-service`.
- `Timeline_Events` -> `claims-service`.
- `Claim_Conditions` -> `claims-service`.
- `Claim_Alerts` -> `claims-service`.
- `External_Links` -> today has intake/dashboard/service writers; future canonical owner should be `claims-service` API with intake/dashboard calling it.
- `Financial_Tracks` -> `claims-service`.
- `Claim_Ownership_History` -> `claims-service`.
- `Claim_Health_History` -> `claims-service`.
- `Claim_Service_Log` -> `claims-service`.
- `Alert_Rules`, `Timeline_Rules`, `Condition_Audit` -> `claims-service` if retained.
- `Claim_Crosswalk`, `Compliance_Actions`, `Claim_Summaries`, `Import_Log` -> `claims-data-foundation` today; migrate or retire only after confirming whether these sheets are still production dependencies.
- Legacy `Claim_Timeline` -> no canonical active owner identified; verify schema/history before any cleanup.

## Manual Verification Checklist

1. In Apps Script UI for every project, check **Triggers** for active handlers: `runRainbowMorningAutomation`, `processUnprocessedEOJs`, any `testWrite*`, `testClassifyTimelineEvents`, `testEnrichClaimsWithComplianceAddresses`, `processInsuranceIntake`, and retry handlers.
2. In Apps Script UI for every project, check **Deployments** and record active web app URLs, deployed version numbers, execute-as user, and access settings.
3. In the Claims Database, inspect recent edit history/version history for writes to `Claims`, `Timeline_Events`, `External_Links`, `Claim_Conditions`, and `Claim_Alerts` and compare timestamps to trigger schedules.
4. Confirm whether `claims-data-foundation` has any active deployments or installable triggers. If none, label its writers as manual-only but still retain until a rollback/export plan exists.
5. Confirm whether EOJ processing currently calls direct `ClaimsBridge.js` or whether any deployed path calls `claims-service?action=processEojOutputs`.
6. Confirm whether dashboard and intake External_Links writes are both needed today. If both are live, define expected conflict behavior before centralization.
7. Before R1/R5 implementation, select a single canonical writer for `Claims`, `Timeline_Events`, `Claim_Conditions`, `Claim_Alerts`, `External_Links`, and `Claim_Service_Log` and convert other projects to call that owner rather than opening the Claims Database directly.
