// ─── Account Services Screen ─────────────────────────────────────────
// Provides USSD-based account services: Check Balance, UPI PIN Change, Request Payment

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { dialUssdCode, sendUssdRequest } from '../engine/USSDService';
import { sanitizeReceiver, validateUssdReceiver } from '../engine/USSDBuilder';
import { translations } from '../utils/i18n';
import { useTheme, spacing, typography } from '../theme';

export const AccountServicesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { language } = useStore();
  const t = translations[language] || translations.en;

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMobile, setRequestMobile] = useState('');
  const [requestAmount, setRequestAmount] = useState('');

  const amountRef = useRef<any>(null);

  // Auto-advance: when mobile reaches 10 digits, focus amount
  const handleMobileChange = useCallback((text: string) => {
    setRequestMobile(text);
    if (text.replace(/\D/g, '').length >= 10) {
      amountRef.current?.focus();
    }
  }, []);

  const executeUssd = async (code: string, label: string) => {
    setIsProcessing(true);
    setProcessingMessage(`${label}...`);
    try {
      try {
        await sendUssdRequest(code);
      } catch {
        await dialUssdCode(code);
      }
    } catch (error) {
      console.warn('[AccountServices] USSD failed:', error);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingMessage('');
      }, 2000);
    }
  };

  const numericAmount = parseInt(requestAmount, 10) || 0;
  const isRequestValid = validateUssdReceiver(requestMobile).valid && numericAmount > 0;

  const SERVICES = [
    {
      id: 'balance',
      icon: 'bank-check',
      title: 'Check Balance',
      subtitle: 'View your bank balance via USSD',
      color: '#30D158',
      onPress: () => executeUssd('*99*3#', 'Checking Balance'),
    },
    {
      id: 'pin',
      icon: 'lock-reset',
      title: 'Change UPI PIN',
      subtitle: 'Securely reset your UPI PIN',
      color: '#FF9F0A',
      onPress: () => executeUssd('*99*7#', 'Initiating PIN Change'),
    },
    {
      id: 'request',
      icon: 'cash-fast',
      title: 'Request Payment',
      subtitle: 'Request money from any mobile',
      color: '#BF5AF2',
      onPress: () => setShowRequestModal(true),
    },
  ];

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Background Decorative Glow */}
      <View style={s.bgGlowWrap}>
        <LinearGradient colors={['rgba(10, 132, 255, 0.12)', 'transparent']} style={s.bgGlow} />
      </View>

      <View style={[s.header, { paddingTop: Math.max(insets.top, 16), borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Account Services</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={[s.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
          <Icon name="shield-check-outline" size={20} color={colors.primary} />
          <Text style={[s.infoText, { color: colors.textSecondary }]}>
            Secure USSD services provided by your bank. No credentials are stored on this device.
          </Text>
        </View>

        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={[s.serviceCard, { backgroundColor: colors.surface, borderColor: 'rgba(255,255,255,0.08)' }]}
            onPress={service.onPress}
          >
            <View style={[s.serviceIconWrap, { backgroundColor: service.color + '15' }]}>
              <Icon name={service.icon} size={32} color={service.color} />
            </View>
            <View style={s.serviceInfo}>
              <Text style={[s.serviceTitle, { color: colors.textPrimary }]}>{service.title}</Text>
              <Text style={[s.serviceSubtitle, { color: colors.textTertiary }]}>{service.subtitle}</Text>
            </View>
            <Icon name="chevron-right" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Processing Modal */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.processingCard, { backgroundColor: colors.surfaceElevated, borderColor: 'rgba(255,255,255,0.08)' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[s.processingText, { color: colors.textPrimary }]}>{processingMessage}</Text>
            <Text style={[s.processingSub, { color: colors.textTertiary }]}>Follow the USSD prompts on your screen</Text>
          </View>
        </View>
      </Modal>

      {/* Request Modal */}
      <Modal visible={showRequestModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.requestCard, { backgroundColor: colors.surfaceElevated, borderColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[s.requestTitle, { color: colors.textPrimary }]}>Request Payment</Text>

            <View style={s.formGroup}>
              <Text style={[s.inputLabel, { color: colors.textTertiary }]}>MOBILE NUMBER</Text>
              <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
                <Icon name="phone" size={18} color={colors.primary} />
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  value={requestMobile}
                  onChangeText={handleMobileChange}
                  placeholder="10-digit number"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>
            </View>

            <View style={s.formGroup}>
              <Text style={[s.inputLabel, { color: colors.textTertiary }]}>AMOUNT (₹)</Text>
              <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
                <Icon name="currency-inr" size={18} color="#FF375F" />
                <TextInput
                  ref={amountRef}
                  style={[s.input, { color: colors.textPrimary, fontSize: 24, fontWeight: '800' }]}
                  value={requestAmount}
                  onChangeText={setRequestAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalBtn} onPress={() => { setShowRequestModal(false); setRequestMobile(''); setRequestAmount(''); }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.primary + '20' }]} onPress={() => {
                const cleanMobile = sanitizeReceiver(requestMobile);
                executeUssd(`*99*2*${cleanMobile}*${numericAmount}*1*1#`, 'Requesting Payment');
                setShowRequestModal(false);
              }} disabled={!isRequestValid}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  bgGlowWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlow: { position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, fontWeight: '900', letterSpacing: 0.5 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 20 },
  serviceCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 28, borderWidth: 1, gap: 16, elevation: 4 },
  serviceIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  serviceInfo: { flex: 1, gap: 4 },
  serviceTitle: { fontSize: 18, fontWeight: '900' },
  serviceSubtitle: { fontSize: 12, fontWeight: '600', opacity: 0.6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  processingCard: { borderRadius: 32, padding: 40, borderWidth: 1, alignItems: 'center', gap: 20 },
  processingText: { fontSize: 20, fontWeight: '900' },
  processingSub: { fontSize: 13, fontWeight: '600', opacity: 0.6, textAlign: 'center' },
  requestCard: { borderRadius: 32, padding: 32, borderWidth: 1, gap: 24 },
  requestTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  formGroup: { gap: 8 },
  inputLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, gap: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 14 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalBtn: { flex: 1, padding: 18, borderRadius: 16, alignItems: 'center' },
});
