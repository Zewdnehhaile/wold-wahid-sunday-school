import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export const ScheduleScreen = () => {
  const scheduleDays = [
    {
      dayAm: 'አርብ (Friday)',
      time: '11:30 - 01:00',
      activity: 'የአብነት እና የዜማ ትምህርት (Abnet & Chant Training)',
      location: 'ምስካበ ቅዱሳን አዳራሽ / Main Hall',
      dept: 'አብነት ክፍል',
    },
    {
      dayAm: 'ቅዳሜ (Saturday)',
      time: '09:00 - 11:30',
      activity: 'የመዘምራን ልምምድ እና ስነ-ጽሑፍ (Choir Practice & Literature)',
      location: 'ካቴድራል መድረክ / Choir Stage',
      dept: 'መዘምራን ክፍል',
    },
    {
      dayAm: 'እሁድ (Sunday)',
      time: '01:30 - 04:30',
      activity: 'ጠቅላላ የሰንበት ት/ቤት ትምህርት እና መርሐ-ግብር (General Class)',
      location: 'ሁሉም ክፍሎች / All Grade Rooms',
      dept: 'ትምህርት ክፍል',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>የሰንበት ትምህርት ቤት ሳምንታዊ መርሐ-ግብር</Text>
      <Text style={styles.sub}>Weekly Program & Timetable</Text>

      {scheduleDays.map((item, idx) => (
        <View key={idx} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.day}>{item.dayAm}</Text>
            <View style={styles.timeBadge}>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          </View>
          <Text style={styles.activity}>{item.activity}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>📍 {item.location}</Text>
            <Text style={styles.meta}>⛪ {item.dept}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  content: { padding: 16 },
  heading: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  sub: { color: '#94a3b8', fontSize: 12, marginBottom: 16 },
  card: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  day: { color: '#f59e0b', fontSize: 15, fontWeight: 'bold' },
  timeBadge: { backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timeText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  activity: { color: '#f8fafc', fontSize: 13, fontWeight: '600', marginVertical: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meta: { color: '#64748b', fontSize: 11 },
});
