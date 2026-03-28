// ─── SMS Service ─────────────────────────────────────────────────────
// JavaScript bridge to the Kotlin native SMS module

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { SmsMessage, SmsPermissions, SmsSendResult } from '../types';

const { SmsModule } = NativeModules;

let smsEventEmitter: NativeEventEmitter | null = null;

/**
 * Check if real SMS functionality is available (native module loaded on Android)
 */
export function isSmsAvailable(): boolean {
  return Platform.OS === 'android' && !!SmsModule;
}

function getEmitter(): NativeEventEmitter {
  if (!smsEventEmitter && SmsModule) {
    smsEventEmitter = new NativeEventEmitter(SmsModule);
  }
  if (!smsEventEmitter) {
    throw new Error(
      '[SmsService] Native SMS module not available. SMS features require a physical Android device.'
    );
  }
  return smsEventEmitter;
}

/**
 * Send an SMS message through the native module
 */
export async function sendSMS(
  phoneNumber: string,
  message: string
): Promise<SmsSendResult> {
  if (Platform.OS !== 'android') {
    throw new Error('[SmsService] SMS is only supported on Android');
  }

  if (!SmsModule) {
    throw new Error(
      '[SmsService] Native SMS module not loaded. Run on a physical Android device.'
    );
  }

  try {
    const result = await SmsModule.sendSms(phoneNumber, message);
    console.log('[SmsService] SMS sent:', result);
    return result;
  } catch (error: any) {
    console.error('[SmsService] Failed to send SMS:', error);
    return {
      status: 'FAILED',
      phoneNumber,
      message,
      timestamp: Date.now(),
    };
  }
}

/**
 * Start listening for incoming SMS messages
 */
export async function startSmsListener(): Promise<void> {
  if (!SmsModule) {
    console.warn('[SmsService] Native module unavailable, cannot start listener');
    return;
  }
  try {
    await SmsModule.startSmsListener();
    console.log('[SmsService] SMS listener started');
  } catch (error) {
    console.error('[SmsService] Failed to start listener:', error);
  }
}

/**
 * Stop listening for incoming SMS
 */
export async function stopSmsListener(): Promise<void> {
  if (!SmsModule) return;
  try {
    await SmsModule.stopSmsListener();
    console.log('[SmsService] SMS listener stopped');
  } catch (error) {
    console.error('[SmsService] Failed to stop listener:', error);
  }
}

/**
 * Subscribe to incoming SMS events
 */
export function onSmsReceived(
  callback: (sms: SmsMessage) => void
): { remove: () => void } {
  const emitter = getEmitter();
  const subscription = emitter.addListener('onSmsReceived', callback);
  return subscription;
}

/**
 * Subscribe to outgoing SMS events
 */
export function onSmsSent(
  callback: (result: SmsSendResult) => void
): { remove: () => void } {
  const emitter = getEmitter();
  const subscription = emitter.addListener('onSmsSent', callback);
  return subscription;
}

/**
 * Request SMS permissions
 */
export async function requestSmsPermissions(): Promise<SmsPermissions> {
  if (!SmsModule) {
    console.warn('[SmsService] Native module unavailable, cannot request permissions');
    return { send: false, receive: false, read: false, allGranted: false };
  }
  try {
    const result = await SmsModule.requestSmsPermissions();
    return result.granted
      ? { send: true, receive: true, read: true, allGranted: true }
      : { send: false, receive: false, read: false, allGranted: false };
  } catch (error) {
    console.error('[SmsService] Permission request failed:', error);
    return { send: false, receive: false, read: false, allGranted: false };
  }
}

/**
 * Check current SMS permissions
 */
export async function checkSmsPermissions(): Promise<SmsPermissions> {
  if (!SmsModule) {
    return { send: false, receive: false, read: false, allGranted: false };
  }
  try {
    return await SmsModule.checkSmsPermissions();
  } catch (error) {
    console.error('[SmsService] Permission check failed:', error);
    return { send: false, receive: false, read: false, allGranted: false };
  }
}

/**
 * Read recent SMS messages from inbox (for polling bank confirmations)
 */
export async function readRecentSms(count: number = 10): Promise<SmsMessage[]> {
  if (!SmsModule) return [];
  try {
    const messages = await SmsModule.readRecentSms(count);
    return messages || [];
  } catch (error) {
    console.warn('[SmsService] Failed to read recent SMS:', error);
    return [];
  }
}
