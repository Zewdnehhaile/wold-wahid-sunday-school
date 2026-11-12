import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, CheckCircle, Info, Sparkles, X, ShieldCheck } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  onOpenApp?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '', onOpenApp }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  const isTelegram = typeof window !== 'undefined' && (
    Boolean((window as any).Telegram?.WebApp?.initData) ||
    /Telegram/i.test(navigator.userAgent) ||
    window.location.search.includes('tgWebApp')
  );

  const handleInstallClick = async () => {
    // 1. If Telegram Mini App has native addToHomeScreen (Bot API 8.0+)
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && typeof tg.addToHomeScreen === 'function') {
      try {
        tg.addToHomeScreen();
        return;
      } catch (e) {
        console.log('Telegram addToHomeScreen failed:', e);
      }
    }

    // 2. If in Telegram WebApp without direct install
    if (isTelegram) {
      setShowTelegramGuide(true);
      return;
    }

    // 3. If standard PWA prompt is ready
    if (isInstallable) {
      await install();
      return;
    }

    // 4. Fallback guide
    setShowAndroidGuide(true);
  };

  if (isInstalled) {
    return (
      <div className={`flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl ${className}`}>
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <span>መተግበሪያው ተጭኗል (PWA Installed)</span>
      </div>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-3 rounded-2xl cursor-pointer ${className}`}
        >
          <Smartphone className="w-5 h-5" />
          <span>በ iPhone / iPad ላይ ለመጫን</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#09351c] border border-[#0f4425] p-6 shadow-2xl text-white">
              <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <Info className="w-5 h-5" />
                በ iPhone / Safari መጫኛ መመሪያ
              </h3>
              <div className="mt-4 space-y-3 text-sm text-emerald-100">
                <p>1. በ Safari ማሰሻ ከታች ያለውን <strong>Share (አጋራ)</strong> ምልክት ይጫኑ።</p>
                <p>2. ወደ ታች ዝቅ ብለው <strong>"Add to Home Screen" (ወደ መነሻ ገጽ ጨምር)</strong> የሚለውን ይምረጡ።</p>
                <p>3. በላይኛው ቀኝ በኩል <strong>Add</strong> የሚለውን ይጫኑ።</p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-amber-500 py-2.5 font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
              >
                ተረድቻለሁ (Close)
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-lg transition active:scale-95 cursor-pointer ${className}`}
      >
        <Smartphone className="w-5 h-5" />
        <span>መተግበሪያውን በስልክዎ ላይ ይጫኑ (Install App)</span>
      </button>

      {/* Telegram-specific Info Modal */}
      {showTelegramGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#09351c] border border-amber-500/30 p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#0f4425]">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Sparkles className="w-5 h-5" />
                <span>የቴሌግራም ሚኒ አፕ መመሪያ</span>
              </div>
              <button
                onClick={() => setShowTelegramGuide(false)}
                className="p-1 rounded-lg text-emerald-300 hover:bg-emerald-900/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-emerald-100 leading-relaxed">
              <div className="p-3 bg-[#062414] rounded-xl border border-emerald-900 space-y-1.5">
                <p className="font-semibold text-amber-300 text-sm">💡 ተጨማሪ ዳውንሎድ አያስፈልግዎትም!</p>
                <p>
                  አሁን በቴሌግራም ውስጥ ስለሆኑ አፑን ዳውንሎድ ሳያደርጉ ሁሉንም አገልግሎት (የአድሚን QR ስካነር፣ የተማሪ መታወቂያ እና አቴንዳንስ) እዚሁ በቀጥታ መጠቀም ይችላሉ።
                </p>
              </div>

              <div className="p-3 bg-[#062414]/60 rounded-xl border border-[#0f4425] space-y-1">
                <p className="font-medium text-emerald-200">📌 ወደ ስልክዎ Home Screen ለመጨመር ከፈለጉ:</p>
                <p className="text-[11px] text-emerald-300/80">
                  በቴሌግራም የላይኛው ቀኝ ጥግ ያለውን ሦስት ነጥብ (፧) ተጭነው <strong>"Open in Chrome"</strong> በማለት በብራውዘር መጫን ይችላሉ።
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {onOpenApp && (
                <button
                  onClick={() => {
                    setShowTelegramGuide(false);
                    onOpenApp();
                  }}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>በቀጥታ ወደ አፑ ይግቡ (Open Web App Now)</span>
                </button>
              )}
              <button
                onClick={() => setShowTelegramGuide(false)}
                className="w-full py-2.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                ተረድቻለሁ (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Android Browser Fallback Modal */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#09351c] border border-[#0f4425] p-6 shadow-2xl text-white space-y-4">
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <Info className="w-5 h-5" />
              መተግበሪያውን የመጫኛ መመሪያ
            </h3>
            <p className="text-xs text-emerald-100 leading-relaxed">
              በብራውዘርዎ የሜኑ ምልክት (⋮ ወይም ሦስት ነጥብ) ተጭነው <strong>"Add to Home Screen"</strong> ወይም <strong>"Install App"</strong> የሚለውን ይምረጡ።
            </p>
            <button
              onClick={() => setShowAndroidGuide(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
            >
              ተረድቻለሁ (Close)
            </button>
          </div>
        </div>
      )}
    </>
  );
};

