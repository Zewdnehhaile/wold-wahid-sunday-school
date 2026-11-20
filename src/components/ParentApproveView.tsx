import React, { useState } from 'react';
import {
  AdminUser,
  Language,
  Member,
  ParentLinkRequest,
  StudentConductNote,
  StudentExamScore,
  StudentReportDoc,
} from '../types';
import { db, doc, getDoc, updateDoc, deleteDoc, setDoc } from '../firebase';
import { sendTelegramMessage } from '../utils/telegram';
import { recordAuditLog } from '../utils/auditLog';
import { studentCodesMatch } from '../utils/idCodes';
import {
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  GraduationCap,
  ShieldAlert,
  Search,
  Plus,
  RefreshCw,
  Clock,
  Phone,
  X,
} from 'lucide-react';

interface ParentApproveViewProps {
  members: Member[];
  currentAdmin: AdminUser;
  parentLinks: ParentLinkRequest[];
  onRefreshParentLinks: () => void;
  onUpdateParentLinksState: React.Dispatch<React.SetStateAction<ParentLinkRequest[]>>;
  onUpdateStudentParentInfo: (studentId: string, patch: Partial<Member>) => void;
  lang: Language;
}

export const ParentApproveView: React.FC<ParentApproveViewProps> = ({
  members,
  currentAdmin,
  parentLinks,
  onRefreshParentLinks,
  onUpdateParentLinksState,
  onUpdateStudentParentInfo,
  lang,
}) => {
  const [subTab, setSubTab] = useState<'approvals' | 'reports'>('approvals');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Reject Modal
  const [rejectingLink, setRejectingLink] = useState<ParentLinkRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('የወላጅ መረጃ ከተማሪው ጋር አልተዛመደም');
  const [processingId, setProcessingId] = useState<string>('');

  // Academic Results & Conduct Editor
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Member | null>(null);
  const [reportDoc, setReportDoc] = useState<StudentReportDoc | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);

  // New Exam Form
  const [examSubject, setExamSubject] = useState('');
  const [examScore, setExamScore] = useState('');
  const [examMaxScore, setExamMaxScore] = useState('100');
  const [examTerm, setExamTerm] = useState('2018 ዓ.ም 1ኛ መንፈቅ');
  const [examRemark, setExamRemark] = useState('');

  // New Conduct Form
  const [conductType, setConductType] = useState<'commendation' | 'warning' | 'notice'>('commendation');
  const [conductTitle, setConductTitle] = useState('');
  const [conductDesc, setConductDesc] = useState('');

  const activeStudents = members.filter((m) => m.status === 'active');

  const pendingCount = parentLinks.filter((l) => l.status === 'pending').length;
  const filteredLinks = parentLinks.filter((l) => filterStatus === 'all' || l.status === filterStatus);

  const handleApproveLink = async (link: ParentLinkRequest) => {
    setProcessingId(link.id);
    const reviewedAt = new Date().toISOString();
    const reviewedBy = currentAdmin.nameAm || currentAdmin.nameEn || 'አስተዳዳሪ';
    try {
      await updateDoc(doc(db, 'parent_links', link.id), {
        status: 'approved',
        reviewedBy,
        reviewedAt,
      });

      const targetMember = members.find((m) => m.id === link.studentId);
      const existingIds = Array.isArray(targetMember?.parentTelegramIds)
        ? targetMember!.parentTelegramIds.map(String)
        : [];
      const mergedIds = Array.from(
        new Set([...existingIds, String(link.parentTelegramId)].filter(Boolean))
      );

      const studentPatch: Partial<Member> = {
        parentTelegramId: targetMember?.parentTelegramId || String(link.parentTelegramId),
        parentTelegramIds: mergedIds,
        parentName: link.parentName,
        parentPhone: link.parentPhone,
      };

      await setDoc(doc(db, 'students', link.studentId), studentPatch, { merge: true });
      onUpdateStudentParentInfo(link.studentId, studentPatch);

      onUpdateParentLinksState((prev) => {
        const next = prev.map((item) =>
          item.id === link.id ? { ...item, status: 'approved' as const, reviewedBy, reviewedAt } : item
        );
        try {
          localStorage.setItem('ww_parent_links_cache', JSON.stringify(next));
        } catch {}
        return next;
      });

      if (link.parentTelegramId) {
        await sendTelegramMessage(
          link.parentTelegramId,
          `🎉 *የወላጅ መለያዎ ጸድቋል!*\n` +
            `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰ/ት/ቤት*\n\n` +
            `👤 *ተማሪ:* ${link.studentNameAm} (\`${link.studentCode}\`)\n` +
            `✍️ *ያጸደቀው:* ${reviewedBy}\n\n` +
            `አሁን በድረ-ገጹ "የወላጅ ፖርታል" ውስጥ በመግባት የልጅዎን መገኘት፣ የትምህርት ውጤት እና ስነ-ምግባር መከታተል ይችላሉ።`,
          { parseMode: 'Markdown' }
        ).catch(() => {});
      }

      recordAuditLog({
        actorId: currentAdmin.id || 'admin',
        actorName: reviewedBy,
        actorRole: currentAdmin.role,
        targetType: 'parent',
        targetName: `${link.parentName} -> ${link.studentCode}`,
        action: 'approve_parent',
        summaryAm: `ወላጅ "${link.parentName}"ን ከተማሪ "${link.studentNameAm}" (${link.studentCode}) ጋር አገናኝቷል`,
        summaryEn: `Approved parent link ${link.parentName} for student ${link.studentCode}`,
      });

      setNotice({
        type: 'success',
        msg: `✅ ወላጅ "${link.parentName}" ከተማሪ ${link.studentNameAm} (${link.studentCode}) ጋር ተገናኝቷል!`,
      });
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      console.error('Approve parent link error:', err);
      setNotice({ type: 'error', msg: 'ማጽደቅ አልተሳካም። እባክዎ እንደገና ይሞክሩ።' });
    } finally {
      setProcessingId('');
    }
  };

  const handleConfirmRejectLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingLink) return;
    const reviewedAt = new Date().toISOString();
    const reviewedBy = currentAdmin.nameAm || currentAdmin.nameEn || 'አስተዳዳሪ';
    const reason = rejectReason.trim() || 'የወላጅ መረጃ አልተዛመደም';
    setProcessingId(rejectingLink.id);
    try {
      await updateDoc(doc(db, 'parent_links', rejectingLink.id), {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy,
        reviewedAt,
      });

      onUpdateParentLinksState((prev) => {
        const next = prev.map((item) =>
          item.id === rejectingLink.id
            ? { ...item, status: 'rejected' as const, rejectionReason: reason, reviewedBy, reviewedAt }
            : item
        );
        try {
          localStorage.setItem('ww_parent_links_cache', JSON.stringify(next));
        } catch {}
        return next;
      });

      if (rejectingLink.parentTelegramId) {
        await sendTelegramMessage(
          rejectingLink.parentTelegramId,
          `❌ *የወላጅ ማገናኛ ጥያቄዎ አልተቀበለም*\n` +
            `ተማሪ: ${rejectingLink.studentNameAm} (\`${rejectingLink.studentCode}\`)\n` +
            `📌 ምክንያት: ${reason}\n` +
            `ለተጨማሪ መረጃ የሰንበት ት/ቤቱን አስተዳደር ያነጋግሩ።`,
          { parseMode: 'Markdown' }
        ).catch(() => {});
      }

      recordAuditLog({
        actorId: currentAdmin.id || 'admin',
        actorName: reviewedBy,
        actorRole: currentAdmin.role,
        targetType: 'parent',
        targetName: `${rejectingLink.parentName} -> ${rejectingLink.studentCode}`,
        action: 'reject_parent',
        summaryAm: `የወላጅ "${rejectingLink.parentName}" ጥያቄ ውድቅ አድርጓል (${reason})`,
        summaryEn: `Rejected parent link ${rejectingLink.parentName}: ${reason}`,
      });

      setRejectingLink(null);
      setNotice({ type: 'success', msg: `ጥያቄው ውድቅ ተደርጓል።` });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice({ type: 'error', msg: 'ውድቅ ማድረግ አልተሳካም።' });
    } finally {
      setProcessingId('');
    }
  };

  const handleDeleteLink = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'parent_links', id)).catch(() => {});
      onUpdateParentLinksState((prev) => {
        const next = prev.filter((l) => l.id !== id);
        try {
          localStorage.setItem('ww_parent_links_cache', JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch {}
  };

  const handleSelectStudentForReport = async (student: Member) => {
    setSelectedStudent(student);
    setIsLoadingReport(true);
    try {
      const snap = await getDoc(doc(db, 'student_reports', student.id));
      if (snap.exists()) {
        const d = snap.data() as any;
        setReportDoc({
          studentId: student.id,
          studentCode: student.code,
          exams: Array.isArray(d.exams) ? d.exams : [],
          conductNotes: Array.isArray(d.conductNotes) ? d.conductNotes : [],
          updatedAt: d.updatedAt,
        });
      } else {
        setReportDoc({
          studentId: student.id,
          studentCode: student.code,
          exams: [],
          conductNotes: [],
        });
      }
    } catch {
      setReportDoc({
        studentId: student.id,
        studentCode: student.code,
        exams: [],
        conductNotes: [],
      });
    } finally {
      setIsLoadingReport(false);
    }
  };

  const saveReportToFirestore = async (nextReport: StudentReportDoc) => {
    setIsSavingReport(true);
    try {
      const payload = {
        ...nextReport,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'student_reports', nextReport.studentId), payload, { merge: true });
      setReportDoc(payload);
      setNotice({ type: 'success', msg: '✅ የተማሪው ውጤት እና ስነ-ምግባር መረጃ ተቀምጧል!' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice({ type: 'error', msg: 'መረጃውን ማስቀመጥ አልተቻለም።' });
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleAddExamScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDoc || !examSubject.trim() || examScore === '') return;
    const newExam: StudentExamScore = {
      id: `ex-${Date.now()}`,
      subject: examSubject.trim(),
      score: Number(examScore) || 0,
      maxScore: Number(examMaxScore) || 100,
      term: examTerm.trim() || '2018 ዓ.ም',
      date: new Date().toISOString().split('T')[0],
      remark: examRemark.trim() || undefined,
    };
    const nextReport: StudentReportDoc = {
      ...reportDoc,
      exams: [newExam, ...reportDoc.exams],
    };
    await saveReportToFirestore(nextReport);
    setExamSubject('');
    setExamScore('');
    setExamRemark('');
  };

  const handleAddConductNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDoc || !conductTitle.trim() || !conductDesc.trim()) return;
    const newNote: StudentConductNote = {
      id: `cn-${Date.now()}`,
      type: conductType,
      title: conductTitle.trim(),
      description: conductDesc.trim(),
      date: new Date().toISOString().split('T')[0],
      issuer: currentAdmin.nameAm || 'አስተዳዳሪ',
    };
    const nextReport: StudentReportDoc = {
      ...reportDoc,
      conductNotes: [newNote, ...reportDoc.conductNotes],
    };
    await saveReportToFirestore(nextReport);
    setConductTitle('');
    setConductDesc('');
  };

  const matchingStudents = activeStudents
    .filter((m) => {
      const q = studentQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        studentCodesMatch(m.code, q) ||
        studentCodesMatch(m.legacyCode, q) ||
        m.code.toLowerCase().includes(q) ||
        m.fullNameAm.toLowerCase().includes(q) ||
        m.phone.includes(q)
      );
    })
    .slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            <span>{lang === 'am' ? 'የወላጆች ማጽደቂያ እና የልጆች ውጤት (Parent Approve)' : 'Parent Approve & Student Reports'}</span>
          </h2>
          <p className="text-sm text-emerald-200/70 mt-1">
            ወላጆች በልጆቻቸው Student ID የላኩትን የማገናኛ ጥያቄ ማጽደቅ እና የትምህርት ውጤት / ስነ-ምግባር መመዝገብ
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshParentLinks}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#09351c] border border-[#0f4425] text-xs font-bold text-emerald-200 hover:text-white cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-amber-400" />
          <span>ዝርዝሩን አድስ</span>
        </button>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold ${
            notice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          {notice.msg}
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#0f4425] pb-3">
        <button
          type="button"
          onClick={() => setSubTab('approvals')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            subTab === 'approvals'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-[#09351c] text-emerald-200/80 border border-[#0f4425] hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>የወላጅ ማጽደቂያ (Parent Approve)</span>
          {pendingCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                subTab === 'approvals' ? 'bg-slate-950 text-amber-400' : 'bg-rose-600 text-white'
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('reports')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            subTab === 'reports'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-[#09351c] text-emerald-200/80 border border-[#0f4425] hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>የትምህርት ውጤትና ስነ-ምግባር መዝግብ</span>
        </button>
      </div>

      {subTab === 'approvals' ? (
        <div className="space-y-4">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'pending' as const, label: `በመጠባበቅ ላይ (${parentLinks.filter((l) => l.status === 'pending').length})` },
              { id: 'approved' as const, label: `የጸደቁ (${parentLinks.filter((l) => l.status === 'approved').length})` },
              { id: 'rejected' as const, label: `ውድቅ (${parentLinks.filter((l) => l.status === 'rejected').length})` },
              { id: 'all' as const, label: `ሁሉም (${parentLinks.length})` },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterStatus(pill.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterStatus === pill.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#09351c] text-emerald-200/80 border border-[#0f4425] hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {filteredLinks.length === 0 ? (
            <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-12 text-center text-xs text-emerald-200/60">
              በዚህ ምድብ ውስጥ ምንም የወላጅ ማመልከቻ አልተገኘም።
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredLinks.map((link) => (
                <div
                  key={link.id}
                  className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 text-xs">
                    {/* Parent Info Submitted */}
                    <div className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425] space-y-1">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                        የወላጅ መረጃ (Submitted Parent)
                      </p>
                      <p className="text-sm font-bold text-white">{link.parentName}</p>
                      <p className="text-emerald-200/80 font-mono flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-400" />
                        <span>{link.parentPhone}</span>
                        <span>· {link.relation}</span>
                      </p>
                      <p className="text-[11px] text-sky-300 font-mono">
                        Telegram: {link.parentTelegramUsername ? `@${link.parentTelegramUsername}` : link.parentTelegramId}
                      </p>
                    </div>

                    {/* Matched Child Info for Admin Verification */}
                    <div className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425] space-y-1">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                        የተጠየቀው ተማሪ (Child Verification)
                      </p>
                      <p className="text-sm font-bold text-white">
                        {link.studentNameAm}{' '}
                        <span className="font-mono text-amber-300">({link.studentCode})</span>
                      </p>
                      <p className="text-[11px] text-emerald-200/75">
                        በምዝገባ ወቅት የተጻፈ ተጠሪ: <strong>{link.registeredEmergencyName || 'ያልተገለጸ'}</strong>
                      </p>
                      <p className="text-[11px] font-mono text-emerald-200/75">
                        የተመዘገበ ስልክ: {link.registeredEmergencyPhone || 'ያልተገለጸ'}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {link.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={processingId === link.id}
                          onClick={() => handleApproveLink(link)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>አጽድቅ (Approve)</span>
                        </button>
                        <button
                          type="button"
                          disabled={processingId === link.id}
                          onClick={() => {
                            setRejectingLink(link);
                            setRejectReason('የወላጅ መረጃ ከተማሪው ጋር አልተዛመደም');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>ውድቅ አድርግ</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                            link.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {link.status === 'approved' ? `✅ ጸድቋል (${link.reviewedBy || ''})` : `❌ ውድቅ`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(link.id)}
                          className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                          title="ሰርዝ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Results & Conduct Entry Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Student Picker */}
          <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="በ EDU001 ወይም በስም ይፈልጉ..."
                className="w-full pl-9 pr-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
              {matchingStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectStudentForReport(s)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                    selectedStudent?.id === s.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : 'bg-[#062414] border-[#0f4425] text-white hover:border-amber-500/40'
                  }`}
                >
                  <p className="truncate">{s.fullNameAm}</p>
                  <p
                    className={`font-mono text-[11px] ${
                      selectedStudent?.id === s.id ? 'text-slate-900' : 'text-amber-400'
                    }`}
                  >
                    {s.code} · {s.department}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Student Exam & Conduct Editor */}
          <div className="lg:col-span-2 bg-[#09351c] border border-[#0f4425] rounded-3xl p-5 space-y-6">
            {!selectedStudent ? (
              <div className="py-16 text-center text-xs text-emerald-200/60">
                ውጤት ወይም የስነ-ምግባር ማስታወሻ ለመመዝገብ ከግራ በኩል ተማሪ ይምረጡ።
              </div>
            ) : isLoadingReport || !reportDoc ? (
              <div className="py-16 text-center text-xs text-emerald-200/60">በመጫን ላይ...</div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[#0f4425] pb-3">
                  <div>
                    <h3 className="text-base font-black text-white">{selectedStudent.fullNameAm}</h3>
                    <p className="text-xs font-mono text-amber-400">{selectedStudent.code}</p>
                  </div>
                </div>

                {/* Add Exam Score Form */}
                <form onSubmit={handleAddExamScore} className="p-4 rounded-2xl bg-[#062414] border border-[#0f4425] space-y-3 text-xs">
                  <p className="font-bold text-amber-400 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    <span>አዲስ የትምህርት / የፈተና ውጤት ጨምር</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      required
                      value={examSubject}
                      onChange={(e) => setExamSubject(e.target.value)}
                      placeholder="የትምህርት ዓይነት (ምሳሌ: መዝሙር)"
                      className="sm:col-span-2 px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                    />
                    <input
                      type="number"
                      required
                      value={examScore}
                      onChange={(e) => setExamScore(e.target.value)}
                      placeholder="ውጤት (e.g. 92)"
                      className="px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white font-mono"
                    />
                    <input
                      type="number"
                      required
                      value={examMaxScore}
                      onChange={(e) => setExamMaxScore(e.target.value)}
                      placeholder="ከስንት (e.g. 100)"
                      className="px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={examTerm}
                      onChange={(e) => setExamTerm(e.target.value)}
                      placeholder="ክፍለ ጊዜ / Term"
                      className="px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                    />
                    <input
                      type="text"
                      value={examRemark}
                      onChange={(e) => setExamRemark(e.target.value)}
                      placeholder="የመምህር አስተያየት (አማራጭ)"
                      className="px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingReport}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ውጤት መዝግብ</span>
                  </button>

                  {reportDoc.exams.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      {reportDoc.exams.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between bg-[#09351c] px-3 py-2 rounded-xl border border-[#0f4425]">
                          <span>
                            <strong>{ex.subject}</strong> · {ex.score}/{ex.maxScore} ({ex.term})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              saveReportToFirestore({
                                ...reportDoc,
                                exams: reportDoc.exams.filter((item) => item.id !== ex.id),
                              })
                            }
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </form>

                {/* Add Conduct / Discipline Note Form */}
                <form onSubmit={handleAddConductNote} className="p-4 rounded-2xl bg-[#062414] border border-[#0f4425] space-y-3 text-xs">
                  <p className="font-bold text-amber-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>የስነ-ምግባርና ማስታወሻ መዝግብ</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={conductType}
                      onChange={(e) => setConductType(e.target.value as any)}
                      className="px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                    >
                      <option value="commendation">🌟 ምስጋና (Commendation)</option>
                      <option value="notice">📌 ማስታወሻ (Notice)</option>
                      <option value="warning">⚠️ ማስጠንቀቂያ (Warning)</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={conductTitle}
                      onChange={(e) => setConductTitle(e.target.value)}
                      placeholder="ርዕስ (Title)"
                      className="sm:col-span-2 px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={conductDesc}
                    onChange={(e) => setConductDesc(e.target.value)}
                    placeholder="ዝርዝር ሁኔታ..."
                    className="w-full px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                  />
                  <button
                    type="submit"
                    disabled={isSavingReport}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ስነ-ምግባር መዝግብ</span>
                  </button>

                  {reportDoc.conductNotes.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      {reportDoc.conductNotes.map((cn) => (
                        <div key={cn.id} className="flex items-center justify-between bg-[#09351c] px-3 py-2 rounded-xl border border-[#0f4425]">
                          <span>
                            <strong>{cn.title}</strong> — {cn.description}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              saveReportToFirestore({
                                ...reportDoc,
                                conductNotes: reportDoc.conductNotes.filter((item) => item.id !== cn.id),
                              })
                            }
                            className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reject Link Modal */}
      {rejectingLink && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09351c] border border-rose-500/40 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-xs">
            <button
              type="button"
              onClick={() => setRejectingLink(null)}
              className="absolute top-4 right-4 text-emerald-200/70 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-white mb-1">የወላጅ ጥያቄ ውድቅ ማድረጊያ</h3>
            <p className="text-emerald-200/70 mb-4">
              {rejectingLink.parentName} → {rejectingLink.studentNameAm} ({rejectingLink.studentCode})
            </p>
            <form onSubmit={handleConfirmRejectLink} className="space-y-4">
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingLink(null)}
                  className="px-4 py-2 text-emerald-200/70 hover:text-white cursor-pointer"
                >
                  ሰርዝ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  ውድቅ አድርግ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
