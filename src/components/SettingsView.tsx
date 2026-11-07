import React, { useState, useRef, useMemo } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  ShieldCheck, 
  Bell, 
  Save, 
  RotateCcw, 
  Check, 
  Hash,
  Image as ImageIcon,
  Upload,
  FileText,
  MapPin,
  Trash2,
  PhoneCall,
  Calendar,
  Database,
  Users,
  Copy,
  ExternalLink,
  KeyRound
} from 'lucide-react';
import { UserProfile, AppSettings, ReportItem, UserRole, USER_ROLES } from '../types/report';
import { KemensosLogo } from './KemensosLogo';
import { useAuth } from '../context/AuthContext';
import { getSupabaseConfig, getSupabaseClient, isValidSupabaseUrl, isValidSupabaseKey, cleanCredentialString } from '../lib/supabase';
import { FULL_SUPABASE_SCHEMA_SQL } from '../data/supabaseSchema';

interface SettingsViewProps {
  userProfile: UserProfile;
  appSettings: AppSettings;
  reports?: ReportItem[];
  onSaveProfile: (profile: UserProfile) => void;
  onSaveSettings: (settings: AppSettings) => void;
  onResetToDefault: () => void;
  onDeleteReportsByRange?: (startDate: string, endDate: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  appSettings,
  reports = [],
  onSaveProfile,
  onSaveSettings,
  onResetToDefault,
  onDeleteReportsByRange,
}) => {
  const { 
    currentRole, 
    allUsersList, 
    updateUserRoleByAdmin, 
    isSupabaseConnected,
    supabaseStatus,
    checkSupabaseConnection 
  } = useAuth();
  const isAdmin = currentRole === 'admin';

  const [name, setName] = useState(userProfile.name);
  const [nip, setNip] = useState(userProfile.nip || '19740512 200212 1 003');
  const [email, setEmail] = useState(userProfile.email);
  const [phone, setPhone] = useState(userProfile.phone);
  const [department, setDepartment] = useState(userProfile.department);
  const [role, setRole] = useState(userProfile.role);

  // System & Kop Surat Settings
  const [ticketPrefix, setTicketPrefix] = useState(appSettings.ticketPrefix || 'Tanggal Input Laporan/Nomor Urut');
  const [helpDeskNumber, setHelpDeskNumber] = useState(appSettings.helpDeskNumber || '8800 / 8801');
  const [emailNotification, setEmailNotification] = useState(appSettings.emailNotification);
  const [whatsappNotification, setWhatsappNotification] = useState(appSettings.whatsappNotification);
  const [autoSaveDraft, setAutoSaveDraft] = useState(appSettings.autoSaveDraft);
  
  const [mainLogoUrl, setMainLogoUrl] = useState<string>(appSettings.mainLogoUrl || '');
  const [kopLogoUrl, setKopLogoUrl] = useState<string>(appSettings.kopLogoUrl || '');
  const [backgroundHeroUrl, setBackgroundHeroUrl] = useState<string>(appSettings.backgroundHeroUrl || '');
  const [kopAddress, setKopAddress] = useState<string>(
    appSettings.kopAddress || 'Jl. Raya Sumedang - Wado, Paseh, Kabupaten Sumedang, Jawa Barat 45311 | Pos-el: srt1sumedang@kemensos.go.id'
  );

  // Supabase Manual Configuration
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => {
    return localStorage.getItem('sibahar_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  });
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => {
    return localStorage.getItem('sibahar_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  });

  // Date range delete states
  const [deleteStartDate, setDeleteStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [deleteEndDate, setDeleteEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testFeedback, setTestFeedback] = useState<any>(null);

  const mainLogoInputRef = useRef<HTMLInputElement>(null);
  const kopLogoInputRef = useRef<HTMLInputElement>(null);
  const backgroundHeroInputRef = useRef<HTMLInputElement>(null);

  // Count reports in range for preview
  const matchingDeleteCount = useMemo(() => {
    if (!reports || reports.length === 0) return 0;
    const start = deleteStartDate ? new Date(deleteStartDate).getTime() : 0;
    const end = deleteEndDate ? new Date(deleteEndDate + 'T23:59:59').getTime() : Infinity;
    return reports.filter((r) => {
      const d = new Date(r.incidentDate || r.createdAt).getTime();
      return d >= start && d <= end;
    }).length;
  }, [reports, deleteStartDate, deleteEndDate]);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestFeedback(null);
    const result = await checkSupabaseConnection(supabaseUrlInput, supabaseKeyInput);
    setIsTestingConnection(false);
    setTestFeedback(result);
  };

  // File to base64 handlers
  const handleMainLogoChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setMainLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleKopLogoChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setKopLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Requirement: Upload Foto Background Lanscape Dashboard Utama
  const handleBackgroundHeroChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file background maksimal 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setBackgroundHeroUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteDateRangeDelete = () => {
    if (matchingDeleteCount === 0) {
      alert('Tidak ada laporan yang ditemukan dalam rentang tanggal tersebut.');
      return;
    }

    const confirmed = window.confirm(
      `PERINGATAN: Apakah Anda yakin ingin menghapus ${matchingDeleteCount} laporan yang tercatat dalam rentang tanggal ${deleteStartDate} s/d ${deleteEndDate}?\n\nTindakan ini bersifat permanen dan tidak dapat dibatalkan.`
    );

    if (confirmed && onDeleteReportsByRange) {
      onDeleteReportsByRange(deleteStartDate, deleteEndDate);
      alert(`Berhasil menghapus ${matchingDeleteCount} laporan dari sistem.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // compute initials
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CK';

    onSaveProfile({
      id: userProfile.id || 'usr-default',
      name: name.trim(),
      nip: nip.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department: department.trim(),
      role: role.trim(),
      roleKey: userProfile.roleKey || 'kepala_sekolah',
      avatarInitials: initials,
    });

    onSaveSettings({
      ticketPrefix: ticketPrefix.trim() || 'Tanggal Input Laporan/Nomor Urut',
      helpDeskNumber: helpDeskNumber.trim(),
      emailNotification,
      whatsappNotification,
      autoSaveDraft,
      mainLogoUrl,
      kopLogoUrl,
      kopAddress: kopAddress.trim(),
      backgroundHeroUrl,
      supabaseUrl: supabaseUrlInput.trim(),
      supabaseAnonKey: supabaseKeyInput.trim(),
    });

    const trimmedUrl = cleanCredentialString(supabaseUrlInput);
    const trimmedKey = cleanCredentialString(supabaseKeyInput);

    if (isValidSupabaseUrl(trimmedUrl) && isValidSupabaseKey(trimmedKey)) {
      localStorage.setItem('sibahar_supabase_url', trimmedUrl);
      localStorage.setItem('sibahar_supabase_key', trimmedKey);
      checkSupabaseConnection(trimmedUrl, trimmedKey);
    } else {
      localStorage.removeItem('sibahar_supabase_url');
      localStorage.removeItem('sibahar_supabase_key');
      checkSupabaseConnection('', '');
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const sqlSchemaSnippet = FULL_SUPABASE_SCHEMA_SQL;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Pengaturan Akun &amp; Preferensi Sistem SIBAHAR
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola profil pelapor, upload background landscape hero, logo kop surat, integrasi Supabase, dan hak akses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isSupabaseConnected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            <Database className="w-3.5 h-3.5" />
            <span>{isSupabaseConnected ? 'Supabase Terhubung' : 'Supabase Belum Terhubung'}</span>
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Profil & Identitas Pelapor */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Profil &amp; Identitas Pengguna ({USER_ROLES[userProfile.roleKey]?.label || userProfile.role})
              </h3>
              <p className="text-[11px] text-slate-500">
                Nama dan NIP di bawah ini otomatis dicetak pada lembar pengesahan dan berita acara PDF.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nama Lengkap &amp; Gelar <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Induk Pegawai (NIP) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="Contoh: 19740512 200212 1 003"
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs font-mono font-bold text-emerald-800"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Jabatan / Kedudukan
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Unit Kerja / Instansi
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Alamat Email Kedinasan
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Kontak / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Upload Foto Background Dashboard Utama (REQUIREMENT USER) */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Upload Foto Background Dashboard Utama (Lanscape Presisi)
              </h3>
              <p className="text-[11px] text-slate-500">
                Pasang foto pemandangan asrama, gedung sekolah, atau kegiatan untuk latar belakang hero paling atas Dashboard Utama dari ujung kiri sampai ujung kanan.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <input
              ref={backgroundHeroInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleBackgroundHeroChange(e.target.files)}
              className="hidden"
            />

            {/* Pratinjau Landscape Presisi */}
            <div className="relative w-full h-36 sm:h-48 rounded-xl overflow-hidden border border-slate-300 bg-slate-200 flex items-center justify-center shadow-inner">
              {backgroundHeroUrl ? (
                <>
                  <img
                    src={backgroundHeroUrl}
                    alt="Pratinjau Background Hero"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/70 via-transparent to-black/40 flex items-end p-3">
                    <span className="text-[11px] font-semibold text-white bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">
                      Pratinjau Background Landscape Aktif
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center p-4 text-slate-400">
                  <ImageIcon className="w-10 h-10 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada foto background kustom</p>
                  <p className="text-[11px]">Dashboard Utama saat ini menggunakan gradient hijau zamrud standar Kemensos.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => backgroundHeroInputRef.current?.click()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{backgroundHeroUrl ? 'Ganti Foto Background' : 'Upload Foto Background'}</span>
                </button>

                {backgroundHeroUrl && (
                  <button
                    type="button"
                    onClick={() => setBackgroundHeroUrl('')}
                    className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                  >
                    Hapus Background
                  </button>
                )}
              </div>

              <span className="text-[11px] text-slate-400">
                Rekomendasi rasio landscape 16:9 atau 21:9 (JPG/PNG maks. 5MB)
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Logo Utama & Kop Surat */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Kustomisasi Logo &amp; Kop Surat Resmi
              </h3>
              <p className="text-[11px] text-slate-500">
                Atur logo aplikasi sidebar, logo kop surat Kemensos, dan teks alamat resmi
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Logo Utama */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <label className="block text-slate-800 font-semibold">
                Logo Utama Aplikasi (Sidebar Brand)
              </label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                  {mainLogoUrl ? (
                    <img src={mainLogoUrl} alt="Logo Utama" className="w-full h-full object-contain" />
                  ) : (
                    <FileText className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    ref={mainLogoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMainLogoChange(e.target.files)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => mainLogoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo</span>
                    </button>
                    {mainLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setMainLogoUrl('')}
                        className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Kop Surat */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <label className="block text-slate-800 font-semibold">
                Logo Kop Surat (PDF Dokumen)
              </label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                  {kopLogoUrl ? (
                    <img src={kopLogoUrl} alt="Logo Kop" className="w-full h-full object-contain" />
                  ) : (
                    <KemensosLogo className="w-8 h-8" />
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    ref={kopLogoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleKopLogoChange(e.target.files)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => kopLogoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Kop</span>
                    </button>
                    {kopLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setKopLogoUrl('')}
                        className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs">
            <label className="block text-slate-700 font-medium mb-1">
              Alamat Lengkap untuk Kop Surat Resmi
            </label>
            <textarea
              rows={2}
              value={kopAddress}
              onChange={(e) => setKopAddress(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs font-sans"
            />
          </div>
        </div>

        {/* Section 4: Integrasi Database Supabase & Vercel */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Konfigurasi Supabase PostgreSQL &amp; Vercel Deployment
                </h3>
                <p className="text-[11px] text-slate-500">
                  Hubungkan database Supabase untuk penyimpanan cloud terpusat, notifikasi Kepala Sekolah, dan Row Level Security (RLS).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 shadow-2xs"
              >
                {isTestingConnection ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                    <span>Menguji...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Uji Koneksi Supabase</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback Status Box */}
          {(() => {
            const currentStat = testFeedback || supabaseStatus;
            if (currentStat.state === 'connected') {
              return (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Supabase Terhubung Sempurna!</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                      Kredensial valid, server terhubung, dan tabel database siap digunakan untuk sinkronisasi laporan otomatis.
                    </p>
                  </div>
                </div>
              );
            }

            if (currentStat.state === 'needs_schema') {
              return (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">!</div>
                  <div className="space-y-1">
                    <p className="font-bold">Kredensial Valid &amp; Server Supabase Terhubung!</p>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Namun tabel database (<code className="font-mono bg-white px-1 py-0.2 rounded border border-amber-200">profiles</code> &amp; <code className="font-mono bg-white px-1 py-0.2 rounded border border-amber-200">reports</code>) belum dibuat di Supabase Anda.
                    </p>
                    <p className="text-[11px] text-amber-800 font-medium">
                      👉 <strong>Solusi Mudah:</strong> Klik tombol <strong>"Salin SQL Schema"</strong> di bawah, buka menu <strong>SQL Editor</strong> di dashboard Supabase Anda, tempel (paste) kodenya dan klik <strong>Run</strong>.
                    </p>
                  </div>
                </div>
              );
            }

            if (currentStat.state === 'auth_error' || currentStat.state === 'network_error') {
              return (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">×</div>
                  <div>
                    <p className="font-bold">Koneksi Supabase Gagal</p>
                    <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                      {currentStat.message}
                    </p>
                    <p className="text-[10.5px] text-rose-700 mt-1">
                      Periksa kembali <strong>Project URL</strong> dan <strong>Anon Key</strong> di menu <em>Project Settings &gt; API</em> pada dashboard Supabase.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                <Database className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">Mode Penyimpanan Lokal Aktif (Standby)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    SIBAHAR saat ini beroperasi penuh menggunakan penyimpanan lokal browser. Masukkan kredensial Supabase di bawah jika Anda ingin mengaktifkan sinkronisasi cloud terpusat.
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1 font-mono">
                  VITE_SUPABASE_URL
                </label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={(e) => {
                    setSupabaseUrlInput(e.target.value);
                    setTestFeedback(null);
                  }}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Dapat disalin dari Supabase &gt; Project Settings &gt; API &gt; Project URL
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1 font-mono">
                  VITE_SUPABASE_ANON_KEY
                </label>
                <input
                  type="password"
                  value={supabaseKeyInput}
                  onChange={(e) => {
                    setSupabaseKeyInput(e.target.value);
                    setTestFeedback(null);
                  }}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Dapat disalin dari Supabase &gt; Project Settings &gt; API &gt; Project API keys (anon/public)
                </span>
              </div>
            </div>

            {/* Step-by-Step & SQL Copy Banner */}
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-bold text-emerald-950 text-xs block">
                    Skrip SQL Schema &amp; RLS Otomatis (Lengkap 100% Siap Pakai)
                  </span>
                  <span className="text-[11px] text-emerald-800">
                    Mencakup tabel profiles, reports, notifications, trigger notifikasi Kepala Sekolah, dan Row Level Security (RLS).
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sqlSchemaSnippet);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2500);
                    }}
                    className="px-3.5 py-1.5 bg-white border border-emerald-400 hover:bg-emerald-50 text-emerald-900 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{copiedSql ? '✓ Berhasil Disalin!' : 'Salin SQL Schema'}</span>
                  </button>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 transition shadow-2xs"
                  >
                    <span>Buka Supabase</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Panduan 3 Langkah */}
              <div className="pt-2 border-t border-emerald-200/80 text-[11px] text-emerald-900 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <span className="font-bold text-emerald-800 block mb-0.5">1. Salin Kredensial</span>
                  <span>Buka Supabase &gt; Project Settings &gt; API. Salin URL dan anon key ke kolom di atas.</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <span className="font-bold text-emerald-800 block mb-0.5">2. Jalankan SQL</span>
                  <span>Klik tombol <em>"Salin SQL Schema"</em> di atas, tempel di SQL Editor Supabase, lalu klik <strong>Run</strong>.</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <span className="font-bold text-emerald-800 block mb-0.5">3. Simpan &amp; Uji</span>
                  <span>Klik <em>"Uji Koneksi"</em> lalu klik <em>"Simpan Seluruh Pengaturan"</em> di bagian bawah formulir ini.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Kelola Pengguna (Hanya Tampil untuk Admin) */}
        {isAdmin && (
          <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-purple-100 text-purple-900">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Manajemen Akun Pengguna (Kewenangan Khusus Admin)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Kelola dan sesuaikan penetapan role untuk 6 jenis kewenangan pengguna SIBAHAR.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto text-xs">
              {allUsersList.map((u) => (
                <div key={u.id || u.email} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{u.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{u.email} · NIP: {u.nip || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.roleKey}
                      onChange={(e) => updateUserRoleByAdmin(u.id || u.email, e.target.value as UserRole)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      <option value="wali_asrama">Wali Asrama</option>
                      <option value="wali_asuh">Wali Asuh</option>
                      <option value="guru">Guru</option>
                      <option value="keamanan">Tenaga Keamanan</option>
                      <option value="admin">Admin</option>
                      <option value="kepala_sekolah">Kepala Sekolah</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Edit Nomor Help Desk */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <PhoneCall className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Edit Nomor Help Desk &amp; Meja Siaga
              </h3>
              <p className="text-xs text-slate-500">
                Atur nomor ekstensi atau saluran telepon bantuan darurat yang tampil di panel sidebar
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs items-center">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Ekstensi / Telepon Help Desk
              </label>
              <input
                type="text"
                value={helpDeskNumber}
                onChange={(e) => setHelpDeskNumber(e.target.value)}
                placeholder="Contoh: 8800 / 8801 atau (0261) 201234"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs font-bold text-slate-800"
              />
            </div>
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs">
              <span className="text-emerald-800 font-semibold block text-[11px]">Pratinjau Tampilan Sidebar:</span>
              <p className="font-mono font-bold text-emerald-950 text-sm mt-1">
                Ext. Help Desk: <span className="underline">{helpDeskNumber || '8800 / 8801'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Section 7: Hapus Laporan dengan Rentang Waktu */}
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-rose-100 text-rose-700">
            <Trash2 className="w-5 h-5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Hapus Semua Laporan Berdasarkan Rentang Waktu
              </h3>
              <p className="text-xs text-slate-500">
                Pilih periode tanggal kejadian untuk menghapus kumpulan riwayat laporan secara massal
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tanggal Mulai</span>
                </label>
                <input
                  type="date"
                  value={deleteStartDate}
                  onChange={(e) => setDeleteStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-rose-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tanggal Selesai</span>
                </label>
                <input
                  type="date"
                  value={deleteEndDate}
                  onChange={(e) => setDeleteEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-rose-500 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-rose-900 font-bold block text-sm">
                  Laporan Terdeteksi: <strong className="font-mono text-base text-rose-700">{matchingDeleteCount}</strong> tiket
                </span>
                <span className="text-[11px] text-rose-700 mt-0.5 block">
                  Periode kejadian: {deleteStartDate || 'Awal'} s/d {deleteEndDate || 'Sekarang'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleExecuteDateRangeDelete}
                disabled={matchingDeleteCount === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {matchingDeleteCount} Laporan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onResetToDefault}
            className="px-4 py-2 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Contoh Default</span>
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" /> Pengaturan berhasil disimpan!
              </span>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
