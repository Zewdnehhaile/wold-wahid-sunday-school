import React from 'react';
import { Lock } from 'lucide-react';
import { WOLD_WAHID_LOGO } from '../data/initialData';

interface ApkDownloadPageProps {
  onOpenApp?: (asStudent?: boolean) => void;
  onOpenParentPortal?: () => void;
}

export const ApkDownloadPage: React.FC<ApkDownloadPageProps> = ({ onOpenApp, onOpenParentPortal }) => {
  return (
    <div className="min-h-screen text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none bg-[#062414]">
      {/* Church Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/assets/aistudio/images_f4623d46.jfif" 
          alt="Church Building" 
          className="w-full h-full object-cover filter brightness-90 saturate-110"
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
      </div>

      <div className="w-full max-w-md bg-[#09351c]/95 border-2 border-amber-500/60 rounded-3xl p-8 shadow-2xl shadow-black/80 relative z-10 backdrop-blur-md text-center space-y-6">
        
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

        {/* Primary Access Options */}
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={() => onOpenApp?.(false)}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/30 flex items-center justify-center gap-3 cursor-pointer transition transform active:scale-95 text-sm"
          >
            <Lock className="w-5 h-5" />
            <span>🔐 የአስተዳዳሪ መግቢያ (Admin Portal Login)</span>
          </button>

          {onOpenParentPortal && (
            <button
              type="button"
              onClick={onOpenParentPortal}
              className="w-full py-3.5 bg-[#062414] hover:bg-emerald-950/90 text-emerald-200 hover:text-amber-300 border border-emerald-500/40 hover:border-amber-400/60 font-bold rounded-2xl shadow-md flex items-center justify-center gap-2.5 cursor-pointer transition text-sm"
            >
              <span>👨‍👩‍👧 የወላጆች ክትትል (Parent Portal)</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
