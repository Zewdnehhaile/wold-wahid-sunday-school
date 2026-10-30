import React, { useState } from 'react';
import { Send, Bell, CheckCircle2, AlertCircle, X, Megaphone } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminName: string;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  adminName,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    setResult(null);

    try {
      await addDoc(collection(db, 'notifications'), {
        title: title.trim() || 'ወልደ ዋሕድ ሰንበት ት/ቤት ማስታወቂያ',
        message: message.trim(),
        senderName: adminName || 'አስተዳዳሪ',
        createdAt: new Date().toISOString(),
        isBroadcast: true
      });
      setResult({
        success: true,
        text: 'ማስታወቂያው በተሳካ ሁኔታ ተልኳል!',
      });
      setTitle('');
      setMessage('');
      setTimeout(() => {
        onClose();
        setResult(null);
      }, 2200);
    } catch (err: any) {
      console.error('Broadcast failed:', err);
      setResult({
        success: false,
        text: 'ማስታወቂያውን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#09351c] border-2 border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-amber-300">
              አጠቃላይ ማስታወቂያ ላክ (Broadcast Notification)
            </h2>
            <p className="text-xs text-emerald-200/70">
              መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰ/ት/ቤት
            </p>
          </div>
        </div>

        {result && (
          <div
            className={`p-3.5 mb-4 rounded-xl text-xs flex items-center gap-2 border ${
              result.success
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500 text-rose-200'
            }`}
          >
            {result.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{result.text}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-emerald-100 mb-1">
              የማስታወቂያው ርዕስ (Title)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ምሳሌ፡ የሳምንቱ የእሁድ ትምህርት መርሐ ግብር ማሳሰቢያ"
              className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-100 mb-1">
              የማስታወቂያው ዝርዝር መልእክት (Message) *
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="መልእክትዎን እዚህ ይጻፉ... (በተንቀሳቃሽ ስልክ መተግበሪያዎች እና በቴሌግራም ቦት በቀጥታ ይደርሳል)"
              className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              ይቅር (Cancel)
            </button>
            <button
              type="submit"
              disabled={isSending || !message.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'እየተላከ ነው...' : 'ማስታወቂያውን ላክ (Broadcast)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
