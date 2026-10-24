import React, { useState } from 'react';
import { SupportTicket, SupportCategory, SupportStatus, Priority, Member, Language, LeaveRequest, AttendanceRecord } from '../types';
import { t } from '../utils/translations';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
import {
  HeartHandshake,
  AlertTriangle,
  Lock,
  Plus,
  MessageSquare,
  User,
  Phone,
  Clock,
  CheckCircle2,
  Filter,
  X,
  Send,
  CalendarX,
  FileText,
  Check,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Trash2,
  Search,
  Edit2,
} from 'lucide-react';

interface SupportDeskProps {
  tickets: SupportTicket[];
  leaveRequests: LeaveRequest[];
  members: Member[];
  attendance: AttendanceRecord[];
  onAddTicket: (ticket: SupportTicket) => void;
  onUpdateTicketStatus: (ticketId: string, status: SupportStatus) => void;
  onDeleteTicket: (ticketId: string) => void;
  onDeleteLeaveRequest: (requestId: string) => void;
  onUpdateLeaveRequestStatus?: (requestId: string, status: 'approved' | 'rejected', reason: string) => void;
  onAddNote: (ticketId: string, author: string, text: string) => void;
  onUpdateAttendance?: (id: string, updated: Partial<AttendanceRecord>) => void;
  lang: Language;
}

