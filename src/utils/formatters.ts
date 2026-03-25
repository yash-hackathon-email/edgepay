// ─── Formatters ──────────────────────────────────────────────────────

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currency: string = '₹'): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${formatted}`;
}

/**
 * Format currency amount without decimals for display
 */
export function formatCurrencyShort(amount: number, currency: string = '₹'): string {
  if (amount >= 100000) {
    return `${currency}${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `${currency}${(amount / 1000).toFixed(1)}K`;
  }
  return `${currency}${amount.toFixed(0)}`;
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format timestamp to relative time (e.g., "2m ago", "1h ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Format timestamp to full date
 */
export function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Alias for formatFullDate
 */
export const formatDate = formatFullDate;

/**
 * Format transaction ID for display (shortened)
 */
export function formatTransactionId(id: string): string {
  if (id.length <= 8) return id.toUpperCase();
  return `${id.slice(0, 4)}...${id.slice(-4)}`.toUpperCase();
}

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `EP${timestamp}${random}`.toUpperCase();
}

/**
 * Mask a phone number for privacy
 */
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    return `${cleaned.slice(0, 2)}****${cleaned.slice(-4)}`;
  }
  return phone;
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
