import React, { useState } from 'react';
import { Member, Language } from '../types';
import { QRCodeView } from './QRCodeView';
import { FITHAPOL_LOGO, AVATAR_MALE, AVATAR_FEMALE } from '../data/initialData';
import { t } from '../utils/translations';
import { Printer, X, ShieldCheck, Phone, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

interface IdCardStudioProps {
  members: Member[];
  selectedMember: Member | null;
  onClose: () => void;
  lang: Language;
}

export const IdCardStudio: React.FC<IdCardStudioProps> = ({
  members,
  selectedMember,
  onClose,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [currentMember, setCurrentMember] = useState<Member>(selectedMember || members[0]);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');
  const [isDownloading, setIsDownloading] = useState(false);

  const dict = t[lang];

  const handlePrint = () => {
    window.print();
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, gender?: 'male' | 'female') => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;
  };

  const downloadSingleCard = async () => {
    const cardEl = document.getElementById('printable-single-badge');
    if (!cardEl) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardEl, {
        pixelRatio: 3,
        backgroundColor: '#062414',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `ID_${currentMember.fullNameAm.replace(/\s+/g, '_')}_${currentMember.code}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download card image:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadAllCards = async () => {
    setIsDownloading(true);
    try {
      const cardNodes = document.querySelectorAll('.batch-card-item');
      for (let i = 0; i < cardNodes.length; i++) {
        const node = cardNodes[i] as HTMLElement;
        const member = members[i];
        if (node && member) {
          const dataUrl = await toPng(node, {
            pixelRatio: 3,
            backgroundColor: '#062414',
            cacheBust: true,
          });
          const link = document.createElement('a');
          link.download = `ID_${member.fullNameAm.replace(/\s+/g, '_')}_${member.code}.png`;
          link.href = dataUrl;
          link.click();
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    } catch (err) {
      console.error('Failed to batch download cards:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!currentMember) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto">
      {/* Control bar */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-4 mb-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {dict.idCard.previewTitle}
            </h3>
            <p className="text-xs text-slate-400">
              {currentMember.fullNameAm} · {currentMember.code}
            </p>
          </div>
        </div>

        {/* View toggles & actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800/80 p-1 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'single'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lang === 'am' ? 'ነጠላ ካርድ' : 'Single Card'}
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'batch'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lang === 'am' ? 'የጅምላ ማተሚያ (A4)' : 'Batch A4 Print'}
            </button>
          </div>

          {activeTab === 'single' && (
            <div className="bg-slate-800/80 p-1 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setCardSide('front')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  cardSide === 'front'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {dict.idCard.frontSide}
              </button>
              <button
                onClick={() => setCardSide('back')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  cardSide === 'back'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {dict.idCard.backSide}
              </button>
            </div>
          )}

          {/* PNG Download Action Button */}
          {activeTab === 'single' ? (
            <button
              onClick={downloadSingleCard}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{lang === 'am' ? 'ካርድ በ PNG አውርድ' : 'Download PNG'}</span>
            </button>
          ) : (
            <button
              onClick={downloadAllCards}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{lang === 'am' ? 'ሁሉንም በ PNG አውርድ' : 'Download All PNGs'}</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>{dict.idCard.printBtn}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      {activeTab === 'single' ? (
        <div className="flex flex-col items-center justify-center p-6 w-full max-w-xl">
          {/* CR80 Standard Proportions: ~85.6mm x 53.98mm */}
          <div
            id="printable-single-badge"
            style={{
              backgroundColor: '#062414',
              backgroundImage: 'linear-gradient(to bottom right, #0f172a, #062414, #022c22)',
              borderColor: '#f59e0b',
            }}
            className="w-[380px] h-[240px] sm:w-[420px] sm:h-[265px] text-white rounded-2xl p-5 shadow-2xl border-2 relative overflow-hidden flex flex-col justify-between"
          >
            {/* Top gold banner */}
            <div
              style={{
                backgroundImage: 'linear-gradient(to right, #d97706, #fbbf24, #d97706)',
              }}
              className="absolute top-0 left-0 right-0 h-2"
            />

            {cardSide === 'front' ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={FITHAPOL_LOGO}
                      alt="Logo"
                      className="w-10 h-10 rounded-full border border-amber-400/50 object-cover shadow-sm"
                      onError={handleImageError}
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-xs font-bold tracking-tight text-amber-400 font-sans">
                        የወልድ ዋሕድ ሰንበት ት/ቤት
                      </h4>
                      <p className="text-[10px] tracking-wider text-slate-300 uppercase font-sans">
                        Wold Wahid Sunday School
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                      {currentMember.code}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="flex items-center gap-4 my-auto">
                  <div className="relative shrink-0">
                    <img
                      src={currentMember.photoUrl}
                      alt={currentMember.fullNameAm}
                      className="w-20 h-24 rounded-xl object-cover border-2 border-amber-400/60 shadow-md bg-slate-900"
                      onError={(e) => handleImageError(e, currentMember.gender)}
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1 py-0.5 rounded bg-slate-950/80 text-amber-300 border border-amber-400/40">
                      {currentMember.bloodGroup || 'O+'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs sm:text-sm font-bold text-white leading-tight break-words font-sans">
                      {currentMember.fullNameAm}
                    </h5>
                    <p className="text-[11px] sm:text-xs text-slate-300 font-medium leading-tight break-words font-sans mt-0.5">
                      {currentMember.fullNameEn}
                    </p>

                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 font-medium">ክፍል:</span>
                        <span className="text-slate-200">{dict.departments[currentMember.department] || currentMember.department}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-400 font-medium">ስልክ:</span>
                        <span className="font-mono text-slate-200">{currentMember.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="shrink-0 flex flex-col items-center justify-center p-1.5 bg-white rounded-xl shadow-md">
                    <QRCodeView value={currentMember.code} size={64} />
                    <span className="text-[8px] font-mono font-bold text-slate-900 mt-0.5">
                      SCAN ID
                    </span>
                  </div>
                </div>

                {/* Footer Strip */}
                <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[9px] text-slate-400">
                  <span>ተመዝግቧል: {currentMember.registeredDate}</span>
                  <span className="text-amber-400/80 font-medium">የአባልነት መታወቂያ</span>
                </div>
              </>
            ) : (
              /* Back Side of the Card */
              <div className="h-full flex flex-col justify-between text-xs">
                <div>
                  <h5 className="text-[11px] font-bold text-amber-400 mb-1 border-b border-slate-800 pb-1">
                    የአባልነት ውል እና ደንብ
                  </h5>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    {dict.idCard.terms}
                  </p>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 my-auto">
                  <div className="text-[10px] font-semibold text-amber-300 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>የአደጋ ጊዜ ተጠሪ (Emergency Contact):</span>
                  </div>
                  <p className="text-[11px] text-slate-100 font-medium">
                    {currentMember.emergencyContact.name} ({currentMember.emergencyContact.relation})
                  </p>
                  <p className="text-[10px] font-mono text-slate-300">
                    {currentMember.emergencyContact.phone}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                  <div>
                    <p className="text-[9px]">አድራሻ፡ {currentMember.subcity}</p>
                  </div>
                  <div className="text-right">
                    <div className="h-6 w-24 border-b border-dashed border-amber-400/60 mb-0.5" />
                    <span className="text-[8px] text-slate-400">{dict.idCard.authorizedSignature}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Member Picker below card */}
          <div className="no-print mt-6 flex items-center gap-2 overflow-x-auto max-w-full p-2 bg-slate-900/60 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 shrink-0 px-2 font-medium">
              {lang === 'am' ? 'አባል ይምረጡ:' : 'Select Member:'}
            </span>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setCurrentMember(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  currentMember.id === m.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{m.fullNameAm.split(' ')[0]}</span>
                <span className="text-[10px] font-mono text-slate-500">{m.code.slice(-4)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Batch A4 Print View: 2 Cards Vertical Stack (1 col x 2 rows per page) */
        <div className="w-full max-w-4xl bg-slate-900 p-6 rounded-2xl border border-slate-800 overflow-y-auto max-h-[75vh]">
          <div className="no-print mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center justify-between">
            <span>
              {lang === 'am'
                ? 'የ A4 ማተሚያ ገጽታ፦ በአንድ ገጽ 2 መታወቂያዎች (ከላይ እና ከታች) ተዘጋጅተዋል።'
                : 'A4 Print Layout: 2 cards per page (stacked top and bottom).'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadAllCards}
                disabled={isDownloading}
                className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{lang === 'am' ? 'ሁሉንም በ PNG አውርድ' : 'Download All PNGs'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> {dict.idCard.printBtn}
              </button>
            </div>
          </div>

          <div
            id="batch-print-grid"
            className="flex flex-col items-center gap-6 p-4 bg-slate-950 rounded-xl border border-slate-800 max-w-2xl mx-auto"
          >
            {members.map((m) => (
              <div key={m.id} className="batch-card-wrapper w-full flex justify-center">
                <div
                  style={{
                    backgroundColor: '#062414',
                    backgroundImage: 'linear-gradient(to bottom right, #0f172a, #062414, #022c22)',
                    borderColor: '#f59e0b',
                  }}
                  className="batch-card-item w-[380px] sm:w-[420px] max-w-full h-[240px] text-white rounded-2xl p-4 border flex flex-col justify-between relative overflow-hidden shadow-xl"
                >
                  <div
                    style={{
                      backgroundImage: 'linear-gradient(to right, #d97706, #fbbf24, #d97706)',
                    }}
                    className="absolute top-0 left-0 right-0 h-1.5"
                  />
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={FITHAPOL_LOGO}
                        alt="Logo"
                        className="w-8 h-8 rounded-full border border-amber-400/50 object-cover"
                        onError={handleImageError}
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-xs font-bold text-amber-400">የወልድ ዋሕድ ሰ/ት/ቤት</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {m.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5 my-auto">
                    <img
                      src={m.photoUrl}
                      alt={m.fullNameAm}
                      className="w-18 h-22 rounded-xl object-cover border border-amber-400/60 shadow-md shrink-0 bg-slate-900"
                      onError={(e) => handleImageError(e, m.gender)}
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <h6 className="text-xs font-bold text-white leading-tight break-words font-sans">{m.fullNameAm}</h6>
                      <p className="text-[11px] text-slate-300 leading-tight break-words font-sans mt-0.5">{m.fullNameEn}</p>
                      <p className="text-[10px] text-amber-400 mt-1.5 font-medium">{dict.departments[m.department] || m.department}</p>
                      <p className="text-[10px] font-mono text-slate-300 mt-0.5">{m.phone}</p>
                    </div>
                    <div className="p-1.5 bg-white rounded-xl shrink-0 shadow-sm flex flex-col items-center">
                      <QRCodeView value={m.code} size={58} />
                      <span className="text-[7px] font-mono font-bold text-slate-900 mt-0.5">SCAN ID</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between text-[9px] text-slate-400">
                    <span>ተመዝግቧል: {m.registeredDate}</span>
                    <span className="text-amber-400 font-medium">የአባልነት መታወቂያ</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
