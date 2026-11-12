import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Send, MessageSquare, Plus, ChevronRight, AlertCircle } from 'lucide-react-native';
import { getSupportTickets, submitSupportTicket } from '../services/api';

interface Props {
  studentCode: string;
}

export const SupportScreen: React.FC<Props> = ({ studentCode }) => {
  const [activeView, setActiveTab] = useState<'tickets' | 'new'>('tickets');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);

  const fetchTickets = async () => {
    setFetching(true);
    const data = await getSupportTickets(studentCode);
    setTickets(data);
    setFetching(false);
  };

  useEffect(() => {
    fetchTickets();
  }, [studentCode]);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      const ticketNumber = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
      await submitSupportTicket({
        ticketNumber,
        memberCode: studentCode,
        category,
        description: message.trim(),
        title: category === 'prayer' ? 'የጸሎት ጥያቄ' : 'የድጋፍ ጥያቄ',
      });
      
      Alert.alert('ተልኳል', 'የድጋፍ ጥያቄዎ በተሳካ ሁኔታ ተልኳል! (Support request sent)');
      setMessage('');
      setActiveTab('tickets');
      fetchTickets();
    } catch (e) {
      Alert.alert('ስህተት', 'መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabHeader}>
        <TouchableOpacity
          style={[styles.tab, activeView === 'tickets' && styles.activeTab]}
          onPress={() => setActiveTab('tickets')}
        >
          <Text style={[styles.tabText, activeView === 'tickets' && styles.activeTabText]}>
            ጥያቄዎቼ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeView === 'new' && styles.activeTab]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeView === 'new' && styles.activeTabText]}>
            አዲስ ጥያቄ
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={fetching} onRefresh={fetchTickets} tintColor="#f59e0b" />
        }
      >
        {activeView === 'tickets' ? (
          <View style={styles.ticketsList}>
            {tickets.length === 0 && !fetching ? (
              <View style={styles.emptyState}>
                <AlertCircle size={40} color="#334155" />
                <Text style={styles.emptyText}>እስካሁን የላኩት ጥያቄ የለም።</Text>
              </View>
            ) : (
              tickets.map((ticket) => (
                <View key={ticket.id} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{ticket.category}</Text>
                    </View>
                    <Text style={styles.ticketDate}>
                      {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  <Text style={styles.ticketTitle}>{ticket.title || 'የድጋፍ ጥያቄ'}</Text>
                  <Text style={styles.ticketDesc} numberOfLines={2}>
                    {ticket.description}
                  </Text>
                  <View style={styles.ticketFooter}>
                    <View style={[styles.statusPill, ticket.status === 'resolved' ? styles.statusResolved : styles.statusPending]}>
                      <Text style={styles.statusText}>
                        {ticket.status === 'new' ? 'አዲስ' : ticket.status === 'resolved' ? 'ተፈትቷል' : 'በሂደት ላይ'}
                      </Text>
                    </View>
                    <View style={styles.repliesCount}>
                      <MessageSquare size={14} color="#94a3b8" />
                      <Text style={styles.repliesText}>
                        {ticket.notes?.length || 0} መልስ
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.newForm}>
            <Text style={styles.label}>የድጋፍ ዘርፍ ይምረጡ</Text>
            <View style={styles.categories}>
              {['general', 'prayer', 'welfare', 'technical'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, category === cat && styles.activeCatBtn]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catBtnText, category === cat && styles.activeCatBtnText]}>
                    {cat === 'general' ? 'አጠቃላይ' : cat === 'prayer' ? 'የጸሎት' : cat === 'welfare' ? 'ድጋፍ' : 'ቴክኒክ'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>መልእክትዎ</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              placeholder="ጥያቄዎን ወይም አስተያየትዎን እዚህ ይጻፉ..."
              placeholderTextColor="#64748b"
              value={message}
              onChangeText={setMessage}
            />

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>ላክ (Submit)</Text>
                  <Send size={18} color="#fff" style={styles.btnIcon} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060910' },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeTabText: {
    color: '#f59e0b',
  },
  content: { padding: 16 },
  ticketsList: { gap: 12 },
  ticketCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  categoryText: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold' },
  ticketDate: { color: '#64748b', fontSize: 11 },
  ticketTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  ticketDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  statusPill: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { color: '#34d399', fontSize: 11, fontWeight: 'bold' },
  statusResolved: { backgroundColor: '#064e3b' },
  statusPending: { backgroundColor: '#1e293b' },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { color: '#64748b', fontSize: 14, fontWeight: '500' },
  repliesCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repliesText: { color: '#94a3b8', fontSize: 11 },
  newForm: { gap: 16 },
  label: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activeCatBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#f59e0b',
  },
  catBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  activeCatBtnText: { color: '#f59e0b' },
  textArea: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#f59e0b',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledBtn: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnIcon: { marginLeft: 10 },
});
