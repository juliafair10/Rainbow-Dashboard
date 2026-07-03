# Trigger and Deployment Inventory

Generated: 2026-07-03

Scope: local read-only source inspection of `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/`. No Apps Script source files were edited, no `clasp push` was run, and no Apps Script deployments or triggers were modified.

Important limitation: local source can show handler functions, manifests, trigger setup functions, and hardcoded IDs, but it cannot prove which Apps Script triggers or deployments are currently live. Anything marked for retirement must be checked in the Apps Script UI first.

## Executive Summary

- Found 17 top-level Apps Script project folders. 16 have `.clasp.json`; 16 have `appsscript.json`.
- One local folder, `emergency service agreement`, appears empty/no-manifest/no-clasp and is likely a duplicate or abandoned local folder. Verify in git/history before deleting.
- Confirmed local trigger-setup code exists in `add-new-job-to-calendar`, `claims-service`, `eoj-processing-engine`, `historical-notes-sync`, `insurance-intake-automation`, and `new-jobs`.
- Confirmed local web app evidence exists in `add-new-job-to-calendar`, `apps-script-dashboard`, `automation-dashboard`, `claims-service`, `eoj-app`, `insurance-intake-automation`, `revision-intake-automation`, and `test-dashboard`.
- Confirmed local references to the Claims Database ID occur in `automation-dashboard`, `claims-data-foundation`, `claims-service`, `eoj-app`, `eoj-processing-engine`, and `insurance-intake-automation`.
- Confirmed local code that writes to the Claims Database or Claims Database-backed sheets exists in `claims-service`, `claims-data-foundation`, `eoj-processing-engine`, and `insurance-intake-automation`. `automation-dashboard` also writes to related EOJ/admin/log sheets and may write external-link records depending on routed actions.
- Do not delete or retire any project with trigger setup, web handlers, hardcoded production spreadsheet IDs, or dashboard web app references until live Apps Script trigger and deployment verification is complete.

## Project Inventory Table

