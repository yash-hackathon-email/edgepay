// ─── EdgePay Main App ──────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  StatusBar, View, Text, StyleSheet, AppState, TouchableOpacity,
  Image, Animated, Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { DashboardScreen } from './screens/DashboardScreen';
import { SendMoneyScreen } from './screens/SendMoneyScreen';
import { QRScanScreen } from './screens/QRScanScreen';
import { TransactionHistoryScreen } from './screens/TransactionHistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';

import { useStore, initializeStore } from './store/useStore';
import { useNetworkMonitor } from './engine/NetworkDetector';
import { 
  startSmsListener, checkSmsPermissions, isSmsAvailable, 
  onSmsReceived, sendSMS 
} from './engine/SmsService';
import { checkUssdPermissions, isUssdAvailable } from './engine/USSDService';
import { parseSmsForBalance } from './engine/SmsParser';
import { translations } from './utils/i18n';
import { useTheme, spacing } from './theme';

const Tab = createBottomTabNavigator();

// ─── Splash Screen ───────────────────────────────────────────────────
const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentFade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => onFinish());
    }, 2200);
  }, []);

  return (
    <Animated.View style={[sSplash.container, { opacity: fadeAnim }]}>
      <Image source={require('../assets/splash1.jpg')} style={sSplash.bg} resizeMode="contain" />
      <View style={sSplash.overlay} />
      <Animated.View style={[sSplash.content, { opacity: contentFade }]}>
        <Image source={require('../assets/EdgePay_Icon.png')} style={sSplash.logo} resizeMode="contain" />
        <Text style={sSplash.title}>EdgePay</Text>
        <View style={sSplash.divider} />
        <Text style={sSplash.subtitle}>OFFLINE PAYMENTS</Text>
      </Animated.View>
    </Animated.View>
  );
};

const sSplash = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.4 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  content: { alignItems: 'center', zIndex: 1 },
  logo: { width: 100, height: 100, borderRadius: 20, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  divider: { width: 40, height: 3, backgroundColor: '#0A84FF', marginVertical: 8, borderRadius: 2 },
  subtitle: { fontSize: 12, fontWeight: '700', color: '#0A84FF', letterSpacing: 3 },
});

// ─── Custom Bottom Tab Bar ───────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const language = useStore(state => state.language);
  const t = translations[language] || translations.en;
  const insets = useSafeAreaInsets();

  if (!state?.routes) return null;

  const TAB_MAP: Record<string, { activeIcon: string; inactiveIcon: string; label: string }> = {
    Dashboard: { activeIcon: 'home-variant', inactiveIcon: 'home-variant-outline', label: t.home },
    SendMoney: { activeIcon: 'bank-transfer', inactiveIcon: 'bank-transfer', label: t.send },
    QRScan: { activeIcon: 'qrcode-scan', inactiveIcon: 'qrcode-scan', label: t.scan },
    History: { activeIcon: 'history', inactiveIcon: 'history', label: t.history },
    Account: { activeIcon: 'account-circle', inactiveIcon: 'account-circle-outline', label: t.account },
  };

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.surface }]}>
      <View style={[styles.tabBarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder }]}>
        {(state?.routes || []).map((route: any, index: number) => {
          const isFocused = state.index === index;
          const config = TAB_MAP[route.name];
          if (!config) return null;

          const isCenter = route.name === 'QRScan';
          const iconName = isFocused ? config.activeIcon : config.inactiveIcon;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          if (isCenter) {
            return (
              <TouchableOpacity key={route.key} onPress={onPress} style={styles.centerBtnWrap} activeOpacity={0.8}>
                <LinearGradient
                  colors={isFocused ? ['#0A84FF', '#0066CC'] : [colors.surfaceHighlight, colors.surface]}
                  style={styles.centerBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Icon name="qrcode-scan" size={28} color={isFocused ? '#FFF' : colors.textTertiary} />
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabItem} activeOpacity={0.7}>
              <Icon name={iconName} size={24} color={isFocused ? colors.primary : colors.textTertiary} />
              <Text style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.textTertiary }]}>{config.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── App UI Wrapper ──────────────────────────────────────────────────
function AppContent() {
  const { colors, theme } = useTheme();
  
  // Stable selectors to prevent re-render loops
  const isOnboarded = useStore(state => state.user.isOnboarded);
  const gateway = useStore(state => state.settings.gatewayNumber);
  const language = useStore(state => state.language);
  
  // Memoized actions
  const setUser = useStore(state => state.setUser);
  const setNetworkMode = useStore(state => state.setNetworkMode);
  const setSmsPermissions = useStore(state => state.setSmsPermissions);
  const setUssdPermissions = useStore(state => state.setUssdPermissions);
  const toggleTheme = useStore(state => state.toggleTheme);
  const setLanguage = useStore(state => state.setLanguage);
  
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => { 
    initializeStore().catch(console.error); 
  }, []);

  useNetworkMonitor(setNetworkMode);

  // Stable balance fetch to prevent loops
  const fetchBalance = useCallback(async () => {
    if (!isSmsAvailable() || !isOnboarded) return;
    try {
      const subscription = onSmsReceived((sms) => {
        const bal = parseSmsForBalance(sms.body);
        if (bal !== null) {
          setUser({ balance: bal });
          subscription.remove();
        }
      });
      await sendSMS(gateway || '56161', 'BAL');
      setTimeout(() => subscription.remove(), 10000);
    } catch (err) {
      console.warn('[BalanceFetch] Error:', err);
    }
  }, [isOnboarded, gateway, setUser]);

  useEffect(() => {
    if (!isOnboarded) return;
    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      if (isSmsAvailable()) {
        const smsPerms = await checkSmsPermissions();
        setSmsPermissions(smsPerms);
        if (smsPerms.receive) {
          await startSmsListener();
          // fetchBalance(); // Disabled as per user request
        }
      }
      if (isUssdAvailable()) {
        const ussdPerms = await checkUssdPermissions();
        setUssdPermissions(ussdPerms);
      }
    };
    init();

    return () => { mounted = false; };
  }, [isOnboarded, fetchBalance, setSmsPermissions, setUssdPermissions]);

  // Memoize Navigation Theme to prevent update loops
  const navTheme = useMemo(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      dark: theme === 'dark',
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.primary,
      },
      fonts: base.fonts,
    };
  }, [theme, colors]);

  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;
  if (!isOnboarded) return <SetupScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.topControls}>
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.surfaceHighlight }]} onPress={toggleTheme}>
            <Icon name={theme === 'dark' ? 'weather-sunny' : 'weather-night'} size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.surfaceHighlight }]} onPress={() => setLanguage(language === 'en' ? 'hi' : 'en')}>
            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 13 }}>{language === 'en' ? 'HI' : 'EN'}</Text>
          </TouchableOpacity>
        </View>

        <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="SendMoney" component={SendMoneyScreen} />
          <Tab.Screen name="QRScan" component={QRScanScreen} />
          <Tab.Screen name="History" component={TransactionHistoryScreen} />
          <Tab.Screen name="Account" component={SettingsScreen} />
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  const theme = useStore(state => state.theme);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: { paddingHorizontal: spacing.sm, position: 'absolute', bottom: 0, left: 0, right: 0 },
  tabBarContainer: {
    flexDirection: 'row', alignItems: 'center', height: 68,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '700' },
  centerBtnWrap: { top: -16, marginHorizontal: 4 },
  centerBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  topControls: { 
    flexDirection: 'row', justifyContent: 'flex-end', gap: 8, 
    paddingHorizontal: 16, paddingTop: 44, paddingBottom: 4, zIndex: 10
  },
  controlBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
