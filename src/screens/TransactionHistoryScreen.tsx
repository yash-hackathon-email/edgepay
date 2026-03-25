// ─── Transaction History Screen ──────────────────────────────────────

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionCard } from '../components/TransactionCard';
import { StatusBadge } from '../components/StatusBadge';
import { useStore } from '../store/useStore';
import { formatCurrency, formatFullDate, formatTransactionId } from '../utils/formatters';
import { useTheme, spacing, borderRadius, typography, gradients } from '../theme';
import { translations } from '../utils/i18n';
import type { Transaction, TransactionStatus } from '../types';

type Filter = 'ALL' | TransactionStatus;

export const TransactionHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const language = useStore(state => state.language);
  const t = translations[language] || translations.en;
  const transactions = useStore(state => state.transactions);
  const cancelTransaction = useStore(state => state.cancelTransaction);
  
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: t.home }, // Use labels from i18n
    { key: 'SUCCESS', label: 'Success' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'FAILED', label: 'Failed' },
    { key: 'CANCELLED', label: 'Cancelled' },
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
      <View style={[s.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.backBtn, { backgroundColor: colors.surfaceHighlight }]}>
          <Icon name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t.history}</Text>
        <View style={{ width: 36 }} />
      </View>

      <LinearGradient colors={theme === 'dark' ? ['#1A1A1A', '#0A0A0A'] : ['#FFF', '#F8F8F8']} style={[s.statsRow, { borderColor: colors.cardBorder }]}>
        <View style={s.stat}>
          <Text style={[s.statVal, { color: colors.textPrimary }]}>{stats.count}</Text>
          <Text style={[s.statLbl, { color: colors.textTertiary }]}>{language === 'en' ? 'TOTAL' : 'कुल'}</Text>
        </View>
        <View style={[s.statDiv, { backgroundColor: colors.border }]} />
        <View style={s.stat}>
          <Text style={[s.statVal, { color: colors.success }]}>{stats.success}</Text>
          <Text style={[s.statLbl, { color: colors.textTertiary }]}>{language === 'en' ? 'PAID' : 'सफल'}</Text>
        </View>
        <View style={[s.statDiv, { backgroundColor: colors.border }]} />
        <View style={s.stat}>
          <Text style={[s.statVal, { color: colors.primary }]}>{formatCurrency(stats.totalAmount)}</Text>
          <Text style={[s.statLbl, { color: colors.textTertiary }]}>{language === 'en' ? 'AMOUNT' : 'राशि'}</Text>
        </View>
      </LinearGradient>

      <View style={s.filterRow}>
        {(filters || []).map(f => (
          <TouchableOpacity 
            key={f.key} 
            style={[s.filterBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, filter === f.key && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]} 
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterText, { color: colors.textTertiary }, filter === f.key && { color: colors.primary, fontWeight: '700' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={({ item }) => <TransactionCard transaction={item} onPress={setSelectedTxn} />}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Icon name="history" size={64} color={colors.textTertiary} />
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{language === 'en' ? 'No transactions' : 'कोई लेनदेन नहीं'}</Text>
            <Text style={{ color: colors.textTertiary }}>{language === 'en' ? 'Send money to see history' : 'इतिहास देखने के लिए पैसे भेजें'}</Text>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal visible={!!selectedTxn} transparent animationType="slide" onRequestClose={() => setSelectedTxn(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 20 }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            {selectedTxn && (
              <>
                <View style={s.modalHeader}>
                  <Text style={[s.modalTitle, { color: colors.textPrimary }]}>{language === 'en' ? 'Details' : 'विवरण'}</Text>
                  <TouchableOpacity onPress={() => setSelectedTxn(null)}>
                    <Icon name="close" size={24} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <View style={s.detailBody}>
                  <Text style={[s.detailInfo, { color: colors.textTertiary }]}>{formatTransactionId(selectedTxn.id)}</Text>
                  <Text style={[s.detailAmount, { color: colors.textPrimary }]}>{formatCurrency(selectedTxn.amount)}</Text>
                  <StatusBadge status={selectedTxn.status} size="medium" />
                  
                  <View style={s.row}><Text style={[s.label, { color: colors.textTertiary }]}>Recipient</Text><Text style={[s.value, { color: colors.textPrimary }]}>{selectedTxn.receiverName || selectedTxn.receiver}</Text></View>
                  <View style={s.row}><Text style={[s.label, { color: colors.textTertiary }]}>Time</Text><Text style={[s.value, { color: colors.textPrimary }]}>{formatFullDate(selectedTxn.timestamp)}</Text></View>
                  {selectedTxn.ussdCommand && <View style={s.row}><Text style={[s.label, { color: colors.textTertiary }]}>Command</Text><Text style={[s.value, { color: colors.primary, fontFamily: 'monospace' }]}>{selectedTxn.ussdCommand}</Text></View>}
                </View>
              </>
            )}
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
  statsRow: { flexDirection: 'row', margin: 16, borderRadius: 16, padding: 20, borderWidth: 1 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { ...typography.h3, fontSize: 18 },
  statLbl: { fontSize: 9, fontWeight: '700', marginTop: 4 },
  statDiv: { width: 1, height: 24 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 12 },
  emptyTitle: { ...typography.h2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { ...typography.h2 },
  detailBody: { alignItems: 'center', gap: 16 },
  detailInfo: { fontSize: 12, opacity: 0.6 },
  detailAmount: { fontSize: 40, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  label: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '600' },
});
