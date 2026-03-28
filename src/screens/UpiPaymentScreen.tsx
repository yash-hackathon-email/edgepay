// ─── UPI Offline Payment Screen ─────────────────────────────────────
// Shows UPI-branded UI but uses SMS/USSD banking under the hood
// Accepts UPI ID (e.g. 7988316241@upi), extracts phone number, uses existing USSD logic

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Animated, KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { 
  createTransaction, executeUssdTransaction 
} from '../engine/TransactionEngine';
import { formatCurrency } from '../utils/formatters';
import { translations } from '../utils/i18n';
import { useTheme, spacing, typography } from '../theme';
import { PinScreen } from '../components/PinScreen';
import { authenticate, isBiometricAvailable } from '../engine/BiometricService';
import type { TransactionStatus } from '../types';

/**
 * Extract phone number from UPI ID
 */
function extractPhoneFromUpiId(upiId: string): string | null {
  const trimmed = upiId.trim().toLowerCase();
  
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    const prefix = parts[0].replace(/[^0-9]/g, '');
    if (prefix.length === 10) return prefix;
    if (prefix.length === 12 && prefix.startsWith('91')) return prefix.substring(2);
  }
  
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.substring(2);
  
  return null;
}

/**
 * Validate UPI ID format
 */
function validateUpiId(upiId: string): { valid: boolean; error?: string } {
  const trimmed = upiId.trim();
  if (!trimmed) return { valid: false };
  if (!trimmed.includes('@')) return { valid: false, error: 'UPI ID must contain @' };
  
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false, error: 'Invalid format' };
  
  const phone = extractPhoneFromUpiId(trimmed);
  if (!phone) return { valid: false, error: 'Needs 10-digit mobile number' };
  
  return { valid: true };
}

/**
 * Map internal USSD status messages to UPI-branded messages
 */
function mapToUpiMessage(status: TransactionStatus, message: string): string {
  const low = message.toLowerCase();
  if (low.includes('dialing')) return 'Connecting to UPI USSD Gateway...';
  if (low.includes('dialer')) return 'Initializing UPI Offline Channel...';
  if (low.includes('awaiting sms') || low.includes('waiting for bank')) return 'Awaiting Bank Confirmation...';
  if (low.includes('completed')) return 'UPI Payment Processed!';
  if (low.includes('failed')) return 'UPI Transaction Failed.';
  return message;
}

