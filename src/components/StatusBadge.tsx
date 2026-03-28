// ─── Status Badge Component ──────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TransactionStatus } from '../types';
import { STATUS_COLORS } from '../utils/constants';
import { borderRadius, spacing, typography } from '../theme';

interface StatusBadgeProps {
  status: TransactionStatus;
  size?: 'small' | 'medium';
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  QUEUED: 'Queued',
  CANCELLED: 'Cancelled',
};

const STATUS_ICONS: Record<TransactionStatus, string> = {
  PENDING: '⏳',
  SENT: '📤',
  SUCCESS: '✓',
  FAILED: '✕',
  QUEUED: '🔄',
  CANCELLED: '⊘',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'small' }) => {
  const colorScheme = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colorScheme.bg,
          paddingHorizontal: isSmall ? spacing.sm : spacing.md,
          paddingVertical: isSmall ? spacing.xs : spacing.sm,
        },
      ]}
    >
      <Text
        style={[
          styles.icon,
          { fontSize: isSmall ? 10 : 12 },
        ]}
      >
        {STATUS_ICONS[status]}
      </Text>
      <Text
        style={[
          styles.label,
          {
            color: colorScheme.text,
            fontSize: isSmall ? 11 : 13,
          },
        ]}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    gap: 4,
  },
  icon: {
    lineHeight: 14,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
