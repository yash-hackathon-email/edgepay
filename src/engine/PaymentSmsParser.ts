// ─── Payment SMS Parser ─────────────────────────────────────────────
// Parses incoming bank SMS to detect CREDIT / payment-received events.
// Extracts amount and sender details for voice announcement.
// Fully offline — no network calls.

export interface PaymentNotification {
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  sender: string;       // From whom (name, UPI ID, or masked account)
  bank: string;         // Which bank/provider sent the SMS
  refNumber?: string;   // Transaction reference if found
  rawBody: string;
}

// ──────────────────────────────────────────────────────────────────────
// Bank / UPI sender ID patterns (Indian format: XX-BANKCODE)
// ──────────────────────────────────────────────────────────────────────

const BANK_SENDER_MAP: Record<string, string> = {
  'HDFCBK': 'HDFC Bank',
  'SBIBNK': 'State Bank of India',
  'ICICIB': 'ICICI Bank',
  'PNBSMS': 'Punjab National Bank',
  'BOIIND': 'Bank of India',
  'CANBNK': 'Canara Bank',
  'UNIONB': 'Union Bank',
  'AXISBK': 'Axis Bank',
  'KOTAKB': 'Kotak Bank',
  'INDBNK': 'IndusInd Bank',
  'PAYTM':  'Paytm',
  'PYTM':   'Paytm',
  'GPAY':   'Google Pay',
  'PHONEPE': 'PhonePe',
};

/**
 * Identify bank/provider from SMS sender address
 */
function identifyBank(sender: string): string {
  const upper = (sender || '').toUpperCase().trim();
  for (const [code, name] of Object.entries(BANK_SENDER_MAP)) {
    if (upper.includes(code)) return name;
  }
  // Fallback: extract from pattern XX-BANKNAME
  const match = upper.match(/^[A-Z]{2}-([A-Z0-9]+)/);
  if (match) return match[1];
  return 'Bank';
}

// ──────────────────────────────────────────────────────────────────────
// CREDIT detection keywords (money received / credited)
// ──────────────────────────────────────────────────────────────────────

const CREDIT_KEYWORDS = [
  'CREDITED',
  'RECEIVED',
  'CREDIT',
  'DEPOSITED',
  'MONEY RECEIVED',
  'ADDED TO YOUR',
  'RECEIVED RS',
  'RECEIVED INR',
  'HAS BEEN CREDITED',
  'CREDITED TO',
  'CREDITED IN',
  'RECEIVED FROM',
  'RECEIVED PAYMENT',
  'CR ',
  'CR.',
];

const DEBIT_KEYWORDS = [
  'DEBITED',
  'SENT RS',
  'PAID TO',
  'TRANSFERRED',
  'DEDUCTED',
  'MONEY SENT',
  'WITHDRAWN',
  'DR ',
  'DR.',
];

// Exclude OTP or promotional messages
const EXCLUSION_KEYWORDS = [
  'OTP',
  'ONE TIME PASSWORD',
  'VERIFY',
  'VERIFICATION',
  'PROMO',
  'OFFER',
  'APPLY',
  'LOAN',
  'EMI',
  'CREDIT CARD',
  'LIMIT',
  'MINIMUM DUE',
];

/**
 * Check if SMS body is a payment notification (not OTP/promo)
 */
function isPaymentSms(body: string): boolean {
  const upper = body.toUpperCase();
  // Must not be OTP or promotional
  if (EXCLUSION_KEYWORDS.some(kw => upper.includes(kw))) return false;
  // Must contain an amount pattern
  if (!/(?:RS|₹|INR)\.?\s*[0-9,]+\.?[0-9]*/i.test(body)) return false;
  // Must contain credit or debit keyword
  return (
    CREDIT_KEYWORDS.some(kw => upper.includes(kw)) ||
    DEBIT_KEYWORDS.some(kw => upper.includes(kw))
  );
}

/**
 * Find the transaction type (CREDIT or DEBIT)
 */
function detectType(body: string): 'CREDIT' | 'DEBIT' {
  const upper = body.toUpperCase();
  if (CREDIT_KEYWORDS.some(kw => upper.includes(kw))) return 'CREDIT';
  return 'DEBIT';
}

/**
 * Extract amount from SMS body
 * Handles: Rs.1,234.56, ₹1234, Rs 1,234, INR 1234.00
 */
