// ─── Zustand Store ───────────────────────────────────────────────────

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStore, Transaction, NetworkMode, SmsPermissions, UssdPermissions, UserData, AppSettings } from '../types';
import { STORAGE_KEYS, DEFAULT_USER, DEFAULT_SETTINGS } from '../utils/constants';

interface UIState {
  theme: 'light' | 'dark';
  language: 'en' | 'hi';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'en' | 'hi') => void;
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
  language: 'en' as 'en' | 'hi',

  toggleTheme: () => {
    set(state => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
  },

  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
  },

  setLanguage: (lang: 'en' | 'hi') => {
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
      AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated)).catch(() => {});
      return { transactions: updated };
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
      state.user = JSON.parse(userData);
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
