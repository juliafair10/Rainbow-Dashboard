# Timeline Classification / Synthesis Fix — CLM-26A-0043-WTR

Health status logic (from the previous fix) was not touched. This is entirely a diagnostic-evidence fix, as scoped.

## Why the live recommendation missed the evidence

**Root cause: a field-name mismatch, not a synthesis or guard-logic bug.**

`evaluateConditionResolutionRecommendation_` gets its activity list from `synthesizeClaimActivities` → `synthesizeActivitiesFromRawTimeline_` → `getTimelineForClaim`. That last function resolves rows through `SheetService.findRows`/`getRows`, which normalizes the real sheet headers ("Event ID", "Claim ID", "Date", "Event Type", "Details", "Source", ...) by stripping spaces — producing row objects keyed `Event_ID, Claim_ID, Date, Event_Type, Details, Source`, **not** `Event_Date, Detail, Event_Source`.

`synthesizeActivitiesFromRawTimeline_` (and, by extension, yesterday's Quoted/Echoed Note Guard) read `event.Event_Date` and `event.Detail` — keys that simply don't exist on these rows. `event.Event_Date` came back `undefined` for every row, so every synthesized activity's date silently defaulted to `null`/epoch. The recommendation logic then filters activities to "at or after the condition's `Opened_At`" — with every genuine activity's date reading as epoch-zero, all of them failed that filter and were discarded. The only activities that *did* get a real date were the quoted/echoed rows (their date came from the embedded "On <date>" text, not the broken field), but those are correctly excluded by the echo guard. Net effect: the relevant-activity list ended up empty, so the function reported no revision or payment evidence at all — exactly the live symptom.

A second, smaller gap made this worse even after the date bug is fixed: the shared content classifier has no vocabulary for revision *completion* language ("I have made the requested changes and uploaded the estimate for review"). It only recognizes request language ("revisions requested," etc.), so the 6/19 completion note was falling into the `Insurance Review` bucket purely because it contains the word "estimate" — incidental, not a real signal.

**Answers to your six investigation questions:**

1. Real field names on `Timeline_Events` rows as returned to this code: `Event_ID, Claim_ID, Job_Number, Date, Source, Event_Type, Actor, Summary, Details, Visibility`.
2. Yes — the recommendation logic (via `synthesizeActivitiesFromRawTimeline_`) was reading `Event_Date`/`Detail`, which don't exist; the real keys are `Date`/`Details`.
3. No — the guard itself was working correctly on whatever it was given. It looked overly aggressive only because it was one of the only things still getting a real date (via embedded-text extraction), while genuine activities were silently zeroed out by the field-mapping bug.
4. No — payment/accounting wording ("PAYMENT," "PAID," "SENT TO ACCOUNTING") is in the classifier and works fine once dates are fixed.
5. Yes — revision completion/upload language was completely absent from the keyword vocabulary. Added as a separate, narrow check.
6. Partially — `Event_Date`/`Detail`/`Event_Source` were wrong keys (not present at all in this row shape); `Claim_ID` happened to work because `findRows` already normalizes "Claim ID" → `Claim_ID` the same way.

## Files/functions changed

- **`TimelineSynthesisService.js`** — new `normalizeRawTimelineEventForSynthesis_(event)`, called once at the top of `synthesizeActivitiesFromRawTimeline_` to map whichever shape `getTimelineForClaim` returns into the canonical field names every function in the file already expects. Also added a `rawText` field to each synthesized activity (the exact text used for classification) for diagnostics. No other function in this file changed — `getRawTimelineText_`, `deriveRawTimelineActivityType_`, the guard functions all work unmodified once they receive correctly-named input.
- **`ConditionEngineService.js`** — added `isRevisionRequestText_` / `isRevisionCompletionText_` (narrow, additive text checks, not a change to the shared classifier bucket used elsewhere). Rewired `evaluateConditionResolutionRecommendation_` to: treat completion language as its own signal (feeds `latestGenuineRevisionEventAt` and the "anchor" point), require a genuine *request* (not completion) to disqualify the recommendation, and exclude a completion/request note from also counting as its own "approval" evidence. Added `debugConditionResolutionEvidenceForClaim_(claimId)` + `testDebugConditionResolutionEvidenceForKnownClaim()` — prints every candidate row with the exact fields you asked for.
- **`TimelineEngineService.js` / `Last_Revision_At`** — not touched. That code builds its own correctly-named event objects directly from sheet headers already, so it was never affected by this bug.
- **`HealthEngineService.js`** — not touched, per your "do not change health status logic yet" instruction.

## Test plan (was run against real data — see below)

1. Reproduce the live bug in isolation using the exact object shape `getTimelineForClaim` returns in production (not the convenient shape used in earlier testing).
2. Apply the field-mapping fix and confirm the same real data now produces populated evidence fields and `recommendedConditionResolution: true`.
3. Run the new debug function and confirm every row after the condition's `Opened_At` is accounted for, with a correct `excludedReason` for anything left out.
4. Confirm no true newer revision request would be missed (the "preserve real escalation" requirement) — verified via the debug output's `revReq` column, which only turns `true` for genuine request-language notes.

## Before/after debug output

**Before the fix** (production shape, unmapped fields):

```json
{
  "recommendedConditionResolution": false,
  "resolutionRecommendationReason": "No genuine revision completion/submission activity found since the condition opened.",
  "confidence": "low",
  "latestGenuineRevisionEventAt": "",
  "latestPaymentOrAccountingEventAt": "",
  "newerRevisionRequestAfterPayment": false
}
```

**After the fix:**

```json
{
  "recommendedConditionResolution": true,
  "resolutionRecommendationReason": "Revision activity appears complete and payment/approval activity (Insurance Review) genuinely occurred after the last revision event, with no newer genuine revision request since.",
  "confidence": "medium",
  "latestGenuineRevisionEventAt": "2026-06-19T14:47:45.000Z",
  "latestPaymentOrAccountingEventAt": "2026-06-25T23:53:45.000Z",
  "newerRevisionRequestAfterPayment": false
}
```

**Debug output — every candidate row at/after the condition's `Opened_At` (2026-06-17), post-fix:**

| Timestamp | Type | Echo | RevReq | RevComp | PayAcct | Included? | Summary |
|---|---|---|---|---|---|---|---|
| 2026-06-18T16:46:29Z | Revision | no | true | false | false | **yes** | "Thanks so much for your revisions. Just one last item..." |
| 2026-06-19T14:47:45Z | Insurance Review | no | false | true | false | **yes** | "I have made the requested changes and uploaded the estimate for review." |
| 2026-06-23T13:45:01Z | Insurance Review | no | false | false | true | **yes** | "EMS: Payment has been issued for the water EMS invoice." |
| 2026-06-25T23:53:45Z | Payment | no | false | false | true | **yes** | "$7324.73 SENT TO ACCOUNTING FOR PAYMENT SCHEDULING" |
| (6 rows, 6/18–6/25) | Revision/Insurance Review | **yes** | — | — | — | excluded: quoted/echoed fragment | duplicate reply-thread echoes |
| (all rows before 6/17) | various | no | — | — | — | excluded: before condition Opened_At | earlier timeline history |

Only the 4 genuine rows after the condition opened are used; the echo guard correctly excludes the reply-thread duplicates without needing to loosen anything.

## Confirmation

- `recommendedConditionResolution` is now `true`, backed by real evidence (not a coincidence of row order).
- `latestGenuineRevisionEventAt` (2026-06-19, the completion note) and `latestPaymentOrAccountingEventAt` (2026-06-25, the payment-to-accounting note) are both populated.
- `newerRevisionRequestAfterPayment` is `false`, correctly.
- Health status logic (yesterday's `Attention Soon` branch in `HealthEngineService.js`) was **not modified** in this pass, but since it already calls this same recommendation function, it will now correctly evaluate to `Attention Soon` once this evidence is populated — you should confirm that live before treating it as done.
- No timeline rows were deleted or altered; the quoted/echoed guard was not loosened — a genuine newer revision request after payment would still disqualify the recommendation (verified via the `revReq` signal being independent of and unaffected by this fix).

## Remaining risk

The revision-completion vocabulary (`isRevisionCompletionText_`) is narrow and tuned to this claim's actual wording ("made the requested changes," "uploaded the estimate," etc.). Other claims may use different completion phrasing that still won't be detected — worth watching as more claims get diagnosed through this path.
