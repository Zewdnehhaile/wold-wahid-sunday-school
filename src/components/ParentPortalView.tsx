import React, { useState, useEffect } from 'react';
import {
  AttendanceRecord,
  Language,
  Member,
  ParentLinkRequest,
  StudentReportDoc,
} from '../types';
import { WOLD_WAHID_LOGO, AVATAR_MALE, AVATAR_FEMALE } from '../data/initialData';
import { getPhotoUrl } from '../utils/photoUtils';
import { getApiUrl } from '../utils/apiConfig';
import { normalizeStudentCode } from '../utils/idCodes';
import {
  Users,
  Send,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  QrCode,
  UserCheck,
  GraduationCap,
  ShieldAlert,
  Bell,
  Plus,
  RefreshCw,
  LogOut,
  FileText,
  Lock,
} from 'lucide-react';

interface ParentPortalViewProps {
  onBack: () => void;
  onOpenAdminLogin?: () => void;
  lang: Language;
}

interface TelegramSessionUser {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
}

interface ChildDashboardPayload {
  student: Member;
  attendance: AttendanceRecord[];
  report: StudentReportDoc;
  notices: Array<{ id: string; title?: string; message?: string; createdAt?: string; senderName?: string }>;
}

const PARENT_STORAGE_KEY = 'ww_parent_session';

