import React, { useState } from 'react';
import { WOLD_WAHID_LOGO, INITIAL_ADMINS } from '../data/initialData';
import { Shield, Lock, Phone, ArrowRight, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { db, collection, getDocs, doc, setDoc, query, where, limit } from '../firebase';
import { hashPasswordWeb } from '../utils/crypto';

interface LoginPageProps {
  onLogin: (adminData: { id?: string; nameAm: string; nameEn: string; phone: string; role: 'super_admin' | 'admin'; permissions?: any }) => void;
  onOpenStudentPortal?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onOpenStudentPortal }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/[\s\-\+]/g, '');
    const cleanPass = password.trim();

    if (!cleanPhone || !cleanPass) {
      setError('እባክዎ ስልክ ቁጥር እና የይለፍ ቃል ያስገቡ (Please enter phone and password)');
      return;
    }

    const inputDigits = cleanPhone.replace(/\D/g, '').slice(-9);

    setIsLoading(true);

    try {
      // Strategy 1: Try server endpoint /api/admins/login with 3.5s timeout
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const apiRes = await fetch('/api/admins/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, password: cleanPass }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.success && apiData.admin) {
            onLogin({
              id: apiData.admin.id,
              nameAm: apiData.admin.nameAm || 'አስተዳዳሪ',
              nameEn: apiData.admin.nameEn || 'Admin',
              phone: apiData.admin.phone || cleanPhone,
              role: apiData.admin.role === 'super_admin' ? 'super_admin' : 'admin',
              permissions: apiData.admin.permissions,
            });
            setIsLoading(false);
            return;
          }
        } else if (apiRes.status === 401 || apiRes.status === 403) {
          const errData = await apiRes.json().catch(() => ({}));
          setError(errData.error || 'የተሳሳተ የይለፍ ቃል (Incorrect password)');
          setIsLoading(false);
          return;
        }
      } catch (apiErr) {
        console.warn('API login check fallback to client DB:', apiErr);
      }

      // Strategy 2: Client-side DB check in admins collection
      const adminsRef = collection(db, 'admins');
      let matchedAdmin: any = null;

      try {
        const allAdminsSnap = await getDocs(query(adminsRef, limit(50)));
        if (!allAdminsSnap.empty) {
          for (const docSnap of allAdminsSnap.docs) {
            const adm = docSnap.data();
            const pDigits = String(adm.phone || '').replace(/\D/g, '').slice(-9);
            if (pDigits && pDigits === inputDigits) {
              matchedAdmin = { id: docSnap.id, ...adm };
              break;
            }
          }
        }
      } catch (clientErr) {
        console.warn('Client admins query notice:', clientErr);
      }

      // Strategy 3: Check students collection for admin or super_admin role
      if (!matchedAdmin) {
        try {
          const studSnap = await getDocs(query(collection(db, 'students'), limit(100)));
          if (!studSnap.empty) {
            for (const docSnap of studSnap.docs) {
              const std = docSnap.data();
              const pDigits = String(std.phone || '').replace(/\D/g, '').slice(-9);
              if (pDigits && pDigits === inputDigits && (std.role === 'admin' || std.role === 'super_admin')) {
                matchedAdmin = { id: docSnap.id, ...std };
                break;
              }
            }
          }
        } catch (studErr) {
          console.warn('Client students admin check notice:', studErr);
        }
      }

      // Strategy 4: Check INITIAL_ADMINS fallback list
      if (!matchedAdmin) {
        for (const adm of INITIAL_ADMINS) {
          const pDigits = String(adm.phone || '').replace(/\D/g, '').slice(-9);
          if (pDigits && pDigits === inputDigits) {
            matchedAdmin = { ...adm };
            break;
          }
        }
      }

      if (!matchedAdmin) {
        setError('ይህ ስልክ ቁጥር በአስተዳዳሪዎች ዝርዝር ውስጥ አልተገኘም (Admin phone not found in database)');
        setIsLoading(false);
        return;
      }

      // Check if admin is suspended
      if (matchedAdmin.status === 'suspended') {
        setError('ይህ የአስተዳዳሪ አካውንት ለጊዜው ታግዷል (This admin account is suspended)');
        setIsLoading(false);
        return;
      }

      // Password verification with database record - STRICT DATABASE COMPARISON ONLY
      const dbPassword = String(matchedAdmin.password || matchedAdmin.data?.password || '').trim();
      const dbPasswordHash = String(matchedAdmin.passwordHash || matchedAdmin.data?.passwordHash || '').trim();
      const inputHash = await hashPasswordWeb(cleanPass);

      const isPasswordMatch = (dbPassword && cleanPass === dbPassword) ||
                              (dbPasswordHash && inputHash === dbPasswordHash) ||
                              (dbPassword && inputHash === dbPassword);

      if (!isPasswordMatch) {
        setError('የተሳሳተ የይለፍ ቃል (Incorrect admin password)');
        setIsLoading(false);
        return;
      }

      // Successful login
      onLogin({
        id: matchedAdmin.id,
        nameAm: matchedAdmin.fullNameAm || matchedAdmin.nameAm || matchedAdmin.name_am || 'አስተዳዳሪ',
        nameEn: matchedAdmin.fullNameEn || matchedAdmin.nameEn || matchedAdmin.name_en || 'Admin',
        phone: matchedAdmin.phone || cleanPhone,
        role: matchedAdmin.role === 'super_admin' ? 'super_admin' : 'admin',
        permissions: matchedAdmin.permissions,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      setError('የይለፍ ቃል ወይም ስልክ ቁጥር አልተዛመደም። እባክዎ እንደገና ይሞክሩ (Login failed. Please check credentials).');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#062414] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Church Background Image - Visible */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/assets/aistudio/1792237453828_f6473ebe.jfif" 
          alt="Church Building" 
          className="w-full h-full object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#09351c]/90 border-2 border-[#b45309]/50 rounded-3xl p-8 shadow-2xl shadow-emerald-950/80 relative z-10 backdrop-blur-md">
        {/* Church Emblem Logo Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-24 h-24 rounded-full border-4 border-[#f59e0b] shadow-xl overflow-hidden bg-[#062414] p-1 mb-3">
            <img
              src={WOLD_WAHID_LOGO}
              alt="የወልድ ዋሕድ ሰንበት ት/ቤት"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <h1 className="text-xl font-black text-amber-300 tracking-tight leading-tight">
            ወልደ ዋሕድ ሰንበት ትምህርት ቤት
          </h1>
          <p className="text-xs text-emerald-200 mt-1 font-medium">
            መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን
          </p>
          <div className="inline-block mt-3 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-widest">
            Admin Scanner Portal
          </div>
        </div>

        {/* Clean Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="text-[10px] font-bold text-emerald-400 hover:text-white flex items-center gap-1 mb-4 cursor-pointer"
          >
            ← ተመለስ (Back)
          </button>
          <div>
            <label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest block mb-2 ml-1">
              ስልክ ቁጥር (Phone Number)
            </label>
            <div className="relative group">
              <Phone className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-amber-300" />
              <input
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09..."
                className="w-full pl-10 pr-4 py-3 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white font-mono placeholder-emerald-700/60 focus:outline-none focus:border-amber-400 shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest block mb-2 ml-1">
              የይለፍ ቃል (Password)
            </label>
            <div className="relative group">
              <Lock className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-amber-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-amber-400 p-1 cursor-pointer transition-colors"
                title={showPassword ? 'ደብቅ / Hide password' : 'አሳይ / Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-[11px] text-rose-300 bg-rose-950/60 border border-rose-800 p-3 rounded-xl text-center font-bold animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 mt-4 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>በማረጋገጥ ላይ... (Verifying...)</span>
              </>
            ) : (
              <>
                <span>ወደ ሲስተሙ ግባ (Sign In)</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};
