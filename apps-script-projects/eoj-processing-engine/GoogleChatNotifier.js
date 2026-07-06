/**
 * GoogleChatNotifier.js — eoj-processing-engine
 *
 * Posts EOJ notifications to an existing Google Chat space.
 * Called from processUnprocessedEOJs() after ClaimsBridge and Todoist.
 * Non-fatal: all errors are logged, never thrown.
 *
 * Script Properties required:
 *   GOOGLE_CHAT_WEBHOOK_URL — Incoming webhook URL for the target Chat space.
 *   (Generate in Google Chat: open space → Apps → Manage webhooks → Add webhook)
 *
 * Architecture:
 *   EOJ → Processing Engine → ClaimsBridge → Todoist → GoogleChatNotifier
 *
 * This module is intentionally isolated. Notification format can be updated
 * here without touching EOJ processing, ClaimsBridge, or Todoist logic.
 */

/**
 * Post an EOJ notification to Google Chat.
 * Returns { ok: true } on success or { ok: false, reason: string } on any failure.
 *
 * @param {Object} interpreted - output of interpretBasicEOJ_()
 * @returns {{ ok: boolean, reason?: string }}
 */
function postEojToGoogleChat(interpreted) {
  try {
    var webhookUrl = PropertiesService.getScriptProperties().getProperty('GOOGLE_CHAT_WEBHOOK_URL');

    if (!webhookUrl) {
      Logger.log('GoogleChatNotifier: GOOGLE_CHAT_WEBHOOK_URL not set in Script Properties — skipping.');
      return { ok: false, reason: 'GOOGLE_CHAT_WEBHOOK_URL not configured' };
    }

    // Build the full report, split into <=limit-sized messages. Long EOJs are
    // never silently truncated — they are sent as sequential parts.
    var messages = buildEojChatMessages_(interpreted);

    for (var i = 0; i < messages.length; i++) {
      var response = UrlFetchApp.fetch(webhookUrl, {
        method:           'post',
        contentType:      'application/json',
        payload:          JSON.stringify({ text: messages[i] }),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();

      if (code < 200 || code >= 300) {
        Logger.log('GoogleChatNotifier: HTTP ' + code + ' on part ' + (i + 1) + '/' + messages.length +
          ' — ' + response.getContentText().slice(0, 300));
        return { ok: false, reason: 'Google Chat webhook returned HTTP ' + code + ' on part ' + (i + 1) };
      }
    }

    Logger.log('GoogleChatNotifier: notification posted for ' + (interpreted.eojId || 'unknown EOJ') +
      ' in ' + messages.length + ' message(s).');
    return { ok: true };

  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    Logger.log('GoogleChatNotifier error (non-fatal): ' + msg);
    return { ok: false, reason: msg };
  }
}

/**
 * Posts a high-priority Google Chat notification when the EOJ -> Claims bridge
 * fails. This is intentionally non-fatal.
 *
 * @param {Object} bridgeContext
 * @param {Error} bridgeErr
 * @param {Object} interpreted
 * @returns {{ok:boolean, reason?:string}}
 */
function notifyClaimsBridgeFailure_(bridgeContext, bridgeErr, interpreted) {
  try {
    var webhookUrl = PropertiesService.getScriptProperties().getProperty('GOOGLE_CHAT_WEBHOOK_URL');

    if (!webhookUrl) {
      Logger.log('GoogleChatNotifier: GOOGLE_CHAT_WEBHOOK_URL not set for bridge notification.');
      return { ok: false, reason: 'Webhook not configured' };
    }

    var lines = [
      '⚠️ EOJ → Claims Bridge Failure',
      '',
      'The EOJ processed successfully, but the Claims Database update failed.',
      ''
    ];

    if (bridgeContext.rowNumber) lines.push('*EOJ Row:* ' + bridgeContext.rowNumber);
    if (bridgeContext.eojId) lines.push('*EOJ ID:* ' + bridgeContext.eojId);
    if (bridgeContext.claimNumber) lines.push('*Claim #:* ' + bridgeContext.claimNumber);
    if (bridgeContext.customerName) lines.push('*Customer:* ' + bridgeContext.customerName);

    lines.push('');
    lines.push('*Error:* ' + (bridgeContext.error || (bridgeErr && bridgeErr.message) || 'Unknown error'));

    var response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: lines.join('\n') }),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();

    if (code < 200 || code >= 300) {
      Logger.log('Bridge failure notification HTTP ' + code + ' — ' + response.getContentText().slice(0, 300));
      return { ok: false, reason: 'Google Chat webhook returned HTTP ' + code };
    }

    return { ok: true };
  } catch (err) {
    Logger.log('Bridge failure notification error (non-fatal): ' + (err && err.message ? err.message : String(err)));
    return { ok: false, reason: String(err) };
  }
}

