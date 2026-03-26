// ─── Account Services Screen ─────────────────────────────────────────
// Provides USSD-based account services: Check Balance, UPI PIN Change, Request Payment

import React, { useState, useRef } from 'react';
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
import { formatCurrency } from '../utils/formatters';
import { translations } from '../utils/i18n';
import { useTheme, spacing, typography, gradients } from '../theme';

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

  const handleCheckBalance = () => {
    executeUssd('*99*3#', 'Checking Balance');
  };

  const handleUpiPinChange = () => {
    executeUssd('*99*7#', 'Initiating UPI PIN Change');
  };

  const handleRequestPayment = () => {
    const validation = validateUssdReceiver(requestMobile);
    if (!validation.valid) return;
    
    const cleanMobile = sanitizeReceiver(requestMobile);
    const amt = Math.floor(parseInt(requestAmount, 10) || 0);
    if (amt <= 0) return;

    const ussdCode = `*99*2*${cleanMobile}*${amt}*1*1#`;
    setShowRequestModal(false);
    setRequestMobile('');
    setRequestAmount('');
    executeUssd(ussdCode, 'Requesting Payment');
  };

  const numericAmount = parseInt(requestAmount, 10) || 0;
  const mobileValidation = validateUssdReceiver(requestMobile);
  const isRequestValid = mobileValidation.valid && numericAmount > 0;

  const SERVICES = [
    {
      id: 'balance',
      icon: 'bank-check',
      title: 'Check Balance',
      subtitle: 'View your linked bank account balance via USSD',
      color: '#30D158',
      onPress: handleCheckBalance,
    },
    {
      id: 'pin',
      icon: 'lock-reset',
      title: 'Change UPI PIN',
      subtitle: 'Reset or change your UPI PIN securely',
      color: '#FF9F0A',
      onPress: handleUpiPinChange,
    },
    {
      id: 'request',
      icon: 'cash-fast',
      title: 'Request Payment',
      subtitle: 'Request money from any mobile number',
      color: '#BF5AF2',
      onPress: () => setShowRequestModal(true),
    },
  ];

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Account Services</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Info Banner */}
        <View style={[s.infoBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
          <Icon name="information-outline" size={18} color={colors.primary} />
          <Text style={[s.infoText, { color: colors.textSecondary }]}>
            These services use secure USSD channels via your bank's *99# service.
          </Text>
        </View>

        {/* Service Cards */}
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={[s.serviceCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={service.onPress}
            activeOpacity={0.7}
          >
            <View style={[s.serviceIconWrap, { backgroundColor: service.color + '15' }]}>
              <Icon name={service.icon} size={28} color={service.color} />
            </View>
            <View style={s.serviceInfo}>
              <Text style={[s.serviceTitle, { color: colors.textPrimary }]}>{service.title}</Text>
              <Text style={[s.serviceSubtitle, { color: colors.textTertiary }]}>{service.subtitle}</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        {/* USSD Code Reference */}
        <View style={[s.codeRef, { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder }]}>
          <Text style={[s.codeRefTitle, { color: colors.textSecondary }]}>USSD Quick Reference</Text>
          <View style={s.codeRow}>
            <Text style={[s.codeLabel, { color: colors.textTertiary }]}>Balance Check</Text>
            <Text style={[s.codeValue, { color: colors.primary }]}>*99*3#</Text>
          </View>
          <View style={s.codeRow}>
            <Text style={[s.codeLabel, { color: colors.textTertiary }]}>UPI PIN Change</Text>
            <Text style={[s.codeValue, { color: colors.primary }]}>*99*7#</Text>
          </View>
          <View style={s.codeRow}>
            <Text style={[s.codeLabel, { color: colors.textTertiary }]}>Request Payment</Text>
            <Text style={[s.codeValue, { color: colors.primary }]}>*99*2*mob*amt*1*1#</Text>
          </View>
        </View>
      </ScrollView>

      {/* Processing Overlay */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={s.processingOverlay}>
          <View style={[s.processingCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[s.processingText, { color: colors.textPrimary }]}>{processingMessage}</Text>
            <Text style={[s.processingSubtext, { color: colors.textTertiary }]}>
              A USSD dialog will appear on your screen. Please follow the prompts.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Request Payment Modal */}
      <Modal visible={showRequestModal} transparent animationType="fade">
        <View style={s.processingOverlay}>
          <View style={[s.requestCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[s.requestTitle, { color: colors.textPrimary }]}>Request Payment</Text>
            <Text style={[s.requestSubtitle, { color: colors.textTertiary }]}>
              Enter the mobile number and amount to request
            </Text>

            <View style={{ gap: 16, marginTop: 20 }}>
              <View>
                <Text style={[s.inputLabel, { color: colors.textTertiary }]}>MOBILE NUMBER</Text>
                <View style={[s.inputWrap, { borderColor: colors.borderLight, backgroundColor: colors.surfaceHighlight }]}>
                  <Icon name="phone-outline" size={18} color={colors.primary} />
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    value={requestMobile}
                    onChangeText={setRequestMobile}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              <View>
                <Text style={[s.inputLabel, { color: colors.textTertiary }]}>AMOUNT (₹)</Text>
                <View style={[s.inputWrap, { borderColor: colors.borderLight, backgroundColor: colors.surfaceHighlight }]}>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>₹</Text>
                  <TextInput
                    style={[s.input, { color: colors.textPrimary }]}
                    value={requestAmount}
                    onChangeText={setRequestAmount}
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={s.requestFooter}>
              <TouchableOpacity
                style={s.requestCancelBtn}
                onPress={() => { setShowRequestModal(false); setRequestMobile(''); setRequestAmount(''); }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.requestSubmitBtn, !isRequestValid && { opacity: 0.4 }]}
                onPress={handleRequestPayment}
                disabled={!isRequestValid}
              >
                <LinearGradient colors={gradients.primary} style={s.requestSubmitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Request ₹{numericAmount > 0 ? numericAmount : '0'}</Text>
                </LinearGradient>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },

  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },

  serviceCard: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderRadius: 20, borderWidth: 1, gap: 14, elevation: 2,
  },
  serviceIconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  serviceInfo: { flex: 1, gap: 3 },
  serviceTitle: { fontSize: 16, fontWeight: '800' },
  serviceSubtitle: { fontSize: 12, fontWeight: '500' },

  codeRef: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 12, marginTop: 8 },
  codeRefTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeLabel: { fontSize: 13, fontWeight: '500' },
  codeValue: { fontSize: 14, fontWeight: '800', fontFamily: 'monospace' },

  processingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  processingCard: { borderRadius: 24, padding: 32, borderWidth: 1, alignItems: 'center', gap: 16, width: '100%' },
  processingText: { fontSize: 18, fontWeight: '800' },
  processingSubtext: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  requestCard: { borderRadius: 24, padding: 24, borderWidth: 1, width: '100%' },
  requestTitle: { ...typography.h2, textAlign: 'center' },
  requestSubtitle: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  inputLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, gap: 10 },
  input: { flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 },
  requestFooter: { flexDirection: 'row', marginTop: 24, gap: 12 },
  requestCancelBtn: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  requestSubmitBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  requestSubmitGrad: { padding: 16, alignItems: 'center' },
});
