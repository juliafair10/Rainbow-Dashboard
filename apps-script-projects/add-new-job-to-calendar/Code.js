/**
 * Gmail to Google Calendar Automation Script
 * Automation: Add New Job to Calendar
 */

const CONFIG = {
  gmailLabel: "Calendar Events",
  calendarId: "6aqe6hond86u044тgs868ouje8@group.calendar.google.com",
  processedLabel: "Calendar Events - Processed",
  automationName: "Add New Job to Calendar",
  mainFunction: "processEmailsToCalendar"
};

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";

  if (action === "process") {
    const startedAt = new Date();

    try {
      const result = processEmailsToCalendar();
      const endedAt = new Date();

      const response = {
        status: result.success ? "Success" : "Error",
        automation: CONFIG.automationName,
        mainFunction: CONFIG.mainFunction,
        message: result.message,
        result: result.result,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString()
      };

      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      const endedAt = new Date();

      const response = {
        status: "Error",
        automation: CONFIG.automationName,
        mainFunction: CONFIG.mainFunction,
        message: error.toString(),
        result: {},
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString()
      };

      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "Error",
      automation: CONFIG.automationName,
      mainFunction: CONFIG.mainFunction,
      message: "No action specified.",
      result: {}
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function processEmailsToCalendar() {
  const summary = {
    threadsFound: 0,
    eventsCreated: 0,
    skipped: 0,
    failed: 0
  };

  try {
    const label = GmailApp.getUserLabelByName(CONFIG.gmailLabel);

    if (!label) {
      return {
        success: false,
        message: "ERROR: Gmail label not found: " + CONFIG.gmailLabel,
        result: summary
      };
    }

    const threads = label.getThreads(0, 50);
    summary.threadsFound = threads.length;

    if (threads.length === 0) {
      return {
        success: true,
        message: "No calendar emails to process.",
        result: summary
      };
    }

    let processedLabel = GmailApp.getUserLabelByName(CONFIG.processedLabel);

    if (!processedLabel) {
      processedLabel = GmailApp.createLabel(CONFIG.processedLabel);
    }

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const messages = thread.getMessages();

      if (messages.length === 0) {
        summary.skipped++;
        continue;
      }

      const labels = thread.getLabels().map(label => label.getName());

      if (labels.includes(CONFIG.processedLabel)) {
        summary.skipped++;
        continue;
      }

      const message = messages[messages.length - 1];
      const emailData = extractEmailData(message);

      if (emailData && emailData.insuredName && emailData.claimNumber) {
        if (createCalendarDraft(emailData)) {
          thread.addLabel(processedLabel);
          summary.eventsCreated++;
        } else {
          summary.failed++;
        }
      } else {
        summary.failed++;
      }
    }

    return {
      success: true,
      message:
        "Calendar processing complete. Threads found: " +
        summary.threadsFound +
        ", events created: " +
        summary.eventsCreated +
        ", skipped: " +
        summary.skipped +
        ", failed: " +
        summary.failed +
        ".",
      result: summary
    };

  } catch (error) {
    return {
      success: false,
      message: "ERROR: " + error.toString(),
      result: summary
    };
  }
}

function extractEmailData(message) {
  const body = message.getPlainBody();
  const receivedDate = message.getDate();

  let data = {
    subject: message.getSubject(),
    body: body,
    receivedDate: receivedDate,
    insuredName: null,
    carrierAbbrev: null,
    claimNumber: null,
    dateOfLoss: null,
    phone: null,
    email: null,
    lossType: null,
    propertyAddress: null,
    lossDescription: null,
    claimxperienceLink: null,
    eventTitle: null,
    lossCategory: null,
    lossEmoji: null
  };

  if (body.includes("has assigned you a new")) {
    extractSymbilityData(data);
  } else {
    extractXactAnalysisData(data);
  }

  const lossInfo = classifyLoss(data);
  data.lossCategory = lossInfo.category;
  data.lossEmoji = lossInfo.emoji;

  if (data.insuredName && data.carrierAbbrev) {
    data.eventTitle =
      "[DRAFT] " +
      data.insuredName.toUpperCase() +
      " - " +
      data.carrierAbbrev +
      " - " +
      data.lossEmoji +
      " ℹ️";
  }

  return data;
}

function classifyLoss(data) {
  const text = [
    data.lossType,
    data.lossDescription,
    data.subject,
    data.body
  ].filter(Boolean).join(" ").toLowerCase();

  const moldWords = ["mold", "mould", "fungal", "fungus", "microbial", "mildew"];

  const waterWords = [
    "water", "plumbing", "pipe", "flood", "leak", "burst",
    "toilet", "supply line", "drain", "sewer", "roof leak",
    "dishwasher", "washing machine", "water heater"
  ];

  const fireWords = [
    "fire", "smoke", "soot", "burn", "burned",
    "electrical fire", "kitchen fire", "grease fire"
  ];

  if (containsAny(text, moldWords)) {
    return { category: "Mold", emoji: "🦠" };
  }

  if (containsAny(text, waterWords)) {
    return { category: "Water", emoji: "💧" };
  }

  if (containsAny(text, fireWords)) {
    return { category: "Fire", emoji: "🔥" };
  }

  return { category: "Unknown", emoji: "ℹ️" };
}

function containsAny(text, words) {
  return words.some(word => text.includes(word));
}

function extractXactAnalysisData(data) {
  const body = data.body;

  const insuredMatch = body.match(/Insured Name:\s*([^\n]+)/i);
  if (insuredMatch) data.insuredName = insuredMatch[1].trim();

  const carrierMatch = body.match(/From:\s*([^\-]+)\s*-/);
  if (carrierMatch) data.carrierAbbrev = getCarrierAbbrev(carrierMatch[1].trim());

  const claimMatch = body.match(/Claim Number:\s*([A-Za-z0-9\-]+)/i);
  if (claimMatch) data.claimNumber = claimMatch[1].trim();

  const dateMatch = body.match(/Date of Loss:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dateMatch) data.dateOfLoss = parseDate(dateMatch[1]);

  const phoneMatch = body.match(/(?:Evening Phone|Phone):\s*([\d\(\)\-\s\.]+)/i);
  if (phoneMatch) data.phone = phoneMatch[1].trim();

  const emailMatch = body.match(/Email[:\s]+Address[:\s]*([^\s\n]+@[^\s\n]+)/i);
  if (emailMatch) data.email = emailMatch[1].trim();

  const lossTypeMatch = body.match(/Type of Loss:\s*([^\n]+)/i);
  if (lossTypeMatch) data.lossType = lossTypeMatch[1].trim();

  const addressMatch = body.match(/Location of Property:\s*([^\n]+)/i);
  if (addressMatch) data.propertyAddress = addressMatch[1].trim();

  const lossDescMatch = body.match(/Loss Description:\s*([^\n]+)/i);
  if (lossDescMatch) data.lossDescription = lossDescMatch[1].trim();

  const linkMatch = body.match(/(https:\/\/[^\s\n]+claimxperience[^\s\n]*)/i);
  if (linkMatch) data.claimxperienceLink = linkMatch[1].trim();
}

function extractSymbilityData(data) {
  const body = data.body;

  const claimMatch = body.match(/claim:\s*#?([A-Za-z0-9\-]+)/i);
  if (claimMatch) data.claimNumber = claimMatch[1].trim();

  const lossDescMatch = body.match(/has assigned you a new\s+([^,]+),\s*claim:/i);
  if (lossDescMatch) data.lossDescription = lossDescMatch[1].trim();

  const insuredMatch = body.match(/assignment\s+"[^"]+",\s*([^,]+),\s*phone:/i);
  if (insuredMatch) data.insuredName = insuredMatch[1].trim();

  const phoneMatch = body.match(/phone:\s*(\([^)]+\)[^,\n]+)/i);
  if (phoneMatch) data.phone = phoneMatch[1].trim();

  const addressMatch = body.match(/address:\s*([^)]+)/i);
  if (addressMatch) data.propertyAddress = addressMatch[1].trim();

  const originatorMatch = body.match(/Claim Originator:\s*([^\n]+)/i);
  if (originatorMatch) data.carrierAbbrev = getCarrierAbbrev(originatorMatch[1].trim());

  const linkMatch = body.match(/(https:\/\/[^\s\n]+symbility[^\s\n]*)/i);
  if (linkMatch) data.claimxperienceLink = linkMatch[1].trim();

  data.lossType = data.lossDescription;
}

