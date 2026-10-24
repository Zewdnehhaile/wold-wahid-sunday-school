import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { StudentBadgeScreen } from './screens/StudentBadgeScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { RegistrationScreen } from './screens/RegistrationScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'badge' | 'scanner' | 'register' | 'schedule'>('badge');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#060910" />

      {/* Main Content Area */}
      <View style={styles.screenWrapper}>
        {activeTab === 'badge' && <StudentBadgeScreen />}
        {activeTab === 'scanner' && <ScannerScreen />}
        {activeTab === 'register' && <RegistrationScreen />}
        {activeTab === 'schedule' && <ScheduleScreen />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('badge')}
        >
          <Text style={[styles.tabIcon, activeTab === 'badge' && styles.tabActive]}>🪪</Text>
          <Text style={[styles.tabLabel, activeTab === 'badge' && styles.tabLabelActive]}>
            መታወቂያ (Pass)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('scanner')}
        >
          <Text style={[styles.tabIcon, activeTab === 'scanner' && styles.tabActive]}>📷</Text>
          <Text style={[styles.tabLabel, activeTab === 'scanner' && styles.tabLabelActive]}>
            ስካነር (Scan)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('register')}
        >
          <Text style={[styles.tabIcon, activeTab === 'register' && styles.tabActive]}>📝</Text>
          <Text style={[styles.tabLabel, activeTab === 'register' && styles.tabLabelActive]}>
            ምዝገባ (Join)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={[styles.tabIcon, activeTab === 'schedule' && styles.tabActive]}>📅</Text>
          <Text style={[styles.tabLabel, activeTab === 'schedule' && styles.tabLabelActive]}>
            መርሐ-ግብር
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  screenWrapper: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 6,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabIcon: { fontSize: 20, marginBottom: 2, opacity: 0.6 },
  tabActive: { opacity: 1, transform: [{ scale: 1.1 }] },
  tabLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  tabLabelActive: { color: '#f59e0b', fontWeight: 'bold' },
});
