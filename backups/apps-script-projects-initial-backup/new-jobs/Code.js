/**
 * Gmail to Google Calendar & Chat Automation Script
 * 
 * This script monitors Gmail for insurance assignment emails and:
 * 1. Creates a DRAFT calendar event (you set the time)
 * 2. Creates a task in Google Chat "Clarence" space with due date = email date + 3 days
 * 
 * Setup Instructions:
 * 1. Go to script.google.com
 * 2. Create a new project
 * 3. Paste this entire code
 * 4. Save the project
 * 5. Run setupDailyTrigger() to create an automatic daily trigger
 */

// ============================================================================
// CONFIGURATION - CUSTOMIZE THESE SETTINGS
// ============================================================================

const CONFIG = {
  // Label to watch for emails (create this label in Gmail first)
  gmailLabel: "Calendar Events",
  
  // Calendar ID (leave as "primary" for your main calendar)
  calendarId: "primary",
  
  // Google Chat space name where tasks should be created
  chatSpaceName: "Clarence",
  
  // Mark processed emails with this label (prevent re-processing)
  processedLabel: "Calendar Events - Processed",
  
  // Default event duration (in minutes) if end time not specified
  defaultDurationMinutes: 60,
  
  // Days to add to email date for task due date
  taskDueDateOffset: 3,
  
  // Email addresses to exclude (optional)
  excludeSenders: []
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Main function: Process unread emails and create calendar drafts + chat tasks
 */
function processEmailsToCalendarAndChat() {
  try {
    Logger.log("Starting email processing...");
    
    // Get the Gmail label
    const label = GmailApp.getUserLabelByName(CONFIG.gmailLabel);
    if (!label) {
      Logger.log("ERROR: Label '" + CONFIG.gmailLabel + "' not found. Please create this label in Gmail first.");
      return;
    }
    
    // Get unprocessed threads from the label
    const threads = label.getThreads(0, 50);
    const processedLabel = GmailApp.getUserLabelByName(CONFIG.processedLabel);
    
    if (threads.length === 0) {
      Logger.log("No threads to process.");
      return;
    }
    
    Logger.log("Found " + threads.length + " threads to process.");
    
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const messages = thread.getMessages();
      
      if (messages.length > 0) {
        const message = messages[messages.length - 1];
        
        // Skip if already processed
        if (processedLabel && message.getThread().hasLabel(processedLabel)) {
          continue;
        }
        
        // Skip if sender is in exclusion list
        if (shouldExcludeSender(message.getFrom())) {
          continue;
        }
        
        const emailData = extractEmailData(message);
        
        if (emailData && emailData.insuredName && emailData.dateOfLoss) {
          let success = true;
          
          // Create calendar draft event
          const calendarCreated = createCalendarDraft(emailData);
          if (calendarCreated) {
            Logger.log("✓ Created calendar draft: " + emailData.eventTitle);
          } else {
            Logger.log("✗ Failed to create calendar draft");
            success = false;
          }
          
          // Create chat task
          const chatTaskCreated = createChatTask(emailData);
          if (chatTaskCreated) {
            Logger.log("✓ Created chat task in Clarence space");
          } else {
            Logger.log("✗ Failed to create chat task");
            success = false;
          }
          
          // Mark as processed only if both succeeded
          if (success && processedLabel) {
            message.getThread().addLabel(processedLabel);
            Logger.log("✓ Marked email as processed");
          }
        } else {
          Logger.log("✗ Could not extract required data from: " + message.getSubject());
        }
      }
    }
    
    Logger.log("Email processing completed.");
    
  } catch (error) {
    Logger.log("ERROR: " + error.toString());
  }
}

/**
 * Extract all relevant data from the assignment email
 * Handles both XactAnalysis and Symbility (Claims Workspace) formats
 */
