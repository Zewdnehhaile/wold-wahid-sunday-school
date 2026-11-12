import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  FolderArchive,
  Terminal,
  ExternalLink,
  X,
  AlertCircle,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface ZipDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZipDownloadModal: React.FC<ZipDownloadModalProps> = ({ isOpen, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'zip' | 'files'>('zip');
  const [selectedFile, setSelectedFile] = useState<string>('.env');

  if (!isOpen) return null;

  const directZipUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/fithapol_full_project.zip`
    : '/fithapol_full_project.zip';

  const handleBlobDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/fithapol_full_project.zip');
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'fithapol_full_project.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1500);
    } catch (err) {
      console.error('Blob download failed:', err);
      // Fallback: trigger normal download navigation
      const a = document.createElement('a');
      a.href = '/fithapol_full_project.zip';
      a.download = 'fithapol_full_project.zip';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(directZipUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  const filesContent: Record<string, { label: string; ext: string; content: string }> = {
    '.env': {
      label: '.env (ውቅር)',
      ext: 'env',
      content: `# Required Telegram configuration
BOT_TOKEN=PASTE_NEW_TOKEN_FROM_BOTFATHER_HERE

SUPER_ADMIN_ID=YOUR_TELEGRAM_NUMERIC_ID
ADMIN_IDS=

# Database
DATABASE_URL=sqlite+aiosqlite:///fithapol_sundayschool.db

# School
SCHOOL_NAME=Fithapol Sunday School
TIMEZONE=Africa/Addis_Ababa

# Existing bot identity
BOT_USERNAME=attendanceforchurchbot

# Attendance
ATTENDANCE_DAY=Sunday
ATTENDANCE_OPEN_TIME=08:00
ATTENDANCE_CLOSE_TIME=12:00

# Admin dashboard security
SECRET_KEY=GENERATE_A_LONG_RANDOM_SECRET_KEY
ADMIN_DASHBOARD_USERNAME=admin
ADMIN_DASHBOARD_PASSWORD=SET_A_STRONG_UNIQUE_PASSWORD

# Dashboard URL
ADMIN_DASHBOARD_URL=http://127.0.0.1:5001/`,
    },
    'start_all.bat': {
      label: 'start_all.bat (Windows አስነሺ)',
      ext: 'bat',
      content: `@echo off
chcp 65001 > nul
echo ========================================================
echo  የወልድ ዋሕድ ሰንበት ትምህርት ቤት (ፍትሐፖል)
echo  Wold Wahid Sunday School Bot & Admin Dashboard
echo ========================================================
echo.

echo [1/3] Python dependencies በመጫን ላይ (Installing dependencies)...
python -m pip install -r requirements.txt

echo.
echo [2/3] የአስተዳዳሪ ሰሌዳን (Admin Dashboard) በ Port 5001 በማስነሳት ላይ...
start "FithaPol Admin Dashboard (Port 5001)" cmd /k "python admin_dashboard.py"

echo.
echo [3/3] የቴሌግራም ቦት (Telegram Bot: @attendanceforchurchbot) በማስነሳት ላይ...
echo.
echo ቦቱ እየሰራ ነው! ማቆም ሲፈልጉ Ctrl + C ይጫኑ።
echo Dashboard መግቢያ: http://127.0.0.1:5001/
echo Username: admin
echo Password: set privately in .env
echo.
python bot.py
pause`,
    },
    'bot.py': {
      label: 'bot.py (ቴሌግራም ቦት)',
      ext: 'python',
      content: `"""
Wold Wahid Sunday School Telegram Bot (@attendanceforchurchbot)
"""
import os, io, datetime, qrcode
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, CallbackQueryHandler
from config import BOT_TOKEN, ORGANIZATION_NAME_AM, ADMIN_IDS, SUPER_ADMIN_ID, ATTENDANCE_DAY, ATTENDANCE_OPEN_TIME, ATTENDANCE_CLOSE_TIME, ADMIN_DASHBOARD_URL
from database import get_connection, init_db

# Grade Level Schedules
SCHEDULE_BY_GRADE = {
    "pre_kg": (
        "🧸 **የቅድመ አንደኛ መርሐ ግብር፦**\\n\\n"
        "📅 **እሁድ:**\\n"
        "• ጸሎት መክፈቻ (3:30–3:40) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
        "• ትምህርት (3:40–4:00) | ኃላፊ: ትምህርት ክፍል\\n"
        "• መዝሙር (4:00–4:15) | ኃላፊ: መዝሙር ክፍል\\n"
        "• አብነት (4:15–4:30) | ኃላፊ: አብነት ክፍል\\n"
        "• ኪነ ጥበብ (4:25–4:50) | ኃላፊ: ኪነ ጥበብ ክፍል\\n"
        "• ማስታወቂያ (4:55–5:00) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
    ),
    "grade_1_2": (
        "🎒 **የ 1ኛ እና 2ኛ ክፍል መርሐ ግብር፦**\\n\\n"
        "📅 **እሁድ:**\\n"
        "• ጸሎት መክፈቻ (3:30–3:35) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
        "• ትምህርት (3:35–4:05) | ኃላፊ: ትምህርት ክፍል\\n"
        "• ኪነ ጥበብ (4:05–4:25) | ኃላፊ: ኪነ ጥበብ ክፍል\\n"
        "• አብነት (4:25–4:50) | ኃላፊ: አብነት ክፍል\\n"
        "• መዝሙር (4:50–5:20) | ኃላፊ: መዝሙር ክፍል\\n"
        "• ማስታወቂያ (5:20–5:30) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
    ),
    "grade_3_5": (
        "📚 **የ 3ኛ–5ኛ ክፍል መርሐ ግብር፦**\\n\\n"
        "📅 **ቅዳሜ:**\\n"
        "• መክፈቻ ጸሎት (8:00–8:05) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
        "• ትምህርት (8:05–9:00) | ኃላፊ: ትምህርት ክፍል\\n"
        "• ኪነ ጥበብ (9:00–9:45) | ኃላፊ: ኪነ ጥበብ ክፍል\\n"
        "• ማስታወቂያ (9:50–10:00) | ኃላፊ: ስነ ስርዓት ክፍል\\n\\n"
        "📅 **እሁድ:**\\n"
        "• መክፈቻ ጸሎት (5:00–5:20) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
        "• ትምህርት (5:20–6:10) | ኃላፊ: ትምህርት ክፍል\\n"
        "• መዝሙር (6:10–7:00) | ኃላፊ: መዝሙር ክፍል\\n"
        "• አብነት (7:00–7:20) | ኃላፊ: አብነት ክፍል\\n"
        "• መዝጊያ ጸሎት (7:20–7:30) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
    ),
    "grade_6_9": (
        "🎓 **የ 6ኛ–9ኛ ክፍል መርሐ ግብር፦**\\n\\n"
        "📅 **አርብ:**\\n"
        "• ጸሎት (11:30–11:50) | ኃላፊ: ኪነ ጥበብ ክፍል\\n"
        "• ኪነ ጥበብ (11:50–12:30) | ኃላፊ: ኪነ ጥበብ ክፍል\\n\\n"
        "📅 **ቅዳሜ:**\\n"
        "• መክፈቻ ጸሎት (9:00–9:05) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
        "• ትምህርት (9:05–10:05) | ኃላፊ: ትምህርት ክፍል\\n"
        "• አብነት (10:05–10:35) | ኃላፊ: አብነት ክፍል\\n"
        "• መዝሙር እና ወረብ (10:35–11:50) | ኃላፊ: መዝሙር ክፍል\\n"
        "• መዝጊያ ጸሎት (11:50–11:55) | ኃላፊ: ስነ ስርዓት ክፍል\\n\\n"
        "📅 **እሁድ:**\\n"
        "• መክፈቻ ጸሎት (8:00–8:20) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
        "• ትምህርት (8:20–9:20) | ኃላፊ: ትምህርት ክፍል\\n"
        "• አብነት (9:20–9:50) | ኃላፊ: አብነት ክፍል\\n"
        "• መዝሙር እና ወረብ (9:50–10:55) | ኃላፊ: መዝሙር ክፍል\\n"
        "• መዝጊያ ጸሎት (10:55–11:00) | ኃላፊ: ስነ ስርዓት ክፍል\\n"
    ),
}

SCHEDULE_BY_DAY = {
    "friday": "📅 **የአርብ መርሐ ግብር፦**\\n\\n• **6ኛ–9ኛ ክፍል:** ጸሎት (11:30–11:50) | ኪነ ጥበብ (11:50–12:30)",
    "saturday": "📅 **የቅዳሜ መርሐ ግብር፦**\\n\\n• **3ኛ–5ኛ ክፍል:** 8:00–10:00\\n• **6ኛ–9ኛ ክፍል:** 9:00–11:55",
    "sunday": "📅 **የእሁድ መርሐ ግብር፦**\\n\\n• **ቅድመ አንደኛ:** 3:30–5:00\\n• **1ኛ እና 2ኛ:** 3:30–5:30\\n• **3ኛ–5ኛ:** 5:00–7:30\\n• **6ኛ–9ኛ:** 8:00–11:00",
}

def generate_qr_image(text: str) -> io.BytesIO:
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0F172A", back_color="#FFFFFF")
    bio = io.BytesIO()
    img.save(bio, "PNG")
    bio.seek(0)
    return bio

def check_is_admin(user_id: int):
    if user_id == SUPER_ADMIN_ID or user_id in ADMIN_IDS:
        return True, "super_admin"
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT role FROM bot_admins WHERE telegram_id = ?", (user_id,))
    row = c.fetchone()
    conn.close()
    return (True, row["role"]) if row else (False, None)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    is_admin, role = check_is_admin(user.id)
    tag = "\\n\\n👑 **ክቡር ዋና አስተዳዳሪ (Super Admin)** እንኳን ደህና መጡ!" if is_admin else ""
    kb = [
        [InlineKeyboardButton("🗓️ የክፍሎች መርሐ ግብር (በክፍል ደረጃ)", callback_data="sched_menu")],
        [InlineKeyboardButton("🪪 የእኔ ዲጂታል መታወቂያ (QR Card)", callback_data="get_card")],
        [InlineKeyboardButton("📋 የተገኘሁባቸው ቀናት", callback_data="my_attendance")],
        [InlineKeyboardButton("🤝 የድጋፍ/የጸሎት ጥያቄ", callback_data="request_support")],
    ]
    if is_admin:
        kb.append([
            InlineKeyboardButton("👑 ያልጸደቁ ተማሪዎችን አጽድቅ", callback_data="admin_pending"),
            InlineKeyboardButton("🌐 ዌብ ዳሽቦርድ (Port 5001)", callback_data="admin_panel"),
        ])
    await update.message.reply_text(f"ሰላም {user.first_name}!\\nእንኳን ወደ {ORGANIZATION_NAME_AM} ቦት በደህና መጡ።{tag}", parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(kb))

# (ለሙሉ ኮዱ start_all.bat ወይም ዚፑን ይጠቀሙ)
print("Bot configured successfully!")`,
    },
    'admin_dashboard.py': {
      label: 'admin_dashboard.py (ዳሽቦርድ Port 5001)',
      ext: 'python',
      content: `"""
FithaPol Sunday School Admin Dashboard (Flask Service - Port 5001)
"""
import os, sqlite3, datetime
from flask import Flask, render_template_string, request, redirect, url_for, session, jsonify, flash
from config import DATABASE_PATH, SECRET_KEY, ADMIN_DASHBOARD_USERNAME, ADMIN_DASHBOARD_PASSWORD, SCHOOL_NAME_AM, ATTENDANCE_DAY, ATTENDANCE_OPEN_TIME, ATTENDANCE_CLOSE_TIME, SUPER_ADMIN_ID, PORT
from database import get_connection, init_db

app = Flask(__name__)
app.secret_key = SECRET_KEY

@app.route("/")
def index():
    if not session.get("logged_in"):
        return redirect(url_for("login"))
    # (ዳሽቦርድ ገጽ እዚህ ይከፈታል)
    return f"<h1>{SCHOOL_NAME_AM} - Admin Dashboard</h1><p>Super Admin: {SUPER_ADMIN_ID}</p>"

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = request.form.get("username")
        p = request.form.get("password")
        if u == ADMIN_DASHBOARD_USERNAME and p == ADMIN_DASHBOARD_PASSWORD:
            session["logged_in"] = True
            return redirect(url_for("index"))
    return "Login form"

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5001, debug=True)`,
    },
    'requirements.txt': {
      label: 'requirements.txt',
      ext: 'txt',
      content: `python-telegram-bot>=20.0
qrcode>=7.4.2
pillow>=10.0.0
python-dotenv>=1.0.0
flask>=3.0.0
requests>=2.31.0`,
    },
  };

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleDownloadSingleFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                የፕሮጀክት ኮድ ማውረጃ (Project Code & ZIP)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  ~2.0 MB
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                የተሟላ የቴሌግራም ቦት፣ ዌብ ዳሽቦርድ እና የሰንበት ት/ቤት መርሐ ግብር
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-5 pt-3 gap-2 bg-slate-950/50">
          <button
            onClick={() => setActiveTab('zip')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'zip'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            1. ዚፕ ፋይሉን ቀጥታ አውርድ (Direct ZIP)
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'files'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            2. ፋይሎችን እዚህ ኮፒ አድርግ ወይም ለየብቻ አውርድ
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'zip' ? (
            <div className="space-y-6">
              {/* Primary Action: Direct Blob Trigger */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    📦 ሙሉውን ዚፕ ፋይል በኮምፒውተርዎ ላይ ያውርዱ
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    ፋይሉ <code className="text-amber-300 font-mono">fithapol_full_project.zip</code> (2 MB) ሲሆን፤ Python backend፣ የቴሌግራም ቦት፣ ዳሽቦርድ እና React ዌብሳይቱን በአንድ ላይ ይዟል።
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto shrink-0">
                  <button
                    onClick={handleBlobDownload}
                    disabled={downloading}
                    className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {downloading ? 'በማውረድ ላይ...' : 'አሁን አውርድ (.ZIP)'}
                  </button>
                  <a
                    href="/fithapol_full_project.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    download="fithapol_full_project.zip"
                    className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>በአዲስ ታብ አውርድ</span>
                  </a>
                </div>
              </div>

              {/* Alternative method if browser iframe blocks download */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      በብራውዘርዎ ላይ Download ካልጀመረ? (Download Link Fallback)
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      አንዳንድ ብራውዘሮች በIframe ውስጥ ሲሆኑ ዚፕ ዳውንሎድ እንዳይጀምር ሊገድቡ ይችላሉ። ከታች ያለውን ቀጥታ አድራሻ ኮፒ አድርገው በChrome/Edge በአዲስ ታብ (New Tab) Address bar ላይ ለጥፈው <strong>Enter</strong> ሲጫኑ ወዲያውኑ ይወርዳል!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl p-2">
                  <input
                    type="text"
                    readOnly
                    value={directZipUrl}
                    className="bg-transparent text-xs text-slate-300 font-mono flex-1 outline-none px-2 select-all"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">ኮፒ ተደርጓል!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>ሊንኩን ኮፒ አድርግ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions Summary */}
              <div className="border border-slate-800/80 rounded-2xl p-4 bg-slate-900/40 space-y-2.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  ከወረደ በኋላ የማስነሻ ቅደም ተከተል (Quick Start)
                </h4>
                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside pl-1">
                  <li>
                    የወረደውን ዚፕ ፋይል <strong>Right-Click</strong> አድርገው <strong>Extract All...</strong> ይበሉት።
                  </li>
                  <li>
                    ወደ <strong><code className="text-amber-300">python_backend</code></strong> ፎልደር ይግቡ።
                  </li>
                  <li>
                    <strong><code className="text-emerald-400">start_all.bat</code></strong> የሚለውን ፋይል ደብል ክሊክ ሲያደርጉት ቦቱም ዳሽቦርዱም በራሳቸው ይነሳሉ!
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            /* File Inspector & Individual Downloader */
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                ዚፑን ሳያወርዱም እያንዳንዱን ፋይል እዚህ መመልከት፣ ኮፒ ማድረግ ወይም ለየብቻ ማውረድ ይችላሉ፦
              </p>

              {/* File selector buttons */}
              <div className="flex flex-wrap gap-2">
                {Object.keys(filesContent).map((filename) => (
                  <button
                    key={filename}
                    onClick={() => setSelectedFile(filename)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                      selectedFile === filename
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {filename}
                  </button>
                ))}
              </div>

              {/* Code preview & actions */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {filesContent[selectedFile]?.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(filesContent[selectedFile].content, selectedFile)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                    >
                      {copiedCode === selectedFile ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">ኮፒ ተደርጓል!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>ኮፒ</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownloadSingleFile(selectedFile, filesContent[selectedFile].content)}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ፋይሉን አውርድ</span>
                    </button>
                  </div>
                </div>

                <pre className="p-4 text-xs font-mono text-slate-300 max-h-72 overflow-y-auto overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {filesContent[selectedFile]?.content}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Super Admin: 5281238412</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition font-medium"
          >
            ዝጋ (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
