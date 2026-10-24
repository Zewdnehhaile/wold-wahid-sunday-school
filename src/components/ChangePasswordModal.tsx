import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, getDocs, collection, updateDoc, setDoc } from 'firebase/firestore';
import { AdminUser } from '../types';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdmin: AdminUser;
  targetAdmin?: {
    id: string;
    nameAm: string;
    phone?: string;
    role?: string;
    password?: string;
  } | null;
  onPasswordChanged?: (adminId: string, newPass: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentAdmin,
  targetAdmin,
  onPasswordChanged,
}) => {
  const isEditingOther = targetAdmin && targetAdmin.id !== currentAdmin.id;
  const isSuperAdmin = currentAdmin.role === 'super_admin';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveAdminName = targetAdmin?.nameAm || currentAdmin.nameAm || 'አስተዳዳሪ';
  const effectivePhone = targetAdmin?.phone || currentAdmin.phone || '';
  const effectiveId = targetAdmin?.id || currentAdmin.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanNewPass = newPassword.trim();
    const cleanConfirmPass = confirmPassword.trim();
    const cleanCurrentPass = currentPassword.trim();

    // Super admins cannot change each other's passwords
    if (isEditingOther && currentAdmin.role === 'super_admin' && targetAdmin?.role === 'super_admin') {
      setError('ዋና አስተዳዳሪዎች የሌላ ዋና አስተዳዳሪን የይለፍ ቃል መቀየር አይችሉም (Super admins cannot change another super admin password)');
      return;
    }

    // If changing own password, current password is required
    if (!isEditingOther && !cleanCurrentPass) {
      setError('እባክዎ የአሁኑን የይለፍ ቃል ያስገቡ (Please enter current password)');
      return;
    }

    if (!cleanNewPass) {
      setError('እባክዎ አዲሱን የይለፍ ቃል ያስገቡ (Please enter new password)');
      return;
    }

    if (cleanNewPass.length < 4) {
      setError('አዲሱ የይለፍ ቃል ቢያንስ 4 ፊደላት ወይም ቁጥሮች መሆን አለበት (At least 4 characters)');
      return;
    }

    if (cleanNewPass !== cleanConfirmPass) {
      setError('አዲሱ የይለፍ ቃል እና ማረጋገጫው አይመሳሰሉም (Passwords do not match)');
      return;
    }

    if (!isEditingOther && cleanCurrentPass === cleanNewPass) {
      setError('አዲሱ የይለፍ ቃል ከአሮጌው የተለየ መሆን አለበት (Must be different from old password)');
      return;
    }

    setIsLoading(true);

    try {
      let docToUpdateId = effectiveId;
      let matchedData: any = null;

      // 1. Try finding doc by ID or Phone Digits
      const cleanPhoneDigits = (effectivePhone || '').replace(/\D/g, '').slice(-9);
      const querySnap = await getDocs(collection(db, 'admins'));
      
      for (const d of querySnap.docs) {
        const dPhoneDigits = (d.data().phone || '').replace(/\D/g, '').slice(-9);
        if (d.id === docToUpdateId || (cleanPhoneDigits && dPhoneDigits === cleanPhoneDigits)) {
          docToUpdateId = d.id;
          matchedData = d.data();
          break;
        }
      }

      // If user is changing own password, verify current password against Firestore
      if (!isEditingOther) {
        let storedPassword = String(matchedData?.password || '').trim();
        // Fallback for default super admins if not yet synced
        if (!storedPassword) {
          if (cleanPhoneDigits === '988286610') storedPassword = '6610Zewd';
          else if (cleanPhoneDigits === '927209931') storedPassword = 'kidu9931';
        }

        if (storedPassword && cleanCurrentPass !== storedPassword) {
          setError('የአሁኑ የይለፍ ቃል ትክክል አይደለም (Current password is incorrect)');
          setIsLoading(false);
          return;
        }
      }

      // 2. Update password in Firestore across all matching documents
      let updatedCount = 0;
      for (const d of querySnap.docs) {
        const dPhoneDigits = (d.data().phone || '').replace(/\D/g, '').slice(-9);
        if (
          d.id === docToUpdateId ||
          d.id === effectiveId ||
          (cleanPhoneDigits && dPhoneDigits === cleanPhoneDigits)
        ) {
          await setDoc(doc(db, 'admins', d.id), {
            password: cleanNewPass,
            passwordUpdatedAt: new Date().toISOString(),
          }, { merge: true });
          updatedCount++;
        }
      }

      // If document was not found in existing docs, create or merge with fallback ID
      if (updatedCount === 0) {
        const targetId = docToUpdateId || (cleanPhoneDigits ? `admin-${cleanPhoneDigits}` : `admin-${Date.now()}`);
        await setDoc(doc(db, 'admins', targetId), {
          id: targetId,
          nameAm: effectiveAdminName,
          phone: effectivePhone,
          password: cleanNewPass,
          role: targetAdmin?.role || currentAdmin.role || 'admin',
          status: 'active',
          passwordUpdatedAt: new Date().toISOString(),
        }, { merge: true });
        docToUpdateId = targetId;
      }

      // 3. Update localStorage cache
      try {
        const cached = localStorage.getItem('ww_custom_admins');
        if (cached) {
          const list = JSON.parse(cached);
          const updated = list.map((a: any) => {
            const aPhoneDigits = (a.phone || '').replace(/\D/g, '').slice(-9);
            if (a.id === docToUpdateId || (cleanPhoneDigits && aPhoneDigits === cleanPhoneDigits)) {
              return { ...a, password: cleanNewPass };
            }
            return a;
          });
          localStorage.setItem('ww_custom_admins', JSON.stringify(updated));
        }
      } catch {
        // ignore cache write error
      }

      if (onPasswordChanged) {
        onPasswordChanged(docToUpdateId, cleanNewPass);
      }

      setSuccess('የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል! ከአሁን በኋላ በአዲሱ የይለፍ ቃል ብቻ መግባት ይችላሉ።');
      setTimeout(() => {
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error('Password change error:', err);
      setError('የይለፍ ቃል መቀየር አልተሳካም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#09351c] border border-amber-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-emerald-200 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#0f4425]">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              የይለፍ ቃል መቀየሪያ (Change Password)
            </h3>
            <p className="text-xs text-emerald-200/70">
              {effectiveAdminName} {effectivePhone ? `· ${effectivePhone}` : ''}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Current Password Field (Only if editing own password) */}
          {!isEditingOther && (
            <div>
              <label className="block text-emerald-100 font-semibold mb-1">
                የአሁኑ የይለፍ ቃል (Current Password) *
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="የነበረውን የይለፍ ቃል ያስገቡ..."
                  className="w-full pl-3 pr-10 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {isEditingOther && isSuperAdmin && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
              <span>ዋና አስተዳዳሪ እንደመሆንዎ መጠን የአስተዳዳሪውን አዲስ የይለፍ ቃል በቀጥታ ማስተካከል ይችላሉ።</span>
            </div>
          )}

          {/* New Password Field */}
          <div>
            <label className="block text-emerald-100 font-semibold mb-1">
              አዲስ የይለፍ ቃል (New Password) *
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="አዲሱን የይለፍ ቃል ያስገቡ..."
                className="w-full pl-3 pr-10 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-emerald-100 font-semibold mb-1">
              አዲሱን የይለፍ ቃል በድጋሚ ያረጋግጡ (Confirm New Password) *
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="አዲሱን የይለፍ ቃል ደግመው ያስገቡ..."
                className="w-full pl-3 pr-10 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#0f4425] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-emerald-200/70 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              ይቅር (Cancel)
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>በመቀየር ላይ...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>የይለፍ ቃል ቀይር (Save)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