function extractEmailData(message) {
  const subject = message.getSubject();
  const body = message.getPlainBody();
  const from = message.getFrom();
  const receivedDate = message.getDate();
  
  let emailData = {
    subject: subject,
    body: body,
    from: from,
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
    xaId: null,
    claimxperienceLink: null,
    eventTitle: null,
    taskTitle: null,
    taskDueDate: null,
    isWaterDamage: false,
    emailFormat: null
  };
  
  // Determine which email format this is
  if (body.includes("has assigned you a new")) {
    emailData.emailFormat = "symbility";
    extractSymbilityData(emailData);
  } else {
    emailData.emailFormat = "xactanalysis";
    extractXactAnalysisData(emailData);
  }
  
  // Determine if water or fire damage for emoji
  const lossText = (emailData.lossType || emailData.lossDescription || "").toLowerCase();
  emailData.isWaterDamage = lossText.includes("water") || lossText.includes("plumbing") || 
                             lossText.includes("pipe") || lossText.includes("flood");
  
  // Build Event Title with emoji: [DRAFT] NAME - CARRIER - EMOJI EMOJI
  if (emailData.insuredName && emailData.carrierAbbrev) {
    const emoji = emailData.isWaterDamage ? "💧" : "🔥";
    emailData.eventTitle = "[DRAFT] " + emailData.insuredName.toUpperCase() + " - " + emailData.carrierAbbrev + " - " + emoji + " ℹ️";
  }
  
  // Build Task Title: INSURED NAME - CARRIER ABBREV - CLAIM #
  if (emailData.insuredName && emailData.carrierAbbrev && emailData.claimNumber) {
    emailData.taskTitle = emailData.insuredName.toUpperCase() + " - " + emailData.carrierAbbrev + " " + emailData.claimNumber;
  }
  
  // Calculate task due date (email received + 3 days)
  const dueDate = new Date(emailData.receivedDate);
  dueDate.setDate(dueDate.getDate() + CONFIG.taskDueDateOffset);
  emailData.taskDueDate = dueDate;
  
  return emailData;
}

/**
 * Extract data from XactAnalysis format emails
 */
