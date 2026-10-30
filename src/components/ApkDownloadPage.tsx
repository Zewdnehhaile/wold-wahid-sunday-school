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
    <div className="min-h-screen text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none bg-[#062414]">
      {/* Church Background Image - Visible */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/assets/aistudio/1792237453828_f6473ebe.jfif" 
          alt="Church Building" 
          className="w-full h-full object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="w-full max-w-md bg-[#09351c]/95 border-2 border-[#b45309]/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative z-10 backdrop-blur-md text-center space-y-6">
        
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
        </div>

        {/* Primary Access Options: Admin Login only */}
        <div className="space-y-3 pt-4">
          {/* Admin Scanner Login Button */}
          <button
            type="button"
            onClick={() => onOpenApp?.(false)}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/30 flex items-center justify-center gap-3 cursor-pointer transition transform active:scale-95 text-sm"
          >
            <Lock className="w-5 h-5" />
            <span>🔐 የአስተዳዳሪና ስካነር መግቢያ (Admin Scanner Login)</span>
          </button>
          
          <p className="text-[10px] text-amber-300/80 mt-2 font-medium">
            (ለዋና አስተዳዳሪና ለአስተዳዳሪዎች ብቻ የተፈቀደ - Admin Access)
          </p>
        </div>

      </div>
    </div>
  );
};
