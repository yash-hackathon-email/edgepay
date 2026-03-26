// ─── QR Scan Screen ──────────────────────────────────────────────────
// Scans UPI QR codes and converts them to USSD commands

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  TextInput, Alert, Dimensions, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Camera, useCameraDevice, useCameraPermission, useCodeScanner,
} from 'react-native-vision-camera';
import { parseUPIQR, validateQRData, getReceiverFromQR } from '../utils/qrParser';
import { formatCurrency } from '../utils/formatters';
import { useStore } from '../store/useStore';
import { translations } from '../utils/i18n';
import { useTheme, spacing, borderRadius, typography, shadows } from '../theme';
import type { QRPaymentData } from '../types';

const SCANNER_SIZE = Dimensions.get('window').width * 0.7;

export const QRScanScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { language, networkMode } = useStore();
  const t = translations[language] || translations.en;
  
  const [manualInput, setManualInput] = useState('');
  const [scannedData, setScannedData] = useState<QRPaymentData | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Camera setup
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  useEffect(() => { if (!hasPermission) requestPermission(); }, [hasPermission]);

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback((codes) => {
      if (codes.length > 0 && codes[0].value && !scannedData) {
        const qrValue = codes[0].value;
        const parsed = parseUPIQR(qrValue);
        const validation = validateQRData(parsed);
        if (validation.valid && parsed) {
          setIsCameraActive(false);
          setScannedData(parsed);
        }
      }
    }, [scannedData]),
  });

  const handleManualScan = () => {
    if (!manualInput.trim()) return;
    const parsed = parseUPIQR(manualInput.trim());
    const validation = validateQRData(parsed);
    if (!validation.valid || !parsed) {
      Alert.alert('Invalid QR Data', validation.error || 'Could not parse');
      return;
    }
    setScannedData(parsed);
    setIsCameraActive(false);
  };

  const handleProceed = () => {
    if (!scannedData) return;
    const { receiver, name } = getReceiverFromQR(scannedData);
    const method = networkMode === 'ONLINE' ? 'WALLET' : 'USSD';
    navigation.navigate('SendMoney', { receiver, name, amount: scannedData.amount, method });
  };

  const handleReset = () => {
    setScannedData(null);
    setManualInput('');
    setIsCameraActive(true);
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t.scan}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.content}>
        {!scannedData ? (
          <>
            <View style={s.scannerWrap}>
              <View style={[s.scanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                {hasPermission && device && !showManual ? (
                  <>
                    <Camera style={StyleSheet.absoluteFill} device={device} isActive={isCameraActive} codeScanner={codeScanner} />
                    <View style={s.corners}>
                      <View style={[s.corner, s.tl]} /><View style={[s.corner, s.tr]} />
                      <View style={[s.corner, s.bl]} /><View style={[s.corner, s.br]} />
                    </View>
                    <Animated.View style={[s.scanLine, {
                      transform: [{ translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1], outputRange: [0, SCANNER_SIZE - 4],
                      })}],
                    }]} />
                  </>
                ) : (
                  <View style={s.scanCenter}>
                    <Icon name={!hasPermission ? 'camera-off' : (showManual ? 'keyboard' : 'camera-outline')} size={48} color={colors.textTertiary} />
                    <Text style={{ color: colors.textTertiary, textAlign: 'center' }}>
                      {!hasPermission ? 'Permission needed' : (showManual ? 'Manual Input' : 'Initializing...')}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity style={[s.manualToggle, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={() => setShowManual(!showManual)}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{showManual ? 'Open Camera' : 'Enter Manually'}</Text>
            </TouchableOpacity>

            {showManual && (
              <View style={s.manualSection}>
                <TextInput style={[s.manualInput, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.border }]} 
                  value={manualInput} onChangeText={setManualInput} placeholder="upi://pay?pa=..." placeholderTextColor={colors.textTertiary} multiline />
                <TouchableOpacity style={[s.parseBtn, !manualInput.trim() && { opacity: 0.5 }]} onPress={handleManualScan} disabled={!manualInput.trim()}>
                  <Text style={s.parseBtnText}>Parse Data</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={s.result}>
            <View style={[s.resultIcon, { backgroundColor: colors.success + '20' }]}>
              <Icon name="check-circle" size={48} color={colors.success} />
            </View>
            <Text style={[s.resultTitle, { color: colors.textPrimary }]}>{t.success}</Text>
            
            <View style={[s.resultCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder }]}>
              <Row label="Name" value={getReceiverFromQR(scannedData).name} colors={colors} />
              <Row label="Receiver" value={getReceiverFromQR(scannedData).receiver} colors={colors} />
              {scannedData.amount && <Row label="Amount" value={formatCurrency(scannedData.amount)} colors={colors} />}
            </View>


            <TouchableOpacity style={s.proceedBtn} onPress={handleProceed}>
              <Text style={s.proceedText}>Proceed to Pay</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[s.resetBtn, { borderColor: colors.border }]} onPress={handleReset}>
              <Text style={{ color: colors.textSecondary }}>Scan Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const Row = ({ label, value, colors }: any) => (
  <View style={s.row}>
    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h2 },
  content: { flex: 1, padding: spacing.xl },
  scannerWrap: { alignItems: 'center', marginVertical: spacing.xl },
  scanner: { width: SCANNER_SIZE, height: SCANNER_SIZE, borderRadius: 24, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  corners: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#0A84FF' },
  tl: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanLine: { position: 'absolute', left: 16, right: 16, height: 2, backgroundColor: '#0A84FF', opacity: 0.5, zIndex: 10 },
  scanCenter: { alignItems: 'center', gap: 12 },
  manualToggle: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1 },
  manualSection: { marginTop: 24, gap: 12 },
  manualInput: { borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 60, fontSize: 13, fontFamily: 'monospace' },
  parseBtn: { backgroundColor: '#0A84FF', borderRadius: 12, padding: 16, alignItems: 'center' },
  parseBtnText: { color: '#FFF', fontWeight: '800' },
  result: { flex: 1, alignItems: 'center', paddingTop: 20, gap: 20 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { ...typography.h1 },
  resultCard: { width: '100%', borderRadius: 20, padding: 20, borderWidth: 1, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  ussdBox: { width: '100%', borderRadius: 12, padding: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', gap: 4 },
  ussdText: { fontSize: 20, color: '#0A84FF', fontWeight: '800', fontFamily: 'monospace' },
  ussdSubText: { fontSize: 11, fontWeight: '600' },
  proceedBtn: { width: '100%', backgroundColor: '#0A84FF', borderRadius: 16, padding: 18, alignItems: 'center' },
  proceedText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  resetBtn: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 18, alignItems: 'center' },
});
