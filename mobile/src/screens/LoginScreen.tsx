import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, LogIn, ShieldCheck, Lock, Sparkles, BookOpen } from 'lucide-react-native';
import { getStudentProfile, checkAdminLogin, adminLogin, studentLogin } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (studentCode: string, role: 'student' | 'admin') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminFlow, setIsAdminFlow] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check identifier as user types (Dynamic database check - NO hardcoded phone lists)
  const handleIdentifierChange = async (text: string) => {
    setIdentifier(text);
    const trimmed = text.trim();
    const digits = trimmed.replace(/\D/g, '').slice(-9);

    // If starts with WW- or contains letters, it's definitely a student code
    if (/^[A-Za-z]/.test(trimmed) || trimmed.toUpperCase().startsWith('WW')) {
      setIsAdminFlow(false);
      return;
    }

    // If 9 or more digits, check against Firestore admins collection
    if (digits.length >= 9) {
      try {
        const adminRes = await checkAdminLogin(digits);
        if (adminRes && (adminRes.role === 'admin' || adminRes.role === 'super_admin')) {
          setIsAdminFlow(true);
          return;
        }
      } catch {}
    }

    setIsAdminFlow(false);
  };

  const handleLogin = async () => {
    const trimmedInput = identifier.trim();
    if (!trimmedInput) {
      Alert.alert('ስህተት / Error', 'እባክዎ የተማሪ መለያ ቁጥር ወይም ስልክ ቁጥር ያስገቡ\n(Please enter Student ID or Phone number)');
      return;
    }

    setLoading(true);

      // 1. Identify Admin vs Student (Unified Database Check)
      const digits = trimmedInput.replace(/\D/g, '').slice(-9);
      
      // If we detected it's an admin (either from previous check or now)
      if (isAdminFlow || digits === '988286610') {
        if (!password) {
          setIsAdminFlow(true);
          setLoading(false);
          Alert.alert('የይለፍ ቃል ያስፈልጋል (Password Required)', 'እባክዎ የአስተዳዳሪ የይለፍ ቃል ያስገቡ\n(Please enter your admin password)');
          return;
        }

        try {
          const aRes = await adminLogin(digits, password);
          if (aRes && aRes.success) {
            const adminCode = aRes.admin.code || `admin-${digits}`;
            await AsyncStorage.setItem('studentCode', adminCode);
            await AsyncStorage.setItem('userRole', 'admin');
            onLoginSuccess(adminCode, 'admin');
            return;
          }
        } catch (adminErr: any) {
          Alert.alert('የአስተዳዳሪ ስህተት', adminErr.message || 'የይለፍ ቃል አልተሳካም');
          setLoading(false);
          return;
        }
      }

      // 2. Student Login (Real Database Auth)
      const upperInput = trimmedInput.toUpperCase();
      try {
        const sRes = await studentLogin(trimmedInput);
        if (sRes && sRes.success && sRes.student) {
          const code = sRes.student.code || sRes.student.studentCode || upperInput;
          await AsyncStorage.setItem('studentCode', code);
          await AsyncStorage.setItem('userRole', 'student');
          onLoginSuccess(code, 'student');
          return;
        }
      } catch (e: any) {
        // Only if studentLogin explicitly throws "Not Found", we show that error.
        // Otherwise, it might be a network error where we can retry or use limited local data.
        if (e.message && e.message.includes('አልተገኘም')) {
          Alert.alert('ያልተመዘገበ መለያ (Not Found)', e.message);
          setLoading(false);
          return;
        }
        console.warn('Student login network issue:', e);
      }

      // If we reached here, try one last check with profile API
      try {
        const profile = await getStudentProfile(trimmedInput);
        if (profile && profile.id) {
          await AsyncStorage.setItem('studentCode', profile.code);
          await AsyncStorage.setItem('userRole', 'student');
          onLoginSuccess(profile.code, 'student');
          return;
        }
      } catch {}

      Alert.alert('ስህተት', 'ያስገቡት መለያ በመረጃ ቋቱ ውስጥ አልተገኘም። እባክዎ በትክክል መሆኑን ያረጋግጡ።');
    } catch (error: any) {
      console.error('Final Login Catch:', error);
      Alert.alert('የመግባት ችግር', 'ከመረጃ ቋቱ ጋር መገናኘት አልተቻለም። እባክዎ የኢንተርኔት ግንኙነትዎን ያረጋግጡ።');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Emblem & Branding Header */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <ShieldCheck size={44} color="#f59e0b" />
            </View>
            <Text style={styles.titleAm}>ወልድ ዋሕድ ሰንበት ት/ቤት</Text>
            <Text style={styles.churchName}>መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን</Text>
            <Text style={styles.titleEn}>Wold Wahid Sunday School</Text>
          </View>

          {/* User Guide Pill */}
          <View style={styles.guideBox}>
            <View style={styles.guideRow}>
              <BookOpen size={16} color="#34d399" />
              <Text style={styles.guideText}>
                <Text style={styles.guideHighlight}>ተማሪዎች፦ </Text>
                የተማሪ መለያ ቁጥር (ምሳሌ፡ WW-2026-0001) ወይም ስልክ ቁጥር ብቻ ያስገቡ (የይለፍ ቃል አያስፈልግም)
              </Text>
            </View>
          </View>

          {/* Identifier Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>ስልክ ቁጥር ወይም የተማሪ መለያ (Phone or Student ID)</Text>
            <View style={styles.inputWrapper}>
              <User size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="ምሳሌ፡ WW-2026-0001 ወይም 0911..."
                placeholderTextColor="#64748b"
                value={identifier}
                onChangeText={handleIdentifierChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Admin Password Input (shown only if admin phone detected) */}
          {isAdminFlow && (
            <View style={styles.inputContainer}>
              <View style={styles.adminLabelRow}>
                <Text style={styles.label}>የአስተዳዳሪ የይለፍ ቃል (Admin Password)</Text>
                <View style={styles.adminTag}>
                  <Text style={styles.adminTagText}>አስተዳዳሪ</Text>
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <Lock size={20} color="#f59e0b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="የአስተዳዳሪ የይለፍ ቃል ያስገቡ"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#062414" />
            ) : (
              <View style={styles.btnInner}>
                <Text style={styles.buttonText}>
                  {isAdminFlow ? 'እንደ አስተዳዳሪ ይግቡ (Admin Login)' : 'ይግቡ (Enter App)'}
                </Text>
                <LogIn size={20} color="#062414" />
              </View>
            )}
          </TouchableOpacity>

          {/* Footer Assistance */}
          <View style={styles.footerContainer}>
            <Text style={styles.footer}>
              እስካሁን ያልተመዘገቡ ተማሪዎች በቴሌግራም ቦት (@attendanceforchurchbot) በኩል መመዝገብ ይችላሉ።
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#062414',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#091f13',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#0f4425',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  titleAm: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  churchName: {
    fontSize: 12,
    color: '#fbbf24',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  titleEn: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 2,
  },
  guideBox: {
    backgroundColor: 'rgba(6, 36, 20, 0.8)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  guideText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 18,
  },
  guideHighlight: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 18,
  },
  adminLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  adminTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  adminTagText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06170d',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1b4d2e',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#062414',
    fontSize: 15,
    fontWeight: '900',
  },
  footerContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#0f4425',
  },
  footer: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
