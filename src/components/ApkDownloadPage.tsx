import React, { useState } from 'react';
import { Phone, Smartphone, CheckCircle, ShieldCheck, ArrowRight, AlertCircle, Loader2, LogIn, Sparkles, Clock, Lock } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { WOLD_WAHID_LOGO } from '../data/initialData';

interface ApkDownloadPageProps {
  onOpenApp?: (asStudent?: boolean) => void;
}

export const ApkDownloadPage: React.FC<ApkDownloadPageProps> = ({ onOpenApp }) => {
  const [phone, setPhone] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const normalizePhone = (raw: string) => {
    let cleaned = raw.replace(/\D/g, '');
    if (cleaned.startsWith('251')) {
      cleaned = '0' + cleaned.slice(3);
    } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
    return cleaned;
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const inputPhone = normalizePhone(phone);

    if (inputPhone.length < 9) {
      setErrorMessage('እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ (ምሳሌ፡ 0911234567)');
      return;
    }

    setLoading(true);

    try {
      const studentsRef = collection(db, 'students');
      const studentSnap = await getDocs(studentsRef);
      
      let foundStudent = studentSnap.docs.map(doc => doc.data()).find(data => {
        const p = normalizePhone(data.phone || '').replace(/\D/g, '').slice(-9);
        const targetP = inputPhone.replace(/\D/g, '').slice(-9);
        return p && targetP && p === targetP;
      });

      if (!foundStudent) {
        const regRef = collection(db, 'registrations');
        const regSnap = await getDocs(regRef);
        foundStudent = regSnap.docs.map(doc => doc.data()).find(data => {
          const p = normalizePhone(data.phone || '').replace(/\D/g, '').slice(-9);
          const targetP = inputPhone.replace(/\D/g, '').slice(-9);
          return p && targetP && p === targetP;
        });
      }

      if (foundStudent) {
        setStudentName(foundStudent.fullNameAm || foundStudent.fullNameEn || 'የሰንበት ት/ቤት ተማሪ');
        setIsAuthenticated(true);
      } else {
        setErrorMessage('❌ ይህ ስልክ ቁጥር በሲስተሙ ውስጥ አልተገኘም። እባክዎ በመጀመሪያ በቴሌግራም ቦቱ ላይ "📝 የተማሪ ምዝገባ" ይፈጽሙ።');
      }
    } catch (err) {
      console.error('Phone validation error:', err);
      setErrorMessage('የስልክ ቁጥር ማረጋገጫ ላይ ስህተት አጋጥሟል። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ff0000] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#09351c] border-2 border-[#b45309]/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/80 relative z-10 backdrop-blur-md text-center space-y-6">
        
        {/* Church Emblem Logo Header */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full border-2 border-amber-400 overflow-hidden bg-[#062414] p-1 mb-3 shadow-lg">
            <img
              src={WOLD_WAHID_LOGO}
              alt="የወልደ ዋሕድ ሰንበት ት/ቤት"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            ወልደ ዋሕድ ሰንበት ትምህርት ቤት
          </h1>
          <p className="text-xs text-emerald-200/80 mt-0.5">
            መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን
          </p>

          {/* Coming Soon Mobile App Banner */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>📱 ሞባይል መተግበሪያ (በቅርቡ ይጠብቁ / Coming Soon)</span>
          </div>
        </div>

        {/* Coming Soon Notice Box */}
        <div className="p-4 bg-[#062414]/90 rounded-2xl border border-emerald-900 text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>የአንድሮይድ እና iOS መተግበሪያ በዝግጅት ላይ ነው!</span>
          </div>
          <p className="text-[11px] text-emerald-200/80 leading-relaxed">
            ኦፊሴላዊው የሞባይል አፕሊኬሽን በቅርቡ በ Google Play Store እና App Store የሚለቀቅ ሲሆን፤ በአሁኑ ሰዓት ሙሉውን የሰንበት ት/ቤት ሲስተም በቴሌግራም ሚኒ አፕ እዚሁ በቀጥታ መጠቀም ይችላሉ።
          </p>
        </div>

        {/* Primary Access Options: Super Admin/Admin Scanner Login only */}
        <div className="space-y-3 pt-1">
          {/* Admin Scanner Login Button */}
          <button
            type="button"
            onClick={() => onOpenApp?.(false)}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 text-xs sm:text-sm"
          >
            <Lock className="w-4 h-4" />
            <span>🔐 የአስተዳዳሪና ስካነር መግቢያ (Admin Scanner Login)</span>
          </button>
          <p className="text-[10px] text-amber-300/80 -mt-1 font-medium">
            (ለዋና አስተዳዳሪና ለአስተዳዳሪዎች ብቻ የተፈቀደ)
          </p>
        </div>

      </div>
    </div>
  );
};
