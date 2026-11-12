import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { CheckCircle2, XCircle, Clock, Calendar, AlertCircle } from 'lucide-react-native';
import { getAttendanceHistory } from '../services/api';

interface Props {
  studentCode: string;
}

export const AttendanceHistoryScreen: React.FC<Props> = ({ studentCode }) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);

  const fetchHistory = async () => {
    setLoading(true);
    const data = await getAttendanceHistory(studentCode);
    setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [studentCode]);

  const total = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const absent = records.filter(r => r.status === 'absent').length;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{pct}%</Text>
          <Text style={styles.statLabel}>ጠቅላላ ተገኝነት</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{present}</Text>
          <Text style={styles.statLabel}>የተገኙበት ቀን</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{absent}</Text>
          <Text style={styles.statLabel}>የቀሩበት ቀን</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchHistory} tintColor="#f59e0b" />
        }
      >
        <Text style={styles.sectionTitle}>የቅርብ ጊዜ መዝገቦች</Text>
        {records.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <AlertCircle size={40} color="#334155" />
            <Text style={styles.emptyText}>እስካሁን የተመዘገበ የመገኘት ታሪክ የለም።</Text>
          </View>
        ) : (
          records.map((rec) => (
            <View key={rec.id} style={styles.recordCard}>
              <View style={styles.recordIcon}>
                {rec.status === 'present' ? (
                  <CheckCircle2 size={24} color="#34d399" />
                ) : (
                  <XCircle size={24} color="#ef4444" />
                )}
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordSession}>{rec.sessionName || 'የሰንበት ት/ቤት ክፍለ-ጊዜ'}</Text>
                <View style={styles.recordDateRow}>
                  <Calendar size={12} color="#64748b" />
                  <Text style={styles.recordDate}>{rec.date}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, rec.status === 'present' ? styles.presentBadge : styles.absentBadge]}>
                <Text style={[styles.statusText, rec.status === 'present' ? styles.presentText : styles.absentText]}>
                  {rec.status === 'present' ? 'ተገኝተዋል' : 'ቀርተዋል'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#062414',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  statVal: { color: '#f59e0b', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  content: { padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  recordIcon: { marginRight: 12 },
  recordInfo: { flex: 1 },
  recordSession: { color: '#fff', fontSize: 14, fontWeight: '600' },
  recordDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  recordDate: { color: '#64748b', fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  presentBadge: { backgroundColor: 'rgba(52, 211, 153, 0.1)' },
  absentBadge: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  presentText: { color: '#34d399' },
  absentText: { color: '#ef4444' },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { color: '#64748b', fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