| Project | Folder Path | appsscript.json | .clasp.json | Script ID | Web app / doGet / doPost evidence | ScriptApp.newTrigger evidence |
|---|---|---:|---:|---|---|---|
| add-new-job-to-calendar | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/add-new-job-to-calendar | Yes | Yes | 13e-iHHNrWcklR-mMdb6cgZHsFcgTzfs_caiXU3Ndd38Vlave5QKJeRyf | Manifest webapp; doGet `apps-script-projects/add-new-job-to-calendar/Code.js:14` | processEmailsToCalendar `apps-script-projects/add-new-job-to-calendar/Code.js:498` |
| apps-script-dashboard | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/apps-script-dashboard | Yes | Yes | 12ujVKC7PkmY_5jUjCNExDsB4-ledD5Av9F8lgP3uHMk9uBZWw4soltmz | Manifest webapp; doGet `apps-script-projects/apps-script-dashboard/Code.js:99` | None found |
| automation-dashboard | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard | Yes | Yes | 1FLiir_-mnSKqln336Vb8Fw74_ZDI_melrePqFcK70HMhzNvXCsyLqUlU | Manifest webapp; doGet `apps-script-projects/automation-dashboard/Code.js:717` | None found |
| certificate of completion | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/certificate of completion | Yes | Yes | 11vK7GNEBiAnUXW1Rs82NH5U_V-58-QcxZzD0KhLBqf-RBQIhc0hRYVfq | No local web evidence | None found |
| claims-data-foundation | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/claims-data-foundation | Yes | Yes | 1PrkZyClY6Cbf68YEpZyLeZ78qQXc2ois_5RIXxtEp1bHJa8TQ3KX5BsY | No local web evidence | None found |
| claims-service | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/claims-service | Yes | Yes | 1eXZu58To5G0STkEXdONwUO1YIIqILvwEfwQkzoM4hiCc1z4VAcECMrkN | doGet `apps-script-projects/claims-service/Code.js:8`; doPost `apps-script-projects/claims-service/Code.js:67` | runRainbowMorningAutomation `apps-script-projects/claims-service/MorningAutomationService.js:259` |
| emergency service agreement | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/emergency service agreement | No | No |  | No local web evidence | None found |
| emergency-service-agreement | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/emergency-service-agreement | Yes | Yes | 1SFeWbq0opimQcbmKnKdNdkyjTevPd3xayABCzFk_sdjPRMfLogmBYaX5 | No local web evidence | None found |
| eoj-app | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-app | Yes | Yes | 1UgqxcxHkDOA6txO2vcG16JmKdRCUgH98dj0eUCTZpATAQVPaZhrzfSVY | doGet `apps-script-projects/eoj-app/Code.js:1` | None found |
| eoj-builder | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-builder | Yes | Yes | 1ua_ZfYM2LjpfKHzf7LSWVYGb6n1MjSFZDpqEMOQ-FaSvaCv9KDP7BpsI | No local web evidence | None found |
| eoj-processing-engine | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-processing-engine | Yes | Yes | 1I3SDIOVs6n65OwnO6A7zN5T_jMEmOngAySY_fkcXDrwAB3YoIhFVHVCF | No local web evidence | processUnprocessedEOJs `apps-script-projects/eoj-processing-engine/Code.js:12` |
| historical-notes-sync | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/historical-notes-sync | Yes | Yes | 1-udieNt7oIgQOHvlIGiaxDIe_iM7AgLvmRBM5WGvJqOxfKvZ73Ap85LY | No local web evidence | runDailyHistoricalNotesSyncWithLog `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:366` |
| insurance-intake-automation | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/insurance-intake-automation | Yes | Yes | 1ql7J3kUb1PltkSPgAXs-ez4ed3qyEsY2_KYYewAXpKSWvGcsmQPNCePG | Manifest webapp; doGet `apps-script-projects/insurance-intake-automation/Code.js:28` | Dynamic handler variable `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:118` |
| new-jobs | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/new-jobs | Yes | Yes | 1qGEwGrklFh2JVMKitwznrJdsYkHEcNydIj8YFHQAMDSMNxI8-J8ApCne | No local web evidence | processEmailsToCalendarAndChat `apps-script-projects/new-jobs/Code.js:596`; processEmailsToCalendarAndChat `apps-script-projects/new-jobs/Code.js:616` |
| rbw-utils | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/rbw-utils | Yes | Yes | 1bRWBJn_npJLj2JXYSaZ6tp3Y2CGv47c7Fl5r-z_b9Aip8UljSltjwVVb | No local web evidence | None found |
| revision-intake-automation | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/revision-intake-automation | Yes | Yes | 1DMcNiizsxErACSdWW-LFw70T1m5bSNtBMD99dfj7unGMVPHdYEUB3wD9 | doGet `apps-script-projects/revision-intake-automation/Code.gs:421` | None found |
| test-dashboard | /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/test-dashboard | Yes | Yes | 1mtB49UWPuKcnn68m_HVjYE599pVdHpOlmk6d3JAnnl38Gz7p6EyF6J-W | Manifest webapp; doGet `apps-script-projects/test-dashboard/Code.js:1` | None found |

## Confirmed Local Evidence

### Web App Handlers and Manifests
- `add-new-job-to-calendar`: manifest webapp block; handlers: doGet `apps-script-projects/add-new-job-to-calendar/Code.js:14`.
- `apps-script-dashboard`: manifest webapp block; handlers: doGet `apps-script-projects/apps-script-dashboard/Code.js:99`.
- `automation-dashboard`: manifest webapp block; handlers: doGet `apps-script-projects/automation-dashboard/Code.js:717`.
- `claims-service`: no manifest webapp block found; handlers: doGet `apps-script-projects/claims-service/Code.js:8`; doPost `apps-script-projects/claims-service/Code.js:67`.
- `eoj-app`: no manifest webapp block found; handlers: doGet `apps-script-projects/eoj-app/Code.js:1`.
- `insurance-intake-automation`: manifest webapp block; handlers: doGet `apps-script-projects/insurance-intake-automation/Code.js:28`.
- `revision-intake-automation`: no manifest webapp block found; handlers: doGet `apps-script-projects/revision-intake-automation/Code.gs:421`.
- `test-dashboard`: manifest webapp block; handlers: doGet `apps-script-projects/test-dashboard/Code.js:1`.

