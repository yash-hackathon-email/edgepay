// ─── Lock Screen ─────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authenticate, isBiometricAvailable } from '../engine/BiometricService';
import { useStore } from '../store/useStore';
import { useTheme, spacing, borderRadius, typography } from '../theme';

export const LockScreen: React.FC = () => {
  const { colors, theme } = useTheme();
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
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <View style={s.bgGlowWrap}>
        <LinearGradient
          colors={[colors.primary + '15', 'transparent']}
          style={s.bgGlow}
        />
      </View>

      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        {/* Logo */}
        <View style={s.logoWrap}>
          <Image source={require('../../assets/EdgePay_Icon.png')} style={s.logoImg} resizeMode="contain" />
          <Text style={[s.appName, { color: colors.textPrimary }]}>EdgePay</Text>
          <Text style={[s.tagline, { color: colors.textSecondary }]}>SECURE GSM PAYMENTS</Text>
        </View>

        {/* Fingerprint Area */}
        <View style={s.authArea}>
          <Animated.View
            style={[
              s.ring,
              { transform: [{ scale: ringScale }], opacity: ringOpacity, borderColor: colors.primary },
            ]}
          />

          <Animated.View style={[s.fingerprintWrap, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={[colors.primary + '30', colors.primary + '10']}
              style={[s.fingerprintBg, { borderColor: colors.primary + '40' }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="fingerprint" size={56} color={colors.primary} />
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
            <Text style={s.unlockText}>Unlock with Biometrics</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[s.hint, { color: colors.textTertiary }]}>Securely encrypted for your safety</Text>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bgGlowWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlow: { position: 'absolute', top: -150, left: -150, width: 500, height: 500, borderRadius: 250 },
  content: { alignItems: 'center', width: '100%', paddingHorizontal: spacing['3xl'] },
  logoWrap: { alignItems: 'center', marginBottom: 60 },
  logoImg: { width: 90, height: 90, borderRadius: 24, marginBottom: 16 },
  appName: { fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  tagline: { fontSize: 11, fontWeight: '800', letterSpacing: 4, marginTop: 4, opacity: 0.6 },
  authArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 60, height: 160 },
  ring: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    borderWidth: 2,
  },
  fingerprintWrap: { zIndex: 1 },
  fingerprintBg: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  unlockBtn: { width: '100%', borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
  unlockGrad: { paddingVertical: 20, alignItems: 'center' },
  unlockText: { fontSize: 17, color: '#FFF', fontWeight: '800' },
  hint: { fontSize: 12, fontWeight: '600', opacity: 0.6 },
});
