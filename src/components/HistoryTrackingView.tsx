import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  Eye, 
  FileText, 
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { ReportItem, UserRole, USER_ROLES, JENJANG_OPTIONS } from '../types/report';
import { 
  priorityLabels, 
  statusLabels, 
  formatDateOnly, 
  formatReportTicketNumber,
  NEW_CATEGORY_OPTIONS,
  LEGACY_CATEGORY_OPTIONS,
  getCategoryDisplayLabel,
  getReportEntriesSummaryCategories,
  getReportJenjangBadgeList,
  reportHasYesFindings,
  reportMatchesCategory,
  reportMatchesJenjang,
  reportMatchesPriority,
  reportMatchesSearchQuery,
  canDeleteReport
} from '../utils/formatters';
import { EditReportModal } from './EditReportModal';
import { SubmitReportResult, DeleteReportResult } from '../lib/supabase';

interface HistoryTrackingViewProps {
  reports: ReportItem[];
  onViewReportDetail: (report: ReportItem) => void;
  onNavigateToCreate: () => void;
  onEditReport: (report: ReportItem) => Promise<SubmitReportResult>;
  onDeleteReport: (reportId: string) => Promise<DeleteReportResult> | void;
  initialStatusFilter?: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserRole?: UserRole;
  currentUserIsActive?: boolean;
}

