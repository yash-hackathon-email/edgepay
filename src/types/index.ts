// ─── Transaction Types ───────────────────────────────────────────────

export type TransactionStatus = 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED' | 'QUEUED' | 'CANCELLED';

export type TransactionMethod = 'USSD' | 'ONLINE' | 'WALLET';

export type NetworkMode = 'ONLINE' | 'GSM' | 'DETECTING';

export interface Transaction {
  id: string;
  amount: number;
  receiver: string;
  receiverName?: string;
  method: TransactionMethod;
  status: TransactionStatus;
  timestamp: number;
  ussdCommand?: string;
  smsBody?: string;
  retryCount: number;
  lastRetryAt?: number;
  responseMessage?: string;
  upiId?: string;
}

// ─── QR Data Types ───────────────────────────────────────────────────

export interface QRPaymentData {
  upiId: string;
  name: string;
  amount?: number;
  note?: string;
  raw: string;
}

// ─── SMS Types ───────────────────────────────────────────────────────

export interface SmsMessage {
  sender: string;
  body: string;
  timestamp: number;
}

export interface SmsPermissions {
  send: boolean;
  receive: boolean;
  read: boolean;
  allGranted: boolean;
}

export interface SmsSendResult {
  status: 'SENT' | 'FAILED';
  phoneNumber: string;
  message: string;
  timestamp: number;
}

export type SmsParseResult = 'SUCCESS' | 'FAILED' | 'UNKNOWN';

// ─── USSD Types ──────────────────────────────────────────────────────

export interface UssdPermissions {
  callPhone: boolean;
  readPhoneState: boolean;
  allGranted: boolean;
}

export interface UssdResponse {
  status: 'SUCCESS' | 'DIALED';
  request?: string;
  response?: string;
  ussdCode?: string;
  timestamp: number;
}

// ─── User Types ──────────────────────────────────────────────────────

export interface UserData {
  name: string;
  phone: string;
  balance: number;
  currency: string;
  bank: string;
  isOnboarded: boolean;
}

// ─── Settings Types ──────────────────────────────────────────────────

export interface AppSettings {
  gatewayNumber: string;
  smsTemplate: string;
  maxTransactionAmount: number;
  pinHash: string;
  isBiometricEnabled: boolean;
}

// ─── Store Types ─────────────────────────────────────────────────────

export interface AppStore {
  // User
  user: UserData;
  setUser: (user: Partial<UserData>) => void;

  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;

  // Network
  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (txn: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  cancelTransaction: (id: string) => void;
  getRecentTransactions: (count?: number) => Transaction[];

  // Queue
  pendingQueue: Transaction[];
  addToQueue: (txn: Transaction) => void;
  removeFromQueue: (id: string) => void;

  // Permissions
  smsPermissions: SmsPermissions;
  setSmsPermissions: (perms: SmsPermissions) => void;

  ussdPermissions: UssdPermissions;
  setUssdPermissions: (perms: UssdPermissions) => void;

  // UI
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Auth
  isAuthenticated: boolean;
  setAuthenticated: (val: boolean) => void;
}

// ─── Navigation Types ────────────────────────────────────────────────

export type RootTabParamList = {
  Dashboard: undefined;
  SendMoney: { receiver?: string; amount?: number; name?: string } | undefined;
  QRScan: undefined;
  History: undefined;
  Setup: undefined;
  Settings: undefined;
};
