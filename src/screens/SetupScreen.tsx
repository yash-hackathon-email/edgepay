// ─── Setup / Onboarding Screen ──────────────────────────────────────
// Handles first-time setup, user details, bank selection, and initial permissions

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, TextInput, TouchableOpacity,
  Animated, Alert, ScrollView, Dimensions, Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import { requestSmsPermissions } from '../engine/SmsService';
import { requestUssdPermissions } from '../engine/USSDService';
import { hashPin } from '../engine/BiometricService';
import { SMS_GATEWAY_NUMBER_DEFAULT, PIN_LENGTH } from '../utils/constants';
import { PinScreen } from '../components/PinScreen';
import { colors, spacing, borderRadius, typography, gradients } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BANKS = [
  { id: 'HDFC', name: 'HDFC Bank', color: '#004B87', textColor: '#FFF' },
  { id: 'SBI', name: 'State Bank of India', color: '#22409A', textColor: '#FFF' },
];

export const SetupScreen: React.FC = () => {
  const { setUser, setSettings, setSmsPermissions, setUssdPermissions } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [gateway, setGateway] = useState(SMS_GATEWAY_NUMBER_DEFAULT);
  const [template, setTemplate] = useState('PAY {amount} TO {receiver}');
  const [step, setStep] = useState(0); // 0=info, 1=form, 2=pin, 3=permissions
  const [showPinSet, setShowPinSet] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [pendingPin, setPendingPin] = useState('');

  const phoneRef = useRef<any>(null);

  // Auto-advance: when phone reaches 10 digits, blur to show bank selection
  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text);
    if (text.replace(/\D/g, '').length >= 10) {
      phoneRef.current?.blur();
    }
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const handleNext = () => {
    if (step === 0) {
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
      setStep(1);
    } else if (step === 1) {
      if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
        Alert.alert('Invalid Input', 'Please enter your name and 10-digit phone number.');
        return;
      }
      if (!selectedBank) {
        Alert.alert('Select Bank', 'Please select your bank to continue.');
        return;
      }
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
      setStep(2);
    } else if (step === 2) {
      setShowPinSet(true);
    } else if (step === 3) {
      handleComplete();
    }
  };

  const handlePinSet = (pin: string) => {
    setShowPinSet(false);
    setPendingPin(pin);
    setTimeout(() => setShowPinConfirm(true), 300);
  };

  const handlePinConfirm = (pin: string) => {
    if (pin === pendingPin) {
      setShowPinConfirm(false);
      setSettings({ pinHash: hashPin(pin) });
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
      setStep(3);
    } else {
      setShowPinConfirm(false);
      Alert.alert('PIN Mismatch', 'PINs did not match. Please try again.', [
        { text: 'OK', onPress: () => setPendingPin('') }
      ]);
    }
  };

  const handleSkipPin = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    setStep(3);
  };

  const handleComplete = async () => {
    try {
      const smsPerms = await requestSmsPermissions();
      setSmsPermissions(smsPerms);

      if (Platform.OS === 'android') {
        const ussdResult = await requestUssdPermissions();
        if (!ussdResult.granted) {
          Alert.alert(
            'Permissions Partial',
            'Some permissions were not granted. USSD features may be limited.'
          );
        }
      }
    } catch (err) {
      console.warn('[Setup] Permission request error:', err);
    }

    setUser({
      name: name.trim(),
      phone: phone.trim(),
      bank: selectedBank,
      balance: 1000,
      isOnboarded: true,
    });
    setSettings({
      gatewayNumber: gateway.trim(),
      smsTemplate: template.trim(),
    });
  };

  const features = [
    { icon: 'phone-dial', title: 'USSD Engine', desc: 'UPI payments over *99# USSD network' },
    { icon: 'qrcode-scan', title: 'QR to USSD', desc: 'Scan any UPI QR and pay offline' },
    { icon: 'shield-lock-outline', title: 'Secured PIN', desc: 'Local PIN & Biometric protection' },
    { icon: 'wifi-off', title: 'No Internet', desc: 'Works perfectly in zero connectivity' },
  ];

  return (
    <LinearGradient colors={['#0A0A0A', '#111', '#1A1A1A']} style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {step === 0 && (
            <>
              <View style={s.heroArea}>
                <Image source={require('../../assets/logo1.jpg')} style={s.heroLogoImg} resizeMode="contain" />
                <Text style={s.heroTitle}>EdgePay USSD</Text>
                <Text style={s.heroSub}>Offline UPI for Bharat</Text>
              </View>

              <View style={s.featureGrid}>
                {features.map((f, i) => (
                  <View key={i} style={s.featureCard}>
                    <Icon name={f.icon} size={24} color={colors.primary} />
                    <Text style={s.featureTitle}>{f.title}</Text>
                    <Text style={s.featureDesc}>{f.desc}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={s.primaryBtnWrap} onPress={handleNext} activeOpacity={0.8}>
                <LinearGradient colors={gradients.primary} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>Get Started</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={s.stepTitle}>Your Profile</Text>
              <Text style={s.stepSub}>Enter your details to link with *99#</Text>

              <View style={s.formGroup}>
                <Text style={s.label}>FULL NAME</Text>
                <View style={s.inputWrapper}>
                  <Icon name="account-outline" size={20} color={colors.textTertiary} />
                  <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={colors.textTertiary} selectionColor={colors.primary} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} blurOnSubmit={false} />
                </View>
              </View>

              <View style={s.formGroup}>
                <Text style={s.label}>MOBILE NUMBER</Text>
                <View style={s.inputWrapper}>
                  <Icon name="phone-outline" size={20} color={colors.textTertiary} />
                  <TextInput ref={phoneRef} style={s.input} value={phone} onChangeText={handlePhoneChange} placeholder="10-digit mobile" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" maxLength={10} selectionColor={colors.primary} returnKeyType="done" />
                </View>
                <Text style={s.hint}>Registered with your bank for USSD (*99#)</Text>
              </View>

              {/* Bank Selection */}
              <View style={s.formGroup}>
                <Text style={s.label}>SELECT YOUR BANK</Text>
                <View style={s.bankRow}>
                  {BANKS.map((bank) => {
                    const isSelected = selectedBank === bank.id;
                    return (
                      <TouchableOpacity
                        key={bank.id}
                        style={[
                          s.bankCard,
                          { backgroundColor: isSelected ? bank.color : 'rgba(255,255,255,0.04)', borderColor: isSelected ? bank.color : 'rgba(255,255,255,0.08)' },
                        ]}
                        onPress={() => setSelectedBank(bank.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.bankLogo, { backgroundColor: bank.color }]}>
                          <Icon
                            name={bank.id === 'HDFC' ? 'bank' : 'bank-outline'}
                            size={24}
                            color="#FFF"
                          />
                        </View>
                        <Text style={[s.bankName, { color: isSelected ? '#FFF' : colors.textPrimary }]}>{bank.name}</Text>
                        {isSelected && (
                          <View style={s.bankCheck}>
                            <Icon name="check-circle" size={20} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={[s.primaryBtnWrap, (!name.trim() || phone.length < 10 || !selectedBank) && { opacity: 0.4 }]}
                onPress={handleNext}
                disabled={!name.trim() || phone.length < 10 || !selectedBank}
              >
                <LinearGradient colors={gradients.primary} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>Next Step</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <View style={s.pinArea}>
                <View style={s.pinIconCircle}>
                  <Icon name="lock-plus-outline" size={48} color={colors.primary} />
                </View>
                <Text style={s.stepTitle}>Secure Your App</Text>
                <Text style={s.stepSub}>Create a payment PIN to protect your transactions offline.</Text>
              </View>

              <TouchableOpacity style={s.primaryBtnWrap} onPress={handleNext} activeOpacity={0.8}>
                <LinearGradient colors={gradients.primary} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>Set Payment PIN</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.skipBtn} onPress={handleSkipPin}>
                <Text style={s.skipText}>I'll do it later</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <View style={s.pinArea}>
                <View style={s.pinIconCircle}>
                  <Icon name="shield-check-outline" size={48} color={colors.success} />
                </View>
                <Text style={s.stepTitle}>Final Permissions</Text>
                <Text style={s.stepSub}>EdgePay needs Phone & SMS access to dial USSD codes and detect bank confirmations.</Text>
              </View>

              <TouchableOpacity style={s.primaryBtnWrap} onPress={handleNext} activeOpacity={0.8}>
                <LinearGradient colors={gradients.success} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>Allow & Finish</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <PinScreen visible={showPinSet} mode="set" onComplete={handlePinSet} onCancel={() => setShowPinSet(false)} />
      <PinScreen visible={showPinConfirm} mode="confirm" title="Confirm PIN" subtitle="Re-enter your PIN to confirm" onComplete={handlePinConfirm} onCancel={() => setShowPinConfirm(false)} />
    </LinearGradient>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  content: { gap: spacing['2xl'] },
  heroArea: { alignItems: 'center', marginBottom: spacing.md },
  heroLogoImg: { width: 100, height: 100, borderRadius: 24, marginBottom: spacing.lg },
  heroTitle: { ...typography.h1, color: colors.textPrimary, fontSize: 28 },
  heroSub: { ...typography.body, color: colors.textTertiary, marginTop: 4 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  featureCard: { width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2 - 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: spacing.sm },
  featureTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  featureDesc: { ...typography.caption, color: colors.textTertiary, lineHeight: 16 },
  stepTitle: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  stepSub: { ...typography.body, color: colors.textTertiary, textAlign: 'center', marginTop: -spacing.md, lineHeight: 22 },
  formGroup: { gap: spacing.sm },
  label: { ...typography.label, color: colors.textTertiary },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, gap: spacing.md },
  input: { ...typography.bodyLarge, color: colors.textPrimary, paddingVertical: spacing.lg, flex: 1 },
  hint: { ...typography.caption, color: colors.textTertiary, opacity: 0.7, textAlign: 'center' },
  bankRow: { flexDirection: 'row', gap: spacing.md },
  bankCard: {
    flex: 1, flexDirection: 'column', alignItems: 'center', padding: spacing.lg,
    borderRadius: borderRadius.lg, borderWidth: 1.5, gap: spacing.sm,
  },
  bankLogo: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  bankName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  bankCheck: { position: 'absolute', top: 8, right: 8 },
  pinArea: { alignItems: 'center', gap: spacing.lg, marginVertical: spacing.xl },
  pinIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  primaryBtnWrap: { borderRadius: borderRadius.xl, overflow: 'hidden', marginTop: spacing.lg },
  primaryBtn: { paddingVertical: spacing.xl, alignItems: 'center' },
  primaryBtnText: { ...typography.h3, color: '#FFF', fontWeight: '800' },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  skipText: { ...typography.body, color: colors.textTertiary },
});
