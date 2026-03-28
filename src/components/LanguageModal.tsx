import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'ur', label: 'اردو (Urdu)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
];

interface LanguageModalProps {
  visible: boolean;
  currentLanguage: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({
  visible, currentLanguage, onSelect, onClose, title = 'Select Language'
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalBg}>
          <TouchableWithoutFeedback>
            <View style={[styles.langMenu, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.langMenuTitle, { color: colors.textPrimary }]}>{title}</Text>
              
              <View style={styles.listWrap}>
                {LANGUAGES.map(l => {
                  const isSelected = currentLanguage === l.code;
                  return (
                    <TouchableOpacity 
                      key={l.code} 
                      style={[styles.langMenuItem, isSelected && { backgroundColor: colors.primary + '20' }]}
                      onPress={() => {
                        onSelect(l.code);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.langMenuItemText, { color: isSelected ? colors.primary : colors.textPrimary }]}>
                        {l.label}
                      </Text>
                      {isSelected && <Icon name="check" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBg: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  langMenu: { 
    width: 280, 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1, 
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  langMenuTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  listWrap: {
    gap: 4
  },
  langMenuItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 10 
  },
  langMenuItemText: { 
    fontSize: 15, 
    fontWeight: '600' 
  },
});
