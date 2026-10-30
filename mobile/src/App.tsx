import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  UserCircle, 
  Scan, 
  Calendar, 
  LogOut,
  MessageSquare,
  ClipboardList,
  FileText
} from 'lucide-react-native';

import { StudentBadgeScreen } from './screens/StudentBadgeScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SupportScreen } from './screens/SupportScreen';
import { AttendanceHistoryScreen } from './screens/AttendanceHistoryScreen';
import { LeaveRequestScreen } from './screens/LeaveRequestScreen';
import { API_BASE_URL } from './services/api';

type TabType = 'badge' | 'scanner' | 'schedule' | 'support' | 'attendance' | 'leave';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [studentCode, setStudentCode] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'admin'>('student');
  const [activeTab, setActiveTab] = useState<TabType>('badge');
  const [badges, setBadges] = useState({ support: 0, reports: 0 });

  const fetchBadges = useCallback(async (code: string, role: string) => {
    try {
      if (role === 'student') {
        const res = await fetch(`${API_BASE_URL}/api/students/${code}/tickets`);
        if (res.ok) {
          const tickets = await res.json();
          const unread = tickets.filter((t: any) => t.status === 'in_contact' || t.status === 'resolved').length;
          setBadges(prev => ({ ...prev, support: unread }));
        }
      } else if (role === 'admin') {
        const [ticketsRes, regsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/support_tickets`).catch(() => ({ ok: false, json: async () => [] })),
          fetch(`${API_BASE_URL}/api/registrations`).catch(() => ({ ok: false, json: async () => [] }))
        ]);
        
        let count = 0;
        if (ticketsRes.ok) {
          const tickets = await ticketsRes.json();
          count += tickets.filter((t: any) => t.status === 'new').length;
        }
        if (regsRes.ok) {
          const regs = await regsRes.json();
          count += regs.filter((r: any) => r.status === 'pending').length;
        }
        setBadges(prev => ({ ...prev, reports: count, support: count }));
      }
    } catch (err) {
      console.warn('Failed to fetch badges:', err);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const code = await AsyncStorage.getItem('studentCode');
      const role = (await AsyncStorage.getItem('userRole')) as 'student' | 'admin';
      
      if (code) {
        setStudentCode(code);
        setUserRole(role || 'student');
        setIsAuthenticated(true);
        if (role === 'admin') setActiveTab('scanner');
        else setActiveTab('badge');
        
        fetchBadges(code, role || 'student');
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    }
  }, [fetchBadges]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Periodic badge refresh every 2 minutes
  useEffect(() => {
    if (isAuthenticated && studentCode) {
      const interval = setInterval(() => {
        fetchBadges(studentCode, userRole);
      }, 120000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, studentCode, userRole, fetchBadges]);

  const handleLoginSuccess = (code: string, role: 'student' | 'admin') => {
    setStudentCode(code);
    setUserRole(role);
    setIsAuthenticated(true);
    if (role === 'admin') setActiveTab('scanner');
    else setActiveTab('badge');
    fetchBadges(code, role);
  };

  const handleLogout = () => {
    Alert.alert(
      'መውጣት / Log Out',
      'ከመተግበሪያው በእርግጥ መውጣት ይፈልጋሉ?',
      [
        { text: 'ይቅር (Cancel)', style: 'cancel' },
        {
          text: 'ውጣ (Log Out)',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            setIsAuthenticated(false);
            setStudentCode(null);
            setUserRole('student');
            setActiveTab('badge');
            setBadges({ support: 0, reports: 0 });
          },
        },
      ]
    );
  };

  if (isAuthenticated === null) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  // Strict login enforcement - No navigation possible if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#062414" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>ወልድ ዋሕድ</Text>
          <View style={styles.churchPill}>
            <Text style={styles.churchPillText}>ሰንበት ት/ቤት</Text>
          </View>
          <View style={[styles.rolePill, userRole === 'admin' ? styles.rolePillAdmin : styles.rolePillStudent]}>
            <Text style={[styles.rolePillText, userRole === 'admin' ? styles.rolePillTextAdmin : styles.rolePillTextStudent]}>
              {userRole === 'admin' ? 'አስተዳዳሪ' : 'ተማሪ'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={styles.screenWrapper}>
        {activeTab === 'badge' && userRole === 'student' && <StudentBadgeScreen studentCode={studentCode!} />}
        {activeTab === 'scanner' && userRole === 'admin' && <ScannerScreen />}
        {activeTab === 'schedule' && <ScheduleScreen />}
        {activeTab === 'leave' && <LeaveRequestScreen studentCode={studentCode!} />}
        {activeTab === 'support' && <SupportScreen studentCode={studentCode!} />}
        {activeTab === 'attendance' && <AttendanceHistoryScreen studentCode={studentCode!} />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {/* STUDENT NAVIGATION: Badge, Attendance, Schedule, Leave, Support (NO SCANNER) */}
        {userRole === 'student' && (
          <>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'badge' && styles.tabItemActive]}
              onPress={() => setActiveTab('badge')}
            >
              <UserCircle size={20} color={activeTab === 'badge' ? '#f59e0b' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === 'badge' && styles.tabLabelActive]}>
                መታወቂያ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'attendance' && styles.tabItemActive]}
              onPress={() => setActiveTab('attendance')}
            >
              <ClipboardList size={20} color={activeTab === 'attendance' ? '#f59e0b' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === 'attendance' && styles.tabLabelActive]}>
                መገኘት
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'schedule' && styles.tabItemActive]}
              onPress={() => setActiveTab('schedule')}
            >
              <Calendar size={20} color={activeTab === 'schedule' ? '#f59e0b' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>
                መርሐ-ግብር
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'leave' && styles.tabItemActive]}
              onPress={() => setActiveTab('leave')}
            >
              <FileText size={20} color={activeTab === 'leave' ? '#f59e0b' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === 'leave' && styles.tabLabelActive]}>
                ፈቃድ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'support' && styles.tabItemActive]}
              onPress={() => setActiveTab('support')}
            >
              <View>
                <MessageSquare size={20} color={activeTab === 'support' ? '#f59e0b' : '#94a3b8'} />
                {badges.support > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{badges.support}</Text></View>
                )}
              </View>
              <Text style={[styles.tabLabel, activeTab === 'support' && styles.tabLabelActive]}>
                ድጋፍ
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ADMIN NAVIGATION: Scanner, Attendance Reports, Support Desk, Schedule */}
        {userRole === 'admin' && (
          <>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'scanner' && styles.tabItemActive]}
              onPress={() => setActiveTab('scanner')}
            >
              <Scan size={22} color={activeTab === 'scanner' ? '#f59e0b' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === 'scanner' && styles.tabLabelActive]}>
                ስካነር
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'attendance' && styles.tabItemActive]}
              onPress={() => setActiveTab('attendance')}
            >
              <View>
                <ClipboardList size={22} color={activeTab === 'attendance' ? '#f59e0b' : '#94a3b8'} />
                {badges.reports > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{badges.reports}</Text></View>
                )}
              </View>
              <Text style={[styles.tabLabel, activeTab === 'attendance' && styles.tabLabelActive]}>
                ሪፖርት
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'support' && styles.tabItemActive]}
              onPress={() => setActiveTab('support')}
            >
              <View>
                <MessageSquare size={22} color={activeTab === 'support' ? '#f59e0b' : '#94a3b8'} />
                {badges.support > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{badges.support}</Text></View>
                )}
              </View>
              <Text style={[styles.tabLabel, activeTab === 'support' && styles.tabLabelActive]}>
                ድጋፍ
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'schedule' && styles.tabItemActive]}
              onPress={() => setActiveTab('schedule')}
            >
              <Calendar size={22} color={activeTab === 'schedule' ? '#f59e0b' : '#94a3b8'} />
              <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>
                መርሐ-ግብር
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#062414' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 60,
    backgroundColor: '#091f13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f4425',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  churchPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  churchPillText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: 'bold',
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginLeft: 6,
    borderWidth: 1,
  },
  rolePillAdmin: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
  },
  rolePillStudent: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  rolePillTextAdmin: { color: '#f59e0b' },
  rolePillTextStudent: { color: '#34d399' },
  logoutBtn: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  screenWrapper: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    height: 72,
    backgroundColor: '#091f13',
    borderTopWidth: 1.5,
    borderTopColor: '#0f4425',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  tabLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 4 },
  tabLabelActive: { color: '#f59e0b', fontWeight: '900' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#091f13',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
