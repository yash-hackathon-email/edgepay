// ─── Lock Screen ─────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authenticate, isBiometricAvailable } from '../engine/BiometricService';
import { useStore } from '../store/useStore';
import { colors, spacing, borderRadius, typography } from '../theme';

export const LockScreen: React.FC = () => {
  const setAuthenticated = useStore(state => state.setAuthenticated);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start();

    // Pulse animation for fingerprint icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    ).start();

    // Ring animation
    Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true,
      })
    ).start();

    // Auto-prompt biometric
    handleAuth();
  }, []);

  const handleAuth = async () => {
    const available = await isBiometricAvailable();
    if (!available) {
      // If no biometrics, let them through
      setAuthenticated(true);
      return;
    }
    const success = await authenticate('Unlock EdgePay');
    if (success) {
      setAuthenticated(true);
    }
  };

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.6],
  });
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.4, 0.15, 0],
  });

  return (
    <LinearGradient
      colors={['#0A0A0A', '#0D1B2A', '#1B2838']}
      style={s.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        {/* Logo */}
        <View style={s.logoWrap}>
          <Image source={require('../../assets/logo1.jpg')} style={s.logoImg} resizeMode="contain" />
          <Text style={s.tagline}>Secure GSM Payments</Text>
        </View>

        {/* Fingerprint Area */}
        <View style={s.authArea}>
          {/* Animated ring */}
          <Animated.View
            style={[
              s.ring,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />

          <Animated.View style={[s.fingerprintWrap, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['rgba(10,132,255,0.15)', 'rgba(10,132,255,0.05)']}
              style={s.fingerprintBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="fingerprint" size={56} color="#0A84FF" />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Action */}
        <TouchableOpacity style={s.unlockBtn} onPress={handleAuth} activeOpacity={0.7}>
          <LinearGradient
            colors={['#0A84FF', '#0066CC']}
            style={s.unlockGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={s.unlockText}>Tap to Unlock</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={s.hint}>Use fingerprint or device PIN</Text>
      </Animated.View>
    </LinearGradient>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '100%', paddingHorizontal: spacing['3xl'] },
  logoWrap: { alignItems: 'center', marginBottom: spacing['6xl'] },
  logoImg: { width: 100, height: 100, borderRadius: 24, marginBottom: spacing.md },
  appName: { ...typography.displayLarge, color: colors.textPrimary, letterSpacing: 1 },
  tagline: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs },
  authArea: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing['5xl'], height: 160 },
  ring: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, borderColor: colors.primary,
  },
  fingerprintWrap: { zIndex: 1 },
  fingerprintBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(10,132,255,0.3)',
  },
  fingerprintIcon: { fontSize: 40 },
  unlockBtn: { width: '100%', borderRadius: borderRadius.xl, overflow: 'hidden', marginBottom: spacing.lg },
  unlockGrad: { paddingVertical: spacing.xl, alignItems: 'center' },
  unlockText: { ...typography.h3, color: '#FFF', fontWeight: '700' },
  hint: { ...typography.caption, color: colors.textTertiary },
});
