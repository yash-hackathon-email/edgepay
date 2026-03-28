// ─── Settings Screen ────────────────────────────────────────────────
// Themed and Localized Settings for EdgePay

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, Switch, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { hashPin, verifyPin } from '../engine/BiometricService';
import { testSoundboxAnnouncement, updateSoundboxConfig } from '../engine/PaymentSoundbox';
import {
  isWidgetAvailable, startPaymentWidget, stopPaymentWidget,
  isWidgetRunning, hasOverlayPermission, requestOverlayPermission,
} from '../engine/WidgetService';
import { PinScreen } from '../components/PinScreen';
import { translations } from '../utils/i18n';
import { LanguageModal } from '../components/LanguageModal';
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
  const [isTesting, setIsTesting] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Widget state
  const [widgetRunning, setWidgetRunning] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState(false);

  useEffect(() => {
    if (isWidgetAvailable()) {
      isWidgetRunning().then(setWidgetRunning);
      hasOverlayPermission().then(setOverlayGranted);
    }
  }, []);

  const handleWidgetToggle = async (val: boolean) => {
    setSettings({ isWidgetEnabled: val });
    if (val) {
      const ok = await startPaymentWidget({
        language: settings.soundboxLanguage || 'en',
        announceCredits: true,
        announceDebits: false,
      });
      setWidgetRunning(ok);
    } else {
      await stopPaymentWidget();
      setWidgetRunning(false);
    }
  };

  const handleOverlayPermission = async () => {
    await requestOverlayPermission();
    // Re-check after user returns (settings app opens)
    setTimeout(async () => {
      const granted = await hasOverlayPermission();
      setOverlayGranted(granted);
    }, 2000);
  };

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

  const handleSoundboxToggle = (val: boolean) => {
    setSettings({ isSoundboxEnabled: val });
    updateSoundboxConfig({ enabled: val });
  };

  const handleTestAnnouncement = async () => {
    if (isTesting) return;
    setIsTesting(true);
    // Pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.93, duration: 100, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    try {
      await testSoundboxAnnouncement(settings.soundboxLanguage || 'en', 500);
    } catch (e) {
      console.warn('[Settings] Test announcement failed:', e);
    }
    setTimeout(() => setIsTesting(false), 3000);
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

        {/* ─── Soundbox Section ─────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>{t.soundboxSection}</Text>
        <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {/* Soundbox Icon Header */}
          <View style={s.soundboxHeader}>
            <View style={[s.soundboxIconWrap, { backgroundColor: settings.isSoundboxEnabled ? colors.success + '18' : colors.surfaceHighlight }]}>
              <Icon 
                name={settings.isSoundboxEnabled ? 'volume-high' : 'volume-off'} 
                size={22} 
                color={settings.isSoundboxEnabled ? colors.success : colors.textTertiary} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{t.soundbox}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>{t.soundboxDesc}</Text>
            </View>
            <Switch 
              value={settings.isSoundboxEnabled ?? true}
              onValueChange={handleSoundboxToggle}
              trackColor={{ false: colors.border, true: colors.success + '50' }}
              thumbColor={settings.isSoundboxEnabled ? colors.success : colors.textTertiary}
            />
          </View>

          {settings.isSoundboxEnabled && (
            <>
              <View style={[s.divider, { backgroundColor: colors.border }]} />
              {/* Language Toggle */}
              <TouchableOpacity style={s.actionRow} onPress={() => setLangModalVisible(true)} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name="translate" size={18} color={colors.primary} />
                  <View>
                    <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{t.soundboxLang}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{t.soundboxLangDesc}</Text>
                  </View>
                </View>
                <View style={[s.langBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>
                    {(settings.soundboxLanguage || 'en').toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={[s.divider, { backgroundColor: colors.border }]} />
              {/* Test Button */}
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity 
                  style={[s.testBtn, { opacity: isTesting ? 0.6 : 1 }]} 
                  onPress={handleTestAnnouncement}
                  activeOpacity={0.7}
                  disabled={isTesting}
                >
                  <LinearGradient
                    colors={isTesting ? [colors.surfaceHighlight, colors.surfaceHighlight] : ['#0A84FF', '#0066CC']}
                    style={s.testBtnGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    <Icon name={isTesting ? 'loading' : 'play-circle-outline'} size={18} color="#FFF" />
                    <Text style={s.testBtnText}>
                      {isTesting ? '...' : t.soundboxTest}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </View>

        {/* ─── Background Widget Section ──────────────────────────── */}
        {isWidgetAvailable() && (
          <>
            <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>BACKGROUND WIDGET</Text>
            <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {/* Widget Header */}
              <View style={s.soundboxHeader}>
                <View style={[s.soundboxIconWrap, { backgroundColor: (settings.isWidgetEnabled ?? true) ? '#0A84FF18' : colors.surfaceHighlight }]}>
                  <Icon
                    name={(settings.isWidgetEnabled ?? true) ? 'widgets' : 'widgets-outline'}
                    size={22}
                    color={(settings.isWidgetEnabled ?? true) ? '#0A84FF' : colors.textTertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>Payment Monitor</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>Runs in background • Shows overlay</Text>
                </View>
                <Switch
                  value={settings.isWidgetEnabled ?? true}
                  onValueChange={handleWidgetToggle}
                  trackColor={{ false: colors.border, true: '#0A84FF50' }}
                  thumbColor={(settings.isWidgetEnabled ?? true) ? '#0A84FF' : colors.textTertiary}
                />
              </View>

              {(settings.isWidgetEnabled ?? true) && (
                <>
                  <View style={[s.divider, { backgroundColor: colors.border }]} />

                  {/* Status indicator */}
                  <View style={[s.actionRow, { paddingVertical: 4 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.statusDot, { backgroundColor: widgetRunning ? '#30D158' : colors.textTertiary }]} />
                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                        {widgetRunning ? 'Service Active' : 'Service Stopped'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                      {widgetRunning ? 'Monitoring payments' : 'Tap toggle to start'}
                    </Text>
                  </View>

                  <View style={[s.divider, { backgroundColor: colors.border }]} />

                  {/* Overlay permission */}
                  <TouchableOpacity style={s.actionRow} onPress={handleOverlayPermission} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Icon name="cellphone-screenshot" size={18} color={overlayGranted ? '#30D158' : '#FF9F0A'} />
                      <View>
                        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Overlay Permission</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Show widget on top of other apps</Text>
                      </View>
                    </View>
                    <View style={[s.langBadge, { backgroundColor: overlayGranted ? '#30D15815' : '#FF9F0A15' }]}>
                      <Text style={{ color: overlayGranted ? '#30D158' : '#FF9F0A', fontWeight: '800', fontSize: 11 }}>
                        {overlayGranted ? 'GRANTED' : 'GRANT'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={[s.divider, { backgroundColor: colors.border }]} />

                  {/* Info text */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 4 }}>
                    <Icon name="information-outline" size={16} color={colors.textTertiary} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.textTertiary, fontSize: 11, flex: 1, lineHeight: 16 }}>
                      Keeps EdgePay running in background to detect incoming payments, show a floating widget with transaction details, and announce payments via voice.
                    </Text>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        <TouchableOpacity style={[s.dangerCard, { backgroundColor: colors.error + '10', borderColor: colors.error + '20' }]} onPress={handleReset}>
          <Icon name="alert-circle-outline" size={20} color={colors.error} />
          <Text style={{ color: colors.error, fontWeight: '700' }}>Reset All App Data</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Version 2.9.0 • Background Widget</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 4 }}>EdgePay | Offline UPI Payments</Text>
        </View>
      </ScrollView>

      <LanguageModal
        visible={langModalVisible}
        currentLanguage={settings.soundboxLanguage || 'en'}
        onSelect={(code) => {
          setSettings({ soundboxLanguage: code as any });
          updateSoundboxConfig({ language: code });
        }}
        onClose={() => setLangModalVisible(false)}
        title="Soundbox Language"
      />

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
  // Soundbox styles
  soundboxHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  soundboxIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  langBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  testBtn: { marginTop: 4 },
  testBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  testBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
