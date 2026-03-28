// ─── Dashboard Screen ────────────────────────────────────────────────
// Themed and Localized Dashboard for EdgePay with Dynamic Balance

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Platform, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionList } from '../components/TransactionList';
import { useStore } from '../store/useStore';
import { checkUssdPermissions, requestUssdPermissions } from '../engine/USSDService';
import { sendSMS, isSmsAvailable, onSmsReceived } from '../engine/SmsService';
import { parseSmsForBalance } from '../engine/SmsParser';
import { formatCurrency } from '../utils/formatters';
import { translations } from '../utils/i18n';
import { syncGoalAmount } from '../engine/WidgetService';
import { useTheme, spacing, borderRadius, typography, shadows, gradients } from '../theme';
import { PinScreen, triggerPinError } from '../components/PinScreen';
import { GoalModal } from '../components/GoalModal';
import { hashPin } from '../engine/BiometricService';
import { SMS_GATEWAY_NUMBER_DEFAULT } from '../utils/constants';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();

  // Stable selectors to prevent re-render loops
  const user = useStore(state => state.user);
  const transactions = useStore(state => state.transactions);
  const networkMode = useStore(state => state.networkMode);
  const language = useStore(state => state.language);
  const gateway = useStore(state => state.settings.gatewayNumber);
  const setUser = useStore(state => state.setUser);

  const [refreshing, setRefreshing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showPinVerify, setShowPinVerify] = useState(false);
  
  const t = translations[language] || translations.en;
  const pinHash = useStore(state => state.settings.pinHash);

  const [showGoalModal, setShowGoalModal] = useState(false);

  // Sync goal tracker to widget
  useEffect(() => {
    if (user.goalAmount > 0) {
      syncGoalAmount(user.goalAmount, user.balance);
    }
  }, [user.goalAmount, user.balance]);

  const fetchBalanceManually = useCallback(async () => {
    // If bank is HDFC, just show dummy balance (revealing it)
    if (user.bank === 'HDFC') {
      setIsRevealed(true);
      setRefreshing(false);
      return;
    }

    // SBI Logic: Read recent messages directly
    if (user.bank === 'SBI') {
      if (!isSmsAvailable()) {
        Alert.alert('Permissions', 'Please enable SMS permissions in settings.');
        return;
      }
      
      setRefreshing(true);
      try {
        const { readRecentSms } = await import('../engine/SmsService');
        const messages = await readRecentSms(5);
        
        let foundBalance = null;
        for (const msg of messages) {
          const cleanSender = msg.sender.toUpperCase();
          if (cleanSender.includes('SBIPSG') || cleanSender.includes('SBI')) {
            const bal = parseSmsForBalance(msg.body);
            if (bal !== null) {
              foundBalance = bal;
              break; // Stop at the most recent one
            }
          }
        }

        if (foundBalance !== null) {
           setUser({ balance: foundBalance });
           setIsRevealed(true);
        } else {
           // If not found in last 5, attempt to send request again? 
           // User asked to "simply fetch recent 5", so I'll stick to that.
           Alert.alert('No Message Found', 'Could not find a recent balance message from SBI in your inbox. Please trigger Check Balance again after receiving the SMS.');
        }

      } catch (err) {
        console.warn('[BalanceFetch] Error reading SMS:', err);
      } finally {
        setRefreshing(false);
      }
    } else {
      setIsRevealed(true);
      setRefreshing(false);
    }
  }, [user.bank, setUser]);

  const handleCheckBalance = () => {
    if (pinHash) {
      setShowPinVerify(true);
    } else {
      // No PIN set? (should not happen after setup)
      fetchBalanceManually();
    }
  };

  const onPinVerified = (pin: string) => {
    if (hashPin(pin) === pinHash) {
      setShowPinVerify(false);
      fetchBalanceManually();
    } else {
      triggerPinError('Invalid PIN');
    }
  };

  const onRefresh = useCallback(() => {
    // Reveal what we have or re-fetch depending on state
    if (!isRevealed) {
      handleCheckBalance();
    } else {
      fetchBalanceManually();
    }
  }, [isRevealed, fetchBalanceManually]);

  const recentTxns = useMemo(() => (transactions || []).slice(0, 5), [transactions]);
  const isGsm = networkMode === 'GSM';

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Background Decorative Glow */}
      <View style={s.bgGlowWrap}>
        <LinearGradient colors={theme === 'dark' ? ['rgba(10, 132, 255, 0.12)', 'transparent'] : ['rgba(10, 132, 255, 0.05)', 'transparent']} style={s.bgGlow} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={s.content}>
          {/* Header / Welcome */}
          <View style={s.welcomeRow}>
            <View>
              <Text style={[s.welcomeSub, { color: colors.textTertiary }]}>{language === 'en' ? 'Welcome back,' : 'वापसी पर स्वागत है,'}</Text>
              <Text style={[s.welcomeTitle, { color: colors.textPrimary }]}>{user.name || 'User'}</Text>
            </View>
            <TouchableOpacity style={[s.profileBtn, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]} onPress={() => navigation.navigate('Account')}>
              <Icon name="account-circle-outline" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* New Premium Balance Card */}
          <LinearGradient
            colors={theme === 'dark' ? ['#1A1B2E', '#121220', '#0E0E18'] : ['#FFFFFF', '#F9F9F9']}
            style={[s.balanceCard, { borderColor: theme === 'dark' ? 'rgba(10, 132, 255, 0.15)' : colors.cardBorder }]}
          >
            <View style={s.balanceHeader}>
              <View>
                <Text style={[s.balanceLabel, { color: colors.textTertiary }]}>{t.balance.toUpperCase()}</Text>
                <View style={[s.balanceAccent, { backgroundColor: colors.primary }]} />
              </View>
              <View style={[s.badge, { backgroundColor: isGsm ? colors.error + '15' : colors.success + '15' }]}>
                <View style={[s.dot, { backgroundColor: isGsm ? colors.error : colors.success }]} />
                <Text style={[s.badgeText, { color: isGsm ? colors.error : colors.success }]}>
                  {isGsm ? t.offline : t.online}
                </Text>
              </View>
            </View>

            <View style={s.balanceValueRow}>
              <View style={s.amountWrap}>
                <Text style={[s.currencySymbol, { color: colors.textTertiary }]}>₹</Text>
                <Text style={[s.balanceAmount, { color: colors.textPrimary }]}>
                  {isRevealed ? formatCurrency(user.balance).replace('₹', '') : '******'}
                </Text>
              </View>
              {!isRevealed ? (
                <TouchableOpacity onPress={handleCheckBalance} style={[s.checkBalanceBtn, { backgroundColor: colors.primary }]}>
                   <Text style={s.checkBalanceBtnText}>Check Balance</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={fetchBalanceManually} style={[s.refreshBtn, { backgroundColor: colors.primary + '15' }]}>
                  <Icon name="refresh" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.cardFooter}>
              <View style={s.cardInfo}>
                <Icon name="bank-outline" size={14} color={colors.textTertiary} />
                <Text style={[s.cardInfoText, { color: colors.textSecondary }]}>{user.bank || 'Linked Bank'}</Text>
              </View>
              <Text style={[s.lastUpdate, { color: colors.textTertiary }]}>Sync via SMS</Text>
            </View>
          </LinearGradient>

          {/* Quick Actions Header */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.textPrimary, fontSize: 16 }]}>Quick Actions</Text>
          </View>

          {/* Actions Grid */}
          <View style={s.actionsGrid}>
            <ActionBtn icon="qrcode-scan" label={t.scan} color="#0A84FF" onPress={() => navigation.navigate('QRScan')} themeColors={colors} />
            <ActionBtn icon="cellphone-nfc" label="UPI Pay" color="#5856D6" onPress={() => navigation.navigate('UpiPayment')} themeColors={colors} />
            <ActionBtn icon="bank-transfer" label={t.send} color="#BF5AF2" onPress={() => navigation.navigate('SendMoney', { method: 'USSD' })} themeColors={colors} />
            <ActionBtn icon="chart-donut" label="Expenses" color="#30D158" onPress={() => navigation.navigate('ExpenseTracker')} themeColors={colors} />
            <ActionBtn icon="bank-outline" label="Services" color="#FF375F" onPress={() => navigation.navigate('Services')} themeColors={colors} />
            <ActionBtn icon="history" label={t.history} color="#FF9F0A" onPress={() => navigation.navigate('History')} themeColors={colors} />
          </View>

          {/* Goal Tracker Section */}
          <View style={s.goalSection}>
            <View style={s.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="bullseye-arrow" size={18} color={colors.primary} />
                <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Budget & Goals</Text>
              </View>
              <TouchableOpacity 
                activeOpacity={0.7}
                style={[s.editGoalBadge, { backgroundColor: colors.primary + '15' }]} 
                onPress={() => navigation.navigate('ExpenseTracker')}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>Manage Budget</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
               {/* Savings Goal Card */}
               <LinearGradient
                  colors={theme === 'dark' ? ['#1C1C2E', '#141426'] : ['#F2F2F7', '#E5E5EA']}
                  style={[s.goalCardFixed, { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : colors.border }]}
                >
                   {user.goalAmount > 0 ? (
                     <>
                       <View style={s.goalInnerHeader}>
                          <View>
                            <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Savings Goal</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 2 }}>
                              ₹{formatCurrency(user.balance).replace('₹', '')}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                             <View style={[s.statusPill, { backgroundColor: (user.balance / user.goalAmount) > 0.9 ? colors.error + '20' : colors.success + '20' }]}>
                                <Text style={{ color: (user.balance / user.goalAmount) > 0.9 ? colors.error : colors.success, fontSize: 10, fontWeight: '900' }}>
                                   {Math.floor((user.balance / user.goalAmount) * 100)}%
                                </Text>
                             </View>
                          </View>
                       </View>

                       <View style={[s.progressWrapper, { backgroundColor: colors.surfaceHighlight }]}>
                          <LinearGradient
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            colors={ (user.balance / user.goalAmount) > 0.9 ? ['#FF453A', '#FF375F'] : ['#0A84FF', '#5856D6'] }
                            style={[s.progressFill, { width: `${Math.min((user.balance / user.goalAmount) * 100, 100)}%` }]}
                          />
                       </View>
                     </>
                   ) : (
                     <TouchableOpacity style={s.emptyGoal} onPress={() => setShowGoalModal(true)}>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>Set Savings Goal</Text>
                     </TouchableOpacity>
                   )}
               </LinearGradient>

               {/* Expense/Salary Deduct Card */}
               <LinearGradient
                  colors={theme === 'dark' ? ['#2E1C24', '#1F1417'] : ['#FFF5F5', '#FFE5E5']}
                  style={[s.goalCardFixed, { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : colors.border }]}
                >
                   {user.monthlyBudget > 0 ? (
                     <>
                        <View style={s.goalInnerHeader}>
                          <View>
                            <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Monthly Salary</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 2 }}>
                              ₹{formatCurrency(user.monthlyBudget - user.spentThisMonth).replace('₹', '')} <Text style={{ fontSize: 12, fontWeight: '400', color: colors.textTertiary }}>left</Text>
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                             <Text style={{ color: colors.error, fontSize: 14, fontWeight: '900' }}>
                                -{Math.floor((user.spentThisMonth / user.monthlyBudget) * 100)}%
                             </Text>
                          </View>
                       </View>
                       <View style={[s.progressWrapper, { backgroundColor: colors.surfaceHighlight }]}>
                          <View style={[s.progressFill, { backgroundColor: colors.error, width: `${Math.min((user.spentThisMonth / user.monthlyBudget) * 100, 100)}%` }]} />
                       </View>
                     </>
                   ) : (
                     <TouchableOpacity style={s.emptyGoal} onPress={() => navigation.navigate('ExpenseTracker')}>
                        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '800' }}>Insert Monthly Salary / Pocket Money</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4 }}>Auto-deduct on every payment</Text>
                     </TouchableOpacity>
                   )}
               </LinearGradient>
            </View>
          </View>

          {/* Transactions */}
          <View style={s.txnSection}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{t.history}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{language === 'en' ? 'View All' : 'सब देखें'}</Text>
              </TouchableOpacity>
            </View>
            {recentTxns.length > 0 ? (
              <TransactionList transactions={recentTxns} scrollEnabled={false} />
            ) : (
              <View style={[s.emptyState, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Icon name="layers-off-outline" size={32} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, marginTop: 8 }}>{language === 'en' ? 'No transactions yet.' : 'कोई लेनदेन नहीं।'}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Goal Setting Modal */}
      <GoalModal
        visible={showGoalModal}
        currentGoal={user.goalAmount}
        onSave={(amt) => setUser({ goalAmount: amt })}
        onClose={() => setShowGoalModal(false)}
      />

      {/* PIN Verification Modal */}
      <PinScreen
        visible={showPinVerify}
        mode="verify"
        title="Check Balance"
        subtitle="Verification required"
        onComplete={onPinVerified}
        onCancel={() => setShowPinVerify(false)}
      />
    </View>
  );
};

