// ─── Biometric Authentication Service ────────────────────────────────
import ReactNativeBiometrics from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const { available } = await rnBiometrics.isSensorAvailable();
    return available;
  } catch {
    return false;
  }
}

export async function getBiometryType(): Promise<string | null> {
  try {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    return available ? (biometryType || null) : null;
  } catch {
    return null;
  }
}

export async function authenticate(promptMessage?: string): Promise<boolean> {
  try {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage: promptMessage || 'Authenticate to continue',
      cancelButtonText: 'Cancel',
    });
    return success;
  } catch {
    return false;
  }
}

// Simple hash for PIN (not cryptographic — for local app use only)
export function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36) + pin.length;
}

export function verifyPin(pin: string, storedHash: string): boolean {
  return hashPin(pin) === storedHash;
}
