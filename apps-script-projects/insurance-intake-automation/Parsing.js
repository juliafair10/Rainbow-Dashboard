// ========================
// Insurance Intake Parsing + Label Helpers
// ========================

function parseInsuranceIntakeThread(thread) {
  const messages = thread.getMessages();
  const firstMessage = messages && messages.length > 0 ? messages[0] : null;
  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const subject = firstMessage ? firstMessage.getSubject() : '';
  const bodyParts = [];

  if (subject) {
    bodyParts.push(subject);
  }

  messages.forEach(function(message) {
    bodyParts.push(message.getSubject() || '');
    bodyParts.push(message.getPlainBody() || '');
    bodyParts.push(extractInsuranceLinksFromHtml_(message.getBody() || '').join('\n'));
  });

  const fullText = normalizeInsuranceIntakeText_(bodyParts.join('\n'));
  const normalizedIntakeFields = parseNormalizedRainbowIntakeFields_(fullText);
  const fusionJobNumber = getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'fusion job number');
  let claimNumber = getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'claim number') || extractInsuranceClaimNumber_(fullText);

  if (!claimNumber) {
    const subjectClaimMatch = String(subject || '').match(/(?:clm|claim)\s*#\s*(\d{8,12})/i);

    if (subjectClaimMatch && subjectClaimMatch[1]) {
      claimNumber = String(subjectClaimMatch[1]).trim();
    }
  }

  if (!claimNumber && fusionJobNumber) {
    claimNumber = fusionJobNumber;
  }

  const rainbowJobNumber = fusionJobNumber || extractRainbowJobNumber_(fullText);
  const customerName = getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'insured name') || extractInsuranceCustomerName_(fullText);
  const lossAddress = cleanExtractedAddress_(getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'location of property') || extractInsuranceLossAddress_(fullText));
  const carrierName = getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'insurance carrier') || getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'carrier') || extractInsuranceCarrierName_(fullText);
  const phone = getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'phone') || extractInsurancePhone_(fullText);
  const email = getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'email address') || extractInsuranceEmail_(fullText);
  const lossDescription = getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'loss description') || extractInsuranceLossDescription_(fullText);
  const platformLinks = extractInsurancePlatformLinks_(fullText);

  return {
    subject: subject,
    threadId: thread.getId(),
    messageCount: messages.length,
    firstMessageDate: firstMessage ? firstMessage.getDate() : null,
    lastMessageDate: lastMessage ? lastMessage.getDate() : null,
    sender: firstMessage ? firstMessage.getFrom() : '',
    lastSender: lastMessage ? lastMessage.getFrom() : '',
    claimNumber: claimNumber,
    rainbowJobNumber: rainbowJobNumber,
    customerName: customerName,
    insuredName: customerName,
    lossAddress: lossAddress,
    propertyAddress: lossAddress,
    lossCity: getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'loss city') || extractInsuranceField_(fullText, /Loss City:\s*([^\n]+)/i),
    lossState: getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'loss state') || extractInsuranceField_(fullText, /Loss State:\s*([^\n]+)/i),
    lossZip: getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'loss zip code') || extractInsuranceField_(fullText, /(?:Loss Zip Code|zipcode):\s*([^\n]+)/i),
    dateOfLoss: getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'date of loss') || extractInsuranceField_(fullText, /Date of Loss:\s*([^\n]+)/i),
    typeOfLoss: getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'type of loss') || getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'services') || extractInsuranceField_(fullText, /(?:Type of Loss|Services):\s*([^\n]+)/i),
    lossType: getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'type of loss') || getNormalizedRainbowIntakeField_(normalizedIntakeFields, 'services') || extractInsuranceField_(fullText, /(?:Type of Loss|Services):\s*([^\n]+)/i),
    lossDescription: lossDescription,
    phone: phone,
    email: email,
    carrier: carrierName,
    carrierName: carrierName,
    carrierAbbrev: getInsuranceCarrierAbbrev_(carrierName),
    client: extractInsuranceField_(fullText, /Client:\s*([^\n]+)/i),
    platformLinks: platformLinks,
    fusionUrl: getInsurancePlatformLinkUrl_(platformLinks, 'Fusion'),
    xactAnalysisUrl: getInsurancePlatformLinkUrl_(platformLinks, 'XactAnalysis'),
    symbilityUrl: getInsurancePlatformLinkUrl_(platformLinks, 'Symbility'),
    source: 'parseInsuranceIntakeThread'
  };
}

