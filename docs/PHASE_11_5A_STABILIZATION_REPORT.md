# Rainbow Platform — Phase 11.5A Stabilization Report (Round 1)

**Date:** 2026-07-06
**Scope:** Dashboard-only functional stabilization. No redesign, no new architecture, no caching work, no Claims Service edits, no EOJ changes.
**Constraint outcome:** All code changes are confined to the `automation-dashboard` project. `claims-service/*` was inspected only, not modified.

---

## 1. Summary

The 14 audit items resolve into three underlying systems (Homepage Intelligence, Navigation/drilldown, Claims Query). After confirming each hypothesis against the code on disk, the items split into:

- **Fixed in code (6):** Search bar, Recent Activity EOJ dedup, Workflow Blockers "+X more", Timeline-events KPI, two empty Operational Awareness card routes, Queue Health noise.
- **Verified correct in code — symptom is the deployment pin, not a bug (3):** Today's Priorities freshness, Watchlist "frozen", Claims lens filtering.
- **Flagged (needs info or conflicts with constraints) (4):** Open EOJ / Add Link form-level deep-link, Intake issue-card "open the files", Intake load speed, Compliance placeholder + Health-Engine call.

A recurring root cause is the **deploy gotcha** from the handoff §2: `clasp push` does not update the served web app, which serves a *pinned* version. Several "frozen / stale / broken" symptoms are consistent with running an older deployment, because the current code reads live data correctly. Nothing is live until the web app is redeployed (or verified via the `/dev` URL).

---

## 2. Files changed

All in `apps-script-projects/automation-dashboard/`:

| File | Change |
| :--- | :--- |
| `HomepageDataService.js` | (a) `getHomepageRecentActivity_` now collapses multiple EOJ events per claim into one row. (b) The two Operational Awareness cards that had no route ("Follow-Ups Due", "Operational Alerts") now route to the `needsAttention` lens. (c) New `searchHomepageClaims(query)` server endpoint (live Claims-sheet read). |
| `HomepageView.html` | Removed the "Timeline Events" KPI card. Added a `#homepageSearchResults` dropdown container under the search input. |
| `HomepageScripts.html` | Added `bindHomepageSearch()` (debounced live search → opens the selected claim's Full Claim Workspace). Removed the obsolete `timelineEvents` KPI render line. Rewired Operational Alerts grouping so every item renders and the "+X more" control expands the full list. |
| `HomepageStyles.html` | Styles for the search-results dropdown; made "+X more" render as a real clickable control. |
| `IntakeScripts.html` | `renderIntakeWorkflows_` now hides Healthy workflows by default, shows only Warning/Critical/Unavailable, and notes how many healthy workflows were hidden. |
| `IntakeStyles.html` | Style for the "N healthy workflows hidden" note. |

Every JS/HTML block above passed a `node --check` syntax pass.

---

## 3. Root causes found

**Search bar (HIGH — fixed).** `#homepageSearchInput` existed in markup but had **no event handler anywhere** in `HomepageScripts.html`, and there was no backend search function. It was purely decorative. Fix: added `searchHomepageClaims()` which reads the Claims sheet live and matches customer name, claim number, claim ID, job number, and property address; the client renders a results dropdown and navigates to `?view=fullClaim&claimId=…` on select (Enter opens the top hit).

**Recent Activity duplicates (LOW — fixed).** `getHomepageRecentActivity_` sorted and sliced the timeline with no de-duplication. Because the EOJ interpreter writes both an "EOJ Submitted" event and a visit-specific event per submission, a single claim produced several near-identical EOJ rows. Fix: keep only the most-recent EOJ-type event per claim; non-EOJ events are untouched.

**Workflow Blockers "+X more" (HIGH — fixed).** In `renderOperationalAlerts`, only the first 3 items per group were rendered and "+N more in this group" was a static `<div>` — no expansion. Fix: all items now render (items past the third start hidden); "+X more" is a button that reveals the remainder and removes itself. The navigation binder was extended to wire every row, not just the first three.

**Timeline-events KPI (LOW — fixed).** Removed the low-signal KPI card and its render call.

**Operational Awareness drilldowns (HIGH — mostly already working; fixed the gap).** 5 of 7 cards already emit a valid `?view=claimShell&lensId=…` route and drill correctly. Two cards ("Follow-Ups Due", "Operational Alerts") shipped with an empty route and did nothing. Fix: both now route to the closest existing lens, `needsAttention`. (No new lens was invented.)

**Queue Health noise (MEDIUM — fixed).** `renderIntakeWorkflows_` rendered all three workflows regardless of state. Fix: Healthy workflows are hidden by default; only problems (Warning/Critical/Unavailable) show, with a one-line count of what was hidden.

**Today's Priorities / Watchlist "frozen / stale" (CRITICAL — verified correct in code).** The homepage reads the Claims DB sheets live on every load (`getHomepageSheetRows_` → `getDataRange().getValues()`), and both `getHomepageTodayPriorities_` and `getHomepageBecomingStale_` recompute from that live data. There is **no `CacheService` anywhere in the homepage path** — the only cache in the project is for the Intake workspace. Conclusion: frozen/stale homepage data is the **pinned web-app deployment** (handoff §2/§8), not a code bug. Resolution is a redeploy, not a code change. (Per the no-caching rule, this was investigated read-only and is flagged, not altered.)

**Claims lens filtering (CRITICAL — verified correct in code).** End-to-end trace: `ClaimsScripts.html` reads `lensId/ownership/condition/claimId` from both the URL and the server-injected route context; `Code.js getClaimsWorkspacePageData` forwards both alias forms (`ownership`+`ownershipArea`, `condition`+`conditionType`) to claims-service; `claims-service ClaimsLensService.filterClaimsByWorkspaceRoute_` already aliases those params and applies the lens via `getClaimsForLens`. The routing and filtering are correct in code. If lenses look broken live, it is again the deployment pin. **No dashboard change was required, and claims-service must not be edited.**

**Health Engine usage (verify / decision).** The homepage derives health from the claim row's `Health_Status` sheet column (`getHomepageClaimHealthLevel_`), i.e. the value the Health Engine writes to the sheet — it does not call `HealthEngineService` live. This is a design choice, not a defect. Calling the engine from the dashboard is permitted (calling ≠ modifying claims-service) but is out of stabilization scope; left as-is pending your decision.

---

## 4. Verification checklist

Deploy first — nothing below is testable until the web app is redeployed:

- [ ] `clasp push` the `automation-dashboard` project.
- [ ] Deploy → Manage deployments → Edit → **New version** → Deploy (or open the `/dev` URL, which always serves latest).

Then verify each fix:

- [ ] **Search:** type a customer name / claim number in the homepage search; a results dropdown appears; clicking a result (or pressing Enter) opens that claim's Full Claim Workspace.
- [ ] **Recent Activity:** a claim with several EOJ submissions shows a single EOJ activity row, not duplicates.
- [ ] **Workflow Blockers:** a group with more than 3 alerts shows "+N more"; clicking it reveals the rest and the button disappears; revealed rows are clickable.
- [ ] **KPIs:** the "Timeline Events" card is gone; the other three KPIs render.
- [ ] **Operational Awareness:** every card (including "Follow-Ups Due" and "Operational Alerts") opens the Claims Workspace with a lens applied.
- [ ] **Conditions Visibility:** clicking a condition opens the Claims Workspace filtered to that condition (confirm the filtered list is non-empty — see data note in §5).
- [ ] **Ownership Visibility:** clicking an area opens the workspace filtered to that ownership area.
- [ ] **Claims lenses:** each lens button (Needs Attention, Waiting on Insurance, Missing EOJ, Paid/Monitoring, Closed) changes the list; homepage drilldowns land on the right lens.
- [ ] **Intake Queue Health:** healthy workflows are hidden; only problems show; the hidden-count note is accurate. When all are healthy, the "all healthy" state shows.

---

## 5. Remaining issues / flagged for decision

**Open Alerts — "Open EOJ" / "Add Link" form-level deep-link (MEDIUM — partial).** Alert rows currently open the related claim (where the Add-link and EOJ controls live). A true deep-link *into the form/app* needs two things not present in the dashboard today: (a) the **EOJ app web-app URL** (there is no such constant in `automation-dashboard`; only the in-dashboard `?view=eojAdmin` exists), and (b) an **auto-open parameter** honored by the claim view to open the Add-link form on load. Recommend a small scoped follow-up: add an `openLink=1` param handler in `ClaimsScripts.html` for Add Link, and wire the EOJ app URL for Open EOJ. Not implemented here to avoid shipping an unverifiable cross-file behavior.

**Intake issue cards — "open the N affected files" (HIGH — needs server field).** Issue detail items expose `claimId/claimNumber/customerName/subject/workflow` but **no Gmail thread permalink or Drive file URL** on the client. To open "Asbestos Intake (5)" onto those five items, the Intake summary/audit modules need to surface a `threadId` (→ `https://mail.google.com/mail/u/0/#all/<threadId>`) or reuse the existing queue-health Gmail label queries as a search URL. This is a small, well-scoped server addition — flagged rather than guessed, per "do not invent functionality."

**Intake load speed (CRITICAL — conflicts with constraints).** This is a performance/caching item, which the phase explicitly excludes ("no caching / no perf work except where noted"). A cache-warm mechanism **already exists**: `warmIntakeWorkspaceCache` + `installIntakeWorkspaceCacheWarmTrigger` (5-minute, business-hours-gated). Recommendation is to **install/deploy that existing trigger** rather than write new performance code. Treated as a deploy/decision item.

**Compliance Activity (MEDIUM — intentionally left).** Renders counts only (open / critical / overdue). Left as a placeholder; no functionality invented, per the prompt.

**Data note for condition/ownership drilldowns.** The wiring is correct, but the *values* must match: the homepage emits condition labels like "Coverage Pending", and `claims-service claimHasRouteCondition_` compares them (normalized) against each claim's `activeConditions`. If a drilldown opens an empty list, it is a label-mismatch in the data, not a routing bug — worth a spot check during verification.

---

## 6. Do-not-touch confirmation

- `claims-service/*` — inspected only; unchanged.
- `USE_CLAIMS_SERVICE_EXTERNAL_LINKS`, `USE_INTERNAL_INTAKE_MODULE`, `CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE` — untouched.
- No caching added or removed. No EOJ code changed. No UI redesign.
