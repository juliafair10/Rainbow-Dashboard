/***** CONFIG *****/
const SPREADSHEET_ID = '1ughsoVE9O4p_-q83vdvQ9g1B8b4JpjoCGSp0HC5gAYE'; // just the ID
const FORM_TITLE = 'End of Job (EOJ) Report';
const COLLECT_EMAILS = true;

/***** MAIN FORM BUILDER *****/
function buildEOJForm() {
  // Create the form
  const form = FormApp.create(FORM_TITLE);
  form.setCollectEmail(COLLECT_EMAILS);
  form.setIsQuiz(false);
  form.setAllowResponseEdits(false);

  // Responses destination
  form.setDestination(FormApp.DestinationType.SPREADSHEET, SPREADSHEET_ID);

  /**************** SECTION A — JOB IDENTIFICATION ****************/
  form.addSectionHeaderItem().setTitle('Section A — Job Identification');
  form.addTextItem().setTitle('Job ID').setRequired(true);
  form.addTextItem().setTitle('Job Name').setHelpText('Usually prefilled via link.');
  form.addDateItem().setTitle('Date of Visit').setRequired(true);

  // Trip Type (choices wired AFTER sections are created)
  const tripType = form.addMultipleChoiceItem()
    .setTitle('Trip Type')
    .setRequired(true);

  /**************** C₁ — INSPECTION (create section, then content) ****************/
  const c1_start = form.addPageBreakItem().setTitle('C₁ — Inspection');

  addXaNote_(form);

  // Tools → details → continue
  const c1_toolsYN = addToolsYesNo_(form);
  const c1_toolsPage = addToolsDetailsPage_(form, 'Inspection');
  const c1_continue = form.addPageBreakItem().setTitle('Inspection — Deliverables & Accountability');

  addDeliverablesInspection_(form);

  // Asbestos (Inspection only)
  const asbestosYN = form.addMultipleChoiceItem()
    .setTitle('Asbestos test required?')
    .setChoiceValues(['Yes','No'])
    .setRequired(false);
  const c1_asbestosPage = form.addPageBreakItem().setTitle('Inspection — Asbestos Follow-up');
  form.addMultipleChoiceItem()
    .setTitle('Have you requested the assignment?')
    .setChoiceValues(['Yes','No']);
  c1_asbestosPage.setGoToPage(FormApp.PageNavigationType.CONTINUE);

  // Mitigation Plan (Inspection)
  form.addParagraphTextItem()
    .setTitle('Mitigation Plan')
    .setHelpText('Write a complete mitigation plan based on inspection findings.')
    .setRequired(true);

  addMicaBlock_(form);

  form.addParagraphTextItem()
    .setTitle('Internal Notes')
    .setHelpText('Optional — free text.');

  const c1_end = form.addPageBreakItem().setTitle('→ Next: Job Status & Follow-up');

  /**************** C₂ — ACTIVE DEMOLITION / CLEANING ****************/
  const c2_start = form.addPageBreakItem().setTitle('C₂ — Active Demolition / Cleaning');

  addXaNote_(form);

  const c2_toolsYN = addToolsYesNo_(form);
  const c2_toolsPage = addToolsDetailsPage_(form, 'Active Demolition / Cleaning');
  const c2_continue = form.addPageBreakItem().setTitle('Active Demo/Cleaning — Deliverables & Accountability');

  addDeliverablesDemo_(form);

  form.addParagraphTextItem()
    .setTitle('Mitigation Plan')
    .setHelpText('What still needs to be done from the mitigation plan after today’s visit.')
    .setRequired(true);

  addMicaBlock_(form);

  form.addParagraphTextItem()
    .setTitle('Internal Notes')
    .setHelpText('Optional — free text.');

  const c2_end = form.addPageBreakItem().setTitle('→ Next: Job Status & Follow-up');

  /**************** C₃ — MONITORING ****************/
  const c3_start = form.addPageBreakItem().setTitle('C₃ — Monitoring');

  addXaNote_(form);

  const c3_toolsYN = addToolsYesNo_(form);
  const c3_toolsPage = addToolsDetailsPage_(form, 'Monitoring');
  const c3_continue = form.addPageBreakItem().setTitle('Monitoring — Deliverables & Accountability');

  addDeliverablesMonitoring_(form);

  form.addParagraphTextItem()
    .setTitle('Mitigation Plan')
    .setHelpText('What still needs to be done from the mitigation plan after today’s visit.')
    .setRequired(true);

  addMicaBlock_(form);

  form.addParagraphTextItem()
    .setTitle('Internal Notes')
    .setHelpText('Optional — free text.');

  const c3_end = form.addPageBreakItem().setTitle('→ Next: Job Status & Follow-up');

  /**************** C₄ — COMPLETION ****************/
  const c4_start = form.addPageBreakItem().setTitle('C₄ — Completion');

  addXaNote_(form);

  const c4_toolsYN = addToolsYesNo_(form);
  const c4_toolsPage = addToolsDetailsPage_(form, 'Completion');
  const c4_continue = form.addPageBreakItem().setTitle('Completion — Deliverables & Accountability');

  addDeliverablesCompletion_(form);

  form.addMultipleChoiceItem()
    .setTitle('Final Deliverables Confirmation')
    .setChoiceValues(['Yes','No'])
    .setRequired(true);

  addMicaBlock_(form);

  form.addParagraphTextItem()
    .setTitle('Internal Notes')
    .setHelpText('Optional — free text.');

  const c4_end = form.addPageBreakItem().setTitle('→ Next: Job Status & Follow-up');

  /**************** G — JOB STATUS & FOLLOW-UP (COMMON) ****************/
  const g_start = form.addPageBreakItem().setTitle('Section G — Job Status & Follow-up');

  const jobStatus = form.addListItem()
    .setTitle('Job Status')
    .setRequired(true)
    .setChoiceValues([
      'More Work Required',
      'Inspection Only (Close Out)',
      'Job Complete – Task Out & Close',
      'Awaiting Asbestos Testing',
      'Awaiting Asbestos Abatement'
    ]);

  const g_mwr = form.addPageBreakItem().setTitle('Follow-up Scheduling');

  form.addCheckboxItem()
    .setTitle('What type of follow-up required?')
    .setChoiceValues(['More demo/cleaning','Monitoring','MICA update','Pickup'])
    .setRequired(true);

  form.addDateItem().setTitle('Follow-up Date').setRequired(true);
  form.addListItem().setTitle('Preferred Start Time')
    .setChoiceValues(['8:00','9:00','10:00','1:00','3:00'])
    .setRequired(true);
  form.addListItem().setTitle('Duration (min)')
    .setChoiceValues(['30','60','90','120'])
    .setRequired(true);

  // After the MWR page → submit the form
  g_mwr.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  /**************** WIRE BRANCHING (AFTER all targets exist) ****************/
  // Trip Type → jump directly to chosen section
  tripType.setChoices([
    tripType.createChoice('Inspection', c1_start),
    tripType.createChoice('Active Demolition / Cleaning', c2_start),
    tripType.createChoice('Monitoring', c3_start),
    tripType.createChoice('Completion', c4_start)
  ]);

  // Tools Y/N in each section → details page or continue page
  c1_toolsYN.setChoices([
    c1_toolsYN.createChoice('Yes', c1_toolsPage),
    c1_toolsYN.createChoice('No', c1_continue)
  ]);  c1_toolsPage.setGoToPage(c1_continue);

  c2_toolsYN.setChoices([
    c2_toolsYN.createChoice('Yes', c2_toolsPage),
    c2_toolsYN.createChoice('No', c2_continue)
  ]);  c2_toolsPage.setGoToPage(c2_continue);

  c3_toolsYN.setChoices([
    c3_toolsYN.createChoice('Yes', c3_toolsPage),
    c3_toolsYN.createChoice('No', c3_continue)
  ]);  c3_toolsPage.setGoToPage(c3_continue);

  c4_toolsYN.setChoices([
    c4_toolsYN.createChoice('Yes', c4_toolsPage),
    c4_toolsYN.createChoice('No', c4_continue)
  ]);  c4_toolsPage.setGoToPage(c4_continue);

  // Asbestos (Inspection only): Yes → asbestos follow-up page, No → continue
  asbestosYN.setChoices([
    asbestosYN.createChoice('Yes', c1_asbestosPage),
    asbestosYN.createChoice('No', FormApp.PageNavigationType.CONTINUE)
  ]);

  // Each C-section end → jump to Section G
  c1_end.setGoToPage(g_start);
  c2_end.setGoToPage(g_start);
  c3_end.setGoToPage(g_start);
  c4_end.setGoToPage(g_start);

  // Job Status: MWR → scheduling page, others → submit
  jobStatus.setChoices([
    jobStatus.createChoice('More Work Required', g_mwr),
    jobStatus.createChoice('Inspection Only (Close Out)', FormApp.PageNavigationType.SUBMIT),
    jobStatus.createChoice('Job Complete – Task Out & Close', FormApp.PageNavigationType.SUBMIT),
    jobStatus.createChoice('Awaiting Asbestos Testing', FormApp.PageNavigationType.SUBMIT),
    jobStatus.createChoice('Awaiting Asbestos Abatement', FormApp.PageNavigationType.SUBMIT)
  ]);

  /**************** FINISHING ****************/
  renameResponsesSheet_();

  // Log links
  Logger.log('EDIT (admin) URL: ' + form.getEditUrl());
  Logger.log('LIVE (send to team) URL: ' + form.getPublishedUrl());

  // Email links to you
  emailLinks_(form);
}

