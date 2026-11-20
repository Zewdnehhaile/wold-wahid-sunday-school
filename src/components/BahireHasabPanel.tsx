import React, { useState, useMemo } from 'react';
import { computeBahireHasab, toEthiopianDate } from '../utils/ethiopianCalendar';
import { Calendar, Sparkles, Flame, Star } from 'lucide-react';

export const BahireHasabPanel: React.FC = () => {
  const currentEth = useMemo(() => toEthiopianDate(new Date()), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentEth.year || 2019);
  const [filterType, setFilterType] = useState<'all' | 'fast' | 'feast' | 'movable'>('all');

  const bh = useMemo(() => computeBahireHasab(selectedYear), [selectedYear]);
  const todayIso = new Date().toISOString().split('T')[0];

  const filteredEvents = useMemo(() => {
    return bh.events.filter((ev) => {
      if (filterType === 'fast') return ev.category === 'fast';
      if (filterType === 'feast') return ev.category === 'feast';
      if (filterType === 'movable') return ev.isMovable;
      return true;
    });
  }, [bh, filterType]);

  const yearOptions = [
    currentEth.year - 1,
    currentEth.year,
    currentEth.year + 1,
    currentEth.year + 2,
  ];

  return (
    <div className="space-y-5">
      {/* Header & Year Selector */}
      <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-amber-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>ባሕረ ሐሳብ — የአጽዋማትና የበዓላት መቁጠሪያ ({selectedYear} ዓ.ም)</span>
          </h3>
          <p className="text-xs text-emerald-200/75 mt-1">
            የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተ-ክርስቲያን ትክክለኛ የባሕረ ሐሳብ ስሌት (ዓመተ ዓለም፣ ወንበር፣ አበቅቴ፣ መጥቅዕ እና መባጃ ሐመር)
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#062414] p-1 rounded-xl border border-[#0f4425] shrink-0">
          {yearOptions.map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedYear === yr
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-emerald-200/80 hover:text-white'
              }`}
            >
              {yr} ዓ.ም
            </button>
          ))}
        </div>
      </div>

      {/* Bahire Hasab Core Constants Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'ዓመተ ዓለም', value: `${bh.ameteAlem}`, sub: `ዘመነ ${bh.wengelawi}` },
          { label: 'መስከረም 1', value: bh.newYearDayName, sub: `${selectedYear} ዓ.ም` },
          { label: 'ወንበር (Wenber)', value: `${bh.wenber}`, sub: '(ዓ.ዓ - 1) mod 19' },
          { label: 'አበቅቴ (Abektie)', value: `${bh.abektie}`, sub: '(ወንበር × 11) mod 30' },
          { label: 'መጥቅዕ (Metqi)', value: `${bh.metqi}`, sub: `በዓለ መጥቅዕ: ${bh.bealeMetqiStr}` },
          { label: 'መባጃ ሐመር', value: `${bh.mebajaHamer}`, sub: 'የጾመ ነነዌ ቁልፍ' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-3.5 text-center shadow"
          >
            <div className="text-[11px] text-emerald-300/75 font-semibold">{card.label}</div>
            <div className="text-lg font-black text-amber-400 mt-1">{card.value}</div>
            <div className="text-[10px] text-emerald-200/60 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 bg-[#09351c] p-2.5 rounded-2xl border border-[#0f4425]">
        {[
          { id: 'all' as const, label: `ሁሉም (${bh.events.length})` },
          { id: 'fast' as const, label: '🕯️ አጽዋማት (Fasts)' },
          { id: 'feast' as const, label: '✨ በዓላት (Feasts)' },
          { id: 'movable' as const, label: '📜 ተንቀሳቃሽ (Movable)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === tab.id
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-[#062414] text-emerald-200/80 border border-[#0f4425] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredEvents.map((ev) => {
          const isNextUpcoming =
            ev.gregorianIso >= todayIso &&
            bh.events.find((x) => x.gregorianIso >= todayIso)?.id === ev.id;

          return (
            <div
              key={ev.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                isNextUpcoming
                  ? 'bg-amber-500/10 border-amber-400/70 shadow-lg shadow-amber-500/10'
                  : 'bg-[#09351c] border-[#0f4425] hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        ev.category === 'fast'
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {ev.category === 'fast' ? (
                        <span className="inline-flex items-center gap-1"><Flame className="w-3 h-3" /> ጾም</span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Star className="w-3 h-3" /> በዓል</span>
                      )}
                    </span>
                    {ev.isMovable && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        ተንቀሳቃሽ
                      </span>
                    )}
                    {isNextUpcoming && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                        ቀጣይ (Next)
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white mt-2">{ev.nameAm}</h4>
                  <p className="text-[11px] text-emerald-200/70">{ev.nameEn}</p>
                </div>

                <div className="text-right shrink-0 bg-[#062414] border border-[#0f4425] rounded-xl px-2.5 py-1.5">
                  <div className="text-xs font-black text-amber-400 flex items-center justify-end gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{ev.ethDateFormatted}</span>
                  </div>
                  <div className="text-[10px] font-mono text-emerald-200/70 mt-0.5">
                    {ev.gregorianFormatted}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-emerald-100/75 pt-2 border-t border-[#0f4425]/80">
                {ev.noteAm}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
