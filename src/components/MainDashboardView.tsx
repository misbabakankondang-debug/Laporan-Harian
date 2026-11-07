import React from 'react';
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
  Info
} from 'lucide-react';
import { ReportItem, UserProfile, AppSettings } from '../types/report';
import { categoryLabels, priorityLabels, statusLabels, formatDateOnly, formatDateTime } from '../utils/formatters';
import { KemensosLogo } from './KemensosLogo';

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
  const nonDraftReports = reports.filter((r) => r.status !== 'draft');
  const pendingCount = nonDraftReports.filter((r) => r.status === 'menunggu').length;
  const inProgressCount = nonDraftReports.filter((r) => r.status === 'diproses').length;
  const resolvedCount = nonDraftReports.filter((r) => r.status === 'selesai').length;
  const nihilCount = nonDraftReports.filter((r) => r.category === 'nihil' || r.priority === 'nihil').length;

  const recentReports = [...nonDraftReports]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      
      {/* ================= HERO HEADER: SEKOLAH RAKYAT & SIBAHAR ================= */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-emerald-600/30">
        {/* Decorative background watermarks & glows */}
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-12 bottom-0 opacity-10 pointer-events-none hidden md:block">
          <KemensosLogo className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            {/* Tag Lembaga Resmi */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full border border-white/20 text-xs text-emerald-100 font-semibold shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Kementerian Sosial Republik Indonesia</span>
            </div>

            {/* Nama Instansi Sesuai Permintaan */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight drop-shadow-xs">
              Sekolah Rakyat Terintegerasi 1 Sumedang
            </h1>

            {/* Kata SIBAHAR & Akronim */}
            <div className="pt-1 border-t border-emerald-600/60">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black tracking-wider text-amber-300 font-mono drop-shadow-sm">
                  SIBAHAR
                </span>
                <span className="text-xs sm:text-sm font-medium text-emerald-100 tracking-wide">
                  (Sistem Informasi Berita Aktual Harian)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1.5 leading-relaxed max-w-2xl">
                Platform terpadu pemantauan berita harian, pencatatan insiden siswa, asesmen kedisiplinan, serta pelaporan resmi terintegerasi ke Kementerian Sosial Republik Indonesia.
              </p>
            </div>
          </div>

          {/* Quick Date and Status Widget */}
          <div className="bg-white/15 backdrop-blur-md p-4 rounded-xl border border-white/20 flex flex-col justify-between shrink-0 min-w-[220px]">
            <div>
              <div className="flex items-center justify-between text-xs text-emerald-200 mb-1">
                <span>Tanggal Hari Ini:</span>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              </div>
              <p className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-300" />
                {todayStr}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
              <span className="text-emerald-200">Penanggung Jawab:</span>
              <span className="font-bold text-white truncate max-w-[120px]" title={userProfile.name}>
                {userProfile.name.split(',')[0]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= KPI 4-CARD OVERVIEW: GREEN & WHITE THEME ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Laporan */}
        <div 
          onClick={() => onNavigateToTab('history')}
          className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Total Tiket Masuk</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
              {nonDraftReports.length}
            </span>
            <span className="text-xs text-emerald-700 font-medium">berita terdaftar</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span>Termasuk laporan berkala dan kondusif</span>
          </p>
        </div>

        {/* Dalam Penanganan */}
        <div 
          onClick={() => onNavigateToTab('history')}
          className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md hover:border-amber-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Sedang Ditangani</span>
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
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
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
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span>Resolusi mediasi &amp; tindak lanjut</span>
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
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <span>Situasi aman &amp; terkendali</span>
          </p>
        </div>
      </div>

      {/* ================= ACTION HUB & QUICK SHORTCUTS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Menu 1: Buat Laporan */}
        <div 
          onClick={() => onNavigateToTab('create')}
          className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <FilePlus className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-base text-white">Buat Laporan Baru</h3>
            </div>
            <p className="text-xs text-emerald-100 leading-relaxed">
              Input berita harian, kronologi kasus, atau status nihil dengan cepat.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition shrink-0 ml-3" />
        </div>

        {/* Menu 2: Ringkasan & Statistik */}
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
              Analisis grafik distribusi kasus ringan, sedang, berat, dan tren mingguan.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition shrink-0 ml-3" />
        </div>

        {/* Menu 3: Riwayat & Pelacakan */}
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
              Daftar seluruh tiket, edit laporan, cetak PDF, dan unduh data rekap.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition shrink-0 ml-3" />
        </div>
      </div>

      {/* ================= RECENT DAILY NEWS & INCIDENTS FEED ================= */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Berita Aktual Harian &amp; Laporan Terkini
              </h3>
              <p className="text-xs text-slate-500">
                Aktivitas pelaporan terbaru dari lingkungan Sekolah Rakyat Terintegerasi 1 Sumedang
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('history')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            Lihat Semua Tiket <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentReports.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Belum ada laporan yang tercatat hari ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentReports.map((item) => {
              const prio = priorityLabels[item.priority] || priorityLabels.sedang;
              const stat = statusLabels[item.status] || statusLabels.menunggu;

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
                      {categoryLabels[item.category]?.label || item.category} · Lokasi: {item.location || 'Lingkungan Sekolah'}
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
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-200 transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Buka Laporan</span>
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
        {/* Box Panduan / SOP */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-start gap-3.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              SOP Pelaporan Harian SIBAHAR
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Setiap peristiwa tata tertib, kesehatan siswa, maupun berita nihil wajib dicatatkan sebelum pukul 17:00 WIB untuk rekap harian pimpinan dan tembusan Kementerian Sosial RI.
            </p>
          </div>
        </div>

        {/* Box Help Desk Meja Siaga */}
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