Manifest webapp blocks:
- `add-new-job-to-calendar`: `apps-script-projects/add-new-job-to-calendar/appsscript.json:6`.
- `apps-script-dashboard`: `apps-script-projects/apps-script-dashboard/appsscript.json:6`.
- `automation-dashboard`: `apps-script-projects/automation-dashboard/appsscript.json:6`.
- `insurance-intake-automation`: `apps-script-projects/insurance-intake-automation/appsscript.json:6`.
- `test-dashboard`: `apps-script-projects/test-dashboard/appsscript.json:6`.

### Trigger Setup and Scheduled-Handler Evidence
- `add-new-job-to-calendar`: `processEmailsToCalendar` appears to be the scheduled handler at `apps-script-projects/add-new-job-to-calendar/Code.js:74`; `setupDailyTrigger` creates a daily trigger at `apps-script-projects/add-new-job-to-calendar/Code.js:486` and `apps-script-projects/add-new-job-to-calendar/Code.js:498`.
- `claims-service`: `runRainbowMorningAutomation` is documented as the single 6 AM trigger target at `apps-script-projects/claims-service/MorningAutomationService.js:13`; handler starts at `apps-script-projects/claims-service/MorningAutomationService.js:57`; `createRainbowMorningAutomationTrigger` creates the daily 6 AM trigger at `apps-script-projects/claims-service/MorningAutomationService.js:257` and `apps-script-projects/claims-service/MorningAutomationService.js:259`.
- `eoj-processing-engine`: `createProcessingTrigger` creates a 15-minute trigger for `processUnprocessedEOJs` at `apps-script-projects/eoj-processing-engine/Code.js:6` and `apps-script-projects/eoj-processing-engine/Code.js:12`; scheduled handler starts at `apps-script-projects/eoj-processing-engine/Code.js:41`.
- `historical-notes-sync`: `runDailyHistoricalNotesSyncWithLog` is the trigger target at `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:357`; `createDailyHistoricalNotesSyncTrigger` calls `ScriptApp.newTrigger` at `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:363` and `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:366`.
- `insurance-intake-automation`: scheduled retry handlers are `scheduledRetryInsuranceIntake`, `scheduledRetryAsbestos`, and `scheduledRetryItel` at `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:77`, `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:81`, and `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:85`; `setupRetryTriggers` creates daily triggers dynamically at `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:89` and `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:118`; handler definitions are listed at `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:227`.
- `new-jobs`: `processEmailsToCalendarAndChat` appears to be the scheduled handler at `apps-script-projects/new-jobs/Code.js:50`; `setupDailyTrigger` and `setupHourlyTrigger` create triggers at `apps-script-projects/new-jobs/Code.js:588`, `apps-script-projects/new-jobs/Code.js:596`, `apps-script-projects/new-jobs/Code.js:608`, and `apps-script-projects/new-jobs/Code.js:616`.

### Hardcoded Claims Database ID References
- `automation-dashboard`: `apps-script-projects/automation-dashboard/HomepageDataService.js:2` `const HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';`
- `claims-data-foundation`: `apps-script-projects/claims-data-foundation/Config.js:3` `spreadsheetId: '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c'`
- `claims-service`: `apps-script-projects/claims-service/Config.js:6` `const CLAIM_FOUNDATION_SPREADSHEET_ID = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';`; `apps-script-projects/claims-service/Config.js:7` `const CLAIMS_DATABASE_SPREADSHEET_ID = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';`
- `eoj-app`: `apps-script-projects/eoj-app/Config.js:3` `CLAIMS_DATABASE_ID: '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c',`
- `eoj-processing-engine`: `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:38` `var CLAIMS_DB_ID_    = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';`
- `insurance-intake-automation`: `apps-script-projects/insurance-intake-automation/Code.js:587` `'1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';`

### EOJ Source/Output Spreadsheet ID References
- EOJ source spreadsheet ID `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs` appears in:
  - `automation-dashboard`: `apps-script-projects/automation-dashboard/EojAdminService.js:9`
  - `claims-service`: `apps-script-projects/claims-service/Config.js:18`
  - `eoj-app`: `apps-script-projects/eoj-app/Config.js:2`
  - `eoj-processing-engine`: `apps-script-projects/eoj-processing-engine/Config.js:2`