function extractXactAnalysisData(emailData) {
  const body = emailData.body;
  
  // Extract Insured Name
  const insuredMatch = body.match(/Insured Name:\s*([^\n]+)/i);
  if (insuredMatch) {
    emailData.insuredName = insuredMatch[1].trim();
  }
  
  // Extract Carrier (from "From:" field)
  const carrierMatch = body.match(/From:\s*([^\-]+)\s*-/);
  if (carrierMatch) {
    const carrierFull = carrierMatch[1].trim();
    emailData.carrierAbbrev = getCarrierAbbrev(carrierFull);
  }
  
  // Extract Claim Number
  const claimMatch = body.match(/Claim Number:\s*(\d+)/i);
  if (claimMatch) {
    emailData.claimNumber = claimMatch[1].trim();
  }
  
  // Extract Date of Loss
  const dateOfLossMatch = body.match(/Date of Loss:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (dateOfLossMatch) {
    emailData.dateOfLoss = parseDate(dateOfLossMatch[1]);
  }
  
  // Extract Phone Number
  const phoneMatch = body.match(/(?:Evening Phone|Phone):\s*([\d\(\)\-\s]+)/i);
  if (phoneMatch) {
    emailData.phone = phoneMatch[1].trim();
  }
  
  // Extract Email Address
  const emailMatch = body.match(/Email[:\s]+Address[:\s]*([^\s\n]+@[^\s\n]+)/i);
  if (emailMatch) {
    emailData.email = emailMatch[1].trim();
  }
  
  // Extract Loss Type
  const lossTypeMatch = body.match(/Type of Loss:\s*([^\n]+)/i);
  if (lossTypeMatch) {
    emailData.lossType = lossTypeMatch[1].trim();
  }
  
  // Extract Property Address
  const addressMatch = body.match(/Location of Property:\s*([^\n]+)/);
  if (addressMatch) {
    emailData.propertyAddress = addressMatch[1].trim();
  }
  
  // Extract Loss Description
  const lossDescMatch = body.match(/Loss Description:\s*([^\n]+)/i);
  if (lossDescMatch) {
    emailData.lossDescription = lossDescMatch[1].trim();
  }
  
  // Extract XA ID
  const xaIdMatch = body.match(/XA ID:\s*([^\s\n]+)/i);
  if (xaIdMatch) {
    emailData.xaId = xaIdMatch[1].trim();
  }
  
  // Extract ClaimXperience Link
  const linkMatch = body.match(/(https:\/\/[^\s\n]+claimxperience[^\s\n]*)/i);
  if (linkMatch) {
    emailData.claimxperienceLink = linkMatch[1].trim();
  }
}

/**
 * Extract data from Symbility (Claims Workspace) format emails
 */
function extractSymbilityData(emailData) {
  const body = emailData.body;
  const subject = emailData.subject;
  
  // Extract Claim Number from subject or body
  // Pattern: "claim: #0611913381"
  const claimMatch = body.match(/claim:\s*#?(\d+)/i);
  if (claimMatch) {
    emailData.claimNumber = claimMatch[1].trim();
  }
  
  // Extract Insured Name and Carrier from the main assignment line
  // Pattern: "has assigned you a new ... claim: #061191381 (assignment "EMS-Water", VERONA REID, phone:...)"
  const assignmentMatch = body.match(/has assigned you a new\s+([^,]+),\s*claim:\s*#?\d+\s*\(assignment\s+"([^"]+)",\s*([^,]+),\s*phone:/i);
  
  if (assignmentMatch) {
    emailData.lossDescription = assignmentMatch[1].trim();
    // assignmentMatch[2] would be the assignment type like "EMS-Water"
  }
  
  // Extract insured name - look for pattern after "assignment type" and before "phone"
  const insuredMatch = body.match(/assignment\s+"[^"]+",\s*([^,]+),\s*phone:/i);
  if (insuredMatch) {
    emailData.insuredName = insuredMatch[1].trim();
  }
  
  // Extract Phone Number
  const phoneMatch = body.match(/phone:\s*(\([^)]+\)\s*[\d\-]+)/i);
  if (phoneMatch) {
    emailData.phone = phoneMatch[1].trim();
  }
  
  // Extract Address
  const addressMatch = body.match(/address:\s*([^)]+)/i);
  if (addressMatch) {
    emailData.propertyAddress = addressMatch[1].trim();
  }
  
  // Extract Claim Originator (Insurance Company)
  const originatorMatch = body.match(/Claim Originator:\s*([^\n]+)/i);
  if (originatorMatch) {
    const originator = originatorMatch[1].trim();
    emailData.carrierAbbrev = getCarrierAbbrev(originator);
  }
  
  // Extract Symbility link
  const linkMatch = body.match(/(https:\/\/[^\s\n]+symbility[^\s\n]*)/i);
  if (linkMatch) {
    emailData.claimxperienceLink = linkMatch[1].trim();
  }
  
  // Loss type is in the assignment description
  emailData.lossType = emailData.lossDescription;
}

/**
 * Get carrier abbreviation from full carrier name
 */
function getCarrierAbbrev(carrierName) {
  const abbreviations = {
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
  
  const lowerName = carrierName.toLowerCase().trim();
  
  for (const [key, abbrev] of Object.entries(abbreviations)) {
    if (lowerName.includes(key)) {
      return abbrev;
    }
  }
  
  // If no match, use first letters of each word (max 3 letters)
  return carrierName.split(" ").map(word => word[0]).join("").toUpperCase().substring(0, 3);
}

/**
 * Parse date string in MM/DD/YYYY format
 */
function parseDate(dateString) {
  const [month, day, year] = dateString.split("/");
  return new Date(year, month - 1, day);
}

/**
 * Create a calendar draft event (with [DRAFT] prefix)
 * Event is set for 12:00 AM on the day the email was received for you to edit
 */
function createCalendarDraft(emailData) {
  try {
    const calendar = CalendarApp.getCalendarById(CONFIG.calendarId);
    if (!calendar) {
      Logger.log("ERROR: Calendar not found.");
      return false;
    }
    
    // Set event for 12:00 AM - 1:00 AM on the day the email was received (you'll edit this)
    const startTime = new Date(emailData.receivedDate);
    startTime.setHours(0, 0, 0);
    startTime.setMinutes(0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(1, 0, 0);
    
    // Build description with all available info
    let description = "CLAIM DETAILS\n";
    description += "============\n\n";
    if (emailData.claimNumber) description += "Claim #: " + emailData.claimNumber + "\n";
    if (emailData.phone) description += "Phone: " + emailData.phone + "\n";
    if (emailData.email) description += "Email: " + emailData.email + "\n";
    if (emailData.lossType) description += "Loss Type: " + emailData.lossType + "\n";
    if (emailData.dateOfLoss) description += "Date of Loss: " + formatDate(emailData.dateOfLoss) + "\n";
    if (emailData.propertyAddress) description += "Property: " + emailData.propertyAddress + "\n";
    if (emailData.lossDescription) description += "Loss: " + emailData.lossDescription + "\n";
    if (emailData.xaId) description += "XA ID: " + emailData.xaId + "\n";
    if (emailData.claimxperienceLink) description += "Link: " + emailData.claimxperienceLink + "\n";
    
    const event = calendar.createEvent(
      emailData.eventTitle,
      startTime,
      endTime,
      {
        description: description,
        location: emailData.propertyAddress || ""
      }
    );
    
    // Send reminder email to set the time
    sendReminderEmail(emailData);
    
    return true;
  } catch (error) {
    Logger.log("ERROR creating calendar event: " + error.toString());
    return false;
  }
}

/**
 * Send a reminder email to set the calendar event time
 */
function sendReminderEmail(emailData) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    
    const subject = "⏰ Set Calendar Time: " + emailData.eventTitle;
    
    let body = "A new calendar draft event has been created:\n\n";
    body += "Event: " + emailData.eventTitle + "\n";
    body += "Created: " + formatDate(emailData.receivedDate) + "\n";
    body += "Date of Loss: " + formatDate(emailData.dateOfLoss) + "\n";
    body += "Claim #: " + emailData.claimNumber + "\n";
    body += "Insured: " + emailData.insuredName + "\n";
    body += "Phone: " + emailData.phone + "\n";
    body += "\n";
    body += "⚠️ ACTION REQUIRED:\n";
    body += "Please open your calendar and set the time for this appointment.\n\n";
    body += "Event Details:\n";
    body += "- Property: " + (emailData.propertyAddress || "N/A") + "\n";
    body += "- Loss Type: " + (emailData.lossType || "N/A") + "\n";
    body += "- Loss Description: " + (emailData.lossDescription || "N/A") + "\n";
    
    if (emailData.claimxperienceLink) {
      body += "\nClaimXperience Link:\n" + emailData.claimxperienceLink + "\n";
    }
    
    GmailApp.sendEmail(userEmail, subject, body);
    Logger.log("✓ Reminder email sent to " + userEmail);
    
  } catch (error) {
    Logger.log("ERROR sending reminder email: " + error.toString());
  }
}

/**
 * Format date as M/D/YYYY
 */
function formatDate(date) {
  if (!date) return "N/A";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return month + "/" + day + "/" + year;
}

/**
 * Create a task in the Clarence Google Chat space
 */
function createChatTask(emailData) {
  try {
    // Format due date as "M/D" (e.g., "4/17")
    const dueMonth = emailData.taskDueDate.getMonth() + 1;
    const dueDay = emailData.taskDueDate.getDate();
    const dueDateStr = dueMonth + "/" + dueDay;
    
    // Build task description
    const description = "Upload 3 day - due " + dueDateStr;
    
    // Use Google Chat API to create a task
    const spaceName = "spaces/" + getSpaceId(CONFIG.chatSpaceName);
    
    const payload = {
      parent: spaceName,
      body: {
        text: emailData.taskTitle,
        cardsV2: [
          {
            cardId: "task-card",
            card: {
              header: {
                title: emailData.taskTitle,
                subtitle: description
              },
              sections: [
                {
                  widgets: [
                    {
                      textParagraph: {
                        text: "<b>Claim #:</b> " + (emailData.claimNumber || "N/A") + "\n" +
                              "<b>Phone:</b> " + (emailData.phone || "N/A") + "\n" +
                              "<b>Email:</b> " + (emailData.email || "N/A") + "\n" +
                              "<b>Address:</b> " + (emailData.propertyAddress || "N/A")
                      }
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    };
    
    // Send to Google Chat API
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(
      "https://chat.googleapis.com/v1/" + spaceName + "/messages",
      options
    );
    
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 200) {
      return true;
    } else {
      Logger.log("Google Chat API error: " + response.getContentText());
      return false;
    }
    
  } catch (error) {
    Logger.log("ERROR creating chat task: " + error.toString());
    return false;
  }
}

/**
 * Get space ID from space name (requires API setup)
 * For now, this is a helper - you may need to manually get the space ID
 */
function getSpaceId(spaceName) {
  try {
    const options = {
      method: "get",
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(
      "https://chat.googleapis.com/v1/spaces?filter=displayName:\"" + spaceName + "\"",
      options
    );
    
    const result = JSON.parse(response.getContentText());
    
    if (result.spaces && result.spaces.length > 0) {
      // Extract just the space ID (e.g., "AAAABCDEF123" from "spaces/AAAABCDEF123")
      const fullSpaceName = result.spaces[0].name;
      return fullSpaceName.split("/")[1];
    }
    
    Logger.log("WARNING: Could not find space '" + spaceName + "'. You may need to set the space ID manually.");
    return null;
    
  } catch (error) {
    Logger.log("ERROR getting space ID: " + error.toString());
    return null;
  }
}

/**
 * Check if sender should be excluded
 */
function shouldExcludeSender(sender) {
  return CONFIG.excludeSenders.some(excluded => sender.includes(excluded));
}

// ============================================================================
// SETUP AND TRIGGER MANAGEMENT
// ============================================================================

/**
 * Set up an automatic trigger to run the script daily at 8 AM
 */
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processEmailsToCalendarAndChat") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("processEmailsToCalendarAndChat")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Daily trigger set up. Script will run every day at 8 AM.");
}

/**
 * Set up an automatic trigger to run every hour
 */
function setupHourlyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processEmailsToCalendarAndChat") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("processEmailsToCalendarAndChat")
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log("✓ Hourly trigger set up.");
}

/**
 * Remove all triggers
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processEmailsToCalendarAndChat") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  Logger.log("✓ All triggers removed.");
}

/**
 * Test function - manually run the processing once
 */
function testProcessing() {
  Logger.log("Running manual test...");
  processEmailsToCalendarAndChat();
}