function normalizeInsuranceIntakeText_(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/Â/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#40;/g, '(')
    .replace(/&#41;/g, ')')
    .replace(/&#91;/g, '[')
    .replace(/&#93;/g, ']')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function parseNormalizedRainbowIntakeFields_(text) {
  const labels = [
    'insured name',
    'phone',
    'email address',
    'insurance carrier',
    'carrier',
    'claim number',
    'fusion job number',
    'date of loss',
    'type of loss',
    'loss description',
    'location of property',
    'loss city',
    'loss state',
    'loss zip code',
    'services',
    'notes'
  ];

  const fields = {};
  const sourceText = String(text || '');

  labels.forEach(function(label) {
    const labelPattern = label.replace(/\s+/g, '\\s+');
    const nextLabelPattern = labels
      .filter(function(nextLabel) {
        return nextLabel !== label;
      })
      .map(function(nextLabel) {
        return nextLabel.replace(/\s+/g, '\\s+');
      })
      .join('|');

    const pattern = new RegExp('(?:^|\\n)\\s*(' + labelPattern + ')\\s*(?:\\||:)\\s*([\\s\\S]*?)(?=\\n\\s*(?:' + nextLabelPattern + ')\\s*(?:\\||:)|$)', 'i');
    const match = sourceText.match(pattern);

    if (match && match[2]) {
      fields[label] = cleanNormalizedRainbowIntakeValue_(match[2]);
    }
  });

  return fields;
}

function getNormalizedRainbowIntakeField_(fields, label) {
  if (!fields) {
    return '';
  }

  const value = fields[String(label || '').toLowerCase()] || '';
  return cleanNormalizedRainbowIntakeValue_(value);
}

function cleanNormalizedRainbowIntakeValue_(value) {
  return cleanExtractedInsuranceValue_(String(value || '')
    .replace(/^\s*[|:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim());
}

function extractInsuranceClaimNumber_(text) {
  const patterns = [
    /(?:clm|claim)\s*#\s*(\d{8,12})/i,
    /Claim Number\s*(?:\||:)\s*([A-Z0-9]+(?:-[A-Z0-9]+)*|\d{6,12})/i,
    /Fusion Job Number\s*(?:\||:)\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)/i,
    /claim #\s*([A-Z0-9-]+)/i,
    /Claim No:\s*([*A-Z0-9-]+)/i,
    /Claim:\s*\n?\s*(?:Rainbow:\s*)?([A-Z0-9-]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return String(match[1]).replace(/\*/g, '').replace(/\s+/g, '').trim();
    }
  }

  return '';
}

function extractRainbowJobNumber_(text) {
  const patterns = [
    /Fusion Job Number\s*(?:\||:)\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)/i,
    /Rainbow:\s*([A-Z0-9-]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return String(match[1]).replace(/\s+/g, '').trim();
    }
  }

  return '';
}

function extractInsuranceCustomerName_(text) {
  const patterns = [
    /EMSL report, invoice, COC for order\(s\)\s+\d+\s*\(\s*\d+\s*-\s*([^\)]+?)\s*\)/i,
    /Report, invoice, COC for order\(s\):\s*\n\s*\d+\s*-\s*([^\n]+)/i,
    /\(\s*\d{6,12}\s*-\s*([^\)]+?)\s*\)/i,
    /^\s*\d{6,12}\s*-\s*([^\n]+)/m,
    /ITEL Lab Report\s*-\s*([^-]+?)\s*-\s*(?:clm|claim)\s*#/i,
    /Insured Name:\s*([^\n]+)/i,
    /Customer:\s*\n\s*([^\n]+)/i,
    /Customer:\s*([^\n]+)/i,
    /claim\s*#\s*[A-Z0-9-]+\s*\(([^)]+)\)/i,
    /claim\s+number\s*[:#]?\s*[A-Z0-9-]+\s*\(([^)]+)\)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return cleanExtractedInsuranceValue_(match[1]);
    }
  }

  return '';
}

function extractInsuranceLossAddress_(text) {
  const patterns = [
    /Location of Property:\s*([^\n]+)/i,
    /Property Address:\s*([^\n]+)/i,
    /Loss Address:\s*([^\n]+)/i,
    /Risk Address:\s*([^\n]+)/i,
    /Service Address:\s*([^\n]+)/i,
    /Job Address:\s*([^\n]+)/i,
    /address:\s*([^\)\n]+)\)/i,
    /Address:\s*([^\n]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return cleanExtractedAddress_(match[1]);
    }
  }

  const mapMatch = text.match(/maps\?q=([^\]\n]+)/i);

  if (mapMatch && mapMatch[1]) {
    return cleanExtractedAddress_(decodeURIComponent(String(mapMatch[1]).replace(/\+/g, ' ')));
  }

  const genericStreetMatch = text.match(/\b(\d{2,6}\s+[A-Za-z0-9 .'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Court|Ct|Drive|Dr|Lane|Ln|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Way|Terrace|Ter)\b[^\n,\/]*(?:,\s*[A-Za-z .'-]+)?(?:,\s*[A-Z]{2})?(?:\s+\d{5}(?:-\d{4})?)?)/i);

  if (genericStreetMatch && genericStreetMatch[1]) {
    return cleanExtractedAddress_(genericStreetMatch[1]);
  }

  return '';
}

