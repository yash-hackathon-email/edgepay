// ─── SMS Parser ────────────────────────────────────────────────────────
// Detects payment success/failure from incoming bank SMS
// Tuned for HDFC Bank (AD-HDFCBK-S) and SBI sender formats

import type { SmsMessage } from '../types';

/**
 * SUCCESS patterns found in Indian bank debit confirmation SMS.
 * These cover HDFC, SBI, ICICI, PNB, etc.
 * 
 * HDFC format: "Sent Rs.1.00 From HDFC Bank A/C *7906 To ..."
 * SBI format:  "Your a/c ...debited by Rs.100.00..."
 */
const SUCCESS_KEYWORDS = [
  'SENT RS',         // HDFC: "Sent Rs.1.00 From HDFC Bank"
  'SENT RS.',        // HDFC exact
  'DEBITED',         // SBI / generic: "debited by"
  'SUCCESSFULLY',    // Generic: "successfully transferred"
  'PAID TO',         // "Paid to XYZ"
  'TRANSFER SUCCESS',
  'PAYMENT OF',
  'TRANSFERRED',
  'DEDUCTED',
  'MONEY SENT',
  'TXN OF RS',       // "Txn of Rs.100"
  'FROM HDFC BANK A/C', // HDFC specific
  'FROM SBI A/C',    // SBI specific
];

const FAILURE_KEYWORDS = [
  'FAILED',
  'DECLINED',
  'INSUFFICIENT',
  'CANCELLED',
  'REJECTED',
  'NOT AUTHORIZED',
  'INVALID PIN',
  'LIMIT EXCEEDED',
  'COULD NOT',
  'UNABLE TO PROCESS',
];

/**
 * Determine if an SMS is from a bank or payment provider.
 * Indian bank senders: AD-HDFCBK-S, VM-SBIBNK, AX-ICICIB, etc.
 * The format is: XX-BANKCODE or XX-BANKCODE-X
 */
export function isBankSms(sender: string): boolean {
  if (!sender) return false;
  const cleanSender = sender.toUpperCase().trim();

  // Match Indian bank short codes: XX-XXXXXX or XX-XXXXXX-X
  if (/^[A-Z]{2}-[A-Z0-9]{4,8}(-[A-Z0-9])?$/.test(cleanSender)) return true;

  // Direct bank name checks
  if (
    cleanSender.includes('HDFC') ||
    cleanSender.includes('SBI') ||
    cleanSender.includes('ICICI') ||
    cleanSender.includes('PNB') ||
    cleanSender.includes('BANK') ||
    cleanSender.includes('PAYTM') ||
    cleanSender.includes('GPAY') ||
    cleanSender.includes('PHONEPE') ||
    cleanSender.includes('NPCI')
  ) return true;

  return false;
}

/**
 * Parse an incoming SMS to determine transaction status
 */
export function parseSmsForTransaction(sms: SmsMessage) {
  const body = sms.body.toUpperCase();

  // Check for failure first (more specific)
  if (FAILURE_KEYWORDS.some(kw => body.includes(kw))) {
    return 'FAILED';
  }

  // Check for success
  if (SUCCESS_KEYWORDS.some(kw => body.includes(kw))) {
    return 'SUCCESS';
  }

  // Extra: check for "Ref" + reference number pattern (debit confirmations always have this)
  if (/REF\s*[0-9]{8,}/.test(body) && /RS\.?\s*[0-9]/.test(body)) {
    return 'SUCCESS';
  }

  return 'PENDING';
}

/**
 * Demo Parser for testing purposes
 */
export function parseDemoSms(body: string) {
  const upperBody = body.toUpperCase();

  if (upperBody.includes('DEMO SUCCESS') || upperBody.includes('PAID 10 TO')) {
    return { result: 'SUCCESS' };
  }

  if (upperBody.includes('DEMO FAIL')) {
    return { result: 'FAILED' };
  }

  return { result: 'PENDING' };
}

/**
 * Parse an incoming SMS to extract a numeric balance
 * Example: "Your AC balance is ₹1,234.56" -> 1234
 */
export function parseSmsForBalance(body: string): number | null {
  // Remove commas for easier parsing
  const cleanBody = body.replace(/,/g, '');
  
  // Pattern 1: Rs. 1234 or ₹1234 (handles newlines between Rs and amount)
  // Screenshot shows: Rs.\n168.59
  const standardMatch = cleanBody.match(/(?:RS|₹)\.?\s*([0-9]+\.?[0-9]*)/i);
  if (standardMatch && standardMatch[1]) {
    return Math.floor(parseFloat(standardMatch[1]));
  }
  
  // Pattern 2: "Avl Bal Rs 1234"
  const noDotMatch = cleanBody.match(/BAL\s*[\n\r]*\s*(?:RS|₹)?\s*([0-9]+\.?[0-9]*)?/i);
  if (noDotMatch && noDotMatch[1]) {
    return Math.floor(parseFloat(noDotMatch[1]));
  }

  // Final fallback: just look for the first decimal number after "Rs" or "Bal"
  const fallback = cleanBody.match(/(?:RS|₹|BAL|BALANCE)\s*[:.-]?\s*([0-9]+\.?[0-9]*)/i);
  if (fallback && fallback[1]) {
     return Math.floor(parseFloat(fallback[1]));
  }

  return null;
}
