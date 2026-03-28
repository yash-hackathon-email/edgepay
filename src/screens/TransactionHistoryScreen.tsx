// ─── Transaction History Screen ──────────────────────────────────────

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionCard } from '../components/TransactionCard';
import { StatusBadge } from '../components/StatusBadge';
import { useStore } from '../store/useStore';
import { formatCurrency, formatFullDate, formatTransactionId } from '../utils/formatters';
import { useTheme, spacing, typography } from '../theme';
import { translations } from '../utils/i18n';
import type { Transaction, TransactionStatus } from '../types';

type Filter = 'ALL' | TransactionStatus;

export const TransactionHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { language, transactions, cancelTransaction } = useStore();
  const t = translations[language] || translations.en;
  
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'SUCCESS', label: 'Success' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'FAILED', label: 'Failed' },
  ];

  const filtered = useMemo(() => {
    if (filter === 'ALL') return transactions;
    return transactions.filter(txn => txn.status === filter);
  }, [transactions, filter]);

  const stats = useMemo(() => {
    const total = transactions.reduce((sum, txn) => txn.status === 'SUCCESS' ? sum + txn.amount : sum, 0);
    return {
      count: transactions.length,
      success: transactions.filter(txn => txn.status === 'SUCCESS').length,
      totalAmount: total,
    };
  }, [transactions]);

  const handleCancel = (txn: Transaction) => {
    Alert.alert('Cancel Payment', `Cancel payment of ${formatCurrency(txn.amount)}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => {
        cancelTransaction(txn.id);
        setSelectedTxn(null);
      }}
    ]);
  };

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
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t.history}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 40 }}>
        <LinearGradient colors={theme === 'dark' ? ['#1A1B2E', '#101018'] : ['#FFFFFF', '#F9F9F9']} style={[s.statsRow, { borderColor: 'rgba(255,255,255,0.08)' }]}>
          <View style={s.stat}>
            <Text style={[s.statVal, { color: colors.textPrimary }]}>{stats.count}</Text>
            <Text style={[s.statLbl, { color: colors.textTertiary }]}>TOTAL</Text>
          </View>
          <View style={[s.statDiv, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: colors.success }]}>{stats.success}</Text>
            <Text style={[s.statLbl, { color: colors.textTertiary }]}>PAID</Text>
          </View>
          <View style={[s.statDiv, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: colors.primary }]}>{formatCurrency(stats.totalAmount)}</Text>
            <Text style={[s.statLbl, { color: colors.textTertiary }]}>AMOUNT</Text>
          </View>
        </LinearGradient>

        <View style={s.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {(filters || []).map(f => (
              <TouchableOpacity 
                key={f.key} 
                style={[s.filterBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, filter === f.key && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]} 
                onPress={() => setFilter(f.key)}
              >
                <Text style={[s.filterText, { color: colors.textTertiary }, filter === f.key && { color: colors.primary, fontWeight: '800' }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={s.listWrap}>
          {filtered.length > 0 ? (
            filtered.map((item, idx) => (
              <View key={item.id}>
                <TransactionCard transaction={item} onPress={setSelectedTxn} />
                {idx < filtered.length - 1 && <View style={{ height: 12 }} />}
              </View>
            ))
          ) : (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: colors.surfaceHighlight }]}>
                <Icon name="history" size={48} color={colors.textTertiary} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{language === 'en' ? 'No transactions' : 'कोई लेनदेन नहीं'}</Text>
              <Text style={{ color: colors.textTertiary, textAlign: 'center' }}>
                {language === 'en' ? 'No transactions found here' : 'यहाँ कोई लेनदेन नहीं मिला'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selectedTxn} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelectedTxn(null)} />
          <View style={[s.modalContent, { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + 40, borderColor: 'rgba(255,255,255,0.08)' }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            {selectedTxn && (
              <>
                <View style={s.modalHeader}>
                  <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Details</Text>
                  <TouchableOpacity onPress={() => setSelectedTxn(null)} style={s.closeBox}>
                    <Icon name="close" size={24} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                
                <View style={s.detailBody}>
                  <View style={[s.detailIconWrap, { backgroundColor: (selectedTxn.status === 'SUCCESS' ? colors.success : colors.error) + '15' }]}>
                    <Icon name={selectedTxn.status === 'SUCCESS' ? 'check-decagram' : 'alert-circle'} size={56} color={selectedTxn.status === 'SUCCESS' ? colors.success : colors.error} />
                  </View>
                  
                  <Text style={[s.detailAmount, { color: colors.textPrimary }]}>{formatCurrency(selectedTxn.amount)}</Text>
                  <Text style={[s.detailStatus, { color: selectedTxn.status === 'SUCCESS' ? colors.success : colors.textTertiary }]}>{selectedTxn.status}</Text>
                  
                  <View style={s.summaryCard}>
                    <Row label="TO" value={selectedTxn.receiverName || selectedTxn.receiver} colors={colors} />
                    <Row label="TXN ID" value={formatTransactionId(selectedTxn.id)} colors={colors} />
                    <Row label="TIME" value={formatFullDate(selectedTxn.timestamp)} colors={colors} />
                  </View>

                  {selectedTxn.status === 'PENDING' && (
                    <TouchableOpacity style={s.cancelBtn} onPress={() => handleCancel(selectedTxn)}>
                      <Text style={s.cancelText}>Cancel Transaction</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Row = ({ label, value, colors }: any) => (
  <View style={s.row}>
    <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>{label}</Text>
    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1 },
  bgGlowWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlow: { position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, fontWeight: '900', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', margin: 16, borderRadius: 24, padding: 24, borderWidth: 1, elevation: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLbl: { fontSize: 9, fontWeight: '800', opacity: 0.6 },
  statDiv: { width: 1, height: 30, opacity: 0.2 },
  filterWrapper: { marginBottom: 16 },
  filterRow: { gap: 10, paddingHorizontal: 16 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '700' },
  listWrap: { paddingHorizontal: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40, gap: 16, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, borderWidth: 1 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  closeBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailBody: { alignItems: 'center', gap: 20 },
  detailIconWrap: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  detailAmount: { fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  detailStatus: { fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  summaryCard: { width: '100%', borderRadius: 24, padding: 20, borderWidth: 1, gap: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelBtn: { marginTop: 12, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, backgroundColor: '#FF3B3015', borderWidth: 1, borderColor: '#FF3B3020' },
  cancelText: { color: '#FF3B30', fontWeight: '800', fontSize: 14 },
});