export const SupportDesk: React.FC<SupportDeskProps> = ({
  tickets,
  leaveRequests,
  members,
  attendance,
  onAddTicket,
  onUpdateTicketStatus,
  onDeleteTicket,
  onDeleteLeaveRequest,
  onUpdateLeaveRequestStatus,
  onAddNote,
  onUpdateAttendance,
  lang,
}) => {
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeView, setActiveView] = useState<'tickets' | 'absence' | 'leaves'>('tickets');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [searchAbsenceQuery, setSearchAbsenceQuery] = useState('');

  // Leave action state
  const [selectedLeaveForAction, setSelectedLeaveForAction] = useState<LeaveRequest | null>(null);
  const [leaveActionType, setLeaveActionType] = useState<'approved' | 'rejected'>('approved');
  const [leaveActionReason, setLeaveActionReason] = useState('');

  // Editing Absence Note state
  const [editingAbsenceRecord, setEditingAbsenceRecord] = useState<AttendanceRecord | null>(null);
  const [absenceNoteText, setAbsenceNoteText] = useState('');

  // Form states
  const [requesterName, setRequesterName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<SupportCategory>('prayer');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isConfidential, setIsConfidential] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const dict = t[lang];

  // Absent Records list (attendance logs with status === 'absent' or 'excused')
  const absentRecords = attendance.filter((a) => {
    const isAbsent = a.status === 'absent' || a.status === 'excused';
    const cleanSearch = searchAbsenceQuery.trim().toLowerCase();
    if (!cleanSearch) return isAbsent;
    return (
      isAbsent &&
      (a.memberNameAm.toLowerCase().includes(cleanSearch) ||
        a.memberCode.toLowerCase().includes(cleanSearch) ||
        (a.sessionName && a.sessionName.toLowerCase().includes(cleanSearch)))
    );
  });

  // Filtered tickets
  const filteredTickets = tickets.filter((ticket) => {
    const matchesCategory = selectedCategory === 'all' || ticket.category === selectedCategory;
    let matchesStatus = true;
    if (selectedStatusTab === 'new') matchesStatus = ticket.status === 'new';
    else if (selectedStatusTab === 'in_progress') matchesStatus = ticket.status === 'assigned' || ticket.status === 'in_contact';
    else if (selectedStatusTab === 'resolved') matchesStatus = ticket.status === 'resolved';
    return matchesCategory && matchesStatus;
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !requesterName.trim()) return;

    const newTicket: SupportTicket = {
      id: `spt-${Date.now()}`,
      ticketNumber: `WW-SPT-${Math.floor(1000 + Math.random() * 9000)}`,
      requesterName: requesterName.trim(),
      phone: phone.trim() || '+251 91 000 0000',
      category,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: 'new',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      isConfidential,
      notes: [],
    };

    onAddTicket(newTicket);
    setIsNewModalOpen(false);

    // Reset
    setTitle('');
    setDescription('');
    setRequesterName('');
    setPhone('');
    setIsConfidential(false);
  };

  const handleDeleteTicketDirect = (ticketId: string) => {
    onDeleteTicket(ticketId);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(null);
    }
    setActionNotice({
      message: 'የድጋፍ ጥያቄው በተሳካ ሁኔታ ተሰርዟል! (Ticket deleted successfully)',
      type: 'success',
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteText.trim()) return;

    const noteContent = newNoteText.trim();
    onAddNote(selectedTicket.id, 'አስተባባሪ (Pastoral Team)', noteContent);
    setSelectedTicket((prev) =>
      prev
        ? {
            ...prev,
            notes: [
              ...prev.notes,
              {
                id: `n-${Date.now()}`,
                author: 'አስተባባሪ (Pastoral Team)',
                text: noteContent,
                date: new Date().toISOString().replace('T', ' ').slice(0, 16),
              },
            ],
          }
        : null
    );
    setNewNoteText('');
    setActionNotice({
      message: `ምላሹ ለጠያቂው (${selectedTicket.requesterName}) በቀጥታ ተልኳል! (Direct reply sent to requester)`,
      type: 'success',
    });
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleStatusChange = (newStatus: SupportStatus) => {
    if (!selectedTicket) return;
    onUpdateTicketStatus(selectedTicket.id, newStatus);
    setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  const handleSaveAbsenceNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAbsenceRecord || !onUpdateAttendance) return;
    onUpdateAttendance(editingAbsenceRecord.id, {
      note: absenceNoteText.trim(),
    });
    setEditingAbsenceRecord(null);
    setAbsenceNoteText('');
  };

  const handleQuickStatusUpdate = (recordId: string, status: 'present' | 'absent' | 'excused') => {
    if (onUpdateAttendance) {
      onUpdateAttendance(recordId, { status });
    }
  };

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" /> የተጠናቀቀ (Fixed)
          </span>
        );
      case 'in_contact':
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> በሂደት ላይ (In Progress)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            ● አዲስ ጥያቄ (New)
          </span>
        );
    }
  };

  const getCategoryLabel = (cat: SupportCategory) => {
    switch (cat) {
      case 'prayer': return '🙏 የጸሎት ጥያቄ (Prayer)';
      case 'visitation': return '🏡 የቤት ጉብኝት (Visitation)';
      case 'counseling': return '💬 መንፈሳዊ ምክር (Counseling)';
      case 'welfare': return '🤝 ድጋፍና እርዳታ (Welfare)';
      default: return '❓ አጠቃላይ (General)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Explicit Header Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{dict.support.title}</span>
          </h2>
          <p className="text-sm text-emerald-200/70 mt-1">
            የተማሪዎችና የአባላት የጸሎት፣ የፈቃድ፣ የጉብኝት እና የመገኘት ክትትል ሰሌዳ
          </p>
        </div>

        {/* New Ticket Button */}
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{dict.support.newTicket}</span>
        </button>
      </div>

      {/* Clear Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#0f4425] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveView('tickets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeView === 'tickets'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-[#09351c] text-emerald-200 hover:text-white border border-[#0f4425]'
          }`}
        >
          <HeartHandshake className="w-4 h-4 text-amber-400" />
          <span>💬 የድጋፍ ጥያቄዎች ({tickets.length})</span>
        </button>

        <button
          onClick={() => setActiveView('leaves')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeView === 'leaves'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-[#09351c] text-emerald-200 hover:text-white border border-[#0f4425]'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-400" />
          <span>✉️ የፈቃድ ጥያቄዎች ({leaveRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveView('absence')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeView === 'absence'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-[#09351c] text-emerald-200 hover:text-white border border-[#0f4425]'
          }`}
        >
          <CalendarX className="w-4 h-4 text-rose-400" />
          <span>⚠️ የቀሩ ተማሪዎች ክትትል (Absence Alerts)</span>
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-emerald-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary View: Smart Interactive List */}
      {activeView === 'tickets' && (
        <div className="space-y-4">
          {/* Status Filter Tabs & Category Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#09351c] p-2.5 rounded-2xl border border-[#0f4425]">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all' as const, label: 'ሁሉም ጥያቄዎች', count: tickets.length },
                { id: 'new' as const, label: 'አዲስ', count: tickets.filter((t) => t.status === 'new').length },
                { id: 'in_progress' as const, label: 'በሂደት ላይ', count: tickets.filter((t) => t.status === 'assigned' || t.status === 'in_contact').length },
                { id: 'resolved' as const, label: 'የተጠናቀቁ (Fixed)', count: tickets.filter((t) => t.status === 'resolved').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatusTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedStatusTab === tab.id
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-emerald-200/80 hover:text-white bg-[#062414] border border-[#0f4425]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1.5 opacity-75 font-mono">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#062414] border border-[#0f4425] text-amber-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-400 font-medium"
            >
              <option value="all">ሁሉም ዘርፎች (All Categories)</option>
              <option value="prayer">የጸሎት ጥያቄ (Prayer)</option>
              <option value="visitation">የቤት ጉብኝት (Visitation)</option>
              <option value="counseling">መንፈሳዊ ምክር (Counseling)</option>
              <option value="welfare">ድጋፍና እርዳታ (Welfare)</option>
              <option value="general">አጠቃላይ (General)</option>
            </select>
          </div>

          {/* Smart Ticket Cards Board */}
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center bg-[#09351c] rounded-2xl border border-[#0f4425] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#062414] border border-[#0f4425] text-amber-400 flex items-center justify-center mx-auto">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <p className="text-sm text-emerald-200/80 font-medium">
                በዚህ ክፍል ውስጥ ምንም አይነት የድጋፍ ጥያቄ አልተገኘም።
              </p>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>አዲስ ጥያቄ መዝግብ</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="group p-4 rounded-2xl bg-[#09351c] border border-[#0f4425] hover:border-amber-500/60 transition-all cursor-pointer shadow-lg space-y-3 flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top: ID, Status and Delete Button */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#0f4425]">
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {ticket.ticketNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(ticket.status)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTicketDirect(ticket.id);
                          }}
                          className="p-1 rounded-lg text-emerald-200/60 hover:text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                          title="ጥያቄውን ሰርዝ (Delete)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Title & Description */}
                    <div className="mt-2.5">
                      <span className="text-[11px] font-semibold text-emerald-300 block mb-0.5">
                        {getCategoryLabel(ticket.category)}
                      </span>
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {ticket.title}
                      </h4>
                      <p className="text-xs text-emerald-200/70 mt-1 line-clamp-2">
                        {ticket.description || 'ዝርዝር መግለጫ የለውም'}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom: Requester and Notes count */}
                  <div className="pt-2 border-t border-[#0f4425] flex items-center justify-between text-[11px] text-emerald-200/70">
                    <span className="font-medium text-white flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>{ticket.requesterName}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {ticket.notes && ticket.notes.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-300 font-mono text-[10px]">
                          <MessageSquare className="w-3 h-3" />
                          <span>{ticket.notes.length}</span>
                        </span>
                      )}
                      <span className="text-[10px] text-emerald-200/50 font-mono">
                        {ticket.createdAt.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Absence Monitoring & Management Panel */}
      {activeView === 'absence' && (
        <div className="bg-[#09351c] rounded-2xl border border-[#0f4425] p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#0f4425]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarX className="w-4 h-4 text-rose-400" />
              <span>የቀሩ ተማሪዎች የክትትል ሰሌዳ ({absentRecords.length})</span>
            </h3>

            {/* Search Bar for Absent Students */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchAbsenceQuery}
                onChange={(e) => setSearchAbsenceQuery(e.target.value)}
                placeholder="በስም፣ በመታወቂያ ወይም ክፍለ-ጊዜ ይፈልጉ..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400 font-medium"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {absentRecords.length === 0 ? (
              <p className="text-xs text-emerald-200/60 py-8 text-center">
                ምንም የቀረ ተማሪ መዝገብ አልተገኘም።
              </p>
            ) : (
              absentRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425] hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{rec.memberNameAm}</h4>
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-[#09351c] px-2 py-0.5 rounded border border-[#0f4425]">
                        {rec.memberCode}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-200/70">
                      <span>📅 🇪🇹 {formatEthiopianDate(rec.date)} ({rec.date})</span>
                      <span>·</span>
                      <span>📖 {rec.sessionName}</span>
                    </div>

                    {/* Note if present */}
                    {rec.note && (
                      <div className="mt-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                        📝 <strong>ማስታወሻ:</strong> {rec.note}
                      </div>
                    )}
                  </div>

                  {/* Actions: Update Status & Add Note */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Note Button */}
                    <button
                      onClick={() => {
                        setEditingAbsenceRecord(rec);
                        setAbsenceNoteText(rec.note || '');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#09351c] hover:bg-emerald-900 text-amber-300 border border-[#0f4425] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{rec.note ? 'ማስታወሻ አርትዕ' : 'ማስታወሻ ጨምር'}</span>
                    </button>

                    {/* Status Toggle Buttons */}
                    <div className="flex items-center gap-1 bg-[#09351c] p-1 rounded-lg border border-[#0f4425]">
                      <button
                        onClick={() => handleQuickStatusUpdate(rec.id, 'present')}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          rec.status === 'present'
                            ? 'bg-emerald-500 text-slate-950 font-extrabold'
                            : 'text-emerald-400 hover:text-white'
                        }`}
                        title="ተገኝቷል"
                      >
                        🟢 ተገኝቷል
                      </button>
                      <button
                        onClick={() => handleQuickStatusUpdate(rec.id, 'excused')}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          rec.status === 'excused'
                            ? 'bg-amber-500 text-slate-950 font-extrabold'
                            : 'text-amber-300 hover:text-white'
                        }`}
                        title="በፈቃድ"
                      >
                        🟡 ፈቃድ
                      </button>
                      <button
                        onClick={() => handleQuickStatusUpdate(rec.id, 'absent')}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          rec.status === 'absent'
                            ? 'bg-rose-500 text-white font-extrabold'
                            : 'text-rose-400 hover:text-white'
                        }`}
                        title="ቀርቷል"
                      >
                        🔴 ቀርቷል
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Real-time Leaves View */}
      {activeView === 'leaves' && (
        <div className="bg-[#09351c] rounded-2xl border border-[#0f4425] p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#0f4425]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>የተማሪዎች የፈቃድ መጠየቂያዎች ({leaveRequests.length})</span>
            </h3>
          </div>
          {leaveRequests.length === 0 ? (
            <p className="text-xs text-emerald-200/60 py-8 text-center">እስካሁን የቀረበ የፈቃድ ጥያቄ የለም።</p>
          ) : (
            <div className="space-y-2.5">
              {leaveRequests.map((l) => (
                <div key={l.id} className="p-3.5 bg-[#062414] rounded-xl border border-[#0f4425] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{l.studentName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {l.leaveType}
                      </span>
                      {l.status === 'approved' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ✓ ጸድቋል (Approved)
                        </span>
                      )}
                      {l.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          ✕ አልተቀበለም (Rejected)
                        </span>
                      )}
                      {l.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          ● በመጠባበቅ ላይ (Pending)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-emerald-200/80">
                      ⏱️ <strong>ጊዜ:</strong> {l.duration}
                    </div>
                    {l.reason && (
                      <p className="text-[11px] text-slate-300 italic">
                        <strong>ምክንያት/አስተያየት:</strong> "{l.reason}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeaveForAction(l);
                        setLeaveActionType('approved');
                        setLeaveActionReason(l.reason || 'ፈቃድዎ ጸድቋል');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow"
                      title="አጽድቅ (Approve)"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>አጽድቅ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLeaveForAction(l);
                        setLeaveActionType('rejected');
                        setLeaveActionReason(l.reason || 'የተጠየቀው ፈቃድ አልተፈቀደም');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow"
                      title="አለመቀበል (Reject)"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>አለመቀበል</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onDeleteLeaveRequest(l.id);
                        setActionNotice({
                          message: 'የፈቃድ ጥያቄው ተሰርዟል! (Leave request deleted)',
                          type: 'success',
                        });
                        setTimeout(() => setActionNotice(null), 3000);
                      }}
                      className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer shrink-0"
                      title="ሰርዝ (Delete)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leave Action Modal (Approve/Reject with Reason) */}
      {selectedLeaveForAction && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-xs">
            <button
              onClick={() => setSelectedLeaveForAction(null)}
              className="absolute top-4 right-4 text-emerald-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white mb-1">
              {leaveActionType === 'approved' ? '✅ የፈቃድ ጥያቄ ማጽደቂያ' : '❌ የፈቃድ ጥያቄ አለመቀበያ'}
            </h3>
            <p className="text-xs text-amber-300 font-mono mb-4">
              ተማሪ: {selectedLeaveForAction.studentName} ({selectedLeaveForAction.leaveType})
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateLeaveRequestStatus) {
                  onUpdateLeaveRequestStatus(selectedLeaveForAction.id, leaveActionType, leaveActionReason.trim());
                }
                setSelectedLeaveForAction(null);
                setActionNotice({
                  message: leaveActionType === 'approved' ? 'የፈቃድ ጥያቄው ጸድቆ ለተማሪው ተልኳል!' : 'የፈቃድ ጥያቄው ውድቅ ሆኖ ለተማሪው ተልኳል!',
                  type: 'success',
                });
                setTimeout(() => setActionNotice(null), 4000);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-emerald-200/80 font-semibold mb-1">
                  ምክንያት ወይም አስተያየት ለተማሪው (Reason / Comment) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={leaveActionReason}
                  onChange={(e) => setLeaveActionReason(e.target.value)}
                  placeholder="ምሳሌ: ፈቃድዎ በሰንበት ት/ቤት ተፈቅዷል..."
                  className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0f4425]">
                <button
                  type="button"
                  onClick={() => setSelectedLeaveForAction(null)}
                  className="px-3 py-1.5 text-emerald-200/70 hover:text-white"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold rounded-xl shadow cursor-pointer text-slate-950 ${
                    leaveActionType === 'approved' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {leaveActionType === 'approved' ? 'አጽድቅና ላክ (Approve)' : 'ውድቅ አድርግና ላክ (Reject)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Absence Note Modal */}
      {editingAbsenceRecord && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setEditingAbsenceRecord(null)}
              className="absolute top-4 right-4 text-emerald-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white mb-1">
              የቀረበት ምክንያት / ማስታወሻ ይጻፉ
            </h3>
            <p className="text-xs text-amber-300 font-mono mb-4">
              {editingAbsenceRecord.memberNameAm} ({editingAbsenceRecord.memberCode})
            </p>

            <form onSubmit={handleSaveAbsenceNote} className="space-y-4 text-xs">
              <div>
                <label className="block text-emerald-200/80 font-semibold mb-1">
                  የክትትል ማስታወሻ (Absence Note / Reason)
                </label>
                <textarea
                  rows={3}
                  value={absenceNoteText}
                  onChange={(e) => setAbsenceNoteText(e.target.value)}
                  placeholder="ምሳሌ: ወላጅ ደውለው የሕመም ፈቃድ ጠይቀዋል..."
                  className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0f4425]">
                <button
                  type="button"
                  onClick={() => setEditingAbsenceRecord(null)}
                  className="px-3 py-1.5 text-emerald-200/70 hover:text-white"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow cursor-pointer"
                >
                  ማስታወሻ መዝግብ (Save Note)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simple, Smart Pop-Up Modal when a ticket is clicked */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 bg-[#062414] border-b border-[#0f4425] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400">
                  {selectedTicket.ticketNumber}
                </span>
                <span className="text-xs text-emerald-400">·</span>
                {getStatusBadge(selectedTicket.status)}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteTicketDirect(selectedTicket.id)}
                className="p-1 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/60 transition-colors mr-2 cursor-pointer"
                title="ጥያቄውን ሰርዝ (Delete)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-[#09351c]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-amber-300">
                  {getCategoryLabel(selectedTicket.category)}
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {selectedTicket.title}
                </h3>
              </div>

              {/* Message Content */}
              <div className="p-3.5 bg-[#062414] rounded-2xl border border-[#0f4425] space-y-3">
                <p className="text-slate-100 leading-relaxed text-xs">
                  {selectedTicket.description}
                </p>
                <div className="pt-2 border-t border-[#0f4425] flex items-center justify-between text-emerald-200/80">
                  <span className="flex items-center gap-1 font-semibold text-white">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedTicket.requesterName}</span>
                  </span>
                  <a
                    href={`tel:${selectedTicket.phone}`}
                    className="font-mono text-amber-400 flex items-center gap-1 hover:underline"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{selectedTicket.phone}</span>
                  </a>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div>
                <label className="block text-emerald-200/80 font-semibold mb-2">
                  ወቅታዊ ሁኔታን ቀይር (Update Status)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusChange('new')}
                    className={`py-2 px-2.5 rounded-xl font-bold border transition-all ${
                      selectedTicket.status === 'new'
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-[#062414] text-sky-300 border-[#0f4425]'
                    }`}
                  >
                    ● አዲስ (New)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('in_contact')}
                    className={`py-2 px-2.5 rounded-xl font-bold border transition-all ${
                      selectedTicket.status === 'in_contact' || selectedTicket.status === 'assigned'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-[#062414] text-amber-300 border-[#0f4425]'
                    }`}
                  >
                    ● በሂደት ላይ
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange('resolved')}
                    className={`py-2 px-2.5 rounded-xl font-bold border transition-all ${
                      selectedTicket.status === 'resolved'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-[#062414] text-emerald-300 border-[#0f4425]'
                    }`}
                  >
                    ✓ ተጠናቋል (Fixed)
                  </button>
                </div>
              </div>

              {/* Case Notes History */}
              <div>
                <label className="block text-emerald-200/80 font-semibold mb-2">
                  የተደረገ ክትትልና ማስታወሻዎች ({selectedTicket.notes?.length || 0})
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {!selectedTicket.notes || selectedTicket.notes.length === 0 ? (
                    <p className="text-emerald-200/50 italic py-2">እስካሁን የተጻፈ ማስታወሻ የለም።</p>
                  ) : (
                    selectedTicket.notes.map((note) => (
                      <div key={note.id} className="p-2.5 rounded-xl bg-[#062414] border border-[#0f4425]">
                        <div className="flex items-center justify-between text-[10px] text-amber-300 font-semibold mb-1">
                          <span>{note.author}</span>
                          <span className="font-mono text-emerald-200/60">{note.date}</span>
                        </div>
                        <p className="text-slate-100">{note.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleSendNote} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="የክትትል ማስታወሻ ወይም ምላሽ እዚህ ይጻፉ..."
                  className="flex-1 px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white placeholder-emerald-200/40 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => setIsNewModalOpen(false)}
              className="absolute top-4 right-4 text-emerald-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">
              አዲስ የድጋፍ / የጸሎት ጥያቄ መዝግብ
            </h3>
            <p className="text-xs text-emerald-200/70 mb-4">
              የአባሉን ወይም የተማሪውን ጥያቄ እዚህ ይመዝግቡ
            </p>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">የጠያቂው ስም *</label>
                  <input
                    type="text"
                    required
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="ምሳሌ: አበበ ከበደ"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">ስልክ ቁጥር</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0911..."
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">የጉዳዩ ዓይነት</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="prayer">የጸሎት ጥያቄ (Prayer)</option>
                  <option value="visitation">የቤት ጉብኝት (Visitation)</option>
                  <option value="counseling">መንፈሳዊ ምክር (Counseling)</option>
                  <option value="welfare">ድጋፍና እርዳታ (Welfare)</option>
                  <option value="general">አጠቃላይ (General)</option>
                </select>
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">አርዕስት *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ምሳሌ: የፈተና ጸሎት ጥያቄ"
                  className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">ዝርዝር ማብራሪያ</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="የጥያቄውን ዝርዝር እዚህ ያስገቡ..."
                  className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-3 border-t border-[#0f4425] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3 py-1.5 text-emerald-200/70 hover:text-white"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow"
                >
                  መዝግብ (Create)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
