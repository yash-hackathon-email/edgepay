// ─── Transaction Card Component ──────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Transaction } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, formatRelativeTime, getInitials } from '../utils/formatters';
import { useTheme, spacing, borderRadius, typography } from '../theme';

interface TransactionCardProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
  compact?: boolean;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction, onPress, compact = false,
}) => {
  const { colors } = useTheme();
  const { amount, receiver, receiverName, status, timestamp, method } = transaction;
  const displayName = receiverName || receiver;
  const initials = getInitials(displayName);

  const getStatusColor = () => {
    switch (status) {
      case 'SUCCESS': return colors.success;
      case 'FAILED': return colors.error;
      case 'PENDING': return colors.warning;
      case 'CANCELLED': return colors.textTertiary;
      default: return colors.primary;
    }
  };

  const statusColor = getStatusColor();

  return (
    <TouchableOpacity
      style={[styles.container, compact && styles.containerCompact, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      onPress={() => onPress?.(transaction)}
      activeOpacity={0.7}
    >
      <View style={[styles.accentStrip, { backgroundColor: statusColor }]} />

      <View style={[styles.avatar, { backgroundColor: colors.surfaceHighlight, borderColor: statusColor + '40' }]}>
        <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{initials}</Text>
      </View>

      <View style={styles.details}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[
            styles.amount,
            { color: colors.textPrimary },
            status === 'SUCCESS' && { color: colors.success },
            status === 'CANCELLED' && { color: colors.textTertiary, textDecorationLine: 'line-through' as const },
          ]}>
            {status === 'CANCELLED' ? '' : '-'}{formatCurrency(amount)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.metaRow}>
            <StatusBadge status={status} size="small" />
            {method === 'USSD' && (
              <View style={[styles.gsmTag, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                <Text style={[styles.gsmTagText, { color: colors.textSecondary }]}>USSD</Text>
              </View>
            )}
          </View>
          <Text style={[styles.time, { color: colors.textTertiary }]}>{formatRelativeTime(timestamp)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, gap: spacing.md, overflow: 'hidden' },
  containerCompact: { padding: spacing.md, borderRadius: borderRadius.md },
  accentStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  details: { flex: 1, gap: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  amount: { fontSize: 16, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gsmTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  gsmTagText: { fontSize: 9, fontWeight: '800' },
  time: { fontSize: 11 },
});
