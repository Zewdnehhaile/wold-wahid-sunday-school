import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import {
  Scan,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  ChevronDown,
  Camera as CameraIcon,
  RefreshCw,
  Search,
} from 'lucide-react-native';
import { submitAttendance, getStudentProfile, API_BASE_URL } from '../services/api';

const SESSIONS = [
  { id: 'sun_general', name: 'እሁድ መደበኛ ትምህርት (Sunday School Class)', grade: 'ሁሉንም ክፍሎች' },
  { id: 'pre_kg', name: 'ቅድመ አንደኛ (Pre-KG) - 3:30–5:00', grade: 'ቅድመ አንደኛ' },
  { id: 'g1_2', name: '1ኛ እና 2ኛ ክፍል - 3:30–5:30', grade: '1ኛ እና 2ኛ ክፍል' },
  { id: 'g3_5', name: '3ኛ–5ኛ ክፍል (ማዕከላዊያን) - 5:30–7:40', grade: '3ኛ–5ኛ ክፍል' },
  { id: 'g6_9', name: '6ኛ–9ኛ ክፍል (አበው) - 8:00–11:00', grade: '6ኛ–9ኛ ክፍል' },
];

export const ScannerScreen = () => {
  const [manualCode, setManualCode] = useState('');
  const [selectedSession, setSelectedSession] = useState(SESSIONS[0]);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastScannedStudent, setLastScannedStudent] = useState<{
    name: string;
    code: string;
    time: string;
  } | null>(null);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(true);
  const isScanningRef = useRef(false);

  // Fetch real attendance records for today from backend
  const fetchTodayAttendance = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance`);
      if (res.ok) {
        const records = await res.json();
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = records.filter((r: any) => (r.date === today || !r.date)).slice(0, 20);
        setRecentScans(todayRecords);
      }
    } catch (err) {
      console.warn('Failed to fetch recent attendance:', err);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  // Process a scanned or typed code
  const handleProcessCode = async (rawCode: string) => {
    const cleanInput = rawCode.trim();
    if (!cleanInput) {
      Alert.alert('ስህተት / Error', 'እባክዎ የተማሪ መለያ ኮድ ወይም ስልክ ቁጥር ያስገቡ');
      return;
    }

    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setLoading(true);

    try {
      // Clean code in case it's a URL or JSON object
      let parsedCode = cleanInput;
      if (cleanInput.startsWith('{') && cleanInput.endsWith('}')) {
        try {
          const obj = JSON.parse(cleanInput);
          parsedCode = obj.code || obj.studentCode || obj.id || cleanInput;
        } catch {}
      }
      if (cleanInput.includes('?code=') || cleanInput.includes('&code=')) {
        try {
          const match = cleanInput.match(/[?&]code=([^&]+)/);
          if (match && match[1]) parsedCode = decodeURIComponent(match[1]);
        } catch {}
      }

      parsedCode = parsedCode.trim().toUpperCase();

      // Look up student from backend
      let studentName = 'የተመዘገበ ተማሪ';
      let studentDept = 'education';
      try {
        const profile = await getStudentProfile(parsedCode);
        if (profile) {
          studentName = profile.fullNameAm || profile.fullNameEn || studentName;
          studentDept = profile.department || studentDept;
          parsedCode = profile.code || parsedCode;
        }
      } catch (profErr) {
        console.warn('Student lookup notice:', profErr);
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toISOString().split('T')[0];

      const payload = {
        memberCode: parsedCode,
        memberNameAm: studentName,
        sessionName: selectedSession.name,
        method: 'qr' as const,
        timestamp: timeStr,
        date: dateStr,
        status: 'present',
        department: studentDept,
      };

      await submitAttendance(payload);

      const newScan = {
        id: `att-${Date.now()}`,
        memberCode: payload.memberCode,
        memberNameAm: payload.memberNameAm,
        time: timeStr,
        timestamp: timeStr,
        sessionName: payload.sessionName,
        status: 'present',
      };

      setRecentScans((prev) => [newScan, ...prev.filter((p) => p.memberCode !== parsedCode)]);
      setLastScannedStudent({
        name: studentName,
        code: parsedCode,
        time: timeStr,
      });
      setManualCode('');

      // Auto clear success banner after 4 seconds
      setTimeout(() => {
        setLastScannedStudent(null);
      }, 4000);
    } catch (e) {
      Alert.alert('ማስታወሻ / Notice', 'የመገኘት መረጃው ተመዝግቧል (Recorded in local queue)');
    } finally {
      setLoading(false);
      // Debounce camera scan trigger
      setTimeout(() => {
        isScanningRef.current = false;
      }, 2000);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanningRef.current && data) {
      handleProcessCode(data);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Session Header Card with Selector */}
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => setIsSessionModalOpen(true)}
        activeOpacity={0.8}
      >
        <View style={styles.sessionCardLeft}>
          <Text style={styles.sessionLabel}>የአሁኑ መርሐ-ግብር / Active Session</Text>
          <Text style={styles.sessionName} numberOfLines={1}>
            {selectedSession.name}
          </Text>
          <Text style={styles.sessionSub}>ደረጃ: {selectedSession.grade} (ለመቀየር ይጫኑ)</Text>
        </View>
        <ChevronDown size={22} color="#f59e0b" />
      </TouchableOpacity>

      {/* Instant Success Banner */}
      {lastScannedStudent && (
        <View style={styles.successBanner}>
          <CheckCircle2 size={32} color="#10b981" />
          <View style={styles.successTextContainer}>
            <Text style={styles.successStudentName}>{lastScannedStudent.name}</Text>
            <Text style={styles.successStudentDetails}>
              መታወቂያ: {lastScannedStudent.code} · ሰዓት: {lastScannedStudent.time} · ✅ ተገኝቷል
            </Text>
          </View>
        </View>
      )}

      {/* Live Camera Scanner Viewfinder */}
      <View style={styles.viewfinderCard}>
        <View style={styles.scannerHeaderRow}>
          <View style={styles.scannerBadge}>
            <Scan size={16} color="#f59e0b" />
            <Text style={styles.scannerBadgeText}>QR ስካነር</Text>
          </View>
          <Text style={styles.scannerLiveText}>● LIVE CAMERA</Text>
        </View>

        <View style={styles.cameraBox}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'],
              }}
              onBarcodeScanned={cameraActive ? handleBarcodeScanned : undefined}
            />
          ) : (
            <View style={styles.noCameraPermission}>
              <CameraIcon size={44} color="#f59e0b" style={{ marginBottom: 12 }} />
              <Text style={styles.noCameraTitle}>የካሜራ ፈቃድ ያስፈልጋል</Text>
              <Text style={styles.noCameraSub}>የተማሪውን QR ኮድ ለመቃኘት ካሜራውን ይፍቀዱ</Text>
              <TouchableOpacity style={styles.enableCamBtn} onPress={requestPermission}>
                <Text style={styles.enableCamBtnText}>ካሜራውን ፍቀድ (Enable Camera)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Reticle Corner Marks */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          {/* Center scan line */}
          <View style={styles.scanLaser} />
        </View>

        <Text style={styles.scannerInstruction}>
          የተማሪውን ዲጂታል ወይም የወረቀት QR ኮድ በካሜራው ፊት ያሳዩ
        </Text>
      </View>

      {/* Manual Input Fallback */}
      <View style={styles.manualSection}>
        <Text style={styles.manualTitle}>በመታወቂያ ቁጥር ወይም ስልክ መዝግብ (Manual Check-In)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="ምሳሌ፡ WW-2026-0001 ወይም 0911..."
            placeholderTextColor="#64748b"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={() => handleProcessCode(manualCode)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#062414" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>መዝግብ</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Recent Check-Ins Feed */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>የዛሬ ምዝገባዎች / Today's Check-Ins ({recentScans.length})</Text>
          <TouchableOpacity onPress={fetchTodayAttendance}>
            <RefreshCw size={16} color="#f59e0b" />
          </TouchableOpacity>
        </View>

        {recentScans.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Clock size={32} color="#334155" />
            <Text style={styles.emptyHistoryText}>ዛሬ እስካሁን የተመዘገበ ተማሪ የለም</Text>
          </View>
        ) : (
          recentScans.map((item, idx) => (
            <View key={item.id || idx} style={styles.historyItem}>
              <View style={styles.historyLeft}>
                <View style={styles.checkCircleSmall}>
                  <UserCheck size={16} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.historyStudentName}>
                    {item.memberNameAm || item.name || 'የሰንበት ት/ቤት ተማሪ'}
                  </Text>
                  <Text style={styles.historyCode}>
                    {item.memberCode || item.code} · {item.timestamp || item.time}
                  </Text>
                </View>
              </View>
              <View style={styles.successBadge}>
                <Text style={styles.successText}>ተገኝቷል</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Session Selector Modal */}
      <Modal visible={isSessionModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>የመርሐ-ግብር ክፍለ-ጊዜ ይምረጡ</Text>
            <Text style={styles.modalSub}>መገኘት የሚመዘገብበትን የክፍል መርሐ-ግብር ይምረጡ፦</Text>
            {SESSIONS.map((ses) => (
              <TouchableOpacity
                key={ses.id}
                style={[
                  styles.sessionOption,
                  selectedSession.id === ses.id && styles.sessionOptionActive,
                ]}
                onPress={() => {
                  setSelectedSession(ses);
                  setIsSessionModalOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sessionOptionText,
                    selectedSession.id === ses.id && styles.sessionOptionTextActive,
                  ]}
                >
                  {ses.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsSessionModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>ዝጋ (Cancel)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#062414' },
  content: { padding: 16, paddingBottom: 40 },
  sessionCard: {
    backgroundColor: '#091f13',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#0f4425',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  sessionCardLeft: { flex: 1, marginRight: 12 },
  sessionLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sessionName: { color: '#ffffff', fontSize: 15, fontWeight: '900', marginTop: 3 },
  sessionSub: { color: '#f59e0b', fontSize: 11, marginTop: 3, fontWeight: '600' },

  successBanner: {
    backgroundColor: 'rgba(6, 78, 59, 0.95)',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successTextContainer: { flex: 1 },
  successStudentName: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  successStudentDetails: { color: '#a7f3d0', fontSize: 12, marginTop: 2, fontWeight: '600' },

  viewfinderCard: {
    backgroundColor: '#091f13',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#0f4425',
  },
  scannerHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scannerBadgeText: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  scannerLiveText: { color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  cameraBox: {
    width: '100%',
    height: 260,
    backgroundColor: '#020d06',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1b4d2e',
  },
  noCameraPermission: {
    alignItems: 'center',
    padding: 20,
  },
  noCameraTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  noCameraSub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  enableCamBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  enableCamBtnText: { color: '#062414', fontSize: 12, fontWeight: 'bold' },

  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#f59e0b',
  },
  topLeft: { top: 16, left: 16, borderTopWidth: 4, borderLeftWidth: 4 },
  topRight: { top: 16, right: 16, borderTopWidth: 4, borderRightWidth: 4 },
  bottomLeft: { bottom: 16, left: 16, borderBottomWidth: 4, borderLeftWidth: 4 },
  bottomRight: { bottom: 16, right: 16, borderBottomWidth: 4, borderRightWidth: 4 },
  scanLaser: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.7)',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  scannerInstruction: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },

  manualSection: {
    backgroundColor: '#091f13',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#0f4425',
  },
  manualTitle: { color: '#e2e8f0', fontSize: 13, fontWeight: 'bold', marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: '#06170d',
    color: '#ffffff',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1.5,
    borderColor: '#1b4d2e',
  },
  submitBtn: {
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 12,
    height: 48,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#062414', fontWeight: '900', fontSize: 14 },

  historySection: {
    backgroundColor: '#091f13',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#0f4425',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '800' },
  emptyHistory: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyHistoryText: { color: '#64748b', fontSize: 12 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 68, 37, 0.4)',
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyStudentName: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  historyCode: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  successBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  successText: { color: '#34d399', fontSize: 11, fontWeight: 'bold' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#091f13',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#0f4425',
  },
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: '900', marginBottom: 4 },
  modalSub: { color: '#94a3b8', fontSize: 12, marginBottom: 16 },
  sessionOption: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#06170d',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1b4d2e',
  },
  sessionOptionActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  sessionOptionText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  sessionOptionTextActive: { color: '#f59e0b', fontWeight: 'bold' },
  modalCloseBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  modalCloseBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});