// Google Chat's text message limit is 4096 chars. Stay under it with headroom
// for the part indicator we prepend to multi-part messages.
var EOJ_CHAT_MESSAGE_LIMIT = 3800;

/**
 * Build the full EOJ report as one or more Google Chat text messages.
 * Sections with no content are omitted entirely (no empty labels). When the
 * full report exceeds the Chat length limit it is split across sequential
 * messages tagged (1/N), (2/N)… — never silently truncated.
 *
 * @param {Object} interpreted - output of interpretBasicEOJ_()
 * @returns {string[]} one or more message bodies, in send order
 */
function buildEojChatMessages_(interpreted) {
  var blocks = buildEojChatSections_(interpreted)
    .filter(function (s) { return s.lines && s.lines.length; })
    .map(function (s) {
      return (s.title ? '*' + s.title + '*\n' : '') + s.lines.join('\n');
    });

  if (!blocks.length) {
    return ['EOJ submitted' + (interpreted.eojId ? ' (' + interpreted.eojId + ')' : '') + ' — no details captured.'];
  }

  // Pack blocks into messages under the limit, splitting an oversized single
  // block only as a last resort.
  var messages = [];
  var current = '';

  blocks.forEach(function (block) {
    var candidate = current ? current + '\n\n' + block : block;

    if (candidate.length <= EOJ_CHAT_MESSAGE_LIMIT) {
      current = candidate;
      return;
    }

    if (current) { messages.push(current); current = ''; }

    if (block.length <= EOJ_CHAT_MESSAGE_LIMIT) {
      current = block;
      return;
    }

    // Single block too large: hard-split on the limit.
    var rest = block;
    while (rest.length > EOJ_CHAT_MESSAGE_LIMIT) {
      messages.push(rest.slice(0, EOJ_CHAT_MESSAGE_LIMIT));
      rest = rest.slice(EOJ_CHAT_MESSAGE_LIMIT);
    }
    current = rest;
  });

  if (current) messages.push(current);

  if (messages.length > 1) {
    var total = messages.length;
    messages = messages.map(function (m, i) { return '(' + (i + 1) + '/' + total + ')\n' + m; });
  }

  return messages;
}

/**
 * Build the ordered list of report sections. Each is { title, lines[] }.
 * Values come from the interpreted structured outputs where available, and
 * fall back to the raw submitted payload for fields the interpreter does not
 * surface. Only non-blank values are pushed.
 */
