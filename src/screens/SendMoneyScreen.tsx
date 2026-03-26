// ─── Send Money Screen ───────────────────────────────────────────────
// Supports both Real USSD Banking and Simulated Edge Wallet

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Animated, KeyboardAvoidingView, Platform, Modal, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput } from '../components/AmountInput';
import { useStore } from '../store/useStore';
import { 
  createTransaction, executeUssdTransaction, executeWalletTransaction 
} from '../engine/TransactionEngine';
import { validateUssdReceiver } from '../engine/USSDBuilder';
import { formatCurrency } from '../utils/formatters';
import { translations } from '../utils/i18n';
import { useTheme, spacing, borderRadius, typography, gradients } from '../theme';
import { PinScreen } from '../components/PinScreen';
import type { TransactionStatus, TransactionMethod } from '../types';

export const SendMoneyScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation, route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { user, networkMode, language, addTransaction, updateTransaction, setUser } = useStore();
  const t = translations[language] || translations.en;

  const [receiver, setReceiver] = useState(route?.params?.receiver || '');
  const [amount, setAmount] = useState(route?.params?.amount ? String(route.params.amount) : '');
  const [method, setMethod] = useState<TransactionMethod>(route?.params?.method || 'USSD');
  
  const [isSending, setIsSending] = useState(false);
  const [txnStatus, setTxnStatus] = useState<TransactionStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);

  const executionLocked = useRef(false);

  const numericAmount = parseInt(amount, 10) || 0;
  const receiverValidation = validateUssdReceiver(receiver);
  const isInputValid = receiverValidation.valid && numericAmount > 0;

  useEffect(() => {
    if (route?.params?.method) setMethod(route.params.method);
  }, [route?.params?.method]);

  const handleInitialPay = () => {
    if (!isInputValid || isSending) return;
    setShowConfirmModal(true);
  };

  const startPaymentFlow = () => {
    setShowConfirmModal(false);
    setShowPinEntry(true);
  };

  const onPinVerified = (pin: string) => {
    setShowPinEntry(false);
    if (method === 'WALLET') {
      executeSimulatedWalletPayment();
    } else {
      executeRealUssdPayment();
    }
  };

  const executeRealUssdPayment = async () => {
    if (executionLocked.current) return;
    setIsSending(true);
    executionLocked.current = true;
    setTxnStatus('PENDING');
    setStatusMessage(t.wait_sms);

    const txn = createTransaction(numericAmount, receiver, undefined, networkMode, 'USSD');
    addTransaction(txn);

    try {
      const result = await executeUssdTransaction(txn, (id, status, message) => {
        setTxnStatus(status);
        setStatusMessage(message || '');
        updateTransaction(id, { status });
      });

      if (result.status === 'SUCCESS') setUser({ balance: user.balance - numericAmount });
    } catch (error: any) {
      setTxnStatus('FAILED');
      setStatusMessage(t.failed);
    } finally {
      setIsSending(false);
      setTimeout(() => { executionLocked.current = false; }, 3000);
    }
  };

  const executeSimulatedWalletPayment = async () => {
    if (executionLocked.current) return;
    setIsSending(true);
    executionLocked.current = true;
    setTxnStatus('SENT');
    setStatusMessage('Connecting to Edge Wallet...');

    const txn = createTransaction(numericAmount, receiver, undefined, networkMode, 'WALLET');
    addTransaction(txn);

    try {
      const result = await executeWalletTransaction(txn, (id, status, message) => {
        setTxnStatus(status);
        setStatusMessage(message || '');
        updateTransaction(id, { status });
      });

      if (result.status === 'SUCCESS') setUser({ balance: user.balance - numericAmount });
    } catch (error: any) {
      setTxnStatus('FAILED');
      setStatusMessage('Wallet transfer failed');
    } finally {
      setIsSending(false);
      setTimeout(() => { executionLocked.current = false; }, 3000);
    }
  };

  const handleReset = () => {
    setReceiver('');
    setAmount('');
    setTxnStatus(null);
    setStatusMessage('');
    executionLocked.current = false;
  };

  if (txnStatus === 'SUCCESS' || txnStatus === 'FAILED') {
    return (
      <View style={[s.screen, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <View style={[s.resultIcon, { backgroundColor: txnStatus === 'SUCCESS' ? colors.success + '20' : colors.error + '20' }]}>
          <Icon name={txnStatus === 'SUCCESS' ? 'check-decagram' : 'alert-circle'} size={64} color={txnStatus === 'SUCCESS' ? colors.success : colors.error} />
        </View>
        <Text style={[s.resultTitle, { color: colors.textPrimary }]}>{txnStatus === 'SUCCESS' ? t.success : t.failed}</Text>
        <Text style={[s.resultAmount, { color: colors.textPrimary }]}>{formatCurrency(numericAmount)}</Text>
        <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 8 }}>{statusMessage}</Text>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: colors.surfaceElevated }]} onPress={handleReset}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{t.done}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.screen, { backgroundColor: colors.background }]} behavior="padding">
      <View style={[s.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t.send}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        {/* Method Switcher */}
        <View style={[s.methodSwitcher, { backgroundColor: colors.surfaceHighlight }]}>
          <TouchableOpacity 
            style={[s.methodBtn, method === 'USSD' && { backgroundColor: colors.surface }]} 
            onPress={() => setMethod('USSD')}
          >
            <Icon name="bank-outline" size={16} color={method === 'USSD' ? colors.primary : colors.textTertiary} />
            <Text style={[s.methodText, { color: method === 'USSD' ? colors.textPrimary : colors.textTertiary }]}>Real Bank</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[s.methodBtn, method === 'WALLET' && { backgroundColor: colors.surface }]} 
            onPress={() => setMethod('WALLET')}
          >
            <Icon name="wallet-outline" size={16} color={method === 'WALLET' ? colors.primary : colors.textTertiary} />
            <Text style={[s.methodText, { color: method === 'WALLET' ? colors.textPrimary : colors.textTertiary }]}>Edge Wallet</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[s.label, { color: colors.textTertiary }]}>{t.receiver}</Text>
          <View style={[s.inputWrap, { borderBottomColor: colors.borderLight }]}>
            <Icon name={receiverValidation.type === 'upi' ? 'at' : 'phone-outline'} size={20} color={colors.primary} />
            <TextInput style={[s.input, { color: colors.textPrimary }]} value={receiver} onChangeText={setReceiver} placeholder="Mobile or UPI ID" placeholderTextColor={colors.textTertiary} autoCapitalize="none" />
          </View>
          {receiverValidation.error && receiver.length > 3 && <Text style={s.error}>{receiverValidation.error}</Text>}

          <View style={{ height: 24 }} />
          <Text style={[s.label, { color: colors.textTertiary }]}>{t.amount}</Text>
          <AmountInput value={amount} onChangeText={setAmount} />
        </View>

        <TouchableOpacity 
          style={[s.payBtn, !isInputValid && { opacity: 0.5 }]} 
          onPress={handleInitialPay} 
          disabled={!isInputValid || isSending}
        >
          <LinearGradient colors={gradients.primary} style={s.payGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.payText}>{method === 'WALLET' ? 'Pay via Wallet' : t.pay}</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={s.secureNote}>
          <Icon name="shield-check" size={14} color={colors.success} />
          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
            {method === 'USSD' ? 'Secure Native USSD Mode' : 'Simulated Wallet (Offline Practice)'}
          </Text>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>{t.confirm}</Text>
            <View style={s.modalRow}><Text style={{ color: colors.textSecondary }}>To</Text><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{receiver}</Text></View>
            <View style={s.modalRow}><Text style={{ color: colors.textSecondary }}>Amount</Text><Text style={{ color: colors.primary, fontSize: 28, fontWeight: '900' }}>{formatCurrency(numericAmount)}</Text></View>
            <View style={s.modalRow}><Text style={{ color: colors.textSecondary }}>Mode</Text><Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{method === 'WALLET' ? 'Edge Wallet (Simulated)' : 'Direct Bank'}</Text></View>
            
            <Text style={s.modalNote}>
              {method === 'WALLET' ? 'This is a practice/simulation mode.' : 'This will initialize a secure USSD channel.'}
            </Text>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.modalBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.primary + '10' }]} onPress={startPaymentFlow}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>PROCEED</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PinScreen 
        visible={showPinEntry} 
        mode="verify" 
        title={method === 'WALLET' ? "Wallet PIN" : "UPI PIN"}
        subtitle="Please enter your 4-digit PIN to confirm"
        onComplete={onPinVerified} 
        onCancel={() => setShowPinEntry(false)} 
      />
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },
  methodSwitcher: { flexDirection: 'row', marginBottom: 24, borderRadius: 12, padding: 4, gap: 4 },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 8 },
  methodText: { fontSize: 13, fontWeight: '700' },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, elevation: 4 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 8, gap: 12 },
  input: { flex: 1, fontSize: 18, fontWeight: '700' },
  error: { color: '#FF3B30', fontSize: 11, marginTop: 4 },
  payBtn: { marginTop: 40, borderRadius: 16, overflow: 'hidden', elevation: 6 },
  payGrad: { paddingVertical: 18, alignItems: 'center' },
  payText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 24, padding: 24, borderWidth: 1, gap: 16 },
  modalTitle: { ...typography.h3, textAlign: 'center', marginBottom: 8 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalNote: { fontSize: 11, color: '#8E8E93', textAlign: 'center', marginTop: 12 },
  modalFooter: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.1)', marginHorizontal: -24, marginBottom: -24 },
  modalBtn: { flex: 1, padding: 20, alignItems: 'center' },
  resultIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  resultTitle: { ...typography.h1, marginBottom: 8 },
  resultAmount: { fontSize: 44, fontWeight: '900' },
  doneBtn: { marginTop: 40, width: '100%', padding: 20, borderRadius: 16, alignItems: 'center' },
});
