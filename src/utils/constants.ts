// ─── Constants ───────────────────────────────────────────────────────

// USSD format
export const USSD_SERVICE_CODE = '*99#';
export const USSD_PAYMENT_PREFIX = '*99*1*';

// SMS format template (kept for transaction confirmation detection)
export const SMS_COMMAND_PREFIX = 'PAY';
export const DEFAULT_SMS_TEMPLATE = 'PAY {amount} TO {receiver}';
export const SMS_GATEWAY_NUMBER_DEFAULT = '09223766666';

// Transaction limits
export const SMS_TIMEOUT_MS = 30000;
export const USSD_TIMEOUT_MS = 10000; // 10s wait for confirmation message as requested
export const MAX_TRANSACTION_AMOUNT_DEFAULT = 100000;

// Queue
export const QUEUE_PROCESS_INTERVAL_MS = 15000;
export const MAX_RETRY_COUNT = 3;
export const RETRY_DELAY_MS = 10000;

// Storage keys
export const STORAGE_KEYS = {
  TRANSACTIONS: '@edgepay/transactions',
  USER_DATA: '@edgepay/user_data',
  PENDING_QUEUE: '@edgepay/pending_queue',
  SETTINGS: '@edgepay/settings',
  PIN_HASH: '@edgepay/pin_hash',
} as const;

// Default user data (empty - user must onboard)
export const DEFAULT_USER = {
  name: '',
  phone: '',
  balance: 0,
  currency: '₹',
  bank: '',
  isOnboarded: false,
  goalAmount: 0,
  monthlyBudget: 0,
  spentThisMonth: 0,
  budgetResetDay: 1,
} as const;

// Default settings
export const DEFAULT_SETTINGS = {
  gatewayNumber: SMS_GATEWAY_NUMBER_DEFAULT,
  smsTemplate: DEFAULT_SMS_TEMPLATE,
  maxTransactionAmount: MAX_TRANSACTION_AMOUNT_DEFAULT,
  pinHash: '',
  isBiometricEnabled: true,
  isSoundboxEnabled: true,
  soundboxLanguage: 'en' as const,
  isWidgetEnabled: true,
} as const;

// Network check interval
export const NETWORK_CHECK_INTERVAL_MS = 5000;

// QR URI schemes
export const UPI_SCHEME = 'upi://pay';

// Status colors mapping
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'rgba(255, 159, 10, 0.12)', text: '#FF9F0A' },
  SENT: { bg: 'rgba(90, 200, 250, 0.12)', text: '#5AC8FA' },
  SUCCESS: { bg: 'rgba(48, 209, 88, 0.12)', text: '#30D158' },
  FAILED: { bg: 'rgba(255, 69, 58, 0.12)', text: '#FF453A' },
  QUEUED: { bg: 'rgba(255, 255, 255, 0.08)', text: 'rgba(255, 255, 255, 0.6)' },
  CANCELLED: { bg: 'rgba(142, 142, 147, 0.12)', text: '#8E8E93' },
} as const;

// PIN
export const PIN_LENGTH = 4;

// Supported bank IFSC patterns for USSD (SBI initial target)
export const SUPPORTED_BANKS = [
  { code: 'SBI', name: 'State Bank of India', ussdShortCode: '*99#' },
  { code: 'PNB', name: 'Punjab National Bank', ussdShortCode: '*99#' },
  { code: 'BOB', name: 'Bank of Baroda', ussdShortCode: '*99#' },
  { code: 'CANARA', name: 'Canara Bank', ussdShortCode: '*99#' },
  { code: 'UNION', name: 'Union Bank of India', ussdShortCode: '*99#' },
] as const;
