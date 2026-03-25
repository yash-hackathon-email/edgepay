// ─── QR Parser ───────────────────────────────────────────────────────
// Parses UPI QR code data into a structured payment object
// Converts QR data into USSD commands for *99# payments

import { QRPaymentData } from '../types';
import { UPI_SCHEME } from './constants';
import { buildUssdCommand, sanitizeReceiver, extractMobileFromVpa } from '../engine/USSDBuilder';

/**
 * Parse a UPI QR code string into payment data
 * UPI QR format: upi://pay?pa=upiid@bank&pn=Name&am=100&cu=INR&tn=Note
 */
export function parseUPIQR(qrData: string): QRPaymentData | null {
  try {
    // Check if it's a UPI URI
    if (!qrData.toLowerCase().startsWith(UPI_SCHEME)) {
      // Try to parse as plain text (phone number or UPI ID)
      return parsePlainQR(qrData);
    }

    const url = new URL(qrData);
    const params = url.searchParams;

    let upiId = params.get('pa') || '';
    const name = params.get('pn') || 'Unknown';
    const amountStr = params.get('am');
    const note = params.get('tn') || undefined;

    if (!upiId) return null;

    // --- ENHANCEMENT: Extract mobile number from VPA if it exists ---
    // If upiId is 9876543210@paytm, many ussd users prefer using the mobile number directly
    const mobilePrefix = extractMobileFromVpa(upiId);
    if (mobilePrefix) {
      console.log(`[QRParser] Extracted mobile ${mobilePrefix} from VPA ${upiId}`);
      // upiId = mobilePrefix; // Replaced it with mobile for better USSD support
    }

    return {
      upiId,
      name: decodeURIComponent(name),
      amount: amountStr ? parseFloat(amountStr) : undefined,
      note: note ? decodeURIComponent(note) : undefined,
      raw: qrData,
    };
  } catch (error) {
    console.warn('[QRParser] Failed to parse QR data:', error);
    return null;
  }
}

/**
 * Parse plain text QR codes (phone number or UPI ID directly)
 */
function parsePlainQR(data: string): QRPaymentData | null {
  const trimmed = data.trim();

  // Check if it's a phone number (10 digits)
  const phoneRegex = /^(\+91|91)?(\d{10})$/;
  const phoneMatch = trimmed.match(phoneRegex);
  if (phoneMatch) {
    return {
      upiId: phoneMatch[2],
      name: 'Phone Payment',
      raw: data,
    };
  }

  // Check if it looks like a UPI ID (contains @)
  if (trimmed.includes('@')) {
    return {
      upiId: trimmed,
      name: trimmed.split('@')[0],
      raw: data,
    };
  }

  return null;
}

/**
 * Convert QR payment data to USSD command
 * This is the key conversion: QR → USSD for offline UPI payments
 *
 * @example
 * qrToUssdCommand({ upiId: 'merchant@upi', ... }, 500)
 * // Returns: '*99*1*1*9876543210*500#' (if mobile extracted)
 */
export function qrToUssdCommand(data: QRPaymentData, amount: number): string {
  // Try to use mobile number if available in VPA (e.g. 9876543210@upi)
  const mobile = extractMobileFromVpa(data.upiId);
  const receiver = mobile || data.upiId;
  
  return buildUssdCommand(receiver, amount);
}

/**
 * Legacy: Convert QR payment data to SMS-friendly format
 * (kept for backward compatibility)
 */
export function qrToSmsCommand(data: QRPaymentData, amount: number): string {
  const receiver = data.upiId.includes('@')
    ? data.upiId.split('@')[0]
    : data.upiId;

  return `PAY ${amount} TO ${receiver}`;
}

/**
 * Validate QR payment data
 */
export function validateQRData(data: QRPaymentData | null): {
  valid: boolean;
  error?: string;
} {
  if (!data) {
    return { valid: false, error: 'Invalid QR code' };
  }

  if (!data.upiId) {
    return { valid: false, error: 'No payment ID found in QR code' };
  }

  if (data.amount !== undefined && data.amount <= 0) {
    return { valid: false, error: 'Invalid amount in QR code' };
  }

  return { valid: true };
}

/**
 * Extract receiver info from QR data for display
 */
export function getReceiverFromQR(data: QRPaymentData): {
  receiver: string;
  name: string;
  type: 'mobile' | 'upi';
} {
  const cleaned = sanitizeReceiver(data.upiId);
  const mobile = extractMobileFromVpa(cleaned);
  const isMobile = mobile !== null || /^\d{10}$/.test(cleaned);

  return {
    receiver: mobile || cleaned,
    name: data.name || (isMobile ? 'Mobile Payment' : cleaned.split('@')[0]),
    type: isMobile ? 'mobile' : 'upi',
  };
}