- EOJ output spreadsheet ID `1GmsWkh8x_ICVEWNFP_WgT-hN6hQDSI_WF16J9T_R-NE` appears in:
  - `claims-service`: `apps-script-projects/claims-service/Config.js:19`
  - `eoj-processing-engine`: `apps-script-projects/eoj-processing-engine/Config.js:3`

### Hardcoded Web App URL References
- `apps-script-dashboard`: multiple `webAppUrl` entries at `apps-script-projects/apps-script-dashboard/Code.js:12`, `apps-script-projects/apps-script-dashboard/Code.js:19`, `apps-script-projects/apps-script-dashboard/Code.js:27`, and `apps-script-projects/apps-script-dashboard/Code.js:83`; URL validation at `apps-script-projects/apps-script-dashboard/Code.js:425` and `apps-script-projects/apps-script-dashboard/Code.js:428`.
- `automation-dashboard`: multiple automation `webAppUrl` entries at `apps-script-projects/automation-dashboard/Code.js:12`, `apps-script-projects/automation-dashboard/Code.js:21`, `apps-script-projects/automation-dashboard/Code.js:30`, and `apps-script-projects/automation-dashboard/Code.js:156`; dashboard base URLs at `apps-script-projects/automation-dashboard/HomepageScripts.html:3` and `apps-script-projects/automation-dashboard/ClaimsScripts.html:59`; claims-service fallback URL at `apps-script-projects/automation-dashboard/Code.js:678`.
- `claims-service`: morning automation calls the dashboard web app at `apps-script-projects/claims-service/MorningAutomationService.js:219` and `apps-script-projects/claims-service/MorningAutomationService.js:222`.

## Projects Requiring Manual Trigger Verification

These have local trigger setup/delete/list evidence or scheduled-looking handlers. Open each Apps Script project by Script ID and inspect **Triggers** before retiring.
- `add-new-job-to-calendar` (`13e-iHHNrWcklR-mMdb6cgZHsFcgTzfs_caiXU3Ndd38Vlave5QKJeRyf`): processEmailsToCalendar `apps-script-projects/add-new-job-to-calendar/Code.js:498`; trigger-related refs: `apps-script-projects/add-new-job-to-calendar/Code.js:486`, `apps-script-projects/add-new-job-to-calendar/Code.js:487`, `apps-script-projects/add-new-job-to-calendar/Code.js:494`, `apps-script-projects/add-new-job-to-calendar/Code.js:498`.
- `claims-service` (`1eXZu58To5G0STkEXdONwUO1YIIqILvwEfwQkzoM4hiCc1z4VAcECMrkN`): runRainbowMorningAutomation `apps-script-projects/claims-service/MorningAutomationService.js:259`; trigger-related refs: `apps-script-projects/claims-service/MorningAutomationService.js:257`, `apps-script-projects/claims-service/MorningAutomationService.js:259`, `apps-script-projects/claims-service/MorningAutomationService.js:276`, `apps-script-projects/claims-service/MorningAutomationService.js:277`, `apps-script-projects/claims-service/MorningAutomationService.js:282`.
- `eoj-processing-engine` (`1I3SDIOVs6n65OwnO6A7zN5T_jMEmOngAySY_fkcXDrwAB3YoIhFVHVCF`): processUnprocessedEOJs `apps-script-projects/eoj-processing-engine/Code.js:12`; trigger-related refs: `apps-script-projects/eoj-processing-engine/Code.js:6`, `apps-script-projects/eoj-processing-engine/Code.js:8`, `apps-script-projects/eoj-processing-engine/Code.js:10`, `apps-script-projects/eoj-processing-engine/Code.js:12`, `apps-script-projects/eoj-processing-engine/Code.js:21`.
- `historical-notes-sync` (`1-udieNt7oIgQOHvlIGiaxDIe_iM7AgLvmRBM5WGvJqOxfKvZ73Ap85LY`): runDailyHistoricalNotesSyncWithLog `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:366`; trigger-related refs: `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:363`, `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:366`, `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:385`, `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:386`, `apps-script-projects/historical-notes-sync/HistoricalNotesSync_v2.gs:391`.
- `insurance-intake-automation` (`1ql7J3kUb1PltkSPgAXs-ez4ed3qyEsY2_KYYewAXpKSWvGcsmQPNCePG`): dynamic handler variable at `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:118`; trigger-related refs: `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:89`, `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:92`, `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:118`, `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:162`, `apps-script-projects/insurance-intake-automation/RetryWorkflow.js:167`.
- `new-jobs` (`1qGEwGrklFh2JVMKitwznrJdsYkHEcNydIj8YFHQAMDSMNxI8-J8ApCne`): processEmailsToCalendarAndChat `apps-script-projects/new-jobs/Code.js:596`; processEmailsToCalendarAndChat `apps-script-projects/new-jobs/Code.js:616`; trigger-related refs: `apps-script-projects/new-jobs/Code.js:588`, `apps-script-projects/new-jobs/Code.js:589`, `apps-script-projects/new-jobs/Code.js:592`, `apps-script-projects/new-jobs/Code.js:596`, `apps-script-projects/new-jobs/Code.js:608`.

