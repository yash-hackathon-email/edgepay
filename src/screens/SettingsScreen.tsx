// ─── Settings Screen ────────────────────────────────────────────────
// Themed and Localized Settings for EdgePay

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { hashPin, verifyPin } from '../engine/BiometricService';
import { PinScreen } from '../components/PinScreen';
import { translations } from '../utils/i18n';
import { useTheme, spacing, borderRadius, typography } from '../theme';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const language = useStore(state => state.language);
  const t = translations[language] || translations.en;
  
  const { user, settings, setUser, setSettings } = useStore();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const phoneRef = useRef<any>(null);
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [pendingPin, setPendingPin] = useState('');

  const handleSave = () => {
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Error', 'Valid name and 10-digit phone are required.');
      return;
    }
    setUser({ name: name.trim(), phone: phone.trim() });
    Alert.alert('Success', 'Profile updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  const handleReset = () => {
    Alert.alert('Reset App', 'Are you sure you want to clear all data and start over?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset Everything', style: 'destructive', onPress: () => {
        setUser({ name: '', phone: '', balance: 0, isOnboarded: false });
        setSettings({ pinHash: '', isBiometricEnabled: true });
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      }}
    ]);
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t.account}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[s.saveText, { color: colors.primary }]}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>PROFILE</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={s.row}>
            <Text style={[s.label, { color: colors.textSecondary }]}>Full Name</Text>
            <TextInput style={[s.input, { color: colors.textPrimary }]} value={name} onChangeText={setName} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} blurOnSubmit={false} />
          </View>
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <View style={s.row}>
            <Text style={[s.label, { color: colors.textSecondary }]}>Phone Number</Text>
            <TextInput ref={phoneRef} style={[s.input, { color: colors.textPrimary }]} value={phone} keyboardType="phone-pad" onChangeText={setPhone} maxLength={10} returnKeyType="done" />
          </View>
        </View>

        <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>SECURITY</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={s.switchRow}>
            <View>
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Biometric Login</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Secure app access with fingerprint</Text>
            </View>
            <Switch 
              value={settings.isBiometricEnabled} 
              onValueChange={(val) => setSettings({ isBiometricEnabled: val })} 
              trackColor={{ false: colors.border, true: colors.primary + '50' }}
              thumbColor={settings.isBiometricEnabled ? colors.primary : colors.textTertiary}
            />
          </View>
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity 
            style={s.actionRow} 
            onPress={() => settings.pinHash ? setShowOldPin(true) : setShowNewPin(true)}
          >
            <View>
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Payment PIN</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{settings.pinHash ? 'PIN protected' : 'No PIN set'}</Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
              {settings.pinHash ? 'CHANGE' : 'SET NOW'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.dangerCard, { backgroundColor: colors.error + '10', borderColor: colors.error + '20' }]} onPress={handleReset}>
          <Icon name="alert-circle-outline" size={20} color={colors.error} />
          <Text style={{ color: colors.error, fontWeight: '700' }}>Reset All App Data</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Version 2.7.0 • Secure USSD Channel</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 4 }}>EdgePay | Offline UPI Payments</Text>
        </View>
      </ScrollView>

      <PinScreen visible={showOldPin} mode="verify" title="Verify Current PIN" onComplete={(pin) => {
        setShowOldPin(false);
        if (verifyPin(pin, settings.pinHash)) setTimeout(() => setShowNewPin(true), 300);
        else Alert.alert('Wrong PIN', 'Incorrect current PIN.');
      }} onCancel={() => setShowOldPin(false)} />
      
      <PinScreen visible={showNewPin} mode="set" title="Set New PIN" onComplete={(pin) => {
        setShowNewPin(false);
        setPendingPin(pin);
        setTimeout(() => setShowConfirmPin(true), 300);
      }} onCancel={() => setShowNewPin(false)} />
      
      <PinScreen visible={showConfirmPin} mode="confirm" title="Confirm PIN" onComplete={(pin) => {
        setShowConfirmPin(false);
        if (pin === pendingPin) { setSettings({ pinHash: hashPin(pin) }); Alert.alert('Done!', 'PIN updated successfully.'); }
        else Alert.alert('Mismatch', 'PINs did not match.');
      }} onCancel={() => setShowConfirmPin(false)} />
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },
  saveText: { fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 11, fontWeight: '800', marginTop: 24, marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '500' },
  input: { fontSize: 14, fontWeight: '600', minWidth: 150, textAlign: 'right', paddingVertical: 4 },
  divider: { height: 1, marginHorizontal: -16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dangerCard: { marginTop: 40, padding: 20, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  footer: { marginTop: 40, alignItems: 'center', opacity: 0.6 },
});