function extractAmount(body: string): number {
  const clean = body.replace(/,/g, '');
  // Try patterns in priority order
  const patterns = [
    /(?:RS|₹|INR)\.?\s*([0-9]+\.?[0-9]*)/i,
    /([0-9]+\.?[0-9]*)\s*(?:RS|₹|INR)/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      const amount = parseFloat(match[1]);
      if (amount > 0) return amount;
    }
  }
  return 0;
}

/**
 * Extract sender name / from details
 * Common patterns:
 *  - "from JOHN DOE"
 *  - "by 9876543210"
 *  - "by JOHN DOE"
 *  - "from VPA user@upi"
 *  - "A/c linked to VPA xyz@bank"
 */
function extractSender(body: string): string {
  // Try to extract "from <name>" pattern
  const fromMatch = body.match(/(?:from|by|sender|payee)\s+([A-Za-z0-9@._\s]{2,30}?)(?:\s+(?:on|at|ref|to|via|has|is|\.|$))/i);
  if (fromMatch && fromMatch[1]) {
    return fromMatch[1].trim();
  }

  // Try VPA / UPI ID pattern
  const vpaMatch = body.match(/VPA\s+([a-zA-Z0-9._]+@[a-zA-Z]+)/i);
  if (vpaMatch && vpaMatch[1]) {
    return vpaMatch[1];
  }

  // Try phone number pattern  
  const phoneMatch = body.match(/(?:from|by)\s+(\d{10,12})/i);
  if (phoneMatch && phoneMatch[1]) {
    return phoneMatch[1];
  }

  // Try extracting name between "from" and next punctuation
  const genericFrom = body.match(/from\s+([^.,(]+)/i);
  if (genericFrom && genericFrom[1] && genericFrom[1].trim().length > 1) {
    const name = genericFrom[1].trim();
    // Don't return if it looks like a bank account reference
    if (!/^[A-Z]{2}-|^A\/C|^ACCOUNT/i.test(name) && name.length < 40) {
      return name;
    }
  }

  return '';
}

/**
 * Extract reference number
 */
function extractRefNumber(body: string): string | undefined {
  const refMatch = body.match(/(?:ref|txn|utr|imps)[\s.:#]*([A-Z0-9]{8,20})/i);
  return refMatch ? refMatch[1] : undefined;
}

// ──────────────────────────────────────────────────────────────────────
// Main Parser
// ──────────────────────────────────────────────────────────────────────

/**
 * Parse an incoming SMS and extract payment notification details.
 * Returns null if the SMS is not a payment notification.
 */
export function parsePaymentSms(
  sender: string,
  body: string,
): PaymentNotification | null {
  if (!body || body.length < 10) return null;
  if (!isPaymentSms(body)) return null;

  const amount = extractAmount(body);
  if (amount <= 0) return null;

  return {
    type: detectType(body),
    amount,
    sender: extractSender(body),
    bank: identifyBank(sender),
    refNumber: extractRefNumber(body),
    rawBody: body,
  };
}

/**
 * Format amount for speech (e.g., 1234.56 → "1234 rupees 56 paise")
 */
export function formatAmountForSpeech(amount: number, lang: string): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (lang === 'hi') {
    if (paise > 0) {
      return `${rupees} रुपये ${paise} पैसे`;
    }
    return `${rupees} रुपये`;
  }

  if (paise > 0) {
    return `${rupees} rupees and ${paise} paise`;
  }
  return `${rupees} rupees`;
}

/**
 * Build the full announcement text for a payment
 */
export function buildAnnouncementText(
  notification: PaymentNotification,
  lang: string,
): string {
  const amountText = formatAmountForSpeech(notification.amount, lang);

  if (lang === 'hi') {
    if (notification.type === 'CREDIT') {
      const from = notification.sender
        ? ` ${notification.sender} से`
        : '';
      return `भुगतान प्राप्त हुआ। ${amountText}${from}।`;
    }
    const to = notification.sender
      ? ` ${notification.sender} को`
      : '';
    return `भुगतान भेजा गया। ${amountText}${to}।`;
  }

  // English
  if (notification.type === 'CREDIT') {
    const from = notification.sender
      ? ` from ${notification.sender}`
      : '';
    return `Payment received. ${amountText}${from}.`;
  }
  const to = notification.sender
    ? ` to ${notification.sender}`
    : '';
  return `Payment sent. ${amountText}${to}.`;
}