function extractInsuranceCarrierName_(text) {
  const patterns = [
    /From:\s*([^\-\n]+?)\s*-\s*Rainbow/i,
    /From:\s*([^\n]+)/i,
    /Claim Originator:\s*([^\n]+)/i,
    /Carrier:\s*([^\n]+)/i,
    /Insurance Carrier:\s*([^\n]+)/i,
    /Client:\s*([^\n]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return cleanExtractedInsuranceValue_(match[1]);
    }
  }

  return '';
}

function getInsuranceCarrierAbbrev_(carrierName) {
  const abbrevs = {
    allstate: 'AS',
    'state farm': 'SF',
    geico: 'GEICO',
    progressive: 'PROG',
    'liberty mutual': 'LM',
    amica: 'AMICA',
    farmers: 'FARM',
    nationwide: 'NW',
    usaa: 'USAA',
    travelers: 'TRAV'
  };

  const carrierText = String(carrierName || '').trim();
  const lower = carrierText.toLowerCase();

  for (const key in abbrevs) {
    if (lower.indexOf(key) !== -1) {
      return abbrevs[key];
    }
  }

  if (!carrierText) {
    return '';
  }

  return carrierText
    .split(/\s+/)
    .filter(Boolean)
    .map(function(word) {
      return word[0];
    })
    .join('')
    .toUpperCase()
    .substring(0, 3);
}

function extractInsurancePhone_(text) {
  const patterns = [
    /(?:Evening Phone|Day Phone|Mobile Phone|Cell Phone|Phone):\s*([\d\(\)\-\s\.]+)/i,
    /phone:\s*(\([^)]+\)[^,\n]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return cleanExtractedInsuranceValue_(match[1]);
    }
  }

  return '';
}

function extractInsuranceEmail_(text) {
  const patterns = [
    /Email Address:\s*([^\s\n]+@[^\s\n]+)/i,
    /Email:\s*([^\s\n]+@[^\s\n]+)/i,
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return cleanExtractedInsuranceValue_(match[1]);
    }
  }

  return '';
}