Also check every other project before deletion because live triggers can exist even when local source has no `ScriptApp.newTrigger` code.

## Projects Requiring Manual Deployment Verification

These have local web app evidence. Open Apps Script → Deploy → Manage deployments and verify active deployments, URLs, access, and callers before retiring.
- `add-new-job-to-calendar` (`13e-iHHNrWcklR-mMdb6cgZHsFcgTzfs_caiXU3Ndd38Vlave5QKJeRyf`): doGet `apps-script-projects/add-new-job-to-calendar/Code.js:14`; manifest webapp: Yes; URL refs: None found.
- `apps-script-dashboard` (`12ujVKC7PkmY_5jUjCNExDsB4-ledD5Av9F8lgP3uHMk9uBZWw4soltmz`): doGet `apps-script-projects/apps-script-dashboard/Code.js:99`; manifest webapp: Yes; URL refs: `apps-script-projects/apps-script-dashboard/Code.js:12`, `apps-script-projects/apps-script-dashboard/Code.js:19`, `apps-script-projects/apps-script-dashboard/Code.js:27`, `apps-script-projects/apps-script-dashboard/Code.js:35`.
- `automation-dashboard` (`1FLiir_-mnSKqln336Vb8Fw74_ZDI_melrePqFcK70HMhzNvXCsyLqUlU`): doGet `apps-script-projects/automation-dashboard/Code.js:717`; manifest webapp: Yes; URL refs: `apps-script-projects/automation-dashboard/ClaimsScripts.html:59`, `apps-script-projects/automation-dashboard/Code.js:12`, `apps-script-projects/automation-dashboard/Code.js:21`, `apps-script-projects/automation-dashboard/Code.js:30`.
- `claims-service` (`1eXZu58To5G0STkEXdONwUO1YIIqILvwEfwQkzoM4hiCc1z4VAcECMrkN`): doGet `apps-script-projects/claims-service/Code.js:8`; doPost `apps-script-projects/claims-service/Code.js:67`; manifest webapp: No; URL refs: `apps-script-projects/claims-service/MorningAutomationService.js:219`.
- `eoj-app` (`1UgqxcxHkDOA6txO2vcG16JmKdRCUgH98dj0eUCTZpATAQVPaZhrzfSVY`): doGet `apps-script-projects/eoj-app/Code.js:1`; manifest webapp: No; URL refs: None found.
- `insurance-intake-automation` (`1ql7J3kUb1PltkSPgAXs-ez4ed3qyEsY2_KYYewAXpKSWvGcsmQPNCePG`): doGet `apps-script-projects/insurance-intake-automation/Code.js:28`; manifest webapp: Yes; URL refs: None found.
- `revision-intake-automation` (`1DMcNiizsxErACSdWW-LFw70T1m5bSNtBMD99dfj7unGMVPHdYEUB3wD9`): doGet `apps-script-projects/revision-intake-automation/Code.gs:421`; manifest webapp: No; URL refs: None found.
- `test-dashboard` (`1mtB49UWPuKcnn68m_HVjYE599pVdHpOlmk6d3JAnnl38Gz7p6EyF6J-W`): doGet `apps-script-projects/test-dashboard/Code.js:1`; manifest webapp: Yes; URL refs: None found.

## Projects That Write Claims Database

Direct Claims Database writers from local evidence:

