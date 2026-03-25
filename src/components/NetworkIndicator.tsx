// ─── Network Indicator Component ─────────────────────────────────────
// Shows current connectivity status (Online vs Offline/USSD mode)

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NetworkMode } from '../types';
import { colors, spacing, borderRadius, typography } from '../theme';

interface NetworkIndicatorProps {
  mode: NetworkMode;
}

export const NetworkIndicator: React.FC<NetworkIndicatorProps> = ({ mode }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Pulse animation for GSM/USSD mode
    if (mode === 'GSM') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [mode, pulseAnim, fadeAnim]);

  const isGsm = mode === 'GSM';
  const isDetecting = mode === 'DETECTING';

  return (
    <Animated.View
      style={[
        styles.container,
        isGsm && styles.containerGsm,
        isDetecting && styles.containerDetecting,
        { opacity: fadeAnim },
      ]}
    >
      <View style={styles.dotContainer}>
        {isGsm && (
          <Animated.View
            style={[
              styles.pulse,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
        )}
        <View
          style={[
            styles.dot,
            isGsm && styles.dotGsm,
            isDetecting && styles.dotDetecting,
            !isGsm && !isDetecting && styles.dotOnline,
          ]}
        />
      </View>
      
      <View style={styles.textStack}>
        <View style={styles.row}>
          <Icon 
            name={isDetecting ? 'sync' : isGsm ? 'radiobox-marked' : 'wifi-check'} 
            size={12} 
            color={isDetecting ? colors.textTertiary : isGsm ? colors.gsmActive : colors.success} 
          />
          <Text
            style={[
              styles.label,
              isGsm && styles.labelGsm,
              isDetecting && styles.labelDetecting,
            ]}
          >
            {isDetecting ? 'Detecting...' : isGsm ? 'Offline' : 'Online'}
          </Text>
        </View>
        {isGsm && (
          <Text style={styles.sublabel}>USSD Payment Mode</Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.2)',
    gap: spacing.sm,
  },
  containerGsm: {
    backgroundColor: colors.gsmBackground,
    borderColor: colors.gsmBorder,
  },
  containerDetecting: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: colors.border,
  },
  dotContainer: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gsmActive,
    opacity: 0.4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 2,
  },
  dotOnline: {
    backgroundColor: colors.success,
  },
  dotGsm: {
    backgroundColor: colors.gsmActive,
  },
  dotDetecting: {
    backgroundColor: colors.textTertiary,
  },
  textStack: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    ...typography.labelSmall,
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
  },
  labelGsm: {
    color: colors.gsmActive,
  },
  labelDetecting: {
    color: colors.textTertiary,
  },
  sublabel: {
    ...typography.caption,
    color: colors.gsmActive,
    opacity: 0.8,
    fontSize: 8,
    lineHeight: 8,
    marginTop: 1,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
