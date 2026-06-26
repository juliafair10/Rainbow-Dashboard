/**
 * LegacyCleanup.js — EOJ Processing Engine
 *
 * Utilities for marking legacy / old-schema EOJ_Log rows as "Skipped" so
 * the processing engine ignores them without deleting any data.
 *
 * WORKFLOW
 * --------
 * 1. Run dryRunLegacyCleanup()  — review the logs, confirm the rows listed
 *    are genuinely legacy and not current submissions.
 * 2. Run applyLegacyCleanup()   — writes Processing_Status = Skipped on
 *    those rows.  Rows are never deleted.
 *
 * LEGACY ROW CRITERIA (all must match)
 * -------------------------------------
 * A. Processing_Status is blank or "New"
 * B. The cell at the header-resolved Raw_JSON column is blank
 *    (header says Raw_JSON is at column X, but column X is empty in this row —
 *    a sign the data was written under the old column schema)
 * C. At least one of:
 *      - A fallback JSON scan finds a JSON payload at a DIFFERENT column than X
 *        (payload is there, just at the old shifted position)
 *      - The Claim_ID column contains name-like text rather than a structured ID
 *        (old schema had customerName where Claim_ID now lives)
 * D. (Optional) Submitted_At is before the pilot start date passed to the function
 */

// ─── Public wrappers — call these from the Apps Script editor ────────────────

/**
 * Preview which rows would be marked.  No changes are made.
 * Check View → Logs after running.
 */
function dryRunLegacyCleanup() {
  markLegacyEOJRowsSkipped_(true, PILOT_START_DATE_);
}

/**
 * Apply the cleanup.  Run dryRunLegacyCleanup() and review the output first.
 */
function applyLegacyCleanup() {
  markLegacyEOJRowsSkipped_(false, PILOT_START_DATE_);
}

/**
 * Pilot start date used as an optional upper-bound filter.
 * Rows submitted ON or AFTER this date are never touched, even if the other
 * criteria match — those are real submissions that should be investigated.
 * Set to null to disable the date filter entirely.
 */
var PILOT_START_DATE_ = '2026-06-25';

// ─── Core implementation ─────────────────────────────────────────────────────

/**
 * @param {boolean} dryRun       - true = log only, false = write changes.
 * @param {string|null} pilotStartDate - ISO date string or null.
 */