function buildEojChatSections_(interpreted) {
  var p = interpreted.rawParsed || {};
  var equip = interpreted.equipmentOutput || {};
  var mon = interpreted.monitoringOutput || {};
  var mica = interpreted.micaOutput || {};
  var follow = interpreted.followUpOutput || {};

  var sections = [];

  // ── Header ────────────────────────────────────────────────────────────────
  var header = [];
  chatPush_(header, 'Customer', firstNonBlankStr_(interpreted.customerName, p.customerName, interpreted.jobName, p.jobName));
  chatPush_(header, 'Claim #', firstNonBlankStr_(interpreted.claimNumber, p.claimNumber));
  chatPush_(header, 'Technician', firstNonBlankStr_(interpreted.technician, p.technician));
  chatPush_(header, 'Date', firstNonBlankStr_(interpreted.visitDate, p.visitDate));
  chatPush_(header, 'Visit Type', firstNonBlankStr_(interpreted.visitType, p.visitType));
  chatPush_(header, 'Status', firstNonBlankStr_(p.jobStatus, (interpreted.jobStatusOutput || {}).job_status));
  sections.push({ title: 'EOJ Report', lines: header });

  // ── Work ────────────────────────────────────────────────────────────────
  var work = [];
  chatPush_(work, 'Work Performed', firstNonBlankStr_(p.workPerformed));
  chatPush_(work, 'Areas Worked', firstNonBlankStr_(p.areasWorked, p.areas));
  chatPushBool_(work, 'Demo Performed', p.demoPerformed);
  chatPush_(work, 'Materials Used', firstNonBlankStr_(p.materialsUsed, p.materials));
  chatPush_(work, 'Technician Notes', firstNonBlankStr_(p.technicianNotes));
  chatPush_(work, 'Other Notes', firstNonBlankStr_(p.otherVisitNotes));
  sections.push({ title: 'Work', lines: work });

  // ── Monitoring / drying ────────────────────────────────────────────────
  var drying = [];
  chatPush_(drying, 'Monitoring Status', firstNonBlankStr_(mon.monitoring_status, p.monitoringStatus));
  chatPush_(drying, 'Monitoring Notes', firstNonBlankStr_(mon.monitoring_notes, p.monitoringNotes));
  chatPush_(drying, 'Moisture Readings', firstNonBlankStr_(p.moistureReadings, p.moisture));
  chatPush_(drying, 'Drying Status', firstNonBlankStr_(p.dryingStatus));
  if (booleanish_(mon.next_monitoring_required) || booleanish_(p.nextMonitoringNeeded)) {
    chatPush_(drying, 'Next Monitoring', 'Needed');
    chatPush_(drying, 'Next Monitoring Date', firstNonBlankStr_(mon.next_monitoring_date, p.nextMonitoringDate));
    chatPush_(drying, 'Preferred Window', firstNonBlankStr_(mon.next_monitoring_window, p.nextMonitoringWindow));
  }
  sections.push({ title: 'Monitoring & Drying', lines: drying });

  // ── Equipment ──────────────────────────────────────────────────────────
  sections.push({ title: 'Equipment', lines: buildEquipmentChatLines_(equip, p) });

  // ── Asbestos ───────────────────────────────────────────────────────────
  var asb = [];
  chatPush_(asb, 'Testing Needed', firstNonBlankStr_(p.asbestosTestNeeded));
  chatPush_(asb, 'Handler', firstNonBlankStr_(p.asbestosHandler));
  chatPush_(asb, 'Samples Taken', firstNonBlankStr_(p.asbestosSamplesTaken));
  if (numberish_(p.asbestosSampleCount) > 0) chatPush_(asb, 'Sample Count', String(numberish_(p.asbestosSampleCount)));
  chatPush_(asb, 'Follow-Up', firstNonBlankStr_(p.asbestosFollowUpDescription));
  sections.push({ title: 'Asbestos', lines: asb });

  // ── ITEL ───────────────────────────────────────────────────────────────
  var itel = [];
  if (booleanish_(p.flooringRemoved)) chatPush_(itel, 'Flooring Removed', 'Yes');
  chatPush_(itel, 'Sample Status', firstNonBlankStr_(p.itelSampleStatus));
  chatPush_(itel, 'Notes', firstNonBlankStr_(p.itelNotes));
  sections.push({ title: 'ITEL', lines: itel });

  // ── Mitigate / MICA ────────────────────────────────────────────────────
  var mit = [];
  chatPush_(mit, 'Mitigate Status', firstNonBlankStr_(mica.mica_status, p.micaStatus, p.micaUpdated));
  chatPush_(mit, 'Delay Reason', firstNonBlankStr_(mica.mica_delay_reason, p.micaDelayReason));
  chatPush_(mit, 'Expected Update', firstNonBlankStr_(mica.mica_expected_update_date, p.micaExpectedDate));
  chatPush_(mit, 'Plan Summary', firstNonBlankStr_(mica.mitigation_plan_summary, p.mitigationPlanSummary));
  sections.push({ title: 'Mitigate', lines: mit });

  // ── Customer communication / issues / next steps ────────────────────────
  var comm = [];
  chatPush_(comm, 'Customer Communication', firstNonBlankStr_(p.customerCommunication, p.customerComms));
  chatPush_(comm, 'Issues / Blockers', firstNonBlankStr_(p.issues, p.blockers));
  chatPush_(comm, 'Next Steps', firstNonBlankStr_(p.nextSteps, p.remainingWork));
  sections.push({ title: 'Communication & Next Steps', lines: comm });

  // ── Return / calendar ──────────────────────────────────────────────────
  var ret = [];
  chatPush_(ret, 'Need to Return', firstNonBlankStr_(p.needToReturn));
  chatPush_(ret, 'Return Date', firstNonBlankStr_(p.returnDate));
  chatPush_(ret, 'Add to Tomorrow’s Calendar', firstNonBlankStr_(p.addToTomorrowCalendar));
  sections.push({ title: 'Return & Scheduling', lines: ret });

  // ── Office follow-up ───────────────────────────────────────────────────
  var fu = [];
  if (booleanish_(follow.follow_up_required) || booleanish_(p.followUpNeeded)) {
    chatPush_(fu, 'Action', firstNonBlankStr_(p.followUpAction) +
      (firstNonBlankStr_(p.followUpAssignedTo, follow.assigned_to) ? ' → ' + firstNonBlankStr_(p.followUpAssignedTo, follow.assigned_to) : ''));
    chatPush_(fu, 'Note', firstNonBlankStr_(p.followUpNote, follow.description, p.followUpDescription));
  }
  chatPush_(fu, 'Waiting On', firstNonBlankStr_(follow.waiting_on, p.waitingOn));
  sections.push({ title: 'Office Follow-Up', lines: fu });

  return sections;
}

