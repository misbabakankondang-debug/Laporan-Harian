import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Wrench,
  DollarSign,
  MessageSquareWarning,
  Eye
} from 'lucide-react';
import { ReportItem, ReportCategory } from '../types/report';
import { categoryLabels, priorityLabels, statusLabels, formatDateOnly } from '../utils/formatters';

interface SummaryStatsViewProps {
  reports: ReportItem[];
  onViewReport: (report: ReportItem) => void;
  onNavigateToHistory: (statusFilter?: string) => void;
}

export const SummaryStatsView: React.FC<SummaryStatsViewProps> = ({
  reports,
  onViewReport,
  onNavigateToHistory,
}) => {
  const [timeframe, setTimeframe] = useState<'30days' | 'all'>('30days');

  // Filter out drafts from public resolution analytics if needed, or include with distinction
  const nonDraftReports = reports.filter((r) => r.status !== 'draft');
  const totalNonDraft = nonDraftReports.length;

  const countByStatus = {
    draft: reports.filter((r) => r.status === 'draft').length,
    menunggu: reports.filter((r) => r.status === 'menunggu').length,
    diproses: reports.filter((r) => r.status === 'diproses').length,
    selesai: reports.filter((r) => r.status === 'selesai').length,
    ditolak: reports.filter((r) => r.status === 'ditolak').length,
  };

  const countByPriority = {
    ringan: nonDraftReports.filter((r) => r.priority === 'ringan' || r.priority === 'rendah').length,
    sedang: nonDraftReports.filter((r) => r.priority === 'sedang').length,
    berat: nonDraftReports.filter((r) => r.priority === 'berat' || r.priority === 'tinggi').length,
  };

  // Distribution items requested by user: Kasus Ringan, Kasus Sedang, Kasus Berat/Kompleks
  const distributionItems = [
    {
      id: 'ringan',
      label: 'Kasus Ringan / Resiko Rendah',
      count: countByPriority.ringan,
      percentage: totalNonDraft > 0 ? Math.round((countByPriority.ringan / totalNonDraft) * 100) : 0,
      color: 'bg-emerald-600',
    },
    {
      id: 'sedang',
      label: 'Kasus Sedang / Resiko Sedang',
      count: countByPriority.sedang,
      percentage: totalNonDraft > 0 ? Math.round((countByPriority.sedang / totalNonDraft) * 100) : 0,
      color: 'bg-amber-600',
    },
    {
      id: 'berat',
      label: 'Kasus Berat/Kompleks atau Resiko Tinggi/Kritis',
      count: countByPriority.berat,
      percentage: totalNonDraft > 0 ? Math.round((countByPriority.berat / totalNonDraft) * 100) : 0,
      color: 'bg-rose-600',
    },
  ];

  const resolutionRate = totalNonDraft > 0 
    ? Math.round((countByStatus.selesai / (totalNonDraft - countByStatus.menunggu || 1)) * 100)
    : 0;

  // Weekly bar simulation for recent report trend
  const weeklyTrend = [
    { day: 'Senin', count: 4, heightPct: 65 },
    { day: 'Selasa', count: 6, heightPct: 90 },
    { day: 'Rabu', count: 3, heightPct: 45 },
    { day: 'Kamis', count: 5, heightPct: 75 },
    { day: 'Jumat', count: 7, heightPct: 100 },
    { day: 'Sabtu', count: 2, heightPct: 30 },
    { day: 'Minggu', count: 1, heightPct: 15 },
  ];

  // Urgent tickets requiring attention
  const urgentTickets = nonDraftReports
    .filter((r) => (r.priority === 'berat' || r.priority === 'tinggi') && r.status !== 'selesai' && r.status !== 'ditolak')
    .slice(0, 3);

  const getCategoryIcon = (cat: ReportCategory) => {
    switch (cat) {
      case 'teknis':
        return Wrench;
      case 'fasilitas':
        return Building;
      case 'keuangan':
        return DollarSign;
      case 'keluhan':
        return MessageSquareWarning;
      default:
        return Layers;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Timeframe Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Metrik Kinerja & Analisis Pelaporan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan data real-time tiket laporan operasional dan tingkat kecepatan penanganan insiden.
          </p>
        </div>

        {/* Timeframe segmented control */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-center">
          <button
            onClick={() => setTimeframe('30days')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              timeframe === '30days'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Hari Terakhir
          </button>
          <button
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              timeframe === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Periode
          </button>
        </div>
      </div>

      {/* KPI 4-Card Grid with Tabular Numerals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Laporan Masuk */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Laporan Masuk</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalNonDraft}
            </span>
            <span className="text-xs text-slate-400">tiket terdaftar</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Draft belum diajukan:</span>
            <span className="font-semibold text-slate-700 font-mono tabular-nums">
              {countByStatus.draft}
            </span>
          </div>
        </div>

        {/* Sedang Ditangani */}
        <div 
          onClick={() => onNavigateToHistory('diproses')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Dalam Penanganan</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {countByStatus.diproses}
            </span>
            <span className="text-xs text-amber-700 font-medium">aktif berjalan</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Menunggu verifikasi:</span>
            <span className="font-semibold text-slate-700 font-mono tabular-nums">
              {countByStatus.menunggu}
            </span>
          </div>
        </div>

        {/* Selesai / Teratasi */}
        <div 
          onClick={() => onNavigateToHistory('selesai')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Laporan Teratasi</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {countByStatus.selesai}
            </span>
            <span className="text-xs text-emerald-700 font-medium">selesai tuntas</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Ditolak / Non-SOP:</span>
            <span className="font-semibold text-slate-700 font-mono tabular-nums">
              {countByStatus.ditolak}
            </span>
          </div>
        </div>

        {/* Rasio Penyelesaian */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Rasio Penyelesaian</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {resolutionRate}%
            </span>
            <span className="text-xs text-slate-400">target &ge; 85%</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Rata-rata tanggap:</span>
            <span className="font-semibold text-slate-700 font-mono tabular-nums">
              1.8 Jam
            </span>
          </div>
        </div>
      </div>

      {/* Main Analytics Row: Category Breakdown & Weekly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Distribusi Berdasarkan Kategori Laporan
              </h3>
              <p className="text-xs text-slate-500">
                Porsi kategori yang paling sering diajukan dalam operasional
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {totalNonDraft} Tiket
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {distributionItems.map((item) => {
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-slate-500">
                      <span>{item.count} Laporan</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-semibold text-slate-800 w-8 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Trend Bar Chart Simulation (1 Col) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Tren Laporan Mingguan
              </h3>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Volume laporan yang masuk per hari selama 7 hari terakhir
            </p>

            {/* Simulated bar chart with proper alignment */}
            <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 border-b border-slate-100">
              {weeklyTrend.map((bar) => (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition font-mono tabular-nums">
                    {bar.count}
                  </span>
                  <div
                    className="w-full bg-indigo-100 group-hover:bg-indigo-600 rounded-t transition-all duration-200"
                    style={{ height: `${bar.heightPct}%` }}
                  />
                  <span className="text-[11px] text-slate-500 font-medium truncate w-full text-center">
                    {bar.day.substring(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Hari tersibuk:</span>
            <span className="font-semibold text-slate-800">Jumat (7 laporan)</span>
          </div>
        </div>
      </div>

      {/* Priority Urgency & Urgent Tickets Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status & Urgency Summary Cards */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Tingkat Prioritas Laporan
          </h3>
          <p className="text-xs text-slate-500">
            Distribusi urgensi penanganan masalah
          </p>

          <div className="space-y-3 pt-1">
            <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-900">Kasus Berat/Kompleks atau Resiko Tinggi/Kritis</p>
                <p className="text-[11px] text-rose-700">Mendesak / butuh tindakan &lt; 4 jam</p>
              </div>
              <span className="text-lg font-bold text-rose-700 font-mono tabular-nums ml-2">
                {countByPriority.berat}
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-900">Kasus Sedang / Resiko Sedang</p>
                <p className="text-[11px] text-amber-700">Tindak lanjut &lt; 24 jam</p>
              </div>
              <span className="text-lg font-bold text-amber-700 font-mono tabular-nums ml-2">
                {countByPriority.sedang}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-900">Kasus Ringan / Resiko Rendah</p>
                <p className="text-[11px] text-emerald-700">Bimbingan &amp; pembinaan berkala</p>
              </div>
              <span className="text-lg font-bold text-emerald-700 font-mono tabular-nums ml-2">
                {countByPriority.ringan}
              </span>
            </div>
          </div>
        </div>

        {/* Urgent Active Tickets Attention Queue (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Tiket Prioritas Tinggi yang Memerlukan Perhatian
                </h3>
              </div>
              <button
                onClick={() => onNavigateToHistory()}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                Lihat Semua <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Laporan insiden kritis yang belum terselesaikan dan perlu eskalasi
            </p>

            {urgentTickets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Tidak ada tiket prioritas tinggi yang tertunda. Semua terkendali!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {urgentTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-lg transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                        <span className="font-mono font-semibold text-indigo-700">{ticket.id}</span>
                        <span>·</span>
                        <span className="text-rose-600 font-semibold">Kasus Berat / Resiko Tinggi</span>
                        <span>·</span>
                        <span>{formatDateOnly(ticket.incidentDate)}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {ticket.title}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        PJ: {ticket.assignedTo || 'Belum ditugaskan'}
                      </p>
                    </div>

                    <button
                      onClick={() => onViewReport(ticket)}
                      className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Periksa</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>SOP Penanganan Insiden: Laporan prioritas tinggi wajib mendapat respons awal maksimal 30 menit.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
