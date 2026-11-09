import React, { useState, useMemo } from 'react';
import { 
  FilePlus, 
  ListFilter, 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ArrowRight,
  Eye,
  ShieldCheck,
  Building2,
  PhoneCall,
  Sparkles,
  Info,
  Users,
  Settings as SettingsIcon,
  Search,
  Filter,
  GraduationCap,
  Shield,
  Home,
  HeartHandshake
} from 'lucide-react';
import { ReportItem, UserProfile, AppSettings, UserRole, USER_ROLES } from '../types/report';
import { categoryLabels, priorityLabels, statusLabels, formatDateOnly, formatDateTime } from '../utils/formatters';
import { KemensosLogo } from './KemensosLogo';
import { useAuth } from '../context/AuthContext';

interface MainDashboardViewProps {
  reports: ReportItem[];
  userProfile: UserProfile;
  appSettings: AppSettings;
  onNavigateToTab: (tab: 'create' | 'stats' | 'history' | 'settings') => void;
  onViewReport: (report: ReportItem) => void;
}

export const MainDashboardView: React.FC<MainDashboardViewProps> = ({
  reports,
  userProfile,
  appSettings,
  onNavigateToTab,
  onViewReport,
}) => {
  const { currentRole, allUsersList } = useAuth();
  const isKepalaSekolah = currentRole === 'kepala_sekolah';
  const isAdmin = currentRole === 'admin';

  // Sesuai Aturan RBAC:
  // - Kepala Sekolah melihat seluruh laporan dari semua pengguna
  // - Pengguna lain hanya melihat laporan miliknya sendiri
  const accessibleReports = useMemo(() => {
    if (isKepalaSekolah) {
      return reports.filter((r) => r.status !== 'draft');
    }
    // Non-kepala sekolah hanya laporan pribadi
    return reports.filter((r) => 
      (r.userId && userProfile.id && r.userId === userProfile.id) ||
      r.reporterName.toLowerCase() === userProfile.name.toLowerCase()
    );
  }, [reports, isKepalaSekolah, userProfile]);

  // Filter khusus Kepala Sekolah
  const [kepalaFilterRole, setKepalaFilterRole] = useState<string>('all');
  const [kepalaFilterCategory, setKepalaFilterCategory] = useState<string>('all');
  const [kepalaSearchQuery, setKepalaSearchQuery] = useState<string>('');

  const filteredKepalaReports = useMemo(() => {
    return accessibleReports.filter((r) => {
      if (kepalaFilterRole !== 'all' && r.userRole !== kepalaFilterRole) return false;
      if (kepalaFilterCategory !== 'all' && r.category !== kepalaFilterCategory) return false;
      if (kepalaSearchQuery.trim()) {
        const q = kepalaSearchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchReporter = r.reporterName.toLowerCase().includes(q);
        const matchDesc = r.description.toLowerCase().includes(q);
        const matchId = r.id.toLowerCase().includes(q);
        if (!matchTitle && !matchReporter && !matchDesc && !matchId) return false;
      }
      return true;
    });
  }, [accessibleReports, kepalaFilterRole, kepalaFilterCategory, kepalaSearchQuery]);

  // Statistik role untuk Kepala Sekolah
  const countByStaffRole = useMemo(() => {
    return {
      wali_asrama: reports.filter((r) => r.userRole === 'wali_asrama').length,
      wali_asuh: reports.filter((r) => r.userRole === 'wali_asuh').length,
      guru: reports.filter((r) => r.userRole === 'guru').length,
      keamanan: reports.filter((r) => r.userRole === 'keamanan').length,
      admin: reports.filter((r) => r.userRole === 'admin').length,
      kepala_sekolah: reports.filter((r) => r.userRole === 'kepala_sekolah').length,
    };
  }, [reports]);

  const pendingCount = accessibleReports.filter((r) => r.status === 'menunggu').length;
  const inProgressCount = accessibleReports.filter((r) => r.status === 'diproses').length;
  const resolvedCount = accessibleReports.filter((r) => r.status === 'selesai').length;
  const nihilCount = accessibleReports.filter((r) => r.category === 'nihil' || r.priority === 'nihil').length;

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const roleInfo = USER_ROLES[currentRole] || USER_ROLES.guru;

  return (
    <div className="space-y-6">
      
      {/* ================= HERO HEADER LANDSCAPE: SEKOLAH RAKYAT & SIBAHAR ================= */}
      {/* Precision landscape container from edge to edge with custom uploaded photo support */}
      <div 
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl border border-emerald-600/30 text-white min-h-[220px] sm:min-h-[240px] flex flex-col justify-between"
        style={
          appSettings.backgroundHeroUrl ? {
            backgroundImage: `url(${appSettings.backgroundHeroUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          } : {
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #115e59 100%)',
          }
        }
      >
        {/* Layer Gradient Overlay agar teks selalu terbaca kontras & presisi */}
        <div className={`absolute inset-0 ${appSettings.backgroundHeroUrl ? 'bg-gradient-to-r from-emerald-950/95 via-emerald-900/85 to-teal-950/80 backdrop-blur-[1px]' : 'bg-gradient-to-r from-emerald-900/90 via-emerald-800/80 to-teal-900/70'}`} />

        {/* Decorative Kemensos Watermark */}
        <div className="absolute right-6 bottom-0 opacity-15 pointer-events-none hidden md:block">
          <KemensosLogo className="w-56 h-56 text-white" />
        </div>

        {/* Content Box */}
        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            {/* Tag Lembaga Resmi & Badge Hak Akses */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/25 text-xs text-emerald-100 font-semibold shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Kementerian Sosial Republik Indonesia</span>
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-400/90 text-slate-900 font-bold rounded-full text-[11px] shadow-2xs">
                <span>Role: {roleInfo.label}</span>
              </div>
            </div>

            {/* Nama Instansi: Selector 2 -> color: #ffff00 */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-tight drop-shadow-md text-[#ffff00]">
              Sekolah Rakyat Terintegerasi 1 Sumedang
            </h1>

            {/* Kata SIBAHAR (Selector 4: color: #ffffff) & Akronim (Selector 3: font-style: italic) */}
            <div className="pt-1 border-t border-emerald-500/50">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black tracking-wider text-[#ffffff] font-mono drop-shadow-md">
                  SIBAHAR
                </span>
                <span className="text-xs sm:text-sm font-medium text-emerald-100 tracking-wide italic">
                  (Sistem Informasi Berita Aktual Harian)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1.5 leading-relaxed max-w-2xl drop-shadow-xs">
                Platform terpadu pemantauan berita harian, pencatatan insiden siswa, asesmen kedisiplinan, serta pelaporan resmi terintegerasi ke Kementerian Sosial Republik Indonesia.
              </p>
            </div>
          </div>

          {/* Quick Date and Profile Card */}
          <div className="bg-white/15 backdrop-blur-md p-4 rounded-2xl border border-white/25 flex flex-col justify-between shrink-0 min-w-[230px] shadow-sm">
            <div>
              <div className="flex items-center justify-between text-xs text-emerald-200 mb-1">
                <span>Tanggal Aktif:</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" />
              </div>
              <p className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-300" />
                {todayStr}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/20 text-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-emerald-900 border-2 border-emerald-300 shadow-xs shrink-0 overflow-hidden flex items-center justify-center font-bold text-xs">
                {userProfile.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt={userProfile.name} className="w-full h-full object-cover" />
                ) : (
                  userProfile.avatarInitials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-emerald-200 text-[10px] uppercase font-bold tracking-wider">Pengguna Aktif:</span>
                <p className="font-bold text-white truncate text-xs sm:text-sm mt-0.5" title={userProfile.name}>
                  {userProfile.name}
                </p>
                <p className="text-emerald-300 text-[10.5px] font-medium truncate">{userProfile.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ROLE-TAILORED METRICS & SECTIONS ================= */}
      
      {/* 1. DASHBOARD KHUSUS KEPALA SEKOLAH (PENGAWASAN TERPUSAT & STATISTIK ROLE) */}
      {isKepalaSekolah && (
        <div className="space-y-6">
          {/* Banner Info Pengawasan Kepala Sekolah */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between flex-wrap gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <span>Pusat Kendali Pengawasan Kepala Sekolah</span>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                    Otomatis Masuk Real-Time
                  </span>
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
                  Setiap kali pengguna (Wali Asrama, Wali Asuh, Guru, Tenaga Keamanan, Admin) membuat laporan, data otomatis langsung masuk ke akun Kepala Sekolah.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono font-bold text-emerald-900 bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs">
                Total Masuk: {reports.filter(r => r.status !== 'draft').length} Tiket
              </span>
            </div>
          </div>

          {/* Breakdown Jumlah Laporan per Jabatan (Poin 6: Kepala Sekolah) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-center shadow-2xs hover:border-emerald-400 transition">
              <Home className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-[11px] text-slate-500 font-semibold">Wali Asrama</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{countByStaffRole.wali_asrama}</p>
              <span className="text-[9.5px] text-emerald-700">laporan asrama</span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-center shadow-2xs hover:border-teal-400 transition">
              <HeartHandshake className="w-5 h-5 text-teal-600 mx-auto mb-1" />
              <p className="text-[11px] text-slate-500 font-semibold">Wali Asuh</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{countByStaffRole.wali_asuh}</p>
              <span className="text-[9.5px] text-teal-700">pembinaan siswa</span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-center shadow-2xs hover:border-blue-400 transition">
              <GraduationCap className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-[11px] text-slate-500 font-semibold">Guru</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{countByStaffRole.guru}</p>
              <span className="text-[9.5px] text-blue-700">pembelajaran</span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-center shadow-2xs hover:border-amber-400 transition">
              <Shield className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-[11px] text-slate-500 font-semibold">Keamanan</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{countByStaffRole.keamanan}</p>
              <span className="text-[9.5px] text-amber-700">keamanan &amp; SOP</span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-center shadow-2xs hover:border-purple-400 transition">
              <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <p className="text-[11px] text-slate-500 font-semibold">Admin</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{countByStaffRole.admin}</p>
              <span className="text-[9.5px] text-purple-700">administrasi</span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-center shadow-2xs hover:border-rose-400 transition">
              <ShieldCheck className="w-5 h-5 text-rose-600 mx-auto mb-1" />
              <p className="text-[11px] text-slate-500 font-semibold">Kepala Sekolah</p>
              <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">{countByStaffRole.kepala_sekolah}</p>
              <span className="text-[9.5px] text-rose-700">laporan pimpinan</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. DASHBOARD ADMIN: STATISTIK AKUN PENGGUNA & PENGATURAN APLIKASI */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-purple-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-purple-800">
              <span className="text-xs font-bold uppercase tracking-wider">Statistik Akun Pengguna</span>
              <Users className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono">{allUsersList.length} Akun</p>
            <p className="text-xs text-slate-500">6 jenis kewenangan hak akses terdaftar di sistem SIBAHAR.</p>
          </div>

          <div 
            onClick={() => onNavigateToTab('settings')}
            className="p-5 bg-white rounded-2xl border border-emerald-200 shadow-sm hover:border-emerald-400 transition cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-xs font-bold uppercase tracking-wider">Pengaturan Aplikasi</span>
              <SettingsIcon className="w-5 h-5 group-hover:rotate-45 transition-transform" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Kelola Logo, Kop &amp; Help Desk</h4>
            <p className="text-xs text-slate-500">Kustomisasi alamat, background hero, dan nomor darurat.</p>
          </div>

          <div 
            onClick={() => onNavigateToTab('create')}
            className="p-5 bg-white rounded-2xl border border-blue-200 shadow-sm hover:border-blue-400 transition cursor-pointer space-y-2 group"
          >
            <div className="flex items-center justify-between text-blue-700">
              <span className="text-xs font-bold uppercase tracking-wider">Laporan Pribadi Admin</span>
              <FilePlus className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Buat Laporan Baru</h4>
            <p className="text-xs text-slate-500">Input kendala sarana IT atau laporan operasional kantor.</p>
          </div>
        </div>
      )}

      {/* 4-CARD OVERVIEW: RESOLUSI & STATUS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Laporan */}
        <div 
          onClick={() => onNavigateToTab('history')}
          className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">
              {isKepalaSekolah ? 'Total Seluruh Laporan Masuk' : 'Total Laporan Pribadi'}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {accessibleReports.length}
            </span>
            <span className="text-xs text-emerald-700 font-medium">berita terdaftar</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {isKepalaSekolah ? 'Seluruh laporan staf terpusat' : 'Hanya laporan milik akun Anda'}
          </p>
        </div>

        {/* Dalam Penanganan */}
        <div 
          onClick={() => onNavigateToTab('history')}
          className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md hover:border-amber-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Dalam Penanganan</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-800 font-mono tabular-nums">
              {inProgressCount}
            </span>
            <span className="text-xs text-amber-700 font-medium">dalam proses</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            <span className="font-semibold text-slate-600">{pendingCount}</span> menunggu verifikasi awal
          </p>
        </div>

        {/* Laporan Selesai */}
        <div 
          onClick={() => onNavigateToTab('history')}
          className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Tuntas / Selesai</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700 font-mono tabular-nums">
              {resolvedCount}
            </span>
            <span className="text-xs text-emerald-800 font-medium">terkelola tuntas</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Resolusi mediasi &amp; tindak lanjut
          </p>
        </div>

        {/* Laporan Nihil / Kondusif */}
        <div 
          onClick={() => onNavigateToTab('history')}
          className="bg-white p-5 rounded-2xl border border-teal-100 shadow-sm hover:shadow-md hover:border-teal-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Laporan Nihil / Aman</span>
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl group-hover:bg-teal-600 group-hover:text-white transition">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-teal-800 font-mono tabular-nums">
              {nihilCount}
            </span>
            <span className="text-xs text-teal-700 font-medium">kondusif</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Situasi aman &amp; terkendali
          </p>
        </div>
      </div>

      {/* ================= ACTION HUB & SHORTCUTS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => onNavigateToTab('create')}
          className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-5 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <FilePlus className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-base text-white">Buat Laporan Baru</h3>
            </div>
            <p className="text-xs text-emerald-100 leading-relaxed">
              Catat laporan sesuai wewenang role Anda ({roleInfo.label}).
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition shrink-0 ml-3" />
        </div>

        <div 
          onClick={() => onNavigateToTab('stats')}
          className="bg-white border border-emerald-200 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-400 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Ringkasan Statistik</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Analisis grafik kasus ringan, sedang, berat, dan tren mingguan.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition shrink-0 ml-3" />
        </div>

        <div 
          onClick={() => onNavigateToTab('history')}
          className="bg-white border border-emerald-200 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-400 transition cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <ListFilter className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Riwayat &amp; Status</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isKepalaSekolah ? 'Audit seluruh laporan masuk staf' : 'Kelola tiket & draft laporan Anda'}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition shrink-0 ml-3" />
        </div>
      </div>

      {/* ================= FILTER & SEARCH BAR (KHUSUS KEPALA SEKOLAH) ================= */}
      {isKepalaSekolah && (
        <div className="p-4 bg-white rounded-2xl border border-emerald-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-700 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-emerald-800">
              <Filter className="w-4 h-4" /> Filter Laporan Seluruh Staf (Kepala Sekolah)
            </span>
            <span className="font-mono text-slate-500">{filteredKepalaReports.length} laporan cocok</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={kepalaSearchQuery}
                onChange={(e) => setKepalaSearchQuery(e.target.value)}
                placeholder="Cari judul, nama pelapor, tiket..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>

            {/* Filter by Role / Jabatan */}
            <select
              value={kepalaFilterRole}
              onChange={(e) => setKepalaFilterRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-emerald-500 text-xs"
            >
              <option value="all">Semua Jabatan Pembuat Laporan</option>
              <option value="wali_asrama">Wali Asrama</option>
              <option value="wali_asuh">Wali Asuh</option>
              <option value="guru">Guru</option>
              <option value="keamanan">Tenaga Keamanan</option>
              <option value="admin">Admin</option>
              <option value="kepala_sekolah">Kepala Sekolah</option>
            </select>

            {/* Filter by Category */}
            <select
              value={kepalaFilterCategory}
              onChange={(e) => setKepalaFilterCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-emerald-500 text-xs"
            >
              <option value="all">Semua Kategori Laporan</option>
              <option value="kategori_1">Tata Tertib, Relasi &amp; Adaptasi</option>
              <option value="kategori_2">Tata Tertib &amp; Perundungan</option>
              <option value="kategori_3">Keselamatan &amp; Hukum</option>
              <option value="kegiatan_asrama">Kegiatan Asrama</option>
              <option value="pengasuhan">Pengasuhan &amp; Karakter</option>
              <option value="pembelajaran">Pembelajaran &amp; Kelas</option>
              <option value="keamanan_lingkungan">Keamanan Lingkungan</option>
              <option value="nihil">Nihil</option>
            </select>
          </div>
        </div>
      )}

      {/* ================= RECENT REPORTS FEED ================= */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isKepalaSekolah ? 'Laporan Masuk dari Seluruh Staf (Pusat)' : 'Riwayat Laporan Terbaru Anda'}
              </h3>
              <p className="text-xs text-slate-500">
                {isKepalaSekolah ? 'Daftar tiket yang otomatis diteruskan ke akun Kepala Sekolah' : 'Laporan yang telah Anda catat ke dalam sistem SIBAHAR'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('history')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            Lihat Riwayat Lengkap <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {((isKepalaSekolah ? filteredKepalaReports : accessibleReports).length === 0) ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <FilePlus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">Belum ada laporan yang tercatat</p>
            <p className="mt-0.5">Gunakan tombol "Buat Laporan Baru" untuk menginput laporan pertama.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {(isKepalaSekolah ? filteredKepalaReports : accessibleReports).slice(0, 6).map((item) => {
              const prio = priorityLabels[item.priority] || priorityLabels.sedang;
              const stat = statusLabels[item.status] || statusLabels.menunggu;
              const makerRole = item.userRole ? USER_ROLES[item.userRole] : undefined;

              return (
                <div
                  key={item.id}
                  onClick={() => onViewReport(item)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-emerald-50/40 transition cursor-pointer group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {item.id}
                      </span>
                      {makerRole && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${makerRole.badgeClass}`}>
                          {makerRole.label}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10.5px] font-medium ${prio.badge}`}>
                        {prio.label}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {formatDateOnly(item.incidentDate)}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition truncate" title={item.title}>
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-500 line-clamp-1">
                      {categoryLabels[item.category]?.label || item.category} · Pelapor: <strong className="text-slate-700">{item.reporterName}</strong> {item.reporterDept ? `(${item.reporterDept})` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right hidden sm:block">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <span className={`w-2 h-2 rounded-full ${stat.dotClass}`} />
                        <span>{stat.label}</span>
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        PJ: {item.picName || item.assignedTo || 'Satgas'}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReport(item);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= INFORMASI SATGAS & HELP DESK ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-start gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              SOP Pelaporan Harian SIBAHAR
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Setiap peristiwa kedisiplinan, kegiatan asrama, kesehatan siswa, maupun laporan nihil wajib dicatat sebelum pukul 17:00 WIB untuk rekapitulasi Kepala Sekolah dan Kementerian Sosial RI.
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-start gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0 mt-0.5">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                Help Desk &amp; Meja Siaga Darurat
              </h4>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                Aktif 24 Jam
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hubungi ekstensi resmi: <strong className="font-mono text-emerald-800">{appSettings.helpDeskNumber || '8800 / 8801'}</strong> untuk eskalasi darurat medis, sarpras asrama, atau keamanan siswa.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
