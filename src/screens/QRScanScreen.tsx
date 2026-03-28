// ─── QR Scan Screen ──────────────────────────────────────────────────
// Scans UPI QR codes via camera, gallery upload, or manual input
// and converts them to USSD commands

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  TextInput, Alert, Dimensions, Linking, Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Camera, useCameraDevice, useCameraPermission, useCodeScanner,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import RNQRGenerator from 'rn-qr-generator';
import LinearGradient from 'react-native-linear-gradient';
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
  const { language } = useStore();
  const t = translations[language] || translations.en;
  
  const [manualInput, setManualInput] = useState('');
  const [scannedData, setScannedData] = useState<QRPaymentData | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isProcessingGallery, setIsProcessingGallery] = useState(false);
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
        processQRValue(qrValue);
      }
    }, [scannedData]),
  });

  /** Central QR processing — used by camera, gallery, and manual input */
  const processQRValue = (qrValue: string) => {
    const parsed = parseUPIQR(qrValue);
    const validation = validateQRData(parsed);
    if (validation.valid && parsed) {
      setIsCameraActive(false);
      setScannedData(parsed);
    } else {
      Alert.alert('Invalid QR', validation.error || 'Could not parse UPI data from image');
    }
  };

  /** Pick an image from gallery and decode QR from it */
  const handleGalleryUpload = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 1,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return; // User cancelled
      }

      const imageUri = result.assets[0].uri;
      if (!imageUri) {
        Alert.alert('Error', 'Could not read the selected image');
        return;
      }

      setIsProcessingGallery(true);
      setIsCameraActive(false);

      // Decode QR from the selected image
      const qrResult = await RNQRGenerator.detect({ uri: imageUri });

      if (qrResult.values && qrResult.values.length > 0) {
        const qrValue = qrResult.values[0];
        console.log('[QRScan] Gallery QR decoded:', qrValue);
        processQRValue(qrValue);
      } else {
        Alert.alert(
          'No QR Found',
          'Could not detect a QR code in the selected image. Please try another image.',
        );
        setIsCameraActive(true);
      }
    } catch (error: any) {
      console.warn('[QRScan] Gallery QR decode error:', error);
      Alert.alert('Error', 'Failed to process the image. Please try again.');
      setIsCameraActive(true);
    } finally {
      setIsProcessingGallery(false);
    }
  };

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
    // Navigate to UPI Payment screen with pre-filled data from QR
    navigation.navigate('UpiPayment', {
      upiId: scannedData.upiId, // Original UPI ID from QR
      name: scannedData.name || name,
      amount: scannedData.amount,
      note: scannedData.note || '',
    });
  };

  const handleReset = () => {
    setScannedData(null);
    setManualInput('');
    setIsCameraActive(true);
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Background Decorative Glow */}
      <View style={s.bgGlowWrap}>
        <LinearGradient colors={['rgba(10, 132, 255, 0.12)', 'transparent']} style={s.bgGlow} />
      </View>

      <View style={[s.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
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
              <View style={[s.scanner, { backgroundColor: colors.surface, borderColor: 'rgba(255,255,255,0.1)' }]}>
                {isProcessingGallery ? (
                  <View style={s.scanCenter}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 12, fontWeight: '600' }}>
                      Reading QR from image...
                    </Text>
                  </View>
                ) : hasPermission && device && !showManual ? (
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
                    <Text style={{ color: colors.textTertiary, textAlign: 'center', fontWeight: '600' }}>
                      {!hasPermission ? 'Permission needed' : (showManual ? 'Manual Input' : 'Initializing...')}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Premium Action buttons row */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={handleGalleryUpload}
                disabled={isProcessingGallery}
              >
                <View style={[s.iconCircle, { backgroundColor: '#0A84FF20' }]}>
                  <Icon name="image-outline" size={20} color="#0A84FF" />
                </View>
                <Text style={[s.actionBtnText, { color: colors.textSecondary }]}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={() => setShowManual(!showManual)}
              >
                <View style={[s.iconCircle, { backgroundColor: '#5856D620' }]}>
                  <Icon name={showManual ? 'camera' : 'keyboard-outline'} size={20} color="#5856D6" />
                </View>
                <Text style={[s.actionBtnText, { color: colors.textSecondary }]}>{showManual ? 'Camera' : 'Manual'}</Text>
              </TouchableOpacity>
            </View>

            {showManual && (
              <View style={s.manualSection}>
                <TextInput style={[s.manualInput, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.border }]} 
                  value={manualInput} onChangeText={setManualInput} placeholder="upi://pay?pa=..." placeholderTextColor={colors.textTertiary} multiline />
                <TouchableOpacity style={[s.parseBtn, !manualInput.trim() && { opacity: 0.5 }]} onPress={handleManualScan} disabled={!manualInput.trim()}>
                  <Text style={s.parseBtnText}>Parse QR Data</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={s.result}>
            <View style={[s.resultIcon, { backgroundColor: colors.success + '20' }]}>
              <Icon name="check-circle" size={48} color={colors.success} />
            </View>
            <Text style={[s.resultTitle, { color: colors.textPrimary }]}>{t.success.toUpperCase()}</Text>
            
            <View style={[s.resultCard, { backgroundColor: colors.surfaceElevated, borderColor: 'rgba(255,255,255,0.08)' }]}>
              <Row label="PAYEE NAME" value={getReceiverFromQR(scannedData).name} colors={colors} />
              <Row label="UPI ID" value={getReceiverFromQR(scannedData).receiver} colors={colors} />
              {scannedData.amount && <Row label="AMOUNT" value={formatCurrency(scannedData.amount)} colors={colors} />}
            </View>

            <TouchableOpacity style={s.proceedBtnWrap} onPress={handleProceed}>
              <LinearGradient colors={['#0A84FF', '#007AFF']} style={s.proceedBtn}>
                <Text style={s.proceedText}>Proceed to Pay</Text>
                <Icon name="chevron-right" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={[s.resetBtn, { borderColor: colors.border }]} onPress={handleReset}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Scan Another QR</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  bgGlow: { position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, fontWeight: '900', letterSpacing: 0.5 },
  content: { flex: 1, padding: spacing.xl },
  scannerWrap: { alignItems: 'center', marginVertical: spacing.xl },
  scanner: { width: SCANNER_SIZE, height: SCANNER_SIZE, borderRadius: 32, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  corners: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#0A84FF' },
  tl: { top: 20, left: 20, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 20, right: 20, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 20, left: 20, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 20, right: 20, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanLine: { position: 'absolute', left: 24, right: 24, height: 2, backgroundColor: '#0A84FF', opacity: 0.6, zIndex: 10 },
  scanCenter: { alignItems: 'center', gap: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 1, elevation: 4,
  },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontWeight: '800', fontSize: 14 },
  manualSection: { marginTop: 24, gap: 12 },
  manualInput: { borderRadius: 16, borderWidth: 1, padding: 16, minHeight: 70, fontSize: 13, fontFamily: 'monospace' },
  parseBtn: { backgroundColor: '#0A84FF', borderRadius: 16, padding: 18, alignItems: 'center', elevation: 4 },
  parseBtnText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  result: { flex: 1, alignItems: 'center', paddingTop: 10, gap: 24 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  resultCard: { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proceedBtnWrap: { width: '100%', borderRadius: 18, overflow: 'hidden', elevation: 8 },
  proceedBtn: { flexDirection: 'row', padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  proceedText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  resetBtn: { width: '100%', borderWidth: 1, borderRadius: 18, padding: 18, alignItems: 'center' },
});
