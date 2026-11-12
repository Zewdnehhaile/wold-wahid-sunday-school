import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { submitRegistration } from '../services/api';

export const RegistrationScreen = () => {
  const [fullNameAm, setFullNameAm] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [department, setDepartment] = useState('ትምህርት (Education)');
  const [gradeLevel, setGradeLevel] = useState('ህፃናት (Pre-KG)');
  const [subcity, setSubcity] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fullNameAm.trim() || !phone.trim()) {
      Alert.alert('ስህተት / Required', 'እባክዎ ሙሉ ስም እና ስልክ ቁጥር ያስገቡ');
      return;
    }

    setLoading(true);
    try {
      await submitRegistration({
        fullNameAm,
        fullNameEn: fullNameEn || fullNameAm,
        phone,
        gender,
        department,
        gradeLevel,
        subcity,
        submittedAt: new Date().toISOString(),
        status: 'pending',
      });

      Alert.alert(
        'ተሳክቷል / Submitted',
        'የምዝገባ ጥያቄዎ ለአስተዳዳሪው ተልኳል! ማረጋገጫ ሲያገኝ የተማሪ መታወቂያዎ ይፈጠራል።',
        [{ text: 'እሺ (OK)' }]
      );

      setFullNameAm('');
      setFullNameEn('');
      setPhone('');
      setSubcity('');
    } catch (e) {
      Alert.alert('ስህተት / Error', 'ምዝገባውን ማስገባት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>የአዲስ ተማሪዎች ምዝገባ</Text>
        <Text style={styles.subtitle}>New Sunday School Student Intake Form</Text>

        {/* Full Name Amharic */}
        <View style={styles.field}>
          <Text style={styles.label}>ሙሉ ስም (በአማርኛ) *</Text>
          <TextInput
            style={styles.input}
            placeholder="ምሳሌ፡ ዮሐንስ ተስፋዬ"
            placeholderTextColor="#64748b"
            value={fullNameAm}
            onChangeText={setFullNameAm}
          />
        </View>

        {/* Full Name English */}
        <View style={styles.field}>
          <Text style={styles.label}>Full Name (English)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Yohannes Tesfaye"
            placeholderTextColor="#64748b"
            value={fullNameEn}
            onChangeText={setFullNameEn}
          />
        </View>

        {/* Phone */}
        <View style={styles.field}>
          <Text style={styles.label}>ስልክ ቁጥር (Phone Number) *</Text>
          <TextInput
            style={styles.input}
            placeholder="0911234567"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {/* Gender */}
        <View style={styles.field}>
          <Text style={styles.label}>ጾታ (Gender)</Text>
          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={[styles.choiceBtn, gender === 'male' && styles.choiceBtnActive]}
              onPress={() => setGender('male')}
            >
              <Text style={[styles.choiceText, gender === 'male' && styles.choiceTextActive]}>
                ወንድ (Male)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.choiceBtn, gender === 'female' && styles.choiceBtnActive]}
              onPress={() => setGender('female')}
            >
              <Text style={[styles.choiceText, gender === 'female' && styles.choiceTextActive]}>
                ሴት (Female)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Department */}
        <View style={styles.field}>
          <Text style={styles.label}>የሰንበት ት/ቤት ክፍል (Department)</Text>
          <View style={styles.wrapChoices}>
            {['ትምህርት (Education)', 'መዘምራን (Choir)', 'ኪነ-ጥበብ (Arts)', 'አብነት (Abnet)'].map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[styles.smallPill, department === dept && styles.smallPillActive]}
                onPress={() => setDepartment(dept)}
              >
                <Text style={[styles.smallPillText, department === dept && styles.smallPillTextActive]}>
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subcity */}
        <View style={styles.field}>
          <Text style={styles.label}>ክፍለ ከተማ / የመኖሪያ አድራሻ (Subcity)</Text>
          <TextInput
            style={styles.input}
            placeholder="ምሳሌ፡ ቦሌ / የካ / ቂርቆስ"
            placeholderTextColor="#64748b"
            value={subcity}
            onChangeText={setSubcity}
          />
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitBtnText}>
            {loading ? 'በመመዝገብ ላይ...' : 'ማመልከቻውን አስገባ (Submit Application)'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  content: { padding: 16 },
  card: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#1e293b' },
  title: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginBottom: 16, marginTop: 2 },
  field: { marginBottom: 14 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  choiceBtnActive: { backgroundColor: '#78350f', borderColor: '#f59e0b' },
  choiceText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  choiceTextActive: { color: '#fef3c7', fontWeight: 'bold' },
  wrapChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  smallPillActive: { backgroundColor: '#2563eb', borderColor: '#60a5fa' },
  smallPillText: { color: '#94a3b8', fontSize: 11 },
  smallPillTextActive: { color: '#ffffff', fontWeight: 'bold' },
  submitBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#090d16', fontSize: 14, fontWeight: 'bold' },
});
