// ─── USSD Service ────────────────────────────────────────────────────
// JavaScript bridge to the Kotlin native USSD module
// Handles USSD command execution via TelephonyManager.sendUssdRequest()

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { USSDModule } = NativeModules;

let ussdEventEmitter: NativeEventEmitter | null = null;

// ─── Types ───────────────────────────────────────────────────────────

export interface UssdResponse {
  status: 'SUCCESS' | 'DIALED';
  request?: string;
  response?: string;
  ussdCode?: string;
  timestamp: number;
}

export interface UssdPermissions {
  callPhone: boolean;
  readPhoneState: boolean;
  allGranted: boolean;
}

export interface TelephonyInfo {
  simState: number;
  isSimReady: boolean;
  networkOperator: string;
  simOperator: string;
  phoneType: number;
  networkType: number;
}

export interface UssdEvent {
  type: 'response' | 'error';
  request?: string;
  response?: string;
  error?: string;
  failureCode?: number;
  timestamp: number;
}

// ─── Availability ────────────────────────────────────────────────────

/**
 * Check if USSD functionality is available (native module loaded on Android)
 */
export function isUssdAvailable(): boolean {
  return Platform.OS === 'android' && !!USSDModule;
}

function getEmitter(): NativeEventEmitter {
  if (!ussdEventEmitter && USSDModule) {
    ussdEventEmitter = new NativeEventEmitter(USSDModule);
  }
  if (!ussdEventEmitter) {
    throw new Error(
      '[USSDService] Native USSD module not available. USSD features require a physical Android device.'
    );
  }
  return ussdEventEmitter;
}

// ─── Core USSD Functions ─────────────────────────────────────────────

/**
 * Send a USSD request using TelephonyManager.sendUssdRequest()
 * This executes the USSD command and waits for the network response
 *
 * @param ussdCode - The USSD code to execute (e.g., '*99*1*9876543210*500#')
 * @returns Promise with the USSD response
 */
export async function sendUssdRequest(ussdCode: string): Promise<UssdResponse> {
  if (Platform.OS !== 'android') {
    throw new Error('[USSDService] USSD is only supported on Android');
  }

  if (!USSDModule) {
    throw new Error(
      '[USSDService] Native USSD module not loaded. Run on a physical Android device.'
    );
  }

  try {
    const result = await USSDModule.sendUssdRequest(ussdCode);
    console.log('[USSDService] USSD request sent:', result);
    return result;
  } catch (error: any) {
    console.error('[USSDService] USSD request failed:', error);
    throw error;
  }
}

/**
 * Dial a USSD code using the phone dialer (fallback method)
 * This opens the native dialer with the USSD code
 *
 * @param ussdCode - The USSD code to dial
 */
export async function dialUssdCode(ussdCode: string): Promise<UssdResponse> {
  if (Platform.OS !== 'android') {
    throw new Error('[USSDService] USSD is only supported on Android');
  }

  if (!USSDModule) {
    throw new Error(
      '[USSDService] Native USSD module not loaded. Run on a physical Android device.'
    );
  }

  try {
    const result = await USSDModule.dialUssdCode(ussdCode);
    console.log('[USSDService] USSD code dialed:', result);
    return result;
  } catch (error: any) {
    console.error('[USSDService] USSD dial failed:', error);
    throw error;
  }
}

// ─── Permissions ─────────────────────────────────────────────────────

/**
 * Check USSD-related permissions (CALL_PHONE, READ_PHONE_STATE)
 */
export async function checkUssdPermissions(): Promise<UssdPermissions> {
  if (!USSDModule) {
    return { callPhone: false, readPhoneState: false, allGranted: false };
  }
  try {
    return await USSDModule.checkPermission();
  } catch (error) {
    console.error('[USSDService] Permission check failed:', error);
    return { callPhone: false, readPhoneState: false, allGranted: false };
  }
}

/**
 * Request USSD-related permissions
 */
export async function requestUssdPermissions(): Promise<{ granted: boolean }> {
  if (!USSDModule) {
    console.warn('[USSDService] Native module unavailable, cannot request permissions');
    return { granted: false };
  }
  try {
    return await USSDModule.requestPermissions();
  } catch (error) {
    console.error('[USSDService] Permission request failed:', error);
    return { granted: false };
  }
}

// ─── Telephony Info ──────────────────────────────────────────────────

/**
 * Get device telephony information (SIM state, operator, etc.)
 */
export async function getTelephonyInfo(): Promise<TelephonyInfo | null> {
  if (!USSDModule) return null;
  try {
    return await USSDModule.getTelephonyInfo();
  } catch (error) {
    console.error('[USSDService] Failed to get telephony info:', error);
    return null;
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────

/**
 * Subscribe to USSD response events
 */
export function onUssdResponse(
  callback: (event: UssdEvent) => void
): { remove: () => void } {
  const emitter = getEmitter();
  const subscription = emitter.addListener('onUssdResponse', callback);
  return subscription;
}
