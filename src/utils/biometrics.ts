import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { Alert, Platform } from 'react-native';

const rnBiometrics = new ReactNativeBiometrics();

export const checkBiometrics = async () => {
    try {
        const { biometryType } = await rnBiometrics.isSensorAvailable();
        return biometryType;
    } catch (error) {
        console.error('[Biometrics] Error checking availability:', error);
        return null;
    }
};

export const authenticateWithBiometrics = async (promptMessage: string = 'Verify your identity'): Promise<boolean> => {
    try {
        const { available, biometryType } = await rnBiometrics.isSensorAvailable();

        if (available) {
            const { success, error } = await rnBiometrics.simplePrompt({
                promptMessage,
                cancelButtonText: 'Use PIN',
            });

            if (success) {
                return true;
            } else {
                console.log('[Biometrics] Authentication failed/cancelled:', error);
                return false;
            }
        } else {
            console.log('[Biometrics] No biometric sensor available');
            return false;
        }
    } catch (error) {
        console.error('[Biometrics] Error during authentication:', error);
        return false;
    }
};