function extractInsuranceLossDescription_(text) {
  const patterns = [
    /Loss Description:\s*([^\n]+)/i,
    /Location Description:\s*([^\n]+)/i,
    /Description of Loss:\s*([^\n]+)/i,
    /has assigned you a new\s+([^,]+),\s*claim:/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return cleanExtractedInsuranceValue_(match[1]);
    }
  }

  return '';
}

function cleanExtractedAddress_(address) {
  return String(address || '')
    .replace(/\s+Google\s+Maps\s+MapQuest.*$/i, '')
    .replace(/\s+Google\s+Maps.*$/i, '')
    .replace(/\s+MapQuest.*$/i, '')
    .replace(/\s+View\s+Map.*$/i, '')
    .replace(/\s+Map.*$/i, '')
    .replace(/\s+\d{1,3}(?:\.\d+)?\s*[º°]?\s*[NS]\s*,\s*\d{1,3}(?:\.\d+)?\s*[º°]?\s*[EW].*$/i, '')
    .replace(/\s+\d{1,3}[º°]\s*\d{1,2}(?:\.\d+)?'?\s*[NS]\s*,\s*\d{1,3}[º°]\s*\d{1,2}(?:\.\d+)?'?\s*[EW].*$/i, '')
    .replace(/[).,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInsuranceField_(text, pattern) {
  const match = text.match(pattern);
  return match && match[1] ? cleanExtractedInsuranceValue_(match[1]) : '';
}

function cleanExtractedInsuranceValue_(value) {
  return String(value || '')
    .replace(/\*/g, '')
    .replace(/\s+(?:Evening Phone|Day Phone|Mobile Phone|Cell Phone|Phone|Email Address|Type of Loss|XA ID|Location of Property|Instructions|Claim Number|Insured Name|Date of Loss|Loss Description|Location Description|Policy Line Code|RoofTypeCd)\s*:?\s*.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInsurancePlatformLinks_(text) {
  const sourceText = String(text || '');
  const links = [];
  const urlMatches = sourceText.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  const htmlHrefMatches = extractInsuranceLinksFromHtml_(sourceText);
  htmlHrefMatches.forEach(function(url) {
    urlMatches.push(url);
  });

  urlMatches.forEach(function(rawUrl) {
    const cleanedUrl = cleanInsurancePlatformUrl_(rawUrl);
    const lowerUrl = cleanedUrl.toLowerCase();

    if (lowerUrl.indexOf('fusion-ngs.net') !== -1 || lowerUrl.indexOf('fusionngs.net') !== -1) {
      addInsurancePlatformLinksFromMatches_(links, 'Fusion', [cleanedUrl]);
      return;
    }

    if (lowerUrl.indexOf('symbility.net') !== -1) {
      addInsurancePlatformLinksFromMatches_(links, 'Symbility', [cleanedUrl]);
      return;
    }

    if (lowerUrl.indexOf('xactanalysis') !== -1 || lowerUrl.indexOf('xactware') !== -1) {
      addInsurancePlatformLinksFromMatches_(links, 'XactAnalysis', [cleanedUrl]);
      return;
    }
  });

  return dedupeInsurancePlatformLinks_(links);
}

function addInsurancePlatformLinksFromMatches_(links, linkType, matches) {
  (matches || []).forEach(function(url) {
    const cleanedUrl = cleanInsurancePlatformUrl_(url);

    if (!cleanedUrl) {
      return;
    }

    links.push({
      linkType: linkType,
      url: cleanedUrl,
      source: 'insurance-intake-email'
    });
  });
}

function extractInsuranceLinksFromHtml_(html) {
  const sourceHtml = String(html || '');
  const links = [];
  let match;
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;

  while ((match = hrefPattern.exec(sourceHtml)) !== null) {
    if (match && match[1]) {
      links.push(decodeInsuranceHtmlUrl_(match[1]));
    }
  }

  return links.filter(function(url) {
    return /^https?:\/\//i.test(url);
  });
}

function decodeInsuranceHtmlUrl_(url) {
  return String(url || '')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function cleanInsurancePlatformUrl_(url) {
  return String(url || '')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/["'<>].*$/g, '')
    .replace(/[\]\[),.;]+$/g, '')
    .trim();
}

function dedupeInsurancePlatformLinks_(links) {
  const seen = {};

  return (links || []).filter(function(link) {
    const key = String(link.linkType || '').toLowerCase() + '|' + String(link.url || '').toLowerCase();

    const sameTypeCleanerUrlExists = (links || []).some(function(otherLink) {
      return otherLink !== link &&
        String(otherLink.linkType || '').toLowerCase() === String(link.linkType || '').toLowerCase() &&
        String(link.url || '').toLowerCase().indexOf(String(otherLink.url || '').toLowerCase()) === 0 &&
        String(otherLink.url || '').length < String(link.url || '').length;
    });

    if (sameTypeCleanerUrlExists) {
      return false;
    }

    if (!link.url || seen[key]) {
      return false;
    }

    seen[key] = true;
    return true;
  });
}

function getInsurancePlatformLinkUrl_(links, linkType) {
  const target = String(linkType || '').toLowerCase();
  const match = (links || []).find(function(link) {
    return String(link.linkType || '').toLowerCase() === target && link.url;
  });

  return match ? match.url : '';
}

function testExtractInsurancePlatformLinks_fusion() {
  const text = 'Fusion link: https://fusion-ngs.net/Enterprise/Module/Job/JobSlideBoard.aspx?JobNumber=26A-0043-WTR&JobId=2003069\n' +
    'Xact link: https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=TEST#_assignment\n' +
    'Symbility link: https://www.symbility.net/ux/site/#/claims/TEST';

  const links = extractInsurancePlatformLinks_(text);
  const result = {
    links: links,
    fusionUrl: getInsurancePlatformLinkUrl_(links, 'Fusion'),
    xactAnalysisUrl: getInsurancePlatformLinkUrl_(links, 'XactAnalysis'),
    symbilityUrl: getInsurancePlatformLinkUrl_(links, 'Symbility'),
    passed: !!(
      getInsurancePlatformLinkUrl_(links, 'Fusion') &&
      getInsurancePlatformLinkUrl_(links, 'XactAnalysis') &&
      getInsurancePlatformLinkUrl_(links, 'Symbility')
    )
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testParseLatestInsuranceIntakeThread() {
  const threads = GmailApp.search(CONFIG.gmailQuery, 0, 1);

  if (!threads.length) {
    Logger.log('No intake threads found for query: ' + CONFIG.gmailQuery);
    return {
      success: false,
      message: 'No intake threads found.',
      query: CONFIG.gmailQuery
    };
  }

  const parsed = parseInsuranceIntakeThread(threads[0]);
  Logger.log(JSON.stringify(parsed, null, 2));
  return parsed;
}

function testExtractInsurancePlatformLinks_fromHtml() {
  const html = '<a href="https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=HTMLTEST&amp;assignment=1">Open Xact</a>' +
    '<a href="https://fusion-ngs.net/Enterprise/Module/Job/JobSlideBoard.aspx?JobNumber=26A-0043-WTR&amp;JobId=2003069">Open Fusion</a>';

  const links = extractInsurancePlatformLinks_(html);
  const result = {
    links: links,
    fusionUrl: getInsurancePlatformLinkUrl_(links, 'Fusion'),
    xactAnalysisUrl: getInsurancePlatformLinkUrl_(links, 'XactAnalysis'),
    passed: !!(
      getInsurancePlatformLinkUrl_(links, 'Fusion') &&
      getInsurancePlatformLinkUrl_(links, 'XactAnalysis')
    )
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
