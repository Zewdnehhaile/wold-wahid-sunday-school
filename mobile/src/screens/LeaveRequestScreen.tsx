import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FileText, Send, Calendar, CheckCircle2, Clock } from 'lucide-react-native';
import { submitLeaveRequest } from '../services/api';

interface Props {
  studentCode: string;
}

export const LeaveRequestScreen: React.FC<Props> = ({ studentCode }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reasonCategory, setReasonCategory] = useState('ትምህርት / ፈተና');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    'ትምህርት / ፈተና (Academic Exam)',
    'የጤና እክል (Illness)',
    'የቤተሰብ / አስቸኳይ ጉዳይ (Family)',
    'የጉዞ / ከከተማ ውጪ (Travel)',
    'ሌላ ምክንያት (Other)',
  ];

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('ማስጠንቀቂያ', 'እባክዎ የቀሪነት ምክንያትዎን በዝርዝር ያስገቡ (Please describe reason)');
      return;
    }

    setLoading(true);
    try {
      await submitLeaveRequest({
        studentCode,
        studentName: studentCode,
        reason: `[${reasonCategory}] ${description.trim()}`,
        date,
        phone,
      });

      setSubmitted(true);
      Alert.alert('ተልኳል!', 'የፈቃድ ጥያቄዎ በተሳካ ሁኔታ ለአስተዳዳሪው ተልኳል።');
    } catch (e: any) {
      Alert.alert('ስህተት', 'የፈቃድ ጥያቄውን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.successCard}>
          <CheckCircle2 size={56} color="#34d399" />
          <Text style={styles.successTitle}>የፈቃድ ጥያቄዎ ተመዝግቧል</Text>
          <Text style={styles.successText}>
            ለቀን {date} የቀረበው የፈቃድ ጥያቄ ለአስተዳዳሪዎች ተልኳል። ሲፈቀድ ማሳወቂያ ይደርስዎታል።
          </Text>
          <TouchableOpacity
            style={styles.newRequestBtn}
            onPress={() => {
              setSubmitted(false);
              setDescription('');
            }}
          >
            <Text style={styles.newRequestText}>አዲስ ጥያቄ አስገባ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <FileText size={28} color="#f59e0b" />
        <View style={styles.headerTitles}>
          <Text style={styles.title}>የፈቃድ መጠየቂያ ፎርም</Text>
          <Text style={styles.subtitle}>Wold Wahid Sunday School Leave Request</Text>
        </View>
      </View>

      <View style={styles.card}>
        {/* Date Field */}
        <Text style={styles.label}>የሚቀሩበት ቀን (Date of Absence)</Text>
        <View style={styles.inputWrapper}>
          <Calendar size={18} color="#94a3b8" />
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#64748b"
          />
        </View>

        {/* Reason Category Pills */}
        <Text style={[styles.label, { marginTop: 16 }]}>የቀሪነት ዓይነት (Reason Type)</Text>
        <View style={styles.catContainer}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catPill,
                reasonCategory === cat.split(' ')[0] && styles.catPillActive,
              ]}
              onPress={() => setReasonCategory(cat.split(' ')[0])}
            >
              <Text
                style={[
                  styles.catText,
                  reasonCategory === cat.split(' ')[0] && styles.catTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Phone */}
        <Text style={[styles.label, { marginTop: 16 }]}>የስልክ ቁጥር (Contact Phone)</Text>
        <TextInput
          style={styles.inputPlain}
          value={phone}
          onChangeText={setPhone}
          placeholder="09... / 07..."
          placeholderTextColor="#64748b"
          keyboardType="phone-pad"
        />

        {/* Explanation */}
        <Text style={[styles.label, { marginTop: 16 }]}>ዝርዝር ማብራሪያ (Detailed Reason)</Text>
        <TextInput
          style={[styles.inputPlain, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="የቀሪነትዎን ምክንያት እዚህ በዝርዝር ይጻፉ..."
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={4}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#062414" />
          ) : (
            <View style={styles.btnInner}>
              <Send size={18} color="#062414" />
              <Text style={styles.submitBtnText}>የፈቃድ ጥያቄውን ላክ (Submit)</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#062414' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    backgroundColor: '#091f13',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0f4425',
  },
  headerTitles: { flex: 1 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: '#091f13',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#0f4425',
  },
  label: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06170d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1b4d2e',
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: { flex: 1, color: '#ffffff', fontSize: 14 },
  inputPlain: {
    backgroundColor: '#06170d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1b4d2e',
    paddingHorizontal: 14,
    height: 48,
    color: '#ffffff',
    fontSize: 14,
  },
  textArea: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  catContainer: { gap: 8 },
  catPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#06170d',
    borderWidth: 1,
    borderColor: '#1b4d2e',
  },
  catPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  catText: { color: '#94a3b8', fontSize: 12 },
  catTextActive: { color: '#f59e0b', fontWeight: 'bold' },
  submitBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { color: '#062414', fontSize: 14, fontWeight: 'bold' },
  successCard: {
    backgroundColor: '#091f13',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0f4425',
    width: '100%',
  },
  successTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  successText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  newRequestBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  newRequestText: { color: '#f59e0b', fontWeight: 'bold', fontSize: 13 },
});
