import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export const StudentBadgeScreen = () => {
  const [lang, setLang] = useState<'am' | 'en'>('am');

  // Active student state (syncable from API / local storage)
  const student = {
    code: 'WW-2026-0101',
    fullNameAm: 'ዮሐንስ ተስፋዬ ገብረመድህን',
    fullNameEn: 'Yohannes Tesfaye Gebremedhin',
    departmentAm: 'ትምህርት ክፍል (Education)',
    departmentEn: 'Education Department',
    gradeAm: '3-5ኛ ክፍል (Grade 3-5)',
    gradeEn: 'Grade 3-5',
    subcity: 'Bole Subcity, Woreda 03',
    emergencyPhone: '+251 91 123 4567',
    registeredYear: '2026 / 2018 ዓ.ም',
    status: 'ACTIVE / ንቁ',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {lang === 'am' ? 'የወልድ ዋሕድ ሰ/ት/ቤት' : 'Wold Wahid Sunday School'}
        </Text>
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
            <Text style={styles.cardChurchName}>ደብረ ምጥማቅ ቅዱስ ዑራኤል ካቴድራል</Text>
            <Text style={styles.cardSubTitle}>የወልድ ዋሕድ ሰንበት ትምህርት ቤት</Text>
            <Text style={styles.cardEnglishTitle}>Wold Wahid Sunday School Digital Pass</Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Avatar and Name */}
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>✝️</Text>
              </View>
            </View>

            <View style={styles.nameBlock}>
              <Text style={styles.fullNameAm}>{student.fullNameAm}</Text>
              <Text style={styles.fullNameEn}>{student.fullNameEn}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{student.status}</Text>
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
              <Text style={styles.infoVal}>
                {lang === 'am' ? student.departmentAm : student.departmentEn}
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{lang === 'am' ? 'የትምህርት ደረጃ' : 'Grade Level'}</Text>
              <Text style={styles.infoVal}>
                {lang === 'am' ? student.gradeAm : student.gradeEn}
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{lang === 'am' ? 'የአደጋ ጊዜ ስልክ' : 'Emergency Contact'}</Text>
              <Text style={styles.infoVal}>{student.emergencyPhone}</Text>
            </View>
          </View>

          {/* Central Attendance QR Code */}
          <View style={styles.qrSection}>
            <View style={styles.qrBox}>
              <QRCode
                value={student.code}
                size={160}
                color="#090d16"
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
          <Text style={styles.footerNote}>WWSS · 2026 OFFICIAL DIGITAL BADGE · ቅዱስ ዑራኤል</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  content: { padding: 16, alignItems: 'center' },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#f59e0b' },
  langBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langBtnText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#d97706',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cardHeader: {
    backgroundColor: '#78350f',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#b45309',
  },
  cardHeaderBadge: { alignItems: 'center' },
  cardChurchName: { color: '#fef3c7', fontSize: 13, fontWeight: 'bold' },
  cardSubTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800', marginTop: 2 },
  cardEnglishTitle: { color: '#cbd5e1', fontSize: 11, marginTop: 2, letterSpacing: 0.5 },
  cardBody: { padding: 18, alignItems: 'center' },
  profileRow: { flexDirection: 'row', width: '100%', alignItems: 'center', marginBottom: 16 },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#f59e0b',
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32 },
  nameBlock: { marginLeft: 14, flex: 1 },
  fullNameAm: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  fullNameEn: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  statusText: { color: '#34d399', fontSize: 10, fontWeight: 'bold' },
  infoGrid: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoCol: { marginVertical: 4 },
  infoLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '500' },
  idCode: { color: '#f59e0b', fontSize: 15, fontWeight: '800', fontFamily: 'monospace' },
  infoVal: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', marginTop: 1 },
  qrSection: { alignItems: 'center', marginVertical: 8 },
  qrBox: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  qrHint: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
  },
  cardFooter: {
    backgroundColor: '#090d16',
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  footerNote: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
});
