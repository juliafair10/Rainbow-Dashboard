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
  });

  const fullText = normalizeInsuranceIntakeText_(bodyParts.join('\n'));
  const claimNumber = extractInsuranceClaimNumber_(fullText);
  const rainbowJobNumber = extractRainbowJobNumber_(fullText);
  const customerName = extractInsuranceCustomerName_(fullText);
  const lossAddress = extractInsuranceLossAddress_(fullText);

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
    lossCity: extractInsuranceField_(fullText, /Loss City:\s*([^\n]+)/i),
    lossState: extractInsuranceField_(fullText, /Loss State:\s*([^\n]+)/i),
    lossZip: extractInsuranceField_(fullText, /(?:Loss Zip Code|zipcode):\s*([^\n]+)/i),
    dateOfLoss: extractInsuranceField_(fullText, /Date of Loss:\s*([^\n]+)/i),
    typeOfLoss: extractInsuranceField_(fullText, /(?:Type of Loss|Services):\s*([^\n]+)/i),
    client: extractInsuranceField_(fullText, /Client:\s*([^\n]+)/i),
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

function extractInsuranceClaimNumber_(text) {
  const patterns = [
    /Claim Number:\s*([A-Z0-9-]+)/i,
    /claim #\s*([A-Z0-9-]+)/i,
    /Claim No:\s*([*A-Z0-9-]+)/i,
    /Claim:\s*\n?\s*(?:Rainbow:\s*)?([A-Z0-9-]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return String(match[1]).replace(/\*/g, '').trim();
    }
  }

  return '';
}

function extractRainbowJobNumber_(text) {
  const match = text.match(/Rainbow:\s*([A-Z0-9-]+)/i);
  return match && match[1] ? String(match[1]).trim() : '';
}

function extractInsuranceCustomerName_(text) {
  const patterns = [
    /Insured Name:\s*([^\n]+)/i,
    /Customer:\s*\n\s*([^\n]+)/i,
    /Customer:\s*([^\n]+)/i,
    /claim\s*#\s*[A-Z0-9-]+\s*\(([^)]+)\)/i,
    /claim\s+number\s*[:#]?\s*[A-Z0-9-]+\s*\(([^)]+)\)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return String(match[1]).replace(/\*/g, '').trim();
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

function cleanExtractedAddress_(address) {
  return String(address || '')
    .replace(/\s+Google Maps\s+MapQuest.*$/i, '')
    .replace(/\s+View Map.*$/i, '')
    .replace(/\s+Map.*$/i, '')
    .replace(/[).,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractInsuranceField_(text, pattern) {
  const match = text.match(pattern);
  return match && match[1] ? String(match[1]).trim() : '';
}
