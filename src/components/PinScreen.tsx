// ─── PIN Pad Component ───────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Modal,
  Vibration,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius, typography } from '../theme';
import { PIN_LENGTH } from '../utils/constants';

interface PinScreenProps {
  visible: boolean;
  mode: 'set' | 'verify' | 'confirm';
  title?: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export const PinScreen: React.FC<PinScreenProps> = ({
  visible, mode, title, subtitle, onComplete, onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(
    Array.from({ length: PIN_LENGTH }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
    }
  }, [visible]);

  useEffect(() => {
    // Animate dots as PIN is entered
    dotAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i < pin.length ? 1 : 0,
        tension: 300,
        friction: 15,
        useNativeDriver: true,
      }).start();
    });

    if (pin.length === PIN_LENGTH) {
      setTimeout(() => onComplete(pin), 150);
    }
  }, [pin]);

  const handleKey = (key: string) => {
    setError('');
    if (key === '⌫') {
      setPin(prev => prev.slice(0, -1));
      return;
    }
    if (key === '' || pin.length >= PIN_LENGTH) return;
    Vibration.vibrate(10);
    setPin(prev => prev + key);
  };

  const triggerError = (msg: string) => {
    setError(msg);
    setPin('');
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // Expose triggerError
  (PinScreen as any)._triggerError = triggerError;

  const defaultTitle = mode === 'set' ? 'Set Payment PIN'
    : mode === 'confirm' ? 'Confirm PIN'
    : 'Enter PIN';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <LinearGradient
        colors={['#0A0A0A', '#0D1117', '#161B22']}
        style={s.container}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onCancel} style={s.cancelBtn}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={s.titleArea}>
          <Text style={s.title}>{title || defaultTitle}</Text>
          <Text style={s.subtitle}>
            {subtitle || (mode === 'set' ? 'Choose a 4-digit PIN for payments' : 'Enter your 4-digit payment PIN')}
          </Text>
        </View>

        {/* Dots */}
        <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {dotAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                s.dot,
                {
                  transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                  backgroundColor: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255,255,255,0.15)', '#0A84FF'],
                  }),
                },
              ]}
            />
          ))}
        </Animated.View>

        {error ? <Text style={s.error}>{error}</Text> : <View style={{ height: 24 }} />}

        {/* Keypad */}
        <View style={s.keypad}>
          {KEYS.map((key, idx) => (
            <TouchableOpacity
              key={idx}
              style={[s.key, key === '' && s.keyHidden]}
              onPress={() => handleKey(key)}
              disabled={key === ''}
              activeOpacity={0.5}
            >
              {key === '⌫' ? (
                <Text style={s.keyDeleteText}>⌫</Text>
              ) : (
                <Text style={s.keyText}>{key}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
    </Modal>
  );
};

// Helper to trigger error animation from parent
export function triggerPinError(msg: string) {
  (PinScreen as any)._triggerError?.(msg);
}

const KEY_SIZE = 72;

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.xl },
  cancelBtn: { padding: spacing.md },
  cancelText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  titleArea: { alignItems: 'center', marginTop: spacing['3xl'], marginBottom: spacing['3xl'] },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  error: { ...typography.caption, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    paddingHorizontal: spacing['3xl'], gap: spacing.lg,
    marginTop: spacing.xl,
  },
  key: {
    width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  keyHidden: { backgroundColor: 'transparent', borderWidth: 0 },
  keyText: { fontSize: 28, fontWeight: '400', color: colors.textPrimary },
  keyDeleteText: { fontSize: 24, color: colors.textSecondary },
});
