import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  Eye, 
  FileText, 
  RefreshCw,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { ReportItem, ReportPriority } from '../types/report';
import { categoryLabels, priorityLabels, statusLabels, formatDateOnly } from '../utils/formatters';
import { EditReportModal } from './EditReportModal';

interface HistoryTrackingViewProps {
  reports: ReportItem[];
  onViewReportDetail: (report: ReportItem) => void;
  onNavigateToCreate: () => void;
  onEditReport: (report: ReportItem) => void;
  onDeleteReport: (reportId: string) => void;
  initialStatusFilter?: string;
}

export const HistoryTrackingView: React.FC<HistoryTrackingViewProps> = ({
  reports,
  onViewReportDetail,
  onNavigateToCreate,
  onEditReport,
  onDeleteReport,
  initialStatusFilter = 'all',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'priority'>('date_desc');
  const [editingReport, setEditingReport] = useState<ReportItem | null>(null);

  // Filter logic
  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchReporter = item.reporterName.toLowerCase().includes(q);
        const matchLoc = (item.location || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchDesc && !matchReporter && !matchLoc) {
          return false;
        }
      }

      // Status
      if (selectedStatus !== 'all') {
        if (item.status !== selectedStatus) return false;
      }

      // Category
      if (selectedCategory !== 'all') {
        if (item.category !== selectedCategory) return false;
      }

      // Priority
      if (selectedPriority !== 'all') {
        if (selectedPriority === 'ringan' && item.priority !== 'ringan' && item.priority !== 'rendah') return false;
        if (selectedPriority === 'sedang' && item.priority !== 'sedang') return false;
        if (selectedPriority === 'berat' && item.priority !== 'berat' && item.priority !== 'tinggi') return false;
        if (selectedPriority === 'nihil' && item.priority !== 'nihil') return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'priority') {
        const weight: Record<string, number> = { berat: 3, tinggi: 3, sedang: 2, ringan: 1, rendah: 1 };
        return (weight[b.priority] || 0) - (weight[a.priority] || 0);
      }
      return 0;
    });
  }, [reports, searchQuery, selectedStatus, selectedCategory, selectedPriority, sortBy]);

  // Status counts for badge tabs
  const statusCounts = useMemo(() => {
    return {
      all: reports.length,
      menunggu: reports.filter((r) => r.status === 'menunggu').length,
      diproses: reports.filter((r) => r.status === 'diproses').length,
      selesai: reports.filter((r) => r.status === 'selesai').length,
      ditolak: reports.filter((r) => r.status === 'ditolak').length,
      draft: reports.filter((r) => r.status === 'draft').length,
    };
  }, [reports]);

  // Export CSV function
  const handleExportCSV = () => {
    const headers = [
      'ID Tiket',
      'Judul Laporan',
      'Kategori',
      'Prioritas',
      'Tanggal Kejadian',
      'Status',
      'Pelapor',
      'Departemen',
      'Petugas Penanggung Jawab',
    ];

    const rows = filteredReports.map((r) => [
      r.id,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${categoryLabels[r.category]?.label || r.category}"`,
      `"${priorityLabels[r.priority]?.label || r.priority}"`,
      r.incidentDate,
      statusLabels[r.status]?.label || r.status,
      `"${r.reporterName}"`,
      `"${r.reporterDept}"`,
      `"${r.assignedTo || 'Belum ditugaskan'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_laporan_sibahar_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteClick = (e: React.MouseEvent, report: ReportItem) => {
    e.stopPropagation();
    if (window.confirm(`Apakah Anda yakin ingin menghapus laporan "${report.id} - ${report.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
      onDeleteReport(report.id);
    }
  };

  const handleEditClick = (e: React.MouseEvent, report: ReportItem) => {
    e.stopPropagation();
    setEditingReport(report);
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedCategory('all');
    setSelectedPriority('all');
    setSortBy('date_desc');
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Riwayat &amp; Pelacakan Status Laporan (SIBAHAR)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar lengkap seluruh tiket insiden dan berita harian, pembaruan status, edit, serta pengelolaan berkas.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
            title="Unduh data dalam format CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={onNavigateToCreate}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Laporan Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Status segmented buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Semua Status', count: statusCounts.all },
            { id: 'menunggu', label: 'Menunggu', count: statusCounts.menunggu },
            { id: 'diproses', label: 'Sedang Diproses', count: statusCounts.diproses },
            { id: 'selesai', label: 'Selesai', count: statusCounts.selesai },
            { id: 'ditolak', label: 'Ditolak', count: statusCounts.ditolak },
            { id: 'draft', label: 'Draft', count: statusCounts.draft },
          ].map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                  isActive ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input + Dropdown filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID tiket, judul, lokasi..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Category dropdown (Updated with exact requested categories) */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 text-slate-700"
          >
            <option value="all">Semua Kategori</option>
            <option value="kategori_1">Tata Tertib, Relasi &amp; Prilaku, Adaptasi...</option>
            <option value="kategori_2">Tata Tertib &amp; Perundungan, Kekerasan &amp; Relasi...</option>
            <option value="kategori_3">Keselamatan &amp; Kekerasan, Hukum &amp; Perlindungan...</option>
            <option value="nihil">Nihil</option>
          </select>

          {/* Priority dropdown (Updated with exact requested priorities) */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 text-slate-700"
          >
            <option value="all">Semua Prioritas</option>
            <option value="ringan">Kasus Ringan / Resiko Rendah</option>
            <option value="sedang">Kasus Sedang / Resiko Sedang</option>
            <option value="berat">Kasus Berat/Kompleks atau Resiko Tinggi/Kritis</option>
            <option value="nihil">Nihil</option>
          </select>

          {/* Sort By dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 text-slate-700"
          >
            <option value="date_desc">Urutkan: Tanggal Terbaru</option>
            <option value="date_asc">Urutkan: Tanggal Terlama</option>
            <option value="priority">Urutkan: Prioritas Tertinggi</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">ID Tiket</th>
                <th className="py-3 px-4">Judul Laporan &amp; Kategori</th>
                <th className="py-3 px-4">Tanggal Kejadian</th>
                <th className="py-3 px-4">Prioritas</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Penanggung Jawab</th>
                <th className="py-3 px-4 text-center">Menu &amp; Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">Tidak ada laporan yang cocok</p>
                    <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau setelan filter Anda.</p>
                    <button
                      onClick={resetAllFilters}
                      className="mt-3 text-xs text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Reset Filter
                    </button>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => {
                  const prio = priorityLabels[report.priority] || priorityLabels.sedang;
                  const stat = statusLabels[report.status] || statusLabels.menunggu;

                  return (
                    <tr
                      key={report.id}
                      onClick={() => onViewReportDetail(report)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      {/* ID Tiket */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-indigo-700 whitespace-nowrap">
                        {report.id}
                      </td>

                      {/* Judul & Kategori */}
                      <td className="py-3.5 px-4 min-w-[240px] max-w-sm">
                        <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition truncate" title={report.title}>
                          {report.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="text-slate-600 font-medium truncate max-w-[200px]" title={categoryLabels[report.category]?.label || report.category}>
                            {categoryLabels[report.category]?.label || report.category}
                          </span>
                          {report.location && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[120px]">{report.location}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Tanggal Kejadian */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDateOnly(report.incidentDate)}
                      </td>

                      {/* Prioritas (Kasus Ringan, Sedang, Berat) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${prio.badge}`}>
                          {prio.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <span className={`w-2 h-2 rounded-full ${stat.dotClass}`} />
                          <span>{stat.label}</span>
                        </span>
                      </td>

                      {/* Penanggung Jawab */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {report.assignedTo || (
                          <span className="text-slate-400 italic">Belum ditugaskan</span>
                        )}
                      </td>

                      {/* Menu Aksi: Detail, Edit, Hapus */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Detail */}
                          <button
                            onClick={() => onViewReportDetail(report)}
                            className="p-1.5 text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition"
                            title="Lihat Detail Tiket"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Menu */}
                          <button
                            onClick={(e) => handleEditClick(e, report)}
                            className="p-1.5 text-slate-600 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded-md transition"
                            title="Edit Laporan"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Hapus Menu */}
                          <button
                            onClick={(e) => handleDeleteClick(e, report)}
                            className="p-1.5 text-slate-600 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 rounded-md transition"
                            title="Hapus Laporan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Menampilkan <strong className="text-slate-700 font-mono tabular-nums">{filteredReports.length}</strong> dari <strong className="text-slate-700 font-mono tabular-nums">{reports.length}</strong> total laporan</span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Gunakan tombol aksi untuk Melihat Detail, Mengedit, atau Menghapus laporan</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingReport && (
        <EditReportModal
          report={editingReport}
          isOpen={Boolean(editingReport)}
          onClose={() => setEditingReport(null)}
          onSave={(updated) => {
            onEditReport(updated);
            setEditingReport(null);
          }}
        />
      )}
    </div>
  );
};
