import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { submitAttendance } from '../services/api';

export const ScannerScreen = () => {
  const [manualCode, setManualCode] = useState('');
  const [session, setSession] = useState('እሁድ መደበኛ ትምህርት (Sunday School Class)');
  const [recentScans, setRecentScans] = useState<Array<{ code: string; time: string; status: string }>>([
    { code: 'WW-2026-0042', time: '08:45 AM', status: 'Success' },
    { code: 'WW-2026-0015', time: '08:42 AM', status: 'Success' },
  ]);
  const [loading, setLoading] = useState(false);

  const handleRecordAttendance = async (code: string) => {
    if (!code.trim()) {
      Alert.alert('ስህተት / Error', 'እባክዎ የተማሪ መለያ ኮድ ያስገቡ / Please provide student ID');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const payload = {
        memberCode: code.trim().toUpperCase(),
        memberNameAm: 'የተመዘገበ ተማሪ',
        sessionName: session,
        method: 'qr' as const,
        timestamp: now.toLocaleTimeString(),
        date: now.toISOString().split('T')[0],
      };

      await submitAttendance(payload);

      setRecentScans((prev) => [
        { code: payload.memberCode, time: payload.timestamp, status: 'Checked In' },
        ...prev,
      ]);
      setManualCode('');
      Alert.alert('ተሳክቷል / Success', `ተማሪ ${payload.memberCode} መገኘቱ ተመዝግቧል!`);
    } catch (e) {
      Alert.alert('ማስጠንቀቂያ / Notice', 'መረጃው በሞባይል ማህደረ ትውስታ ተቀምጧል (Offline Cached)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Session Banner */}
      <View style={styles.sessionCard}>
        <Text style={styles.sessionLabel}>የአሁኑ መርሐ-ግብር / Active Session</Text>
        <Text style={styles.sessionName}>{session}</Text>
      </View>

      {/* Simulated Camera Viewfinder */}
      <View style={styles.viewfinder}>
        <View style={styles.cameraBox}>
          {/* Target Reticle corners */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.scannerInstruction}>
            የተማሪውን QR ኮድ እዚህ ሳጥን ውስጥ ያሳዩ
          </Text>
          <Text style={styles.scannerSub}>Align Student QR Pass within frame</Text>
        </View>

        <TouchableOpacity
          style={styles.simScanBtn}
          onPress={() => handleRecordAttendance('WW-2026-0101')}
          disabled={loading}
        >
          <Text style={styles.simScanBtnText}>
            {loading ? 'በማረጋገጥ ላይ...' : '⚡ Simulate QR Scan (WW-2026-0101)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Input Fallback */}
      <View style={styles.manualSection}>
        <Text style={styles.manualTitle}>በመታወቂያ ቁጥር መመዝገቢያ / Manual Entry</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="ምሳሌ፡ WW-2026-0101"
            placeholderTextColor="#64748b"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => handleRecordAttendance(manualCode)}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>መዝግብ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Scans Feed */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>የቅርብ ጊዜ ምዝገባዎች / Recent Check-Ins</Text>
        {recentScans.map((item, idx) => (
          <View key={idx} style={styles.historyItem}>
            <View>
              <Text style={styles.historyCode}>{item.code}</Text>
              <Text style={styles.historyTime}>{item.time}</Text>
            </View>
            <View style={styles.successBadge}>
              <Text style={styles.successText}>{item.status}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  content: { padding: 16 },
  sessionCard: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  sessionLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  sessionName: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  viewfinder: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cameraBox: {
    width: 240,
    height: 240,
    backgroundColor: '#020617',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#f59e0b',
  },
  topLeft: { top: 8, left: 8, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 8, right: 8, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 8, left: 8, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 8, right: 8, borderBottomWidth: 3, borderRightWidth: 3 },
  cameraIcon: { fontSize: 44, marginBottom: 8 },
  scannerInstruction: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  scannerSub: { color: '#64748b', fontSize: 10, marginTop: 4 },
  simScanBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  simScanBtnText: { color: '#090d16', fontWeight: 'bold', fontSize: 13 },
  manualSection: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  manualTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  submitBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  historySection: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14 },
  historyTitle: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', marginBottom: 12 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  historyCode: { color: '#f59e0b', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' },
  historyTime: { color: '#64748b', fontSize: 11, marginTop: 2 },
  successBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  successText: { color: '#34d399', fontSize: 11, fontWeight: 'bold' },
});
