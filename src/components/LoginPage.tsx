import React, { useState } from 'react';
import { WOLD_WAHID_LOGO, INITIAL_ADMINS } from '../data/initialData';
import { Shield, Lock, Phone, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { db, collection, getDocs, query, limit } from '../firebase';
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
    <div className="min-h-screen bg-[#062414] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans select-none">
      {/* Background ambient glow */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-950/60 via-[#062414] to-black"></div>

      {/* Side-by-Side Smart Login Card Container */}
      <div className="w-full max-w-5xl bg-[#09351c]/95 border-2 border-amber-500/60 rounded-3xl shadow-2xl shadow-emerald-950/90 relative z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-2 backdrop-blur-xl">
        
        {/* Left Side: Church Visual Showcase with Uploaded Image */}
        <div className="relative p-8 lg:p-12 flex flex-col justify-between overflow-hidden min-h-[350px] lg:min-h-[580px]">
          {/* Uploaded Church Image as Background */}
          <div className="absolute inset-0 z-0">
            <img 
              src="/assets/aistudio/images_f4623d46.jfif" 
              alt="Mekane Kidusan Church" 
              className="w-full h-full object-cover filter brightness-90 saturate-110 transform hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#062414] via-[#062414]/70 to-black/40"></div>
          </div>

          {/* Top Branding / Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-14 h-14 rounded-full border-2 border-amber-400 bg-[#062414] p-1 shadow-lg overflow-hidden flex-shrink-0">
              <img
                src={WOLD_WAHID_LOGO}
                alt="Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-400/40">
                ኦፊሴላዊ ፖርታል
              </span>
            </div>
          </div>

          {/* Bottom Title & Church Info */}
          <div className="relative z-10 space-y-3 pt-12">
            <h1 className="text-2xl lg:text-3xl font-black text-amber-300 tracking-tight leading-snug drop-shadow-md">
              ወልደ ዋሕድ ሰንበት ትምህርት ቤት
            </h1>
            <p className="text-sm font-bold text-emerald-100 drop-shadow">
              መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን
            </p>
            <p className="text-xs text-emerald-200/90 font-medium leading-relaxed max-w-sm">
              የተማሪዎች ዲጂታል መታወቂያ፣ QR ኮድ መከታተያ እና የመገኘት መመዝገቢያ አስተዳደር ሥርዓት።
            </p>
          </div>
        </div>

        {/* Right Side: Smart Admin Login Form */}
        <div className="p-8 lg:p-12 flex flex-col justify-center bg-[#072a19]/90 relative">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-xs font-bold text-emerald-400 hover:text-white flex items-center gap-1 mb-3 cursor-pointer transition-colors"
            >
              ← ተመለስ (Back)
            </button>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span>የአስተዳዳሪ መግቢያ (Admin Sign In)</span>
            </h2>
            <p className="text-xs text-emerald-300/80 mt-1">
              እባክዎ የተመዘገበ ስልክ ቁጥርዎን እና የይለፍ ቃልዎን ያስገቡ።
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-amber-400/90 uppercase tracking-widest block mb-1.5 ml-1">
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
                  placeholder="0911234567"
                  className="w-full pl-10 pr-4 py-3 bg-[#062414] border border-emerald-900/60 rounded-xl text-xs text-white font-mono placeholder-emerald-700/60 focus:outline-none focus:border-amber-400 shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-amber-400/90 uppercase tracking-widest block mb-1.5 ml-1">
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
                  className="w-full pl-10 pr-11 py-3 bg-[#062414] border border-emerald-900/60 rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-amber-400 p-1 cursor-pointer transition-colors"
                  title={showPassword ? 'ደብቅ' : 'አሳይ'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-[11px] text-rose-300 bg-rose-950/70 border border-rose-800 p-3 rounded-xl text-center font-bold animate-in fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 mt-2 cursor-pointer"
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
    </div>
  );
};