- `claims-service`: core Claims Database service. Config points at the Claims Database at `apps-script-projects/claims-service/Config.js:6` and `apps-script-projects/claims-service/Config.js:7`; shared sheet writer uses `SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId)` at `apps-script-projects/claims-service/SheetService.js:6`, appends at `apps-script-projects/claims-service/SheetService.js:62` and `apps-script-projects/claims-service/SheetService.js:67`, and updates rows at `apps-script-projects/claims-service/SheetService.js:118`. Additional direct write examples include `apps-script-projects/claims-service/ClaimsDatabaseSyncService.js:39`, `apps-script-projects/claims-service/ClaimsDatabaseSyncService.js:40`, and report import writes at `apps-script-projects/claims-service/ReportImportService.js:805`.
- `claims-data-foundation`: config points at the Claims Database at `apps-script-projects/claims-data-foundation/Config.js:3`; multiple import/summary services write into database-backed sheets, including `apps-script-projects/claims-data-foundation/ClaimSummaryService.js:120`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:233`, `apps-script-projects/claims-data-foundation/ComplianceTasksImportService.js:324`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:262`, `apps-script-projects/claims-data-foundation/DailyNotesImportService.js:337`, and `apps-script-projects/claims-data-foundation/TimelineIntelligenceService.js:82`.
- `eoj-processing-engine`: explicitly says it writes interpreted EOJ outputs to Rainbow Claims Database at `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:4`; Claims Database ID at `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:38`; opens it at `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:88`; writes fields/conditions/logs at `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:373`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:413`, `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:415`, and `apps-script-projects/eoj-processing-engine/ClaimsBridge.js:658`; called from `processUnprocessedEOJs` at `apps-script-projects/eoj-processing-engine/Code.js:60` and `apps-script-projects/eoj-processing-engine/Code.js:65`.
- `insurance-intake-automation`: fallback Claims Database ID at `apps-script-projects/insurance-intake-automation/Code.js:587`; opens the configured spreadsheet at `apps-script-projects/insurance-intake-automation/Code.js:851` and `apps-script-projects/insurance-intake-automation/Code.js:923`; writes External_Links headers/rows/URL fields at `apps-script-projects/insurance-intake-automation/Code.js:609`, `apps-script-projects/insurance-intake-automation/Code.js:617`, `apps-script-projects/insurance-intake-automation/Code.js:641`, `apps-script-projects/insurance-intake-automation/Code.js:659`, `apps-script-projects/insurance-intake-automation/Code.js:674`, and `apps-script-projects/insurance-intake-automation/Code.js:692`.
Related projects with Claims Database references but not confirmed as direct Claims Database writers in this local pass:

- `automation-dashboard`: local source references the Claims Database for homepage reads at `apps-script-projects/automation-dashboard/HomepageDataService.js:2`; EOJ admin writes to EOJ source rows, not directly Claims Database, at `apps-script-projects/automation-dashboard/EojAdminService.js:108` and `apps-script-projects/automation-dashboard/EojAdminService.js:110`. Dashboard action code also appends/updates external-link style records at `apps-script-projects/automation-dashboard/Code.js:2349`, `apps-script-projects/automation-dashboard/Code.js:2388`, and `apps-script-projects/automation-dashboard/Code.js:2413`; verify target sheets before changing.
- `eoj-app`: reads Claims Database for job lookup at `apps-script-projects/eoj-app/Code.js:67` and `apps-script-projects/eoj-app/Code.js:621`; writes EOJ submissions to EOJ_Log, not directly Claims Database, via `apps-script-projects/eoj-app/SheetService.js:47` and `apps-script-projects/eoj-app/SheetService.js:35`.

## Projects That Reference Other Web Apps

- `apps-script-dashboard`: `apps-script-projects/apps-script-dashboard/Code.js:12`, `apps-script-projects/apps-script-dashboard/Code.js:19`, `apps-script-projects/apps-script-dashboard/Code.js:27`, `apps-script-projects/apps-script-dashboard/Code.js:35`, `apps-script-projects/apps-script-dashboard/Code.js:43`, `apps-script-projects/apps-script-dashboard/Code.js:51`, `apps-script-projects/apps-script-dashboard/Code.js:59`, `apps-script-projects/apps-script-dashboard/Code.js:67`.
- `automation-dashboard`: `apps-script-projects/automation-dashboard/ClaimsScripts.html:59`, `apps-script-projects/automation-dashboard/Code.js:12`, `apps-script-projects/automation-dashboard/Code.js:21`, `apps-script-projects/automation-dashboard/Code.js:30`, `apps-script-projects/automation-dashboard/Code.js:39`, `apps-script-projects/automation-dashboard/Code.js:48`, `apps-script-projects/automation-dashboard/Code.js:57`, `apps-script-projects/automation-dashboard/Code.js:66`.
- `claims-service`: `apps-script-projects/claims-service/MorningAutomationService.js:219`.

## Safe Local Cleanup Candidates

No Apps Script project folder should be deleted based solely on local source inspection. Candidate cleanup items after manual verification:
- `apps-script-projects/emergency service agreement/`: empty local folder; no `appsscript.json`, no `.clasp.json`, no files found by `find`. Confirm it is not referenced by documentation, git history, or local workflows before deleting.
- `test-dashboard`: simple local web app evidence only (`apps-script-projects/test-dashboard/Code.js:1`, `apps-script-projects/test-dashboard/appsscript.json:6`) but has `.clasp.json` script ID `1mtB49UWPuKcnn68m_HVjYE599pVdHpOlmk6d3JAnnl38Gz7p6EyF6J-W`; verify deployments before retiring.
- `apps-script-dashboard`: appears to be an older dashboard that points at many other web apps; verify no users/bookmarks depend on script ID `12ujVKC7PkmY_5jUjCNExDsB4-ledD5Av9F8lgP3uHMk9uBZWw4soltmz` before retiring.
- `add-new-job-to-calendar` and `new-jobs`: overlapping Gmail/calendar automation names and scheduled handlers. Verify which live triggers exist and whether either still owns production workflow before deleting either folder.

## Do Not Delete Yet

- `claims-service`: active API/web handlers, morning trigger setup, direct Claims Database writes, Claims Database ID, EOJ IDs, dashboard web app call.
- `automation-dashboard`: active dashboard web app evidence, hardcoded web app URL network, Claims Database reference, EOJ admin retry write path.
- `claims-data-foundation`: bound/parent clasp project with direct Claims Database import/summary writes.
- `eoj-app`: EOJ technician web app, Claims Database lookup, EOJ_Log writes.
- `eoj-processing-engine`: 15-minute processing trigger setup and direct Claims Database write bridge.
- `insurance-intake-automation`: web app, retry trigger setup, Gmail/Drive/calendar scopes, Claims Database fallback ID, External_Links writes.
- `historical-notes-sync`: daily trigger setup and writes to historical notes sync sheets; verify trigger/deployment state first.
- `revision-intake-automation`: `doGet` web handler and multiple spreadsheet write paths; verify deployment state first.
- `new-jobs` and `add-new-job-to-calendar`: scheduled Gmail/calendar automation candidates; verify live triggers first.
- `certificate of completion`, `emergency-service-agreement`, `eoj-builder`, and `rbw-utils`: no trigger/web evidence found in this scan for some, but they have clasp projects; verify ownership/use before deleting.

## Manual Verification Checklist

For each project considered for retirement:

1. Open Apps Script project by Script ID from the inventory table.
2. Check **Triggers** and record handler function, event type, owner, cadence, last run, and failures.
3. Check **Deploy → Manage deployments** and record deployment ID, web app URL, version, access, execute-as, and last modified date.
4. Search dashboard source/config for the script ID and deployment URL before removing any web app.
5. For projects with Claims Database ID `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`, confirm whether the project writes, reads only, or is obsolete.
6. For EOJ projects, confirm ownership of source spreadsheet `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs` and output spreadsheet `1GmsWkh8x_ICVEWNFP_WgT-hN6hQDSI_WF16J9T_R-NE`.
7. Check Apps Script executions/history for recent successful runs or errors.
8. Check Google Drive ownership/location for bound spreadsheets or forms, especially `.clasp.json` entries with `parentId`.
9. Disable or pause live triggers first, observe for at least one expected cadence window, then retire only after no dependent workflow breaks.
10. Never delete a local folder until its script ID, deployments, triggers, and production callers are documented.