function getCarrierAbbrev(carrierName) {
  const abbrevs = {
    "allstate": "AS",
    "state farm": "SF",
    "geico": "GEICO",
    "progressive": "PROG",
    "liberty mutual": "LM",
    "amica": "AMICA",
    "farmers": "FARM",
    "nationwide": "NW",
    "usaa": "USAA",
    "travelers": "TRAV"
  };

  const lower = carrierName.toLowerCase();

  for (const key in abbrevs) {
    if (lower.includes(key)) return abbrevs[key];
  }

  return carrierName
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .substring(0, 3);
}

function parseDate(dateString) {
  const parts = dateString.split("/");
  return new Date(parts[2], parts[0] - 1, parts[1]);
}

function createCalendarDraft(data) {
  try {
    const calendar = CalendarApp.getCalendarById(CONFIG.calendarId);

    if (!calendar) {
      Logger.log("ERROR: Calendar not found.");
      return false;
    }

    const startTime = new Date(data.receivedDate);
    startTime.setHours(0, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(1, 0, 0, 0);

    let description = "CLAIM DETAILS\n============\n\n";

    if (data.claimNumber) description += "Claim #: " + data.claimNumber + "\n";
    if (data.phone) description += "Phone: " + data.phone + "\n";
    if (data.email) description += "Email: " + data.email + "\n";
    if (data.lossCategory) description += "Loss Category: " + data.lossCategory + "\n";
    if (data.lossType) description += "Loss Type: " + data.lossType + "\n";
    if (data.dateOfLoss) description += "Date of Loss: " + formatDate(data.dateOfLoss) + "\n";
    if (data.propertyAddress) description += "Property: " + data.propertyAddress + "\n";
    if (data.lossDescription) description += "Loss: " + data.lossDescription + "\n";
    if (data.claimxperienceLink) description += "\nClaim Link:\n" + data.claimxperienceLink + "\n";

    calendar.createEvent(data.eventTitle, startTime, endTime, {
      description: description,
      location: data.propertyAddress || ""
    });

    sendReminderEmail(data);
    return true;

  } catch (error) {
    Logger.log("ERROR creating calendar: " + error.toString());
    return false;
  }
}

function sendReminderEmail(data) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const subject = "⏰ Set Calendar Time: " + data.eventTitle;

    let body = "A new calendar draft event has been created:\n\n";
    body += "Event: " + data.eventTitle + "\n";
    body += "Created: " + formatDate(data.receivedDate) + "\n";
    if (data.dateOfLoss) body += "Date of Loss: " + formatDate(data.dateOfLoss) + "\n";
    body += "Claim #: " + (data.claimNumber || "N/A") + "\n";
    body += "Insured: " + (data.insuredName || "N/A") + "\n";
    body += "Phone: " + (data.phone || "N/A") + "\n";
    body += "Loss Category: " + (data.lossCategory || "N/A") + "\n\n";
    body += "ACTION REQUIRED:\n";
    body += "Please open your calendar and set the time for this appointment.\n\n";
    body += "Event Details:\n";
    body += "- Property: " + (data.propertyAddress || "N/A") + "\n";
    body += "- Loss Type: " + (data.lossType || "N/A") + "\n";
    body += "- Loss Description: " + (data.lossDescription || "N/A") + "\n";

    if (data.claimxperienceLink) {
      body += "\nLink:\n" + data.claimxperienceLink + "\n";
    }

    GmailApp.sendEmail(userEmail, subject, body);

  } catch (error) {
    Logger.log("ERROR sending email: " + error.toString());
  }
}

function formatDate(date) {
  if (!date) return "N/A";

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  return month + "/" + day + "/" + year;
}

function testProcessing() {
  Logger.log("Running test...");
  processEmailsToCalendar();
}

function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();

  for (let i = 0; i < triggers.length; i++) {
    if (
      triggers[i].getHandlerFunction() === "processEmailsToCalendar" ||
      triggers[i].getHandlerFunction() === "processEmailsToCalendarAndChat"
    ) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("processEmailsToCalendar")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();

  Logger.log("Daily trigger set up at 8 AM");
}