export const UpiPaymentScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation, route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { user, networkMode, language, addTransaction, updateTransaction, setUser } = useStore();
  const t = translations[language] || translations.en;

  const [upiId, setUpiId] = useState(route?.params?.upiId || '');
  const [payeeName, setPayeeName] = useState(route?.params?.name || '');
  const [amount, setAmount] = useState(route?.params?.amount ? String(route.params.amount) : '');
  
  const [isSending, setIsSending] = useState(false);
  const [txnStatus, setTxnStatus] = useState<TransactionStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);

  const executionLocked = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const numericAmount = parseInt(amount, 10) || 0;
  const upiValidation = validateUpiId(upiId);
  const isInputValid = upiValidation.valid && numericAmount > 0;

  const handlePay = () => {
    if (!isInputValid || isSending) return;
    setShowConfirmModal(true);
  };

  const startPaymentFlow = async () => {
    setShowConfirmModal(false);
    
    // Biometric Verification before Payment
    const biometricAvailable = await isBiometricAvailable();
    if (biometricAvailable) {
      const success = await authenticate(`Pay ₹${amount} to ${upiId}`);
      if (!success) return; // User cancelled or failed
    }
    
    setShowPinEntry(true);
  };

  const onPinVerified = (pin: string) => {
    setShowPinEntry(false);
    executeUpiPayment();
  };

  const executeUpiPayment = async () => {
    if (executionLocked.current) return;
    setIsSending(true);
    executionLocked.current = true;
    setTxnStatus('PENDING');
    setStatusMessage('Initiating UPI Offline Payment...');

    const phoneNumber = extractPhoneFromUpiId(upiId);
    if (!phoneNumber) {
      setTxnStatus('FAILED');
      setStatusMessage('Invalid mobile number in UPI ID');
      setIsSending(false);
      executionLocked.current = false;
      return;
    }

    const txn = createTransaction(numericAmount, phoneNumber, payeeName || undefined, networkMode, 'USSD');
    addTransaction({ ...txn, upiId: upiId });

    try {
      const result = await executeUssdTransaction(txn, (id, status, message) => {
        setTxnStatus(status);
        setStatusMessage(mapToUpiMessage(status, message || ''));
        updateTransaction(id, { status });
      });

      if (result.status === 'SUCCESS') setUser({ balance: user.balance - numericAmount });
    } catch (error: any) {
      setTxnStatus('FAILED');
      setStatusMessage('UPI transaction failed.');
    } finally {
      setIsSending(false);
      setTimeout(() => { executionLocked.current = false; }, 3000);
    }
  };

  const handleReset = () => {
    setUpiId('');
    setPayeeName('');
    setAmount('');
    setTxnStatus(null);
    setStatusMessage('');
    executionLocked.current = false;
  };

  // ─── Payment Result View ──────────────────────────────────────────
  if (txnStatus === 'SUCCESS' || txnStatus === 'FAILED') {
    return (
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={s.bgGlowWrap}>
          <LinearGradient colors={['rgba(10, 132, 255, 0.12)', 'transparent']} style={s.bgGlow} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={[s.resultIcon, { backgroundColor: (txnStatus === 'SUCCESS' ? colors.success : colors.error) + '20' }]}>
            <Icon name={txnStatus === 'SUCCESS' ? 'check-decagram' : 'alert-circle'} size={64} color={txnStatus === 'SUCCESS' ? colors.success : colors.error} />
          </View>
          <Text style={[s.resultTitle, { color: colors.textPrimary }]}>
            {txnStatus === 'SUCCESS' ? 'Payment Successful' : 'Payment Failed'}
          </Text>
          <Text style={[s.resultAmount, { color: colors.textPrimary }]}>{formatCurrency(numericAmount)}</Text>
          
          <View style={[s.summaryCard, { backgroundColor: colors.surfaceElevated, borderColor: 'rgba(255,255,255,0.08)' }]}>
            <Row label="TO" value={upiId} colors={colors} />
            {payeeName ? <Row label="NAME" value={payeeName} colors={colors} /> : null}
            <Row label="MODE" value="UPI Offline (USSD)" colors={colors} />
          </View>

          <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 12, fontSize: 13 }}>{statusMessage}</Text>

          <TouchableOpacity style={s.closeBtnWrap} onPress={handleReset}>
            <LinearGradient colors={['#0A84FF', '#007AFF']} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Main Payment Form ────────────────────────────────────────────
  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={s.bgGlowWrap}>
        <LinearGradient colors={['rgba(10, 132, 255, 0.12)', 'transparent']} style={s.bgGlow} />
      </View>

      <View style={[s.header, { paddingTop: Math.max(insets.top, 16), borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Pay via UPI</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
        <Animated.View style={[s.upiBadge, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={['#5856D6', '#AF52DE']} style={s.upiBadgeGrad} start={{x:0,y:0}} end={{x:1,y:1}}>
            <Icon name="cellphone-nfc" size={24} color="#FFF" />
            <View>
              <Text style={s.upiBadgeTitle}>UPI Offline Activated</Text>
              <Text style={s.upiBadgeSub}>Powered by *99# USSD Banking</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={[s.card, { backgroundColor: colors.surface, borderColor: 'rgba(255,255,255,0.08)' }]}>
          <Text style={[s.label, { color: colors.textTertiary }]}>RECIPIENT UPI ID</Text>
          <View style={[s.inputWrap, { borderBottomColor: colors.border }]}>
            <View style={[s.iconBox, { backgroundColor: '#5856D615' }]}>
              <Icon name="at" size={18} color="#5856D6" />
            </View>
            <TextInput
              style={[s.input, { color: colors.textPrimary }]}
              placeholder="e.g. 7988316241@upi"
              placeholderTextColor={colors.textTertiary}
              value={upiId}
              onChangeText={setUpiId}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => amountRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
          
          <View style={{ height: 24 }} />
          
          <Text style={[s.label, { color: colors.textTertiary }]}>AMOUNT (₹)</Text>
          <View style={[s.inputWrap, { borderBottomColor: colors.border }]}>
            <View style={[s.iconBox, { backgroundColor: '#FF375F15' }]}>
              <Icon name="currency-inr" size={18} color="#FF375F" />
            </View>
            <TextInput
              ref={amountRef}
              style={[s.input, { color: colors.textPrimary, fontSize: 32, fontWeight: '900' }]}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[s.payBtnWrap, (!isInputValid || isSending) && { opacity: 0.5 }]} 
          onPress={handlePay}
          disabled={!isInputValid || isSending}
        >
          <LinearGradient colors={['#5856D6', '#7B4DFF']} style={s.payBtn} start={{x:0,y:0}} end={{x:1,y:0}}>
            {isSending ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Text style={s.payText}>Pay Securely</Text>
                <Icon name="shield-check" size={20} color="#FFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={s.footerInfo}>
          <Icon name="shield-lock" size={14} color={colors.success} />
          <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center' }}>
            Offline payment works via secure USSD banking channel. No internet required.
          </Text>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface, borderColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Confirm Payment</Text>
            <View style={s.summaryCard}>
              <Row label="TO" value={upiId} colors={colors} />
              <Row label="AMOUNT" value={formatCurrency(numericAmount)} colors={colors} />
            </View>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#5856D620' }]} onPress={startPaymentFlow}>
                <Text style={{ color: '#5856D6', fontWeight: '800' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PinScreen
        visible={showPinEntry}
        mode="verify"
        title="UPI PIN"
        subtitle="Confirm your transaction"
        onComplete={onPinVerified}
        onCancel={() => setShowPinEntry(false)}
      />
    </View>
  );
};

const Row = ({ label, value, colors }: any) => (
  <View style={s.row}>
    <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{label}</Text>
    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1 },
  bgGlowWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlow: { position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, fontWeight: '900', letterSpacing: 0.5 },
  upiBadge: { marginBottom: 24 },
  upiBadgeGrad: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
  upiBadgeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  upiBadgeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  card: { padding: 24, borderRadius: 28, borderWidth: 1, elevation: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, paddingBottom: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 18, fontWeight: '700' },
  payBtnWrap: { marginTop: 32, borderRadius: 20, overflow: 'hidden', elevation: 12 },
  payBtn: { flexDirection: 'row', padding: 20, alignItems: 'center', justifyContent: 'center', gap: 10 },
  payText: { color: '#FFF', fontWeight: '900', fontSize: 18 },
  footerInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingHorizontal: 24 },
  resultIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '900', marginTop: 24, textAlign: 'center' },
  resultAmount: { fontSize: 48, fontWeight: '900', marginTop: 8 },
  summaryCard: { width: '100%', borderRadius: 24, padding: 20, borderWidth: 1, gap: 16, marginTop: 32 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeBtnWrap: { width: '100%', borderRadius: 18, overflow: 'hidden', marginTop: 40 },
  closeBtn: { padding: 20, alignItems: 'center' },
  closeBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 32, padding: 32, borderWidth: 1, gap: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
});
