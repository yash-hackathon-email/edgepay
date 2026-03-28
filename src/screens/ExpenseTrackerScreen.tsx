import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTheme, spacing } from '../theme';
import { formatCurrency } from '../utils/formatters';
import { syncExpenseData } from '../engine/WidgetService';

export const ExpenseTrackerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const user = useStore(state => state.user);
  const setUser = useStore(state => state.setUser);
  const recalculateSpending = useStore(state => state.recalculateSpending);

  const [budget, setBudget] = useState((user?.monthlyBudget ?? 0).toString());
  const [resetDay, setResetDay] = useState((user?.budgetResetDay ?? 1).toString());

  // Sync with widget and recalculate on mount
  React.useEffect(() => {
    recalculateSpending();
  }, []);

  React.useEffect(() => {
    if (user) {
      syncExpenseData(user.spentThisMonth, user.monthlyBudget, user.budgetResetDay);
    }
  }, [user?.spentThisMonth, user?.monthlyBudget, user?.budgetResetDay]);

  const handleSave = () => {
    const amt = parseFloat(budget);
    const day = parseInt(resetDay);

    if (isNaN(amt) || amt < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid salary/pocket money amount.');
      return;
    }

    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Invalid Date', 'Please enter a day between 1 and 31.');
      return;
    }

    setUser({
      monthlyBudget: amt,
      budgetResetDay: day
    });

    Alert.alert('Success', 'Expense tracker settings updated.');
    navigation.goBack();
  };

  const progress = user.monthlyBudget > 0 ? (user.spentThisMonth / user.monthlyBudget) : 0;

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <LinearGradient colors={theme === 'dark' ? ['#1A1B2E', '#000'] : ['#F2F2F7', '#FFF']} style={StyleSheet.absoluteFill} />
      
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Icon name="chevron-left" size={32} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.textPrimary }]}>Expense Tracker</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content}>
          
          {/* Big Percentage Card (Like Image) */}
          <View style={[s.imageCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
             <Text style={[s.imageLabelTop, { color: colors.textPrimary }]}>Spent</Text>
             <Text style={[s.imagePercent, { color: progress > 0.9 ? colors.error : '#FF453A' }]}>
                {Math.floor(progress * 100)}%
             </Text>
             <Text style={[s.imageLabelBottom, { color: colors.textPrimary }]}>of Salary</Text>
             
             {/* Progress Bar (Hidden or subtle in image, let's keep it subtle) */}
             <View style={[s.progressWrapper, { backgroundColor: colors.surfaceHighlight }]}>
                <View style={[s.progressFill, { 
                  backgroundColor: progress > 0.9 ? colors.error : '#FF453A',
                  width: `${Math.min(progress * 100, 100)}%` 
                }]} />
             </View>
          </View>

          <View style={s.simpleStats}>
             <View style={s.statItem}>
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>SPENT</Text>
                <Text style={[s.statValue, { color: colors.textPrimary }]}>₹{user.spentThisMonth.toLocaleString()}</Text>
             </View>
             <View style={s.statItem}>
                <Text style={[s.statLabel, { color: colors.textTertiary }]}>REMAINING</Text>
                <Text style={[s.statValue, { color: colors.primary }]}>₹{Math.max(0, user.monthlyBudget - user.spentThisMonth).toLocaleString()}</Text>
             </View>
          </View>

          {/* Settings Section */}
          <View style={[s.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.textPrimary }]}>Tracking Settings</Text>
            
            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Monthly Salary / Pocket Money</Text>
              <View style={[s.inputWrap, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                <Text style={[s.inputIcon, { color: colors.primary }]}>₹</Text>
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={budget}
                  onChangeText={setBudget}
                />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textSecondary }]}>Renew Date (Day of Month)</Text>
              <View style={[s.inputWrap, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                <Icon name="calendar-refresh" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  placeholder="1"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={2}
                  value={resetDay}
                  onChangeText={setResetDay}
                />
              </View>
              <Text style={[s.hint, { color: colors.textTertiary }]}>Every month on this date, your "Spent" counter will reset.</Text>
            </View>

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={s.saveBtnText}>Save Settings</Text>
            </TouchableOpacity>
          </View>

          <View style={s.infoBox}>
            <Icon name="information-outline" size={18} color={colors.textTertiary} />
            <Text style={[s.infoText, { color: colors.textTertiary }]}>
              All payments made via EdgePay will be automatically logged as expenses.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 20 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  content: { padding: 20, gap: 20 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  infoBox: { flexDirection: 'row', gap: 10, paddingHorizontal: 10, alignItems: 'center' },
  infoText: { fontSize: 12, lineHeight: 18, flex: 1 },
  card: { borderRadius: 24, padding: 20, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1 },
  inputIcon: { fontSize: 18, fontWeight: '800', marginRight: 10 },
  input: { flex: 1, fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 11, marginTop: 6, marginLeft: 4, lineHeight: 16 },
  saveBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  // Image-style card
  imageCard: { padding: 40, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 4 },
  imageLabelTop: { fontSize: 42, fontWeight: '800', marginBottom: -10 },
  imagePercent: { fontSize: 130, fontWeight: '900', letterSpacing: -5, marginVertical: -10 },
  imageLabelBottom: { fontSize: 36, fontWeight: '800', marginTop: -10 },
  progressWrapper: { height: 12, width: '100%', borderRadius: 6, overflow: 'hidden', marginTop: 32 },
  progressFill: { height: '100%', borderRadius: 6 },
  simpleStats: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  statItem: { alignItems: 'flex-start' },
  statLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statValue: { fontSize: 18, fontWeight: '900' },
});