export const ParentPortalView: React.FC<ParentPortalViewProps> = ({
  onBack,
  onOpenAdminLogin,
  lang,
}) => {
  const [telegramUser, setTelegramUser] = useState<TelegramSessionUser | null>(() => {
    try {
      const saved = localStorage.getItem(PARENT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.telegramId) return parsed;
      }
    } catch {}
    return null;
  });

  // Official Telegram Login Widget (verify.et exact OAuth flow) state
  const [botInfo, setBotInfo] = useState<{ botId: string; botUsername: string }>({
    botId: '8611581813',
    botUsername: 'attendanceforchurchbot',
  });
  const [isInitializingAuth, setIsInitializingAuth] = useState(false);
  const [authError, setAuthError] = useState('');

  // Parent linked children & requests
  const [linkedChildren, setLinkedChildren] = useState<Member[]>([]);
  const [linkRequests, setLinkRequests] = useState<ParentLinkRequest[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [childData, setChildData] = useState<ChildDashboardPayload | null>(null);
  const [isLoadingChild, setIsLoadingChild] = useState(false);

  // Dashboard Sub-tabs (strictly 4 private areas matching parent requirements)
  const [activeTab, setActiveTab] = useState<'info' | 'attendance' | 'results' | 'conduct'>('info');
  const [showAddChildForm, setShowAddChildForm] = useState(false);

  // 1st-Time Parent Link Form state
  const [linkStudentCode, setLinkStudentCode] = useState('');
  const [linkParentName, setLinkParentName] = useState('');
  const [linkParentPhone, setLinkParentPhone] = useState('');
  const [linkRelation, setLinkRelation] = useState('አባት (Father)');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Parent 1-Click Leave Request state
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState('የቤተሰብ (Family)');
  const [leaveDuration, setLeaveDuration] = useState('1 ቀን (ዛሬ)');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState('');

  const verifyTelegramWidgetAuth = async (authPayload: Record<string, any>) => {
    setAuthError('');
    setIsInitializingAuth(true);
    try {
      const res = await fetch(getApiUrl('/api/parent/auth/telegram-widget'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authPayload),
      });
      const data = await res.json();
      if (!res.ok || !data?.telegramUser?.telegramId) {
        setAuthError(data?.error || 'የቴሌግራም ማረጋገጫ አልተሳካም። እባክዎ እንደገና ይሞክሩ።');
        return;
      }
      const tgUser: TelegramSessionUser = data.telegramUser;
      setTelegramUser(tgUser);
      try {
        localStorage.setItem(PARENT_STORAGE_KEY, JSON.stringify(tgUser));
      } catch {}
      const children: Member[] = Array.isArray(data.linkedChildren) ? data.linkedChildren : [];
      const requests: ParentLinkRequest[] = Array.isArray(data.linkRequests) ? data.linkRequests : [];
      setLinkedChildren(children);
      setLinkRequests(requests);
      if (children.length > 0) setActiveChildId(children[0].id);
    } catch {
      setAuthError('ከሰርቨር ጋር መገናኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsInitializingAuth(false);
    }
  };

  // Load bot config + parse #tgAuthResult redirect or load official telegram-widget.js
  useEffect(() => {
    fetch(getApiUrl('/api/parent/auth/bot-info'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.botId) {
          setBotInfo({ botId: String(d.botId), botUsername: String(d.botUsername || 'attendanceforchurchbot') });
        }
      })
      .catch(() => {});

    // Check redirect hash (#tgAuthResult=base64) or query (?id=...&hash=...) from oauth.telegram.org
    try {
      const hash = window.location.hash || '';
      if (hash.includes('tgAuthResult=')) {
        const b64 = hash.split('tgAuthResult=')[1]?.split('&')[0] || '';
        const normB64 = b64.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = atob(normB64);
        const parsed = JSON.parse(jsonStr);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        if (parsed?.id && parsed?.hash) {
          verifyTelegramWidgetAuth(parsed);
        }
      } else {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('id') && sp.get('hash') && sp.get('auth_date')) {
          const parsed: Record<string, string> = {};
          ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].forEach((k) => {
            const v = sp.get(k);
            if (v) parsed[k] = v;
          });
          verifyTelegramWidgetAuth(parsed);
        }
      }
    } catch {}
    // Load official Telegram OIDC Login library (matches verify.et flow)
    const scriptId = 'telegram-oidc-login-sdk';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://oauth.telegram.org/js/telegram-login.js?6';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const refreshParentSession = async (tgId: string) => {
    setIsLoadingSession(true);
    try {
      const res = await fetch(getApiUrl(`/api/parent/session/${encodeURIComponent(tgId)}`));
      if (res.ok) {
        const data = await res.json();
        const children: Member[] = Array.isArray(data.linkedChildren) ? data.linkedChildren : [];
        const requests: ParentLinkRequest[] = Array.isArray(data.linkRequests) ? data.linkRequests : [];
        setLinkedChildren(children);
        setLinkRequests(requests);
        if (children.length > 0 && !children.some((c) => c.id === activeChildId)) {
          setActiveChildId(children[0].id);
        }
      }
    } catch {
      // silent
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    if (telegramUser?.telegramId) {
      const fullTgName = [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(' ').trim();
      if (fullTgName && !linkParentName) setLinkParentName(fullTgName);
      refreshParentSession(telegramUser.telegramId);
    }
  }, [telegramUser?.telegramId]);

  useEffect(() => {
    if (!telegramUser?.telegramId || !activeChildId) {
      setChildData(null);
      return;
    }
    let active = true;
    setIsLoadingChild(true);
    fetch(
      getApiUrl(
        `/api/parent/child/${encodeURIComponent(activeChildId)}?parentTelegramId=${encodeURIComponent(
          telegramUser.telegramId
        )}`
      )
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success) return;
        setChildData({
          student: data.student,
          attendance: Array.isArray(data.attendance) ? data.attendance : [],
          report: data.report || { studentId: activeChildId, studentCode: data.student?.code || '', exams: [], conductNotes: [] },
          notices: Array.isArray(data.notices) ? data.notices : [],
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingChild(false);
      });
    return () => {
      active = false;
    };
  }, [activeChildId, telegramUser?.telegramId]);

  const oauthDirectUrl =
    typeof window !== 'undefined'
      ? `https://oauth.telegram.org/auth?response_type=post_message&client_id=${encodeURIComponent(
          botInfo.botId
        )}&redirect_uri=${encodeURIComponent(
          window.location.origin + window.location.pathname
        )}&scope=${encodeURIComponent('openid profile telegram:bot_access')}`
      : '#';

  const triggerTelegramOidc = () => {
    const tgLogin = (window as any).Telegram?.Login;
    if (!tgLogin || typeof tgLogin.auth !== 'function') {
      return false;
    }
    setIsInitializingAuth(true);
    try {
      tgLogin.auth(
        {
          client_id: Number(botInfo.botId) || botInfo.botId,
          scope: ['profile', 'write'],
        },
        (result: any) => {
          setIsInitializingAuth(false);
          if (!result || result.error) {
            if (result?.error === 'popup_closed') {
              setAuthError('የቴሌግራም መግቢያ ተቋርጧል። እባክዎ እንደገና ይሞክሩ።');
            } else {
              setAuthError(result?.error || 'የቴሌግራም ማረጋገጫ አልተጠናቀቀም።');
            }
            return;
          }
          if (result.id_token) {
            verifyTelegramWidgetAuth({ id_token: result.id_token, user: result.user });
          } else if (result.id && result.hash) {
            verifyTelegramWidgetAuth(result);
          } else {
            setAuthError('የቴሌግራም ማረጋገጫ መረጃ አልተገኘም።');
          }
        }
      );
      return true;
    } catch {
      setIsInitializingAuth(false);
      return false;
    }
  };

  const handleContinueWithTelegram = () => {
    setAuthError('');
    if (triggerTelegramOidc()) return;

    // Ensure OIDC SDK is loaded if user clicks immediately
    setIsInitializingAuth(true);
    const existing = document.getElementById('telegram-oidc-login-sdk') as HTMLScriptElement | null;
    const onSdkReady = () => {
      if (!triggerTelegramOidc()) {
        setIsInitializingAuth(false);
        window.location.assign(oauthDirectUrl);
      }
    };
    if (existing) {
      existing.addEventListener('load', onSdkReady, { once: true });
      setTimeout(() => {
        if ((window as any).Telegram?.Login?.auth) onSdkReady();
      }, 400);
    } else {
      const script = document.createElement('script');
      script.id = 'telegram-oidc-login-sdk';
      script.src = 'https://oauth.telegram.org/js/telegram-login.js?6';
      script.async = true;
      script.onload = onSdkReady;
      script.onerror = () => {
        setIsInitializingAuth(false);
        window.location.assign(oauthDirectUrl);
      };
      document.head.appendChild(script);
    }
  };

  const handleLogoutParent = () => {
    setTelegramUser(null);
    setLinkedChildren([]);
    setLinkRequests([]);
    setActiveChildId('');
    setChildData(null);
    setAuthError('');
    try {
      localStorage.removeItem(PARENT_STORAGE_KEY);
    } catch {}
  };

  const handleSubmitLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramUser?.telegramId) return;
    setLinkFeedback(null);
    setIsSubmittingLink(true);
    try {
      const res = await fetch(getApiUrl('/api/parent/link-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentTelegramId: telegramUser.telegramId,
          parentTelegramUsername: telegramUser.username || '',
          parentName: linkParentName.trim(),
          parentPhone: linkParentPhone.trim(),
          relation: linkRelation,
          studentCode: normalizeStudentCode(linkStudentCode) || linkStudentCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLinkFeedback({ type: 'error', msg: data.error || 'ጥያቄውን መላክ አልተቻለም።' });
        return;
      }
      if (data.alreadyLinked) {
        setLinkFeedback({
          type: 'success',
          msg: `✅ ይህ ተማሪ (${data.studentNameAm}) ቀድሞውኑ ከእርስዎ የወላጅ መለያ ጋር ተገናኝቷል!`,
        });
        setShowAddChildForm(false);
      } else if (data.alreadyPending) {
        setLinkFeedback({
          type: 'success',
          msg: '⏳ የዚህ ልጅ ማገናኛ ጥያቄ ቀድሞ ተልኳል እና በአስተዳዳሪ (Parent Approve) እየታየ ነው።',
        });
      } else {
        setLinkFeedback({
          type: 'success',
          msg: '✅ የወላጅ ማገናኛ ጥያቄዎ ተልኳል! አስተዳዳሪ በ "Parent Approve" ሲያጸድቀው የልጅዎ ሙሉ መረጃ እዚህ ይከፈታል።',
        });
        setLinkStudentCode('');
        setShowAddChildForm(false);
      }
      await refreshParentSession(telegramUser.telegramId);
    } catch {
      setLinkFeedback({ type: 'error', msg: 'ጥያቄውን መላክ አልተሳካም። እባክዎ እንደገና ይሞክሩ።' });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleSubmitParentLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramUser?.telegramId || !childData?.student || !leaveReason.trim()) return;
    setIsSubmittingLeave(true);
    setLeaveMsg('');
    try {
      const res = await fetch(getApiUrl('/api/parent/leave-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentTelegramId: telegramUser.telegramId,
          studentId: childData.student.id,
          leaveType,
          duration: leaveDuration.trim() || '1 ቀን',
          reason: leaveReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaveMsg(`✅ የፈቃድ ጥያቄ (${data.requestNumber}) ለሰንበት ት/ቤቱ አስተዳደር ተልኳል!`);
        setLeaveReason('');
        setShowLeaveForm(false);
      } else {
        setLeaveMsg(data.error || 'የፈቃድ ጥያቄውን መላክ አልተቻለም።');
      }
    } catch {
      setLeaveMsg('ከሰርቨር ጋር መገናኘት አልተቻለም።');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const childAttendance = childData?.attendance || [];
  const presentCount = childAttendance.filter((a) => a.status !== 'absent').length;
  const absentCount = childAttendance.filter((a) => a.status === 'absent').length;
  const attendanceRate =
    childAttendance.length > 0 ? Math.round((presentCount / childAttendance.length) * 100) : 100;

  const exams = childData?.report?.exams || [];
  const avgExamScore =
    exams.length > 0
      ? Math.round(
          (exams.reduce((sum, ex) => sum + (ex.maxScore > 0 ? (ex.score / ex.maxScore) * 100 : 0), 0) /
            exams.length)
        )
      : null;

  return (
    <div className="min-h-screen bg-[#062414] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-[#09351c]/95 backdrop-blur-md border-b border-[#0f4425] px-4 py-3.5 sticky top-0 z-40 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-[#062414] border border-[#0f4425] text-emerald-200 hover:text-white cursor-pointer"
              title="ተመለስ"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-amber-400 overflow-hidden bg-[#062414] p-0.5 shrink-0">
              <img src={WOLD_WAHID_LOGO} alt="Wold Wahid" className="w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-white leading-tight">
                {lang === 'am' ? 'የወላጆች ክትትል ፖርታል' : 'Family & Parent Tracking Portal'}
              </h1>
              <p className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">
                የወልድ ዋሕድ ሰንበት ት/ቤት · Private Parent Access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAdminLogin && (
              <button
                type="button"
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#062414] border border-[#0f4425] text-amber-400 hover:bg-emerald-950 cursor-pointer"
              >
                <span>🔐 አድሚን</span>
              </button>
            )}
            {telegramUser && (
              <button
                type="button"
                onClick={handleLogoutParent}
                className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                title="ውጣ (Log out)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {!telegramUser ? (
          /* Exact verify.et Official Telegram OAuth / Login Widget Flow */
          <div className="max-w-md mx-auto bg-[#09351c]/95 border-2 border-amber-500/40 rounded-3xl p-7 sm:p-9 shadow-2xl space-y-6 mt-6 text-center">
            {/* Dual Telegram + Church Crest Badge (matches verify.et visual step 1) */}
            <div className="flex items-center justify-center -space-x-2">
              <div className="w-14 h-14 rounded-full bg-[#2AABEE] text-white flex items-center justify-center shadow-lg border-2 border-[#062414] z-10">
                <Send className="w-6 h-6 -translate-x-0.5 translate-y-0.5" />
              </div>
              <div className="w-14 h-14 rounded-full bg-[#062414] border-2 border-amber-400 overflow-hidden shadow-lg p-0.5">
                <img src={WOLD_WAHID_LOGO} alt="Wold Wahid" className="w-full h-full object-cover rounded-full" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {lang === 'am' ? 'እንኳን በደህና መጡ' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Sign in to your parent account with your Telegram account
                <span className="block text-emerald-100/90 mt-1">
                  የልጅዎን መገኘት፣ የትምህርት ውጤት እና ስነ-ምግባር በግል ለመከታተል በቴሌግራም መለያዎ ይግቡ።
                </span>
              </p>
            </div>

            {/* Primary verify.et-style Continue with Telegram button */}
            <div className="space-y-3">
              <button
                type="button"
                disabled={isInitializingAuth}
                onClick={handleContinueWithTelegram}
                className="w-full py-3.5 px-5 rounded-full bg-[#2AABEE] hover:bg-[#229ED9] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2.5 cursor-pointer transition disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{isInitializingAuth ? 'በማረጋገጥ ላይ...' : 'Continue with Telegram'}</span>
              </button>

              {authError && (
                <p className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-xl p-3 text-center font-bold">
                  {authError}
                </p>
              )}

              <p className="text-[11px] text-emerald-200/70 leading-relaxed pt-1">
                🔒 Telegram sends an official <strong className="text-white">Log in / Decline</strong> confirmation inside your Telegram app.
              </p>
            </div>

            <div className="pt-2 border-t border-[#0f4425]">
              <button
                type="button"
                onClick={onBack}
                className="text-xs font-bold text-emerald-300 hover:text-amber-300 cursor-pointer"
              >
                Return Home / ተመለስ
              </button>
            </div>
          </div>
        ) : (
          /* Logged-in Parent Flow */
          <div className="space-y-6">
            {/* Verified Telegram Account Banner */}
            <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                {telegramUser.photoUrl ? (
                  <img
                    src={telegramUser.photoUrl}
                    alt={telegramUser.firstName || 'Parent'}
                    className="w-10 h-10 rounded-xl object-cover border border-sky-400/50"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center font-black">
                    TG
                  </div>
                )}
                <div className="text-xs">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span>
                      {[telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(' ') || 'የተረጋገጠ ወላጅ'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ Telegram Verified
                    </span>
                  </p>
                  <p className="text-emerald-200/70 font-mono mt-0.5">
                    {telegramUser.username ? `@${telegramUser.username} · ` : ''}ID: {telegramUser.telegramId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshParentSession(telegramUser.telegramId)}
                  disabled={isLoadingSession}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#062414] border border-[#0f4425] text-xs font-bold text-emerald-200 hover:text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSession ? 'animate-spin' : ''}`} />
                  <span>ሁኔታ አድስ</span>
                </button>
                {linkedChildren.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddChildForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ሌላ ልጅ አገናኝ</span>
                  </button>
                )}
              </div>
            </div>

            {linkFeedback && (
              <div
                className={`p-4 rounded-2xl border text-xs font-bold ${
                  linkFeedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                }`}
              >
                {linkFeedback.msg}
              </div>
            )}

            {/* Pending / Past Parent Link Requests */}
            {linkRequests.some((r) => r.status !== 'approved') && (
              <div className="bg-[#09351c]/90 border border-amber-500/40 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-amber-300">የማገናኛ ጥያቄዎች ሁኔታ (Link Requests)</p>
                  <button
                    type="button"
                    onClick={() => refreshParentSession(telegramUser.telegramId)}
                    className="text-[11px] font-bold text-emerald-200 hover:text-white underline cursor-pointer"
                  >
                    🔄 ሁኔታ ፈትሽ
                  </button>
                </div>
                {linkRequests
                  .filter((r) => r.status !== 'approved')
                  .map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-[#062414] border border-[#0f4425] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-white">{req.studentNameAm}</span>{' '}
                        <span className="font-mono text-amber-400">({req.studentCode})</span>
                        {req.status === 'rejected' && req.rejectionReason && (
                          <p className="text-[11px] text-rose-300 mt-0.5">ምክንያት፦ {req.rejectionReason}</p>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          req.status === 'rejected'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {req.status === 'rejected' ? '❌ ውድቅ ተደርጓል' : '⏳ በአስተዳዳሪ Parent Approve እየታየ ነው'}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* 1st-Time Parent Link Form (Shown when unlinked OR when "+ ሌላ ልጅ አገናኝ" toggled) */}
            {(linkedChildren.length === 0 || showAddChildForm) && (
              <div className="bg-[#09351c] border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
                <div>
                  <h3 className="text-base font-black text-white">
                    {linkedChildren.length === 0
                      ? '🆔 ለመጀመሪያ ጊዜ የልጅዎን መታወቂያ (Student ID) ያስገቡ'
                      : '➕ ተጨማሪ ልጅ ከመለያዎ ጋር ያገናኙ'}
                  </h3>
                  <p className="text-xs text-emerald-200/75 mt-1">
                    ለደህንነት ሲባል የልጅዎን የት/ቤት መታወቂያ (ምሳሌ: <strong className="text-amber-300 font-mono">EDU001</strong>) ያስገቡ። ጥያቄዎ በአስተዳዳሪ ("Parent Approve") እንደጸደቀ የልጅዎ ሙሉ መረጃ በቋሚነት ይከፈታል።
                  </p>
                </div>

                <form onSubmit={handleSubmitLinkRequest} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-amber-400 mb-1">
                        የልጅዎ መታወቂያ ቁጥር (Child Student ID) *
                      </label>
                      <input
                        type="text"
                        required
                        value={linkStudentCode}
                        onChange={(e) => setLinkStudentCode(e.target.value)}
                        placeholder="ምሳሌ: EDU001 ወይም MEZ001"
                        className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-amber-400 mb-1">ዝምድና (Relation) *</label>
                      <select
                        value={linkRelation}
                        onChange={(e) => setLinkRelation(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="አባት (Father)">አባት (Father)</option>
                        <option value="እናት (Mother)">እናት (Mother)</option>
                        <option value="አሳዳጊ (Guardian)">አሳዳጊ (Guardian)</option>
                        <option value="ወንድም / እህት (Sibling)">ወንድም / እህት (Sibling)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-amber-400 mb-1">የእርስዎ ሙሉ ስም (Parent Name) *</label>
                      <input
                        type="text"
                        required
                        value={linkParentName}
                        onChange={(e) => setLinkParentName(e.target.value)}
                        placeholder="ሙሉ ስምዎን ያስገቡ"
                        className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-amber-400 mb-1">የእርስዎ ስልክ ቁጥር (Parent Phone) *</label>
                      <input
                        type="tel"
                        required
                        value={linkParentPhone}
                        onChange={(e) => setLinkParentPhone(e.target.value)}
                        placeholder="0911223344"
                        className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {linkedChildren.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAddChildForm(false)}
                        className="px-4 py-2 text-emerald-200/70 hover:text-white font-bold cursor-pointer"
                      >
                        ሰርዝ
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmittingLink}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingLink ? 'በመላክ ላይ...' : 'ለማጽደቅ ላክ (Request Parent Link)'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Multi-Child Selector & Private 4-Tab Parent Tracking Dashboard */}
            {linkedChildren.length > 0 && (
              <div className="space-y-5">
                {linkedChildren.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-xs text-emerald-200/70 font-bold shrink-0">ልጅ ይምረጡ:</span>
                    {linkedChildren.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveChildId(c.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                          activeChildId === c.id
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'bg-[#09351c] text-emerald-200 border border-[#0f4425] hover:text-white'
                        }`}
                      >
                        {c.fullNameAm} ({c.code})
                      </button>
                    ))}
                  </div>
                )}

                {/* Dashboard Sub-Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#09351c] p-2 rounded-2xl border border-[#0f4425]">
                  {[
                    { id: 'info' as const, label: '🪪 የተማሪ መረጃ', icon: QrCode },
                    { id: 'attendance' as const, label: '📊 የመገኘት ክትትል', icon: UserCheck },
                    { id: 'results' as const, label: '🎓 የትምህርት ውጤት', icon: GraduationCap },
                    { id: 'conduct' as const, label: '📜 ስነ-ምግባርና ማስታወሻ', icon: ShieldAlert },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-[#062414] text-emerald-200/80 hover:text-white'
                      }`}
                    >
                      <tab.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {isLoadingChild || !childData ? (
                  <div className="p-12 text-center bg-[#09351c] border border-[#0f4425] rounded-3xl text-xs text-emerald-200/70">
                    የልጅዎ መረጃ በመጫን ላይ ነው...
                  </div>
                ) : (
                  <>
                    {/* TAB 1: Student Info */}
                    {activeTab === 'info' && (
                      <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-6 shadow-xl space-y-5">
                        <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-[#0f4425] pb-5">
                          <img
                            src={getPhotoUrl(childData.student.photoUrl, childData.student.gender)}
                            alt={childData.student.fullNameAm}
                            className="w-24 h-28 rounded-2xl object-cover border-2 border-amber-400 shadow-lg bg-[#062414]"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = childData.student.gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;
                            }}
                          />
                          <div className="text-center sm:text-left space-y-1.5 flex-1">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-xs font-black">
                              🆔 {childData.student.code}
                            </span>
                            <h3 className="text-xl font-black text-white">{childData.student.fullNameAm}</h3>
                            <p className="text-xs text-emerald-200/70">{childData.student.fullNameEn}</p>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-[11px]">
                              <span className="px-2.5 py-1 rounded-lg bg-[#062414] border border-[#0f4425] text-emerald-200">
                                ክፍል: <strong className="text-amber-300">{childData.student.department}</strong>
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                                <Lock className="w-3 h-3 inline mr-1" />
                                በወላጅ ቁጥጥር ስር (Linked)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3.5 rounded-2xl bg-[#062414] border border-[#0f4425]">
                            <p className="text-emerald-200/60">ክርስትና ስም</p>
                            <p className="font-bold text-white mt-0.5">{childData.student.christianName || 'N/A'}</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-[#062414] border border-[#0f4425]">
                            <p className="text-emerald-200/60">የትውልድ ዘመን</p>
                            <p className="font-bold text-white mt-0.5">{childData.student.birthYear || 'N/A'}</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-[#062414] border border-[#0f4425]">
                            <p className="text-emerald-200/60">የተማሪ ስልክ</p>
                            <p className="font-mono font-bold text-white mt-0.5">{childData.student.phone || 'N/A'}</p>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-[#062414] border border-[#0f4425]">
                            <p className="text-emerald-200/60">አድራሻ</p>
                            <p className="font-bold text-white mt-0.5">{childData.student.subcity || 'አዲስ አበባ'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: Attendance Tracking + 1-Click Parent Leave Request */}
                    {activeTab === 'attendance' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-[#09351c] border border-emerald-500/30 rounded-2xl p-4 text-center">
                            <p className="text-2xl font-black text-emerald-400">{presentCount}</p>
                            <p className="text-[11px] text-emerald-200/70 font-bold">ተገኝቷል (Present)</p>
                          </div>
                          <div className="bg-[#09351c] border border-amber-500/30 rounded-2xl p-4 text-center">
                            <p className="text-2xl font-black text-amber-400">{attendanceRate}%</p>
                            <p className="text-[11px] text-amber-200/70 font-bold">ምጣኔ (Rate)</p>
                          </div>
                          <div className="bg-[#09351c] border border-rose-500/30 rounded-2xl p-4 text-center">
                            <p className="text-2xl font-black text-rose-400">{absentCount}</p>
                            <p className="text-[11px] text-rose-200/70 font-bold">የቀረበት (Absent)</p>
                          </div>
                        </div>

                        <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-black text-white">የልጅዎ የመገኘት ዝርዝር</h3>
                            <button
                              type="button"
                              onClick={() => setShowLeaveForm((v) => !v)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>✉️ ለልጄ ፈቃድ ጠይቅ</span>
                            </button>
                          </div>

                          {leaveMsg && (
                            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold">
                              {leaveMsg}
                            </div>
                          )}

                          {showLeaveForm && (
                            <form
                              onSubmit={handleSubmitParentLeave}
                              className="p-4 rounded-2xl bg-[#062414] border border-amber-500/40 space-y-3 text-xs"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block font-bold text-amber-400 mb-1">የፈቃድ ዓይነት</label>
                                  <select
                                    value={leaveType}
                                    onChange={(e) => setLeaveType(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                                  >
                                    <option value="የቤተሰብ (Family)">የቤተሰብ (Family)</option>
                                    <option value="የጤና (Medical)">የጤና (Medical)</option>
                                    <option value="የጉዞ (Travel)">የጉዞ (Travel)</option>
                                    <option value="ሌላ (Other)">ሌላ (Other)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block font-bold text-amber-400 mb-1">ጊዜ (Duration)</label>
                                  <input
                                    type="text"
                                    required
                                    value={leaveDuration}
                                    onChange={(e) => setLeaveDuration(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block font-bold text-amber-400 mb-1">ምክንያት *</label>
                                <textarea
                                  rows={2}
                                  required
                                  value={leaveReason}
                                  onChange={(e) => setLeaveReason(e.target.value)}
                                  placeholder="ልጅዎ ለምን እንደሚቀር/እንደቀረ ይግለጹ..."
                                  className="w-full px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-white"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowLeaveForm(false)}
                                  className="px-3 py-1.5 text-emerald-200/70 hover:text-white cursor-pointer"
                                >
                                  ሰርዝ
                                </button>
                                <button
                                  type="submit"
                                  disabled={isSubmittingLeave}
                                  className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black cursor-pointer"
                                >
                                  {isSubmittingLeave ? 'በመላክ ላይ...' : 'ፈቃድ ላክ'}
                                </button>
                              </div>
                            </form>
                          )}

                          {childAttendance.length === 0 ? (
                            <p className="text-center py-8 text-xs text-emerald-200/60">
                              እስካሁን የተመዘገበ የመገኘት ታሪክ የለም።
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-[380px] overflow-y-auto">
                              {childAttendance.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425] flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <p className="font-bold text-white">{rec.sessionName}</p>
                                    <p className="text-[11px] text-emerald-200/60 font-mono mt-0.5">
                                      📅 {rec.date} · ⏰ {rec.timestamp}
                                    </p>
                                  </div>
                                  <span
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                                      rec.status === 'absent'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        : rec.status === 'excused'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    }`}
                                  >
                                    {rec.status === 'absent'
                                      ? '🔴 ቀርቷል'
                                      : rec.status === 'excused'
                                      ? '🟡 ፈቃድ'
                                      : '🟢 ተገኝቷል'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 3: Academic Exam Results */}
                    {activeTab === 'results' && (
                      <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-[#0f4425] pb-3">
                          <div>
                            <h3 className="text-base font-black text-white">🎓 የትምህርት ውጤትና እድገት ሪፖርት</h3>
                            <p className="text-xs text-emerald-200/70">በመምህራን የተመዘገቡ የፈተና እና የትምህርት ውጤቶች</p>
                          </div>
                          {avgExamScore !== null && (
                            <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs">
                              አማካይ: {avgExamScore}%
                            </span>
                          )}
                        </div>

                        {exams.length === 0 ? (
                          <p className="text-center py-10 text-xs text-emerald-200/60">
                            እስካሁን ለተማሪው የተመዘገበ የፈተና ውጤት የለም።
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {exams.map((ex) => (
                              <div
                                key={ex.id}
                                className="p-4 rounded-2xl bg-[#062414] border border-[#0f4425] flex items-center justify-between gap-3 text-xs"
                              >
                                <div>
                                  <p className="font-bold text-white text-sm">{ex.subject}</p>
                                  <p className="text-[11px] text-emerald-200/60 mt-0.5">
                                    {ex.term} · 📅 {ex.date}
                                  </p>
                                  {ex.remark && (
                                    <p className="text-[11px] text-amber-300/90 mt-1">💬 {ex.remark}</p>
                                  )}
                                </div>
                                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono font-black text-sm shrink-0">
                                  {ex.score} / {ex.maxScore}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 4: Conduct & Discipline + School Notices */}
                    {activeTab === 'conduct' && (
                      <div className="space-y-5">
                        <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-6 space-y-4">
                          <h3 className="text-base font-black text-white border-b border-[#0f4425] pb-3">
                            📜 የስነ-ምግባርና ቅጣት/ምስጋና መዝገብ
                          </h3>
                          {childData.report.conductNotes.length === 0 ? (
                            <p className="text-center py-6 text-xs text-emerald-200/60">
                              ምንም የተመዘገበ የስነ-ምግባር ማስታወሻ የለም።
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {childData.report.conductNotes.map((note) => (
                                <div
                                  key={note.id}
                                  className={`p-4 rounded-2xl border text-xs ${
                                    note.type === 'warning'
                                      ? 'bg-rose-950/40 border-rose-500/40'
                                      : note.type === 'commendation'
                                      ? 'bg-emerald-950/50 border-emerald-500/40'
                                      : 'bg-[#062414] border-[#0f4425]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-black text-white">
                                      {note.type === 'warning'
                                        ? '⚠️ ማስጠንቀቂያ / ቅጣት: '
                                        : note.type === 'commendation'
                                        ? '🌟 ምስጋና / ሽልማት: '
                                        : '📌 ማስታወሻ: '}
                                      {note.title}
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-200/60">{note.date}</span>
                                  </div>
                                  <p className="text-emerald-100/90 leading-relaxed">{note.description}</p>
                                  <p className="text-[10px] text-amber-300/80 mt-1.5">✍️ {note.issuer}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-6 space-y-3">
                          <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#0f4425] pb-2.5">
                            <Bell className="w-4 h-4 text-amber-400" />
                            <span>የሰንበት ት/ቤት ማስታወቂያዎች (Notices)</span>
                          </h3>
                          {childData.notices.length === 0 ? (
                            <p className="text-center py-6 text-xs text-emerald-200/60">ምንም አዲስ ማስታወቂያ የለም።</p>
                          ) : (
                            <div className="space-y-2.5">
                              {childData.notices.map((n) => (
                                <div key={n.id} className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425] text-xs space-y-1">
                                  <p className="font-bold text-amber-300">{n.title || 'ማስታወቂያ'}</p>
                                  <p className="text-emerald-100/85 whitespace-pre-line">{n.message}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
