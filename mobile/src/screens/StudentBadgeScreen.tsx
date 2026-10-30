import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getStudentProfile, MobileStudent } from '../services/api';
import { RefreshCcw, Church } from 'lucide-react-native';

interface Props {
  studentCode: string;
}

export const StudentBadgeScreen: React.FC<Props> = ({ studentCode }) => {
  const [lang, setLang] = useState<'am' | 'en'>('am');
  const [student, setStudent] = useState<MobileStudent | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    const data = await getStudentProfile(studentCode);
    setStudent(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [studentCode]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text style={styles.loadingText}>መረጃ በመጫን ላይ...</Text>
      </View>
    );
  }

  if (!student) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>መረጃውን ማግኘት አልተቻለም።</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchProfile}>
          <RefreshCcw size={20} color="#fff" />
          <Text style={styles.refreshText}>እንደገና ይሞክሩ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLogo}>
          <Church size={24} color="#f59e0b" />
          <Text style={styles.headerTitle}>ወልድ ዋሕድ</Text>
        </View>
        <TouchableOpacity
          style={styles.langBtn}
          onPress={() => setLang(lang === 'am' ? 'en' : 'am')}
        >
          <Text style={styles.langBtnText}>{lang === 'am' ? 'English' : 'አማርኛ'}</Text>
        </TouchableOpacity>
      </View>

      {/* Official ID Badge Card */}
      <View style={styles.cardContainer}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderBadge}>
            <Text style={styles.cardChurchName}>መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን</Text>
            <Text style={styles.cardSubTitle}>የወልድ ዋሕድ ሰንበት ትምህርት ቤት</Text>
            <Text style={styles.cardEnglishTitle}>Wold Wahid Sunday School Digital Pass</Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Avatar and Name */}
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {student.photoUrl ? (
                <Image source={{ uri: student.photoUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>✝️</Text>
                </View>
              )}
            </View>

            <View style={styles.nameBlock}>
              <Text style={styles.fullNameAm}>{student.fullNameAm || 'ተማሪ'}</Text>
              {student.christianName ? (
                <Text style={styles.christianName}>የክርስትና ስም፦ {student.christianName}</Text>
              ) : null}
              <Text style={styles.fullNameEn}>{student.fullNameEn}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{student.status === 'active' ? 'ACTIVE / ንቁ' : 'ንቁ ተማሪ'}</Text>
              </View>
            </View>
          </View>

          {/* Details Table */}
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{lang === 'am' ? 'የተማሪ መለያ' : 'Student ID'}</Text>
              <Text style={styles.idCode}>{student.code}</Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{lang === 'am' ? 'የትምህርት ክፍል' : 'Department'}</Text>
              <Text style={styles.infoVal}>{student.department}</Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{lang === 'am' ? 'የትምህርት ደረጃ' : 'Grade Level'}</Text>
              <Text style={styles.infoVal}>{student.gradeLevel}</Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{lang === 'am' ? 'ስልክ ቁጥር' : 'Phone Number'}</Text>
              <Text style={styles.infoVal}>{student.phone}</Text>
            </View>
          </View>

          {/* Central Attendance QR Code - Exact registered student QR */}
          <View style={styles.qrSection}>
            <View style={styles.qrBox}>
              <QRCode
                value={(student as any).qrData || student.code || (student as any).studentCode || student.phone || studentCode}
                size={160}
                color="#062414"
                backgroundColor="#ffffff"
              />
            </View>
            <Text style={styles.qrHint}>
              {lang === 'am'
                ? 'ለመገኘት መመዝገቢያ ይህንን ኮድ ለክፍል ኃላፊው ያሳዩ'
                : 'Present this QR code to the usher/teacher for attendance'}
            </Text>
          </View>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerNote}>WWSS · 2026 OFFICIAL DIGITAL BADGE</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#94a3b8', marginTop: 12 },
  errorText: { color: '#ef4444', marginBottom: 16, fontSize: 16 },
  refreshBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#334155', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 8 
  },
  refreshText: { color: '#fff', marginLeft: 8, fontWeight: 'bold' },
  content: { padding: 16, alignItems: 'center' },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#062414',
    padding: 12,
    borderRadius: 12,
  },
  headerLogo: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
  langBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langBtnText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#060910',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  cardHeader: {
    backgroundColor: '#062414',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
  },
  cardHeaderBadge: { alignItems: 'center' },
  cardChurchName: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  cardSubTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginTop: 4 },
  cardEnglishTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
  cardBody: { padding: 20, alignItems: 'center' },
  profileRow: { flexDirection: 'row', width: '100%', alignItems: 'center', marginBottom: 20 },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#f59e0b',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 36 },
  nameBlock: { marginLeft: 16, flex: 1 },
  fullNameAm: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  christianName: { color: '#fbbf24', fontSize: 13, fontWeight: '600', marginTop: 2 },
  fullNameEn: { color: '#94a3b8', fontSize: 14, marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  statusText: { color: '#34d399', fontSize: 10, fontWeight: 'bold' },
  infoGrid: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  infoCol: { marginVertical: 6 },
  infoLabel: { color: '#64748b', fontSize: 11, fontWeight: '500', marginBottom: 2 },
  idCode: { color: '#f59e0b', fontSize: 16, fontWeight: 'bold' },
  infoVal: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  qrSection: { alignItems: 'center', marginVertical: 10 },
  qrBox: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  qrHint: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  cardFooter: {
    backgroundColor: '#062414',
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerNote: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
});