/***** HELPERS *****/
function addXaNote_(form) {
  form.addParagraphTextItem()
    .setTitle('XA Note (2–5 sentences)')
    .setHelpText('Key findings, actions, blockers')
    .setRequired(true);
}

function addToolsYesNo_(form) {
  return form.addMultipleChoiceItem()
    .setTitle('Tools left on site?')
    .setChoiceValues(['Yes','No']);
}

function addToolsDetailsPage_(form, label) {
  const pg = form.addPageBreakItem().setTitle(label + ' — Tools & Equipment Details');
  form.addParagraphTextItem().setTitle('List of tools and equipment left (including number)');
  form.addDateItem().setTitle('Estimated Pickup Date');
  return pg;
}

function addDeliverablesInspection_(form) {
  form.addCheckboxItem().setTitle('Deliverables completed on this trip')
    .setChoiceValues([
      'Photos uploaded',
      'Mitigation plan written',
      'Measurements taken',
      'Initial video taken',
      'MICA report completed',
      'Other: ______'
    ])
    .setRequired(true);
  form.addCheckboxItem().setTitle('Outstanding Deliverables')
    .setChoiceValues([
      'Photos uploaded',
      'Mitigation plan written',
      'Measurements taken',
      'Initial video taken',
      'MICA report completed',
      'Other: ______'
    ]);
}