const ActionBtn = ({ icon, label, color, onPress, themeColors }: any) => (
  <TouchableOpacity style={s.actionBtnWrap} activeOpacity={0.8} onPress={onPress}>
    <View style={[s.actionIcon, { backgroundColor: `${color}18`, borderWidth: 1, borderColor: `${color}20` }]}>
      <Icon name={icon} size={26} color={color} />
    </View>
    <Text style={[s.actionLabel, { color: themeColors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  screen: { flex: 1 },
  bgGlowWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlow: { position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200 },
  content: { padding: spacing.xl, gap: spacing.xl },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  welcomeSub: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  welcomeTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  profileBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  balanceCard: { borderRadius: 32, padding: 24, borderWidth: 1, elevation: 12 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  balanceLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  balanceAccent: { width: 16, height: 2, borderRadius: 1, marginTop: 4 },
  balanceValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  amountWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  currencySymbol: { fontSize: 24, fontWeight: '700', marginTop: 8 },
  balanceAmount: { fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardFooter: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardInfoText: { fontSize: 12, fontWeight: '700' },
  lastUpdate: { fontSize: 10, fontWeight: '600', opacity: 0.8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionsGrid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  actionBtnWrap: { alignItems: 'center', gap: 10, width: '18%' },
  actionIcon: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  txnSection: { marginTop: spacing.md, gap: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  emptyState: { alignItems: 'center', padding: 32, borderRadius: 24, borderStyle: 'dashed', borderWidth: 1 },
  checkBalanceBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkBalanceBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  goalSection: { marginTop: spacing.md, gap: 12 },
  editGoalBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  goalCardFixed: { borderRadius: 24, padding: 20, borderWidth: 1, minHeight: 140, justifyContent: 'center' },
  goalInnerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  progressWrapper: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 5 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyGoal: { alignItems: 'center' },
  emptyIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