function buildEquipmentChatLines_(equip, p) {
  var lines = [];
  var after = equip.equipment_after || {};
  var before = equip.equipment_before || {};
  var added = equip.equipment_added || {};
  var removed = equip.equipment_removed || {};

  Object.keys(after).forEach(function (key) {
    var label = (after[key] && after[key].label) || key;
    var b = after[key] ? Number(after[key].count) || 0 : 0;
    var a = added[key] ? Number(added[key].count) || 0 : 0;
    var r = removed[key] ? Number(removed[key].count) || 0 : 0;
    var startCount = before[key] ? Number(before[key].count) || 0 : 0;
    if (b === 0 && a === 0 && r === 0 && startCount === 0) return; // skip untouched
    var detail = [];
    if (a) detail.push('+' + a);
    if (r) detail.push('-' + r);
    chatPush_(lines, label, b + ' on site' + (detail.length ? ' (' + detail.join(', ') + ')' : ''));
  });

  if (booleanish_(equip.equipment_pickup_complete) || booleanish_(p.equipmentPickedUp)) {
    lines.push('*Equipment picked up:* Yes');
  }
  if (booleanish_(equip.equipment_still_needed) || booleanish_(p.equipmentStillNeeded)) {
    lines.push('*Equipment still needed:* Yes');
  }
  chatPush_(lines, 'Notes', firstNonBlankStr_(equip.summary, p.equipmentSummary));
  return lines;
}

// Push '*Label:* value' only when value is non-blank.
function chatPush_(lines, label, value) {
  var v = value === null || value === undefined ? '' : String(value).trim();
  if (v) lines.push('*' + label + ':* ' + v);
}

// Push a Yes line for a truthy boolean-ish value; omit otherwise.
function chatPushBool_(lines, label, value) {
  if (booleanish_(value)) lines.push('*' + label + ':* Yes');
}

function firstNonBlankStr_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function booleanish_(v) {
  if (v === true) return true;
  if (typeof v === 'number') return v > 0;
  if (typeof v === 'string') {
    return ['yes', 'true', 'needed', 'required', 'active', 'complete', 'completed', '1'].indexOf(v.toLowerCase().trim()) !== -1;
  }
  return false;
}

function numberish_(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}
