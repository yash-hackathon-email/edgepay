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
import { useTheme, spacing, borderRadius, typography, shadows, gradients } from '../theme';

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
  const t = translations[language] || translations.en;

  const fetchBalanceManually = useCallback(async () => {
    if (!isSmsAvailable()) return;
    setRefreshing(true);
    try {
      const subscription = onSmsReceived((sms) => {
        const bal = parseSmsForBalance(sms.body);
        if (bal !== null) {
          setUser({ balance: bal });
          setRefreshing(false);
          subscription.remove();
        }
      });
      await sendSMS(gateway || '56161', 'BAL');
      
      // Auto-stop refresh after 15s if no SMS response
      setTimeout(() => { 
        subscription.remove(); 
        setRefreshing(false); 
      }, 15000);
    } catch (err) {
      setRefreshing(false);
    }
  }, [gateway, setUser]);

  const onRefresh = useCallback(() => {
    fetchBalanceManually();
  }, [fetchBalanceManually]);

  const recentTxns = useMemo(() => (transactions || []).slice(0, 5), [transactions]);
  const isGsm = networkMode === 'GSM';

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={s.content}>
          {/* Header */}
          <View style={s.welcomeRow}>
            <View>
              <Text style={[s.welcomeSub, { color: colors.textTertiary }]}>{language === 'en' ? 'Welcome back,' : 'वापसी पर स्वागत है,'}</Text>
              <Text style={[s.welcomeTitle, { color: colors.textPrimary }]}>{user.name || 'User'}</Text>
            </View>
            <TouchableOpacity style={[s.profileBtn, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]} onPress={() => navigation.navigate('Account')}>
              <Icon name="account-circle-outline" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <LinearGradient 
            colors={theme === 'dark' ? ['#1A1A1A', '#0D0D0D'] : ['#FFFFFF', '#F9F9F9']} 
            style={[s.balanceCard, { borderColor: colors.cardBorder }]}
          >
            <View style={s.balanceHeader}>
              <Text style={[s.balanceLabel, { color: colors.textTertiary }]}>{t.balance.toUpperCase()}</Text>
              <View style={[s.badge, { backgroundColor: isGsm ? colors.error + '10' : colors.success + '10' }]}>
                <Icon name={isGsm ? 'shield-airplane' : 'wifi-check'} size={12} color={isGsm ? colors.error : colors.success} />
                <Text style={[s.badgeText, { color: isGsm ? colors.error : colors.success }]}>
                  {isGsm ? t.offline : t.online}
                </Text>
              </View>
            </View>
            
            <View style={s.balanceValueRow}>
              <Text style={[s.balanceAmount, { color: colors.textPrimary }]}>{formatCurrency(user.balance)}</Text>
              <TouchableOpacity onPress={fetchBalanceManually} style={s.refreshBtn}>
                <Icon name="refresh" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={s.cardFooter}>
              <View style={s.cardInfo}>
                <Icon name="checkbox-marked-circle" size={14} color={colors.success} />
                <Text style={[s.cardInfoText, { color: colors.textSecondary }]}>Linked Bank: {user.bank || 'N/A'} (Verified)</Text>
              </View>
              <Text style={[s.lastUpdate, { color: colors.textTertiary }]}>Last fetched via SMS</Text>
            </View>
          </LinearGradient>

          {/* Actions */}
          <View style={s.actionsGrid}>
            <ActionBtn icon="qrcode-scan" label={t.scan} color="#0A84FF" onPress={() => navigation.navigate('QRScan')} themeColors={colors} />
            <ActionBtn icon="bank-transfer" label={t.send} color="#BF5AF2" onPress={() => navigation.navigate('SendMoney', { method: 'USSD' })} themeColors={colors} />
            <ActionBtn icon="wallet" label="Wallet" color={colors.primary} onPress={() => navigation.navigate('SendMoney', { method: 'WALLET' })} themeColors={colors} />
            <ActionBtn icon="history" label={t.history} color="#FF9F0A" onPress={() => navigation.navigate('History')} themeColors={colors} />
            <ActionBtn icon="account-cog" label={t.account} color="#30D158" onPress={() => navigation.navigate('Account')} themeColors={colors} />
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
              <View style={[s.emptyState, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="layers-off-outline" size={32} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, marginTop: 8 }}>{language === 'en' ? 'No transactions yet.' : 'कोई लेनदेन नहीं।'}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const ActionBtn = ({ icon, label, color, onPress, themeColors }: any) => (
  <TouchableOpacity style={s.actionBtnWrap} onPress={onPress}>
    <View style={[s.actionIcon, { backgroundColor: `${color}15` }]}>
      <Icon name={icon} size={28} color={color} />
    </View>
    <Text style={[s.actionLabel, { color: themeColors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: 10 },
  welcomeSub: { fontSize: 12, fontWeight: '600' },
  welcomeTitle: { fontSize: 28, fontWeight: '900' },
  profileBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  balanceCard: { borderRadius: 28, padding: 24, borderWidth: 1, elevation: 8 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  balanceLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  balanceValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceAmount: { fontSize: 40, fontWeight: '900' },
  refreshBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(10, 132, 255, 0.1)' },
  cardFooter: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardInfoText: { fontSize: 11, fontWeight: '600' },
  lastUpdate: { fontSize: 9, fontStyle: 'italic' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  actionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 12 },
  actionBtnWrap: { alignItems: 'center', gap: 10, width: '18%' },
  actionIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '800' },
  txnSection: { marginTop: 24, gap: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  emptyState: { alignItems: 'center', padding: 32, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(128,128,128,0.2)' },
});
