// ─── Header Component ────────────────────────────────────────────────

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NetworkIndicator } from './NetworkIndicator';
import { useStore } from '../store/useStore';
import { colors, spacing, typography } from '../theme';

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showNetwork?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showLogo = true,
  showNetwork = true,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const networkMode = useStore(state => state.networkMode);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.content}>
        {showLogo && (
          <View style={styles.logoRow}>
            <Image
              source={require('../../assets/logo1.jpg')}
              style={styles.logoImage}
              resizeMode="cover"
            />
            <Text style={styles.logoText}>EdgePay</Text>
          </View>
        )}
        {title && !showLogo && (
          <Text style={styles.title}>{title}</Text>
        )}
        {showNetwork && (
          <View style={styles.rightActions}>
            <NetworkIndicator mode={networkMode} />
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Account')}
              activeOpacity={0.7}
            >
              <Icon name="cog-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  logoText: {
    ...typography.h2,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  settingsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