function addDeliverablesDemo_(form) {
  form.addCheckboxItem().setTitle('Deliverables completed on this trip')
    .setChoiceValues([
      'Photos uploaded',
      'Mitigation plan written',
      'Measurements taken',
      'Initial video taken',
      'MICA report completed',
      'Other: ______'
    ])
    .setRequired(true);
  form.addCheckboxItem().setTitle('Outstanding Deliverables')
    .setChoiceValues([
      'Photos uploaded',
      'Mitigation plan written',
      'Measurements taken',
      'Initial video taken',
      'MICA report completed',
      'Other: ______'
    ]);
}

function addDeliverablesMonitoring_(form) {
  form.addCheckboxItem().setTitle('Deliverables completed on this trip')
    .setChoiceValues([
      'Photos uploaded',
      'Mitigation plan written',
      'Measurements taken',
      'MICA report completed',
      'Other: ______'
    ])
    .setRequired(true);
  form.addCheckboxItem().setTitle('Outstanding Deliverables')
    .setChoiceValues([
      'Photos uploaded',
      'Mitigation plan written',
      'Measurements taken',
      'MICA report completed',
      'Other: ______'
    ]);
}

function addDeliverablesCompletion_(form) {
  form.addCheckboxItem().setTitle('Deliverables completed on this trip')
    .setChoiceValues([
      'Photos uploaded',
      'Measurements taken',
      'Final video taken',
      'MICA report completed',
      'Other: ______'
    ])
    .setRequired(true);
  form.addCheckboxItem().setTitle('Outstanding Deliverables')
    .setChoiceValues([
      'Photos uploaded',
      'Measurements taken',
      'Final video taken',
      'MICA report completed',
      'Other: ______'
    ]);
}

function addMicaBlock_(form) {
  const mica = form.addMultipleChoiceItem()
    .setTitle('MICA completed?')
    .setChoiceValues(['Yes','No'])
    .setRequired(true);

  const micaPg = form.addPageBreakItem().setTitle('MICA — Next Steps');
  form.addParagraphTextItem().setTitle('Next Steps');
  form.addTextItem().setTitle('Responsible Person');
  form.addDateItem().setTitle('Estimated Completion Date');

  mica.setChoices([
    mica.createChoice('Yes', FormApp.PageNavigationType.CONTINUE),
    mica.createChoice('No', micaPg)
  ]);
  micaPg.setGoToPage(FormApp.PageNavigationType.CONTINUE);
}

function renameResponsesSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tabs = ss.getSheets().filter(sh => /^Form Responses/i.test(sh.getName()));
  if (tabs.length) {
    try { tabs[0].setName('EOJ_Responses'); } catch (e) {}
  }
}

/***** EMAIL THE LINKS *****/
function emailLinks_(form) {
  try {
    const me = Session.getActiveUser().getEmail();
    let recipients = [];
    if (me) recipients.push(me);
    try {
      const owner = DriveApp.getFileById(form.getId()).getOwner().getEmail();
      if (owner) recipients.push(owner);
    } catch (e) {}
    recipients = [...new Set(recipients)].filter(Boolean);
    if (!recipients.length) return;

    const subject = `EOJ Form created: ${form.getTitle()}`;
    const body = [
      `Your EOJ Form is ready.`,
      ``,
      `Edit (admin): ${form.getEditUrl()}`,
      `Live (send to team): ${form.getPublishedUrl()}`,
      ``,
      `Responses sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`,
      `Created at: ${new Date().toString()}`
    ].join('\n');

    MailApp.sendEmail(recipients.join(','), subject, body, { noReply: true });
  } catch (err) {
    Logger.log('emailLinks_ error: ' + err);
  }
}
