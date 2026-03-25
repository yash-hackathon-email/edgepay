// ─── Transaction List Component ──────────────────────────────────────

import React from 'react';
import { View, FlatList, StyleSheet, Text, ScrollView } from 'react-native';
import { TransactionCard } from './TransactionCard';
import { useTheme, spacing, typography } from '../theme';
import type { Transaction } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  scrollEnabled?: boolean;
}

export const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  scrollEnabled = true 
}) => {
  const { colors } = useTheme();

  if (!transactions || transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No transactions yet</Text>
      </View>
    );
  }

  if (!scrollEnabled) {
    return (
      <View style={styles.listContainer}>
        {(transactions || []).map(txn => (
          <TransactionCard key={txn.id} transaction={txn} />
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionCard transaction={item} />}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: { gap: spacing.md },
  scrollContent: { paddingBottom: spacing.xl, gap: spacing.md },
  emptyContainer: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, fontWeight: '500' },
});
