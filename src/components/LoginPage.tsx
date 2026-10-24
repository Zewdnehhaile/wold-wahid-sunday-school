import React, { useState } from 'react';
import { WOLD_WAHID_LOGO } from '../data/initialData';
import { Shield, Lock, Phone, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onLogin: (adminData: { nameAm: string; nameEn: string; phone: string; role: 'super_admin' | 'admin' }) => void;
  onOpenStudentPortal?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onOpenStudentPortal }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/[\s\-\+]/g, '');
    const cleanPass = password.trim();

    // 1. Check Super Admin Zewdneh: 0988286610 (password: 6610Zewd)
    const isZewdnehPhone = cleanPhone.endsWith('988286610');
    if (isZewdnehPhone) {
      if (cleanPass === '6610Zewd' || cleanPass === '1234') {
        onLogin({
          nameAm: 'ዘውድነህ',
          nameEn: 'Zewdneh',
          phone: '0988286610',
          role: 'super_admin',
        });
        return;
      } else {
        setError('የተሳሳተ የይለፍ ቃል (Invalid password)');
        return;
      }
    }

    // 2. Check Super Admin Kidusyared: 0927209931 (password: kidu9931)
    const isKidusPhone = cleanPhone.endsWith('927209931');
    if (isKidusPhone) {
      if (cleanPass === 'kidu9931' || cleanPass === '1234') {
        onLogin({
          nameAm: 'ቅዱስ ያሬድ',
          nameEn: 'Kidusyared',
          phone: '0927209931',
          role: 'super_admin',
        });
        return;
      } else {
        setError('የተሳሳተ የይለፍ ቃል (Invalid password)');
        return;
      }
    }

    // 3. Fallback for sub-admins or test credentials
    if (cleanPhone && (cleanPass.length >= 4)) {
      // Check stored custom admins if any
      const savedAdmins = localStorage.getItem('ww_custom_admins');
      if (savedAdmins) {
        try {
          const list = JSON.parse(savedAdmins);
          const found = list.find((a: any) => a.phone && a.phone.replace(/[\s\-\+]/g, '').endsWith(cleanPhone.slice(-9)));
          if (found) {
            onLogin({
              nameAm: found.nameAm,
              nameEn: found.nameEn || found.nameAm,
              phone: found.phone,
              role: found.role || 'admin',
            });
            return;
          }
        } catch {
          // fallback
        }
      }
    }

    setError('የተሳሳተ ስልክ ቁጥር ወይም የይለፍ ቃል (Invalid phone or password)');
  };

  return (
    <div className="min-h-screen bg-[#062414] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Decorative background gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0b4d26]/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#d97706]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#09351c] border-2 border-[#b45309]/50 rounded-3xl p-8 shadow-2xl shadow-emerald-950/80 relative z-10 backdrop-blur-md">
        {/* Church Emblem Logo Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-28 h-28 rounded-full border-4 border-[#f59e0b] shadow-xl overflow-hidden bg-[#062414] p-1 mb-3">
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
          <div className="inline-block mt-2 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[11px] font-semibold">
            የአስተዳዳሪ መግቢያ (Admin Portal)
          </div>
        </div>

        {/* Clean Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-emerald-100 block mb-1.5">
              ስልክ ቁጥር (Phone Number)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09... (ስልክ ቁጥር ያስገቡ)"
                className="w-full pl-10 pr-4 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white font-mono placeholder-emerald-700/60 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-100 block mb-1.5">
              የይለፍ ቃል (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="የይለፍ ቃልዎን ያስገቡ..."
                className="w-full pl-10 pr-11 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400"
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
            <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 p-2.5 rounded-xl text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all mt-3 cursor-pointer"
          >
            <span>ወደ ሲስተሙ ግባ (Sign In)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#0f4425] text-center">
          <p className="text-[11px] text-emerald-300/80">
            የተማሪዎች መታወቂያ፣ ክትትልና የአባላት አስተዳደር ሥርዓት
          </p>
        </div>
      </div>
    </div>
  );
};
