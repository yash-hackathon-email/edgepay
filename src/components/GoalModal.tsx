import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme';

interface GoalModalProps {
  visible: boolean;
  currentGoal: number;
  onSave: (amount: number) => void;
  onClose: () => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  visible, currentGoal, onSave, onClose
}) => {
  const { colors } = useTheme();
  const [value, setValue] = useState(currentGoal > 0 ? currentGoal.toString() : '');

  const handleSave = () => {
    const amount = parseFloat(value);
    if (!isNaN(amount) && amount >= 0) {
      onSave(amount);
      onClose();
    } else {
      // Handle invalid input or 0
      onSave(0);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            >
              <View style={styles.header}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Set Monthly Budget</Text>
                <TouchableOpacity onPress={onClose}>
                  <Icon name="close" size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Track your spending goal directly on your home screen widget.
              </Text>

              <View style={[styles.inputContainer, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                <Text style={[styles.currency, { color: colors.primary }]}>₹</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={value}
                  onChangeText={setValue}
                  autoFocus
                />
              </View>

              <View style={styles.quickSelectRow}>
                 {[5000, 10000, 25000, 50000].map(amt => (
                   <TouchableOpacity 
                     key={amt} 
                     style={[styles.quickBtn, { borderColor: colors.border }]}
                     onPress={() => setValue(amt.toString())}
                   >
                     <Text style={[styles.quickBtnText, { color: colors.textSecondary }]}>₹{amt/1000}k</Text>
                   </TouchableOpacity>
                 ))}
              </View>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Goal</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  container: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginBottom: 24, lineHeight: 18 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, height: 64, borderWidth: 1, marginBottom: 16 },
  currency: { fontSize: 24, fontWeight: '700', marginRight: 10 },
  input: { flex: 1, fontSize: 32, fontWeight: '900', padding: 0 },
  quickSelectRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  quickBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  quickBtnText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});
