// ─── Widget Service ─────────────────────────────────────────────────
// JS bridge to Android PaymentWidgetService — runs the payment monitor
// as a foreground service with floating overlay widget.
// Keeps the app alive in background to detect and announce payments.

import { NativeModules, Platform } from 'react-native';

const { PaymentWidgetModule } = NativeModules;

export interface WidgetConfig {
  language?: string;
  announceCredits: boolean;
  announceDebits: boolean;
}

const DEFAULT_CONFIG: WidgetConfig = {
  language: 'en',
  announceCredits: true,
  announceDebits: false,
};

/**
 * Check if the widget native module is available (Android only)
 */
export function isWidgetAvailable(): boolean {
  return Platform.OS === 'android' && !!PaymentWidgetModule;
}

/**
 * Start the background payment monitor widget.
 * - Runs as a foreground service (persistent notification)
 * - Listens for incoming payment SMS
 * - Announces via TTS
 * - Shows floating overlay widget on screen
 */
export async function startPaymentWidget(
  config: Partial<WidgetConfig> = {},
): Promise<boolean> {
  if (!isWidgetAvailable()) {
    console.warn('[WidgetService] Not available on this platform');
    return false;
  }

  const merged = { ...DEFAULT_CONFIG, ...config };

  try {
    const result = await PaymentWidgetModule.startWidget(merged);
    console.log('[WidgetService] Started:', result);
    return true;
  } catch (err) {
    console.error('[WidgetService] Failed to start:', err);
    return false;
  }
}

/**
 * Stop the background payment monitor widget
 */
export async function stopPaymentWidget(): Promise<boolean> {
  if (!isWidgetAvailable()) return false;

  try {
    await PaymentWidgetModule.stopWidget();
    console.log('[WidgetService] Stopped');
    return true;
  } catch (err) {
    console.error('[WidgetService] Failed to stop:', err);
    return false;
  }
}

/**
 * Check if the widget service is currently running
 */
export async function isWidgetRunning(): Promise<boolean> {
  if (!isWidgetAvailable()) return false;
  try {
    return await PaymentWidgetModule.isWidgetRunning();
  } catch {
    return false;
  }
}

/**
 * Check if overlay (draw over apps) permission is granted
 */
export async function hasOverlayPermission(): Promise<boolean> {
  if (!isWidgetAvailable()) return false;
  try {
    return await PaymentWidgetModule.hasOverlayPermission();
  } catch {
    return false;
  }
}

/**
 * Request overlay permission — opens system settings page
 */
export async function requestOverlayPermission(): Promise<boolean> {
  if (!isWidgetAvailable()) return false;
  try {
    return await PaymentWidgetModule.requestOverlayPermission();
  } catch {
    return false;
  }
}

/**
 * Update widget config while running (language, announce settings)
 */
export async function updateWidgetConfig(
  config: Partial<WidgetConfig>,
): Promise<boolean> {
  if (!isWidgetAvailable()) return false;
  try {
    const merged = { ...DEFAULT_CONFIG, ...config };
    await PaymentWidgetModule.updateConfig(merged);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync budget goal amount and current balance across to Android widget
 */
export async function syncGoalAmount(
  goal: number,
  balance: number,
): Promise<boolean> {
  if (!isWidgetAvailable()) return false;
  try {
    const result = await PaymentWidgetModule.syncGoalAmount(goal, balance);
    console.log('[WidgetService] Goal synced:', result);
    return true;
  } catch (err) {
    console.error('[WidgetService] Failed to sync goal:', err);
    return false;
  }
}

/**
 * Sync budget limit and current expense across to Android widget
 */
export async function syncExpenseData(
  spent: number,
  budget: number,
  resetDay: number,
): Promise<boolean> {
  if (!isWidgetAvailable()) return false;
  try {
    const result = await PaymentWidgetModule.syncExpenseData(spent, budget, resetDay);
    console.log('[WidgetService] Expense synced:', result);
    return true;
  } catch (err) {
    console.error('[WidgetService] Failed to sync expense:', err);
    return false;
  }
}
