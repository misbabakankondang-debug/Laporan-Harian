import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  Eye,
  Layers,
} from 'lucide-react';
import { JENJANG_OPTIONS, ReportItem } from '../types/report';
import {
  formatDateOnly,
  formatReportTicketNumber,
  getReportJenjangBadgeList,
  getReportEntriesSummaryCategories,
} from '../utils/formatters';
import { computeReportStatistics, StatsTimeframe } from '../utils/statistics';

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
  const [timeframe, setTimeframe] = useState<StatsTimeframe>('30days');
  const [showAllOfficialCategories, setShowAllOfficialCategories] = useState(false);

  const stats = useMemo(
    () => computeReportStatistics(reports, timeframe),
    [reports, timeframe]
  );

  const priorityDistributionItems = [
    {
      id: 'ringan',
      label: 'Kasus Ringan / Resiko Rendah',
      count: stats.priorityEntryCounts.ringan,
      percentage:
        stats.totalAnalyzedUnits > 0
          ? Math.round((stats.priorityEntryCounts.ringan / stats.totalAnalyzedUnits) * 100)
          : 0,
      color: 'bg-emerald-600',
    },
    {
      id: 'sedang',
      label: 'Kasus Sedang / Resiko Sedang',
      count: stats.priorityEntryCounts.sedang,
      percentage:
        stats.totalAnalyzedUnits > 0
          ? Math.round((stats.priorityEntryCounts.sedang / stats.totalAnalyzedUnits) * 100)
          : 0,
      color: 'bg-amber-600',
    },
    {
      id: 'berat',
      label: 'Kasus Berat/Kompleks atau Resiko Tinggi/Kritis',
      count: stats.priorityEntryCounts.berat,
      percentage:
        stats.totalAnalyzedUnits > 0
          ? Math.round((stats.priorityEntryCounts.berat / stats.totalAnalyzedUnits) * 100)
          : 0,
      color: 'bg-rose-600',
    },
    {
      id: 'nihil',
      label: 'Nihil (Kondusif / Tidak Ada Kejadian)',
      count: stats.priorityEntryCounts.nihil,
      percentage:
        stats.totalAnalyzedUnits > 0
          ? Math.round((stats.priorityEntryCounts.nihil / stats.totalAnalyzedUnits) * 100)
          : 0,
      color: 'bg-teal-600',
    },
  ];

  const visibleCategoryDistribution = showAllOfficialCategories
    ? [
        ...stats.newCategoriesDistribution,
        ...stats.legacyCategoriesDistribution,
      ]
    : stats.categoryDistribution;

  return (
    <div className="space-y-6">
      {/* Top Banner & Timeframe Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Metrik Kinerja & Analisis Pelaporan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan data aktual laporan utama, rincian entri jenjang (SRD/SRMP/SRMA), kategori, dan status penanganan.
          </p>
        </div>

        {/* Timeframe segmented control */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-center">
          <button
            type="button"
            onClick={() => setTimeframe('30days')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
              timeframe === '30days'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Hari Terakhir
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
              timeframe === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Periode
          </button>
        </div>
      </div>

      {/* KPI 4-Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Laporan Utama */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Laporan Masuk</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {stats.totalMainReports}
            </span>
            <span className="text-xs text-slate-400">laporan utama</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center justify-between">
              <span>Total entri jenjang:</span>
              <span className="font-semibold text-emerald-700 font-mono tabular-nums">
                {stats.totalJenjangEntries} entri
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Draft belum diajukan:</span>
              <span className="font-semibold text-slate-700 font-mono tabular-nums">
                {stats.countByStatus.draft}
              </span>
            </div>
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
              {stats.countByStatus.diproses}
            </span>
            <span className="text-xs text-amber-700 font-medium">aktif berjalan</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Menunggu verifikasi:</span>
            <span className="font-semibold text-slate-700 font-mono tabular-nums">
              {stats.countByStatus.menunggu}
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
              {stats.countByStatus.selesai}
            </span>
            <span className="text-xs text-emerald-700 font-medium">selesai tuntas</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Ditolak / Non-SOP:</span>
            <span className="font-semibold text-slate-700 font-mono tabular-nums">
              {stats.countByStatus.ditolak}
            </span>
          </div>
        </div>

        {/* Rasio Penyelesaian & Nihil */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Rasio Penyelesaian</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {stats.resolutionRate}%
            </span>
            <span className="text-xs text-slate-400">dari tiket diproses</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Laporan Nihil / Aman:</span>
            <span className="font-semibold text-teal-700 font-mono tabular-nums">
              {stats.nihilMainReportsCount} ({stats.nihilEntriesCount} entri)
            </span>
          </div>
        </div>
      </div>

      {/* Ringkasan Per Jenjang (SRD / SRMP / SRMA) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Rekapitulasi Per Jenjang (SRD / SRMP / SRMA)
              </h3>
              <p className="text-xs text-slate-500">
                Satu laporan utama dapat mencakup 1–3 jenjang; jumlah entri dihitung terpisah dari jumlah laporan utama.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            {stats.totalMainReports} Laporan Utama · {stats.totalJenjangEntries} Entri Jenjang
            {stats.legacyReportsCount > 0 ? ` · ${stats.legacyReportsCount} Laporan Lama` : ''}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {JENJANG_OPTIONS.map((jenjangKey) => (
            <div
              key={jenjangKey}
              className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-extrabold text-emerald-900">Jenjang {jenjangKey}</p>
                <p className="text-[11px] text-slate-600">Total entri tercatat</p>
              </div>
              <span className="text-2xl font-black text-emerald-800 font-mono tabular-nums">
                {stats.jenjangCounts[jenjangKey]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Analytics Row: Priority Entry Distribution & Real Weekly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Entry Breakdown (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Distribusi Tingkat Risiko Seluruh Entri Jenjang
              </h3>
              <p className="text-xs text-slate-500">
                Dihitung dari seluruh entri jenjang pada laporan terstruktur serta laporan lama yang tersedia
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {stats.totalAnalyzedUnits} Entri/Unit
            </span>
          </div>

          {stats.totalAnalyzedUnits === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Belum ada laporan masuk pada periode yang dipilih.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {priorityDistributionItems.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-slate-500">
                      <span>{item.count} Entri</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-semibold text-slate-800 w-9 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${item.count > 0 ? Math.max(item.percentage, 3) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real Weekly Trend Bar Chart (1 Col) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Tren Laporan Mingguan
              </h3>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Volume laporan utama aktual selama 7 hari terakhir
            </p>

            {stats.totalInLast7Days === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center px-3 border border-dashed border-slate-200 rounded-lg bg-slate-50/70">
                <Calendar className="w-6 h-6 text-slate-300 mb-1.5" />
                <p className="text-xs font-medium text-slate-600">
                  Belum ada data laporan pada 7 hari terakhir
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Grafik akan otomatis terisi saat laporan baru tercatat.
                </p>
              </div>
            ) : (
              <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 border-b border-slate-100">
                {stats.weeklyTrend.map((bar) => (
                  <div
                    key={bar.dateKey}
                    className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group"
                    title={`${bar.dayName} (${bar.dateLabel}): ${bar.count} laporan`}
                  >
                    <span className="text-[10px] text-slate-600 font-semibold font-mono tabular-nums">
                      {bar.count}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t transition-all duration-200 ${
                          bar.count > 0
                            ? 'bg-indigo-500 group-hover:bg-indigo-600'
                            : 'bg-slate-100'
                        }`}
                        style={{ height: `${bar.count > 0 ? bar.heightPct : 4}%` }}
                      />
                    </div>
                    <span className="text-[10.5px] text-slate-600 font-medium truncate w-full text-center">
                      {bar.shortLabel}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-mono">
                      {bar.dateLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Hari tersibuk:</span>
            <span className="font-semibold text-slate-800">
              {stats.busiestDay
                ? `${stats.busiestDay.dayName} (${stats.busiestDay.count} laporan)`
                : 'Belum ada data'}
            </span>
          </div>
        </div>
      </div>

      {/* Category Breakdown Row (All 14 New Categories + Legacy Categories) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Distribusi Kategori Laporan (14 Kategori Resmi &amp; Kategori Lama)
            </h3>
            <p className="text-xs text-slate-500">
              Dihitung dari seluruh entri jenjang dan laporan historis pada periode terpilih
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllOfficialCategories((prev) => !prev)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 self-start sm:self-center cursor-pointer"
          >
            {showAllOfficialCategories
              ? 'Tampilkan Kategori yang Terisi Saja'
              : 'Tampilkan Seluruh 14 Kategori Resmi'}
          </button>
        </div>

        {visibleCategoryDistribution.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Belum ada distribusi kategori laporan pada periode ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleCategoryDistribution.map((cat) => (
              <div
                key={cat.key}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-slate-800 truncate" title={cat.label}>
                      {cat.label}
                    </span>
                    {cat.isLegacy && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-200 text-slate-700 font-medium shrink-0">
                        Lama
                      </span>
                    )}
                    {cat.isNihil && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-teal-100 text-teal-800 font-medium shrink-0">
                        Nihil
                      </span>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-slate-700 font-semibold shrink-0">
                    {cat.count} ({cat.percentage}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cat.isNihil
                        ? 'bg-teal-600'
                        : cat.isLegacy
                        ? 'bg-slate-500'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${cat.count > 0 ? Math.max(cat.percentage, 3) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Priority Urgency & Urgent Tickets Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status & Urgency Summary Cards */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Tingkat Prioritas Entri Laporan
          </h3>
          <p className="text-xs text-slate-500">
            Distribusi urgensi penanganan masalah per entri jenjang
          </p>

          <div className="space-y-3 pt-1">
            <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-900">Kasus Berat/Kompleks atau Resiko Tinggi/Kritis</p>
                <p className="text-[11px] text-rose-700">Mendesak / butuh tindakan &lt; 4 jam</p>
              </div>
              <span className="text-lg font-bold text-rose-700 font-mono tabular-nums ml-2">
                {stats.priorityEntryCounts.berat}
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-900">Kasus Sedang / Resiko Sedang</p>
                <p className="text-[11px] text-amber-700">Tindak lanjut &lt; 24 jam</p>
              </div>
              <span className="text-lg font-bold text-amber-700 font-mono tabular-nums ml-2">
                {stats.priorityEntryCounts.sedang}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-900">Kasus Ringan / Resiko Rendah</p>
                <p className="text-[11px] text-emerald-700">Bimbingan &amp; pembinaan berkala</p>
              </div>
              <span className="text-lg font-bold text-emerald-700 font-mono tabular-nums ml-2">
                {stats.priorityEntryCounts.ringan}
              </span>
            </div>

            <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-teal-900">Nihil</p>
                <p className="text-[11px] text-teal-700">Kondusif tanpa kejadian khusus</p>
              </div>
              <span className="text-lg font-bold text-teal-700 font-mono tabular-nums ml-2">
                {stats.priorityEntryCounts.nihil}
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
                  Tiket Prioritas Tinggi yang Memerlukan Perhatian ({stats.totalUrgentCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToHistory()}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
              >
                Lihat Semua <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Laporan insiden kritis yang belum terselesaikan dan perlu eskalasi
            </p>

            {stats.urgentTickets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Tidak ada tiket prioritas tinggi yang tertunda. Semua terkendali!
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.urgentTickets.map((ticket) => {
                  const jenjangs = getReportJenjangBadgeList(ticket);
                  return (
                    <div
                      key={ticket.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-lg transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5 flex-wrap">
                          <span className="font-mono font-semibold text-indigo-700">
                            {formatReportTicketNumber(ticket)}
                          </span>
                          {jenjangs.map((j) => (
                            <span
                              key={j}
                              className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900"
                            >
                              {j}
                            </span>
                          ))}
                          <span>·</span>
                          <span className="text-rose-600 font-semibold">Kasus Berat / Resiko Tinggi</span>
                          <span>·</span>
                          <span>{formatDateOnly(ticket.incidentDate)}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {ticket.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {getReportEntriesSummaryCategories(ticket)} · PJ: {ticket.assignedTo || 'Belum ditugaskan'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onViewReport(ticket)}
                        className="px-3 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Periksa</span>
                      </button>
                    </div>
                  );
                })}
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
