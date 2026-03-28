// ─── Payment Soundbox Engine ────────────────────────────────────────
// Paytm-like voice announcement for incoming payments.
// Listens for incoming SMS, parses for credit/debit events,
// and announces via offline TTS. Fully local — zero internet dependency.

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import Tts from 'react-native-tts';
import { parsePaymentSms, buildAnnouncementText } from './PaymentSmsParser';
import type { PaymentNotification } from './PaymentSmsParser';

const { SmsModule } = NativeModules;

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

export interface SoundboxConfig {
  enabled: boolean;
  language: string;
  announceCredits: boolean;   // Announce money received
  announceDebits: boolean;    // Announce money sent (optional)
  volume: number;             // 0.0 – 1.0 (not all engines support)
  speechRate: number;         // 0.25 – 1.0
}

export const DEFAULT_SOUNDBOX_CONFIG: SoundboxConfig = {
  enabled: true,
  language: 'en',
  announceCredits: true,
  announceDebits: false,
  volume: 1.0,
  speechRate: 0.5,
};

// ──────────────────────────────────────────────────────────────────────
// Notification listeners
// ──────────────────────────────────────────────────────────────────────

type PaymentCallback = (notification: PaymentNotification) => void;
const paymentListeners: PaymentCallback[] = [];

export function onPaymentDetected(callback: PaymentCallback): { remove: () => void } {
  paymentListeners.push(callback);
  return {
    remove: () => {
      const idx = paymentListeners.indexOf(callback);
      if (idx >= 0) paymentListeners.splice(idx, 1);
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// TTS Initialization (offline engine)
// ──────────────────────────────────────────────────────────────────────

let ttsInitialized = false;
let ttsReady = false;

async function initTts(): Promise<void> {
  if (ttsInitialized) return;
  ttsInitialized = true;

  try {
    // Configure for offline usage
    await Tts.setDefaultRate(DEFAULT_SOUNDBOX_CONFIG.speechRate);
    await Tts.setDefaultPitch(1.0);
    
    // Try setting default engine (Android offline TTS)
    try {
      const engines = await Tts.engines();
      console.log('[Soundbox] Available TTS engines:', engines?.map((e: any) => e.name));
      
      // Prefer offline-capable engines
      if (engines && engines.length > 0) {
        // com.google.android.tts is Google's offline TTS
        const googleTts = engines.find((e: any) =>
          e.name?.includes('google') || e.name?.includes('com.google')
        );
        if (googleTts) {
          await Tts.setDefaultEngine(googleTts.name);
          console.log('[Soundbox] Using Google TTS engine');
        }
      }
    } catch (engineErr) {
      console.warn('[Soundbox] Could not set TTS engine:', engineErr);
    }

    // Set default language  
    await setTtsLanguage('en');

    ttsReady = true;
    console.log('[Soundbox] TTS initialized successfully');
  } catch (err) {
    console.error('[Soundbox] TTS init failed:', err);
    ttsReady = false;
  }
}

async function setTtsLanguage(lang: string): Promise<void> {
  try {
    if (lang === 'hi') {
      await Tts.setDefaultLanguage('hi-IN');
    } else {
      await Tts.setDefaultLanguage('en-IN');
    }
  } catch (err) {
    console.warn('[Soundbox] Language set failed, falling back:', err);
    try {
      await Tts.setDefaultLanguage(lang === 'hi' ? 'hi' : 'en-US');
    } catch {
      // Use whatever language is available
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Core Announcement
// ──────────────────────────────────────────────────────────────────────

// Track recently announced to avoid duplicates
const recentAnnouncements: string[] = [];
const MAX_RECENT = 10;

function isDuplicate(notification: PaymentNotification): boolean {
  const key = `${notification.type}_${notification.amount}_${notification.sender}_${Math.floor(Date.now() / 30000)}`; // 30s window
  if (recentAnnouncements.includes(key)) return true;
  recentAnnouncements.push(key);
  if (recentAnnouncements.length > MAX_RECENT) recentAnnouncements.shift();
  return false;
}

/**
 * Announce a payment notification via TTS
 */
async function announcePayment(
  notification: PaymentNotification,
  config: SoundboxConfig,
): Promise<void> {
  if (!config.enabled) return;
  if (!ttsReady) {
    await initTts();
    if (!ttsReady) return;
  }

  // Skip if not the right type
  if (notification.type === 'CREDIT' && !config.announceCredits) return;
  if (notification.type === 'DEBIT' && !config.announceDebits) return;

  // Skip duplicates
  if (isDuplicate(notification)) {
    console.log('[Soundbox] Skipping duplicate announcement');
    return;
  }

  try {
    // Set language for this announcement
    await setTtsLanguage(config.language);
    
    // Set speech rate
    await Tts.setDefaultRate(config.speechRate);

    // Build announcement text
    const text = buildAnnouncementText(notification, config.language);
    console.log('[Soundbox] Announcing:', text);

    // Stop any current speech
    await Tts.stop();

    // Play a short "ding" sound effect with a pause then the announcement
    // The chime is simulated with a short spoken cue
    const chime = config.language === 'hi' ? 'EdgePay।' : 'EdgePay.';
    await Tts.speak(chime);

    // Small delay then the main announcement
    setTimeout(async () => {
      try {
        await Tts.speak(text);
      } catch (e) {
        console.error('[Soundbox] TTS speak error:', e);
      }
    }, 800);

    // Notify listeners
    paymentListeners.forEach(cb => {
      try { cb(notification); } catch {}
    });
  } catch (err) {
    console.error('[Soundbox] Announcement failed:', err);
  }
}

// ──────────────────────────────────────────────────────────────────────
// SMS Listener Integration
// ──────────────────────────────────────────────────────────────────────

let smsSubscription: { remove: () => void } | null = null;
let currentConfig: SoundboxConfig = { ...DEFAULT_SOUNDBOX_CONFIG };

/**
 * Start the Payment Soundbox — listens for incoming SMS and announces payments.
 * Call once after SMS listener is started and permissions granted.
 */
export async function startSoundbox(config: SoundboxConfig): Promise<void> {
  currentConfig = { ...config };

  if (!config.enabled) {
    console.log('[Soundbox] Disabled, not starting');
    return;
  }

  if (Platform.OS !== 'android' || !SmsModule) {
    console.warn('[Soundbox] Only available on Android with SMS module');
    return;
  }

  // Initialize TTS
  await initTts();

  // Remove existing subscription if any
  stopSoundbox();

  // Listen for incoming SMS
  try {
    const emitter = new NativeEventEmitter(SmsModule);
    smsSubscription = emitter.addListener('onSmsReceived', (sms: any) => {
      if (!currentConfig.enabled) return;

      const { sender, body } = sms;
      console.log('[Soundbox] SMS received from:', sender);

      // Parse for payment info
      const notification = parsePaymentSms(sender, body);
      if (notification) {
        console.log('[Soundbox] Payment detected:', notification.type, notification.amount);
        announcePayment(notification, currentConfig);
      }
    });

    console.log('[Soundbox] Started — listening for payment SMS');
  } catch (err) {
    console.error('[Soundbox] Failed to start:', err);
  }
}

/**
 * Stop the soundbox listener
 */
export function stopSoundbox(): void {
  if (smsSubscription) {
    smsSubscription.remove();
    smsSubscription = null;
    console.log('[Soundbox] Stopped');
  }
}

/**
 * Update soundbox config without restarting
 */
export function updateSoundboxConfig(config: Partial<SoundboxConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  console.log('[Soundbox] Config updated:', currentConfig);
}

/**
 * Test the soundbox by simulating a payment announcement
 */
export async function testSoundboxAnnouncement(
  lang: string,
  amount: number = 500,
): Promise<void> {
  const testNotification: PaymentNotification = {
    type: 'CREDIT',
    amount,
    sender: 'Test User',
    bank: 'Test Bank',
    rawBody: `Your a/c credited with Rs.${amount}.00 from Test User. Ref#TEST123456`,
  };

  const config: SoundboxConfig = {
    ...currentConfig,
    enabled: true,
    language: lang,
    announceCredits: true,
  };

  await announcePayment(testNotification, config);
}

/**
 * Get current soundbox status
 */
export function getSoundboxStatus(): {
  running: boolean;
  ttsReady: boolean;
  config: SoundboxConfig;
} {
  return {
    running: smsSubscription !== null,
    ttsReady,
    config: { ...currentConfig },
  };
}
