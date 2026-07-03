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

    var message = buildChatMessage_(interpreted);

    var response = UrlFetchApp.fetch(webhookUrl, {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify({ text: message }),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();

    if (code < 200 || code >= 300) {
      Logger.log('GoogleChatNotifier: HTTP ' + code + ' — ' + response.getContentText().slice(0, 300));
      return { ok: false, reason: 'Google Chat webhook returned HTTP ' + code };
    }

    Logger.log('GoogleChatNotifier: notification posted for ' + (interpreted.eojId || 'unknown EOJ'));
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

    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: lines.join('\n') }),
      muteHttpExceptions: true
    });

    return { ok: true };
  } catch (err) {
    Logger.log('Bridge failure notification error (non-fatal): ' + (err && err.message ? err.message : String(err)));
    return { ok: false, reason: String(err) };
  }
}

/**
 * Build the plain-text notification message.
 * Format is preserved from the existing Zapier/Google Sheets notification style.
 * Update this function to redesign the format without touching processing logic.
 *
 * @param {Object} interpreted
 * @returns {string}
 */
function buildChatMessage_(interpreted) {
  var payload    = interpreted.rawParsed || {};
  var technician = String(interpreted.technician   || '').trim();
  var jobName    = String(interpreted.jobName      || payload.jobName     || '').trim();
  var customer   = String(interpreted.customerName || payload.customerName || jobName).trim();
  var claimNum   = String(interpreted.claimNumber  || payload.claimNumber || '').trim();
  var visitDate  = String(interpreted.visitDate    || '').trim();
  var visitType  = String(interpreted.visitType    || payload.visitType   || '').trim();
  var jobStatus  = String(interpreted.jobStatus    || payload.jobStatus   || '').trim();
  var workDone   = String(payload.workPerformed    || '').trim();

  var lines = [];

  if (technician) lines.push('*Technician:* ' + technician);
  if (customer)   lines.push('*Customer:* '   + customer);
  if (claimNum)   lines.push('*Claim #:* '    + claimNum);
  if (visitDate)  lines.push('*Date:* '       + visitDate);
  if (visitType)  lines.push('*Visit Type:* ' + visitType);
  if (jobStatus)  lines.push('*Status:* '     + jobStatus);

  if (workDone) {
    lines.push('');
    var summary = workDone.length > 300 ? workDone.slice(0, 297) + '…' : workDone;
    lines.push(summary);
  }

  if (payload.followUpNeeded) {
    var action   = String(payload.followUpAction     || '').trim();
    var assignee = String(payload.followUpAssignedTo || '').trim();
    var note     = String(payload.followUpNote       || payload.followUpDescription || '').trim();
    lines.push('');
    lines.push('*Office Follow-Up Needed*');
    if (action)  lines.push('*Action:* ' + action + (assignee ? ' → ' + assignee : ''));
    if (note)    lines.push('*Note:* '   + note);
  }

  return lines.join('\n');
}