function markLegacyEOJRowsSkipped_(dryRun, pilotStartDate) {
  if (dryRun === undefined || dryRun === null) dryRun = true;

  const sheet = getEOJLogSheet_();
  ensureEOJLogProcessingColumns_(sheet);

  const allValues = sheet.getDataRange().getValues();
  Logger.log(
    'markLegacyEOJRowsSkipped_: mode=' + (dryRun ? 'DRY RUN' : 'LIVE') +
    ', pilotStartDate=' + (pilotStartDate || 'none') +
    ', totalRows=' + allValues.length
  );

  if (allValues.length < 2) {
    Logger.log('No data rows to evaluate.');
    return { candidateCount: 0, markedCount: 0, dryRun: dryRun };
  }

  const headers = allValues[0];
  const idx = indexHeaders_(headers);

  Logger.log('Column map — Raw_JSON: ' + idx['Raw_JSON'] +
    ', Claim_ID: ' + idx['Claim_ID'] +
    ', Processing_Status: ' + idx['Processing_Status'] +
    ', Submitted_At: ' + idx['Submitted_At']);

  const pilotCutoff = pilotStartDate ? new Date(pilotStartDate + 'T00:00:00') : null;
  const now          = new Date();
  const CLEANUP_RUN_ID = 'LEGACY-CLEANUP';

  const candidates = [];   // rows that match criteria
  const skipped    = [];   // rows actually written (live mode only)

  for (let i = 1; i < allValues.length; i++) {
    const row       = allValues[i];
    const rowNumber = i + 1;

    // ── A. Must be unprocessed ────────────────────────────────────────────
    const status = idx.Processing_Status !== undefined
      ? String(row[idx.Processing_Status] || '')
      : '';
    if (status !== '' && status !== CONFIG.STATUS.NEW) continue;

    // ── B. Header-resolved Raw_JSON cell is blank ─────────────────────────
    const rawJsonHeaderValue = idx.Raw_JSON !== undefined
      ? row[idx.Raw_JSON]
      : undefined;
    const headerColIsBlank = rawJsonHeaderValue === undefined ||
      rawJsonHeaderValue === null ||
      rawJsonHeaderValue === '';
    if (!headerColIsBlank) continue;   // header column has data → current row, skip

    // ── C. At least one structural mismatch sign ──────────────────────────
    const fallback        = findJsonInRow_(row);
    const hasMismatchedFallback = fallback !== null &&
      (idx.Raw_JSON === undefined || fallback.col !== idx.Raw_JSON);

    const claimIdValue    = idx['Claim_ID'] !== undefined
      ? String(row[idx['Claim_ID']] || '')
      : '';
    const claimIdIsName   = claimIdValue !== '' && isNameLike_(claimIdValue);

    if (!hasMismatchedFallback && !claimIdIsName) continue;

    // ── D. (Optional) submitted before pilot cutoff ───────────────────────
    if (pilotCutoff) {
      if (idx['Submitted_At'] === undefined) {
        // No date column in header — skip the date check for this row.
      } else {
        const rawDate     = row[idx['Submitted_At']];
        const submittedAt = rawDate ? new Date(rawDate) : null;
        if (submittedAt && !isNaN(submittedAt.getTime()) && submittedAt >= pilotCutoff) {
          // Submitted on or after pilot date — do NOT touch.
          Logger.log('Row ' + rowNumber + ': meets schema criteria but submitted on/after pilot date ' +
            pilotStartDate + ' — leaving untouched.');
          continue;
        }
      }
    }

    // ── Row qualifies ─────────────────────────────────────────────────────
    const eojId   = idx['EOJ_ID'] !== undefined ? String(row[idx['EOJ_ID']] || '(blank)') : '(col missing)';
    const reasons = [];
    if (headerColIsBlank)        reasons.push('Raw_JSON header column is blank');
    if (hasMismatchedFallback)   reasons.push('JSON payload found at old column ' + fallback.col + ' (expected ' + idx.Raw_JSON + ')');
    if (claimIdIsName)           reasons.push('Claim_ID column contains name-like value: "' + claimIdValue + '"');

    candidates.push({ rowNumber, eojId, reasons });

    if (!dryRun) {
      try {
        batchWriteStatusColumns_(sheet, rowNumber, idx, {
          Processing_Status:  'Skipped',
          Processing_Error:   'Legacy test row / old schema',
          Processed_At:       now,
          Processing_Run_ID:  CLEANUP_RUN_ID
        });
        skipped.push(rowNumber);
      } catch (err) {
        Logger.log('ERROR writing row ' + rowNumber + ': ' + (err.message || String(err)));
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  Logger.log('');
  Logger.log('══════════════════════════════════════════');
  Logger.log(dryRun ? 'DRY RUN RESULTS' : 'CLEANUP RESULTS');
  Logger.log('══════════════════════════════════════════');
  Logger.log('Rows evaluated (unprocessed): ' + (allValues.length - 1));
  Logger.log('Legacy candidates found:      ' + candidates.length);

  if (candidates.length === 0) {
    Logger.log('No legacy rows detected.');
  } else {
    candidates.forEach(function(c) {
      Logger.log('  Row ' + c.rowNumber + ' [' + c.eojId + '] — ' + c.reasons.join(' | '));
    });
  }

  if (dryRun) {
    Logger.log('');
    Logger.log('DRY RUN — no rows were modified.');
    Logger.log('Call applyLegacyCleanup() to apply changes after reviewing the above.');
  } else {
    Logger.log('Rows marked as Skipped: ' + skipped.length);
    if (skipped.length !== candidates.length) {
      Logger.log('WARNING: ' + (candidates.length - skipped.length) + ' row(s) could not be written — check errors above.');
    }
  }
  Logger.log('══════════════════════════════════════════');

  return {
    candidateCount: candidates.length,
    markedCount:    dryRun ? 0 : skipped.length,
    dryRun:         dryRun
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if a value looks like a person or company name rather than a
 * structured claim ID.
 *
 * Claim IDs are typically UUIDs, numeric codes, or alphanumeric tokens with
 * hyphens/numbers (e.g. "CLM-2024-0042", "a3f9b2c1-...").
 * Customer names are multi-word, all-letter strings (e.g. "John Smith",
 * "ABC Restoration LLC").
 */
function isNameLike_(value) {
  const s = String(value).trim();
  if (!s || s.length < 3) return false;

  const hasDigit        = /\d/.test(s);
  const wordCount       = s.split(/\s+/).length;
  const looksLikeUuid   = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s);
  const looksLikeCode   = /^[A-Z0-9]{4,}-[A-Z0-9]+/i.test(s);   // e.g. CLM-001

  if (looksLikeUuid || looksLikeCode) return false;
  // Multiple words with no digits → almost certainly a name.
  if (wordCount >= 2 && !hasDigit) return true;
  // Single word, no digits, long enough to be a surname/company fragment.
  if (wordCount === 1 && !hasDigit && s.length >= 4) return true;

  return false;
}
