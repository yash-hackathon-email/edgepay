// ─── Zustand Store ───────────────────────────────────────────────────

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStore, Transaction, NetworkMode, SmsPermissions, UssdPermissions, UserData, AppSettings } from '../types';
import { STORAGE_KEYS, DEFAULT_USER, DEFAULT_SETTINGS } from '../utils/constants';

interface UIState {
  theme: 'light' | 'dark';
  language: 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa') => void;
}

export const useStore = create<AppStore & UIState>((set, get) => ({
  // ─── User ────────────────────────────────────────────────────────
  user: { ...DEFAULT_USER },

  setUser: (updates: Partial<UserData>) => {
    set(state => {
      const newUser = { ...state.user, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUser)).catch(() => {});
      return { user: newUser };
    });
  },

  // ─── Settings ────────────────────────────────────────────────────
  settings: { ...DEFAULT_SETTINGS },

  setSettings: (updates: Partial<AppSettings>) => {
    set(state => {
      const newSettings = { ...state.settings, ...updates };
      AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings)).catch(() => {});
      return { settings: newSettings };
    });
  },

  // ─── UI / Theme / Lang ───────────────────────────────────────────
  theme: 'dark' as 'light' | 'dark', 
  language: 'en' as 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa',

  toggleTheme: () => {
    set(state => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
  },

  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
  },

  setLanguage: (lang: 'en' | 'hi' | 'mr' | 'ur' | 'bn' | 'kn' | 'or' | 'pa') => {
    set({ language: lang });
  },

  // ─── Network ─────────────────────────────────────────────────────
  networkMode: 'DETECTING' as NetworkMode,

  setNetworkMode: (mode: NetworkMode) => set({ networkMode: mode }),

  // ─── Transactions ────────────────────────────────────────────────
  transactions: [],

  addTransaction: (txn: Transaction) => {
    set(state => {
      const updated = [txn, ...state.transactions];
      let newSpent = state.user.spentThisMonth;
      
      // If payment is SUCCESS/SENT or PENDING (for now), count as expense
      // We assume most transactions are outgoing payments in this app context
      if (txn.status !== 'FAILED' && txn.status !== 'CANCELLED') {
         newSpent += txn.amount;
      }

      const newUser = { ...state.user, spentThisMonth: newSpent };
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUser)).catch(() => {});
      return { transactions: updated, user: newUser };
    });
  },

  updateTransaction: (id: string, updates: Partial<Transaction>) => {
    set(state => {
      const updated = state.transactions.map(txn =>
        txn.id === id ? { ...txn, ...updates } : txn
      );
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      return { transactions: updated };
    });
  },

  cancelTransaction: (id: string) => {
    set(state => {
      const updated = state.transactions.map(txn =>
        txn.id === id ? { ...txn, status: 'CANCELLED' as const } : txn
      );
      const updatedQueue = state.pendingQueue.filter(txn => txn.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(updatedQueue)).catch(() => {});
      return { transactions: updated, pendingQueue: updatedQueue };
    });
  },

  getRecentTransactions: (count: number = 5) => {
    return get().transactions.slice(0, count);
  },

  // ─── Queue ───────────────────────────────────────────────────────
  pendingQueue: [],

  addToQueue: (txn: Transaction) => {
    set(state => {
      const updated = [...state.pendingQueue, { ...txn, status: 'QUEUED' as const }];
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(updated)).catch(() => {});
      return { pendingQueue: updated };
    });
  },

  removeFromQueue: (id: string) => {
    set(state => {
      const updated = state.pendingQueue.filter(txn => txn.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(updated)).catch(() => {});
      return { pendingQueue: updated };
    });
  },

  // ─── Permissions ─────────────────────────────────────────────────
  smsPermissions: {
    send: false,
    receive: false,
    read: false,
    allGranted: false,
  },

  setSmsPermissions: (perms: SmsPermissions) => set({ smsPermissions: perms }),

  ussdPermissions: {
    callPhone: false,
    readPhoneState: false,
    allGranted: false,
  },

  setUssdPermissions: (perms: UssdPermissions) => set({ ussdPermissions: perms }),

  // ─── UI ──────────────────────────────────────────────────────────
  isLoading: false,
  setLoading: (loading: boolean) => set({ isLoading: loading }),

  // ─── Auth ────────────────────────────────────────────────────────
  isAuthenticated: false,
  setAuthenticated: (val: boolean) => set({ isAuthenticated: val }),

  recalculateSpending: () => {
    set(state => {
      let totalSpent = 0;
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      if (state.transactions && Array.isArray(state.transactions)) {
        state.transactions.forEach(txn => {
          const txnDate = new Date(txn.timestamp);
          if (txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {
            if (txn.status !== 'FAILED' && txn.status !== 'CANCELLED') {
              totalSpent += txn.amount;
            }
          }
        });
      }
      
      const newUser = { ...state.user, spentThisMonth: totalSpent };
      AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(newUser)).catch(() => {});
      return { user: newUser };
    });
  },

  checkAndResetBudget: () => {
    const { user, setUser } = get();
    const now = new Date();
    const currentDay = now.getDate();
    
    // Simple logic: if today is reset day and spent > 0, we could reset.
    // However, to avoid double resetting, we usually store the "LastResetMonth"
    // For this hackathon version, I'll do a simple comparison:
    if (currentDay >= user.budgetResetDay && user.spentThisMonth > 0) {
       // Check if we already reset this month (could use storage key)
       // For now, I'll allow the user to see a "Reset" or auto-reset if month changed.
    }
  }
}));

/**
 * Initialize store with persisted data
 */
export async function initializeStore(): Promise<void> {
  try {
    const [transactionsData, userData, queueData, settingsData] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
      AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE),
      AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
    ]);

    const state: Partial<AppStore & UIState> = {};

    if (transactionsData) {
      state.transactions = JSON.parse(transactionsData);
    }
    if (userData) {
      const parsedUser = JSON.parse(userData);
      state.user = { ...DEFAULT_USER, ...parsedUser };
      
      // Auto-recalculate spentThisMonth from transactions if needed
      if (state.transactions) {
        let totalSpent = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        state.transactions.forEach((txn: any) => {
          const txnDate = new Date(txn.timestamp);
          // Simple month boundary check — in a real app would use the user.budgetResetDay
          if (txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear) {
            if (txn.status !== 'FAILED' && txn.status !== 'CANCELLED') {
              totalSpent += txn.amount;
            }
          }
        });
        if (state.user) {
          state.user.spentThisMonth = totalSpent;
        }
      }
    }
    if (queueData) {
      state.pendingQueue = JSON.parse(queueData);
    }
    if (settingsData) {
      state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) };
    }

    useStore.setState(state);
  } catch (error) {
    console.error('[Store] Failed to initialize:', error);
  }
}