export const HistoryTrackingView: React.FC<HistoryTrackingViewProps> = ({
  reports,
  onViewReportDetail,
  onNavigateToCreate,
  onEditReport,
  onDeleteReport,
  initialStatusFilter = 'all',
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserRole = 'kepala_sekolah',
  currentUserIsActive = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter);
  const [selectedJenjang, setSelectedJenjang] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'priority'>('date_desc');
  const [editingReport, setEditingReport] = useState<ReportItem | null>(null);
  const [confirmDeleteReport, setConfirmDeleteReport] = useState<ReportItem | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [deleteReportError, setDeleteReportError] = useState('');

  // Filter logic
  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      if (!reportMatchesSearchQuery(item, searchQuery)) return false;

      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

      if (!reportMatchesJenjang(item, selectedJenjang)) return false;

      if (!reportMatchesCategory(item, selectedCategory)) return false;

      if (!reportMatchesPriority(item, selectedPriority)) return false;

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
  }, [reports, searchQuery, selectedStatus, selectedJenjang, selectedCategory, selectedPriority, sortBy]);

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
      'Jenjang',
      'Judul Laporan',
      'Kategori',
      'Rincian Per Jenjang',
      'Prioritas',
      'Tanggal Kejadian',
      'Status',
      'Pelapor',
      'Departemen',
      'Petugas Penanggung Jawab',
    ];

    const rows = filteredReports.map((r) => {
      const jenjangText = getReportJenjangBadgeList(r).join(', ') || r.jenjang || '-';
      const entriesText = Array.isArray(r.entries) && r.entries.length > 0
        ? r.entries
            .map((e) => `${e.jenjang} (${e.dormitoryType}): ${getCategoryDisplayLabel(e.category, e.customCategory)} [${priorityLabels[e.priority]?.label || e.priority}]`)
            .join(' | ')
        : getCategoryDisplayLabel(r.category, r.customCategory);

      return [
        formatReportTicketNumber(r),
        `"${jenjangText.replace(/"/g, '""')}"`,
        `"${r.title.replace(/"/g, '""')}"`,
        `"${getReportEntriesSummaryCategories(r).replace(/"/g, '""')}"`,
        `"${entriesText.replace(/"/g, '""')}"`,
        `"${priorityLabels[r.priority]?.label || r.priority}"`,
        r.incidentDate,
        statusLabels[r.status]?.label || r.status,
        `"${r.reporterName.replace(/"/g, '""')}"`,
        `"${r.reporterDept.replace(/"/g, '""')}"`,
        `"${(r.assignedTo || 'Belum ditugaskan').replace(/"/g, '""')}"`,
      ];
    });

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
    setDeleteReportError('');
    setConfirmDeleteReport(report);
  };

  const handleEditClick = (e: React.MouseEvent, report: ReportItem) => {
    e.stopPropagation();
    setEditingReport(report);
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedJenjang('all');
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tiket, judul, jenjang, kategori..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Jenjang dropdown */}
          <select
            value={selectedJenjang}
            onChange={(e) => setSelectedJenjang(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 text-slate-700"
          >
            <option value="all">Semua Jenjang</option>
            {JENJANG_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>

          {/* Category dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500 text-slate-700"
          >
            <option value="all">Semua Kategori</option>
            <optgroup label="Kategori Resmi Baru">
              {NEW_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
            <optgroup label="Kategori Lama (Kompatibilitas)">
              {LEGACY_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          </select>

          {/* Priority dropdown */}
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
                  const jenjangBadges = getReportJenjangBadgeList(report);
                  const hasYes = reportHasYesFindings(report);
                  const entries = Array.isArray(report.entries) ? report.entries : [];

                  return (
                    <tr
                      key={report.id}
                      onClick={() => onViewReportDetail(report)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      {/* ID Tiket */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-indigo-700 whitespace-nowrap align-top">
                        <div>{formatReportTicketNumber(report)}</div>
                        {jenjangBadges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {jenjangBadges.map((j) => (
                              <span
                                key={j}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 font-sans"
                              >
                                {j}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Judul & Kategori */}
                      <td className="py-3.5 px-4 min-w-[250px] max-w-sm align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition truncate max-w-[260px]" title={report.title}>
                            {report.title}
                          </p>
                          {hasYes && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Temuan Ya
                            </span>
                          )}
                        </div>
                        {entries.length > 0 ? (
                          <div className="space-y-0.5 mt-1">
                            {entries.map((ent) => (
                              <p key={ent.id} className="text-[11px] text-slate-600 truncate">
                                <strong className="text-emerald-800">{ent.jenjang}</strong> · {ent.dormitoryType || '-'} · {getCategoryDisplayLabel(ent.category, ent.customCategory)}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="text-slate-600 font-medium truncate max-w-[200px]" title={getCategoryDisplayLabel(report.category, report.customCategory)}>
                              {getCategoryDisplayLabel(report.category, report.customCategory)}
                            </span>
                            {report.location && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[120px]">{report.location}</span>
                              </>
                            )}
                          </div>
                        )}
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

                      {/* Penanggung Jawab & Pembuat */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <p className="font-medium text-slate-800 text-xs truncate max-w-[150px]">
                          {report.picName || report.reporterName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {report.userRole && USER_ROLES[report.userRole] ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                              {USER_ROLES[report.userRole].label}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              {report.reporterDept || 'Sekolah Rakyat'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Menu Aksi: Detail, Edit, Hapus (Berdasarkan Hak Akses RBAC) */}
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

                          {/* Sesuai Kebijakan RBAC Tahap 2.2:
                              - Pemilik laporan dapat mengedit laporannya sendiri.
                              - Penghapusan laporan HANYA diizinkan apabila status === 'selesai',
                                dan hanya oleh pemilik laporan (auth.uid() = user_id) atau Kepala Sekolah.
                              - Tidak ada role selain Kepala Sekolah yang dapat menghapus laporan pengguna lain.
                          */}
                          {(() => {
                            const isOwnerForEdit =
                              (report.userId && currentUserId && report.userId === currentUserId) ||
                              (currentUserName && report.reporterName?.toLowerCase() === currentUserName.toLowerCase()) ||
                              (currentUserEmail && report.reporterEmail?.toLowerCase() === currentUserEmail.toLowerCase()) ||
                              (!report.userId && currentUserRole !== 'kepala_sekolah');
                            const canEdit = currentUserRole !== 'kepala_sekolah' || isOwnerForEdit;
                            const deletePermission = canDeleteReport(report, {
                              id: currentUserId,
                              roleKey: currentUserRole,
                              isActive: currentUserIsActive,
                            });

                            if (!canEdit && !deletePermission.allowed) {
                              return (
                                <span
                                  className="text-[10.5px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200 cursor-not-allowed"
                                  title={
                                    deletePermission.reason ||
                                    'Wewenang Kepala Sekolah: Hanya Baca (Dapat dihapus setelah ditandai Selesai)'
                                  }
                                >
                                  Hanya Baca
                                </span>
                              );
                            }

                            return (
                              <>
                                {canEdit && (
                                  <button
                                    onClick={(e) => handleEditClick(e, report)}
                                    className="p-1.5 text-slate-600 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 rounded-md transition cursor-pointer"
                                    title="Edit Laporan Milik Sendiri"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {deletePermission.allowed && (
                                  <button
                                    onClick={(e) => handleDeleteClick(e, report)}
                                    className={
                                      !canEdit
                                        ? 'px-2 py-1 text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-md border border-rose-200 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer'
                                        : 'p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-md transition cursor-pointer'
                                    }
                                    title="Hapus Laporan yang Sudah Selesai"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {!canEdit && <span>Hapus</span>}
                                  </button>
                                )}
                              </>
                            );
                          })()}
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
          currentUserName={currentUserName}
          onSave={async (updated) => {
            const res = await onEditReport(updated);
            if (res.success) {
              setEditingReport(null);
            }
            return res;
          }}
        />
      )}

      {/* Modal Konfirmasi Hapus Laporan Selesai */}
      {confirmDeleteReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-rose-200 p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Hapus Laporan Selesai?</h3>
              <p className="text-xs text-slate-600">
                Laporan <strong>#{formatReportTicketNumber(confirmDeleteReport)}</strong> ({confirmDeleteReport.title}) sudah berstatus <strong>Selesai</strong>. Apakah Anda yakin ingin menghapusnya dari sistem dan database Supabase?
              </p>
            </div>

            {deleteReportError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs text-left">
                {deleteReportError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingReport}
                onClick={() => {
                  setConfirmDeleteReport(null);
                  setDeleteReportError('');
                }}
                className="flex-1 py-2 text-xs border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingReport}
                onClick={async () => {
                  if (isDeletingReport) return;
                  setDeleteReportError('');
                  setIsDeletingReport(true);
                  try {
                    const res = await onDeleteReport(confirmDeleteReport.id);
                    if (res && typeof res === 'object' && !res.success) {
                      setDeleteReportError(
                        res.error || 'Gagal menghapus laporan dari database Supabase.'
                      );
                      return;
                    }
                    setConfirmDeleteReport(null);
                  } finally {
                    setIsDeletingReport(false);
                  }
                }}
                className="flex-1 py-2 text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg font-bold transition shadow-xs cursor-pointer"
              >
                {isDeletingReport ? 'Menghapus...' : 'Ya, Hapus Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
