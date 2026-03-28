// ─── USSD Builder Engine ─────────────────────────────────────────────
// Generates USSD command strings for *99# UPI USSD payments

/**
 * USSD Formats:
 * 1. Mobile Payment: *99*1*1*{target}*{amount}#
 * 2. UPI ID Payment: *99*1*3*{target}*{amount}#
 * 
 * NOTE: We removed the trailing '*1#' (remark) because for many banks, 
 * the bank consumes the '1' as a PIN attempt, leading to the error 
 * 'Your UPI PIN length is incorrect'.
 * 
 * By ending with '#', the bank will prompt the user for a remark 
 * or PIN directly in the native system menu.
 */

export function buildUssdCommand(receiver: string, amount: number): string {
  const cleanedAmount = Math.floor(amount);
  const target = sanitizeReceiver(receiver);
  
  // Decide selection strictly based on presence of @
  const isVPA = target.includes('@');
  
  if (!isVPA) {
    // SELECTION 1: MOBILE (*99*1*1*target*amount#)
    return `*99*1*1*${target}*${cleanedAmount}#`;
  } else {
    // SELECTION 3: UPI ID (*99*1*3*target*amount#)
    return `*99*1*3*${target}*${cleanedAmount}#`;
  }
}

export function buildBasicUssdCommand(): string { return '*99#'; }
export function buildBalanceCheckCommand(): string { return '*99*3#'; }

/**
 * Sanitize receiver input - CLEANING FOR USSD
 * Ensure mobile numbers are clean 10-digit strings
 */
export function sanitizeReceiver(receiver: string): string {
  let cleaned = receiver.trim();
  if (cleaned.includes('@')) {
    return cleaned.toLowerCase();
  }
  
  // Mobile: Remove spaces, country code +91 or 91 if it's 12 digits
  let mob = cleaned.replace(/[\s\-\.]/g, '');
  if (mob.startsWith('+91')) mob = mob.substring(3);
  else if (mob.startsWith('91') && mob.length === 12) mob = mob.substring(2);
  
  // Final safeguard: keep only digits
  mob = mob.replace(/\D/g, '');
  
  return mob;
}

export function validateUssdReceiver(receiver: string): {
  valid: boolean; error?: string; type: 'mobile' | 'upi' | 'unknown';
} {
  const cleaned = sanitizeReceiver(receiver);
  if (/^\d{10}$/.test(cleaned)) return { valid: true, type: 'mobile' };
  if (cleaned.includes('@')) {
    const parts = cleaned.split('@');
    if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
      return { valid: true, type: 'upi' };
    }
  }
  return { valid: false, type: 'unknown', error: 'Invalid Mobile or UPI ID' };
}

export function extractMobileFromVpa(vpa: string): string | null {
  const parts = vpa.split('@');
  if (parts.length === 0) return null;
  const potential = parts[0].replace(/[^0-9]/g, '');
  if (potential.length === 10) return potential;
  if (potential.length === 12 && potential.startsWith('91')) return potential.substring(2);
  return null;
}

export function formatUssdForDisplay(command: string): string {
  if (command.includes('*1*1*')) return 'Transaction via Mobile';
  if (command.includes('*1*3*')) return 'Transaction via UPI ID';
  return 'USSD Session';
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
