import React, { useState } from 'react';
import { WOLD_WAHID_LOGO } from '../data/initialData';
import { Shield, Lock, Phone, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

interface LoginPageProps {
  onLogin: (adminData: { id?: string; nameAm: string; nameEn: string; phone: string; role: 'super_admin' | 'admin' }) => void;
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
      // Fetch all admins directly from Firestore database
      const adminsRef = collection(db, 'admins');
      const snapshot = await getDocs(adminsRef);

      let adminRecords = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as any[];

      // Query database for admin matching input phone
      const matchedAdmin = adminRecords.find((adm) => {
        const dbPhoneDigits = (adm.phone || '').replace(/[\s\-\+]/g, '').replace(/\D/g, '').slice(-9);
        return dbPhoneDigits && dbPhoneDigits === inputDigits;
      });

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

      // Password verification with database record - STRICT DATABASE MATCH ONLY
      const dbPassword = String(matchedAdmin.password || '').trim();
      const isPasswordMatch = cleanPass === dbPassword;

      if (!isPasswordMatch) {
        setError('የተሳሳተ የይለፍ ቃል (Incorrect password)');
        setIsLoading(false);
        return;
      }

      // Successful login from database
      onLogin({
        id: matchedAdmin.id,
        nameAm: matchedAdmin.nameAm || 'አስተዳዳሪ',
        nameEn: matchedAdmin.nameEn || matchedAdmin.nameAm || 'Admin',
        phone: matchedAdmin.phone || cleanPhone,
        role: matchedAdmin.role === 'super_admin' ? 'super_admin' : 'admin',
      });
    } catch (err: any) {
      console.error('Firestore login error:', err);
      setError('የመረብ ችግር አጋጥሟል፤ እባክዎ እንደገና ይሞክሩ (Connection error)');
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
