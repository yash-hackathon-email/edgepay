// ─── Network Detector ────────────────────────────────────────────────
// Detects internet connectivity and switches between ONLINE / GSM mode

import { useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { NetworkMode } from '../types';
import { NETWORK_CHECK_INTERVAL_MS } from '../utils/constants';

/**
 * Check if internet is available by testing connectivity
 * Uses NetInfo for fast detection + HTTP ping for validation
 */
export async function checkNetworkStatus(): Promise<NetworkMode> {
  try {
    // Primary: fast check via NetInfo
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return 'GSM';
    }

    // Secondary: validate actual internet with HTTP ping
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 204 || response.ok) {
      return 'ONLINE';
    }
    return 'GSM';
  } catch {
    return 'GSM';
  }
}

/**
 * React hook for continuous network monitoring
 * Uses NetInfo events for instant detection + periodic HTTP validation
 */
export function useNetworkMonitor(
  onModeChange: (mode: NetworkMode) => void
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentModeRef = useRef<NetworkMode>('DETECTING');

  const checkAndUpdate = useCallback(async () => {
    const mode = await checkNetworkStatus();
    if (mode !== currentModeRef.current) {
      currentModeRef.current = mode;
      onModeChange(mode);
    }
  }, [onModeChange]);

  useEffect(() => {
    // Initial check
    checkAndUpdate();

    // Subscribe to NetInfo events for instant detection
    const unsubscribe = NetInfo.addEventListener(state => {
      const newMode: NetworkMode = state.isConnected ? 'ONLINE' : 'GSM';
      if (newMode !== currentModeRef.current) {
        // Validate with HTTP ping before confirming online
        if (newMode === 'ONLINE') {
          checkAndUpdate();
        } else {
          currentModeRef.current = 'GSM';
          onModeChange('GSM');
        }
      }
    });

    // Periodic validation (fallback)
    intervalRef.current = setInterval(checkAndUpdate, NETWORK_CHECK_INTERVAL_MS);

    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkAndUpdate, onModeChange]);

  return {
    forceCheck: checkAndUpdate,
    currentMode: currentModeRef.current,
  };
}
