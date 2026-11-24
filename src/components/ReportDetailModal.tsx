import React, { useState } from 'react';
import {
  X,
  Printer,
  Clock,
  Calendar,
  Paperclip,
  Download,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { ReportItem, ReportStatus, AppSettings, UserProfile } from '../types/report';
import {
  priorityLabels,
  statusLabels,
  formatDateTime,
  formatDateOnly,
  formatFileSize,
  formatReportTicketNumber,
  getCategoryDisplayLabel,
  getReportJenjangBadgeList,
  reportHasYesFindings,
  entryHasYesFindings,
  normalizeChecklistAnswers,
  isKepalaSekolahReporter,
  getReporterRoleDisplayLabel,
} from '../utils/formatters';
import { openPrintPdfTab, sanitizeImageUrl } from '../utils/printPdf';
import { SubmitReportResult } from '../lib/supabase';

interface ReportDetailModalProps {
  report: ReportItem;
  onClose: () => void;
  onUpdateStatus: (
    reportId: string,
    newStatus: ReportStatus,
    note?: string
  ) => Promise<SubmitReportResult>;
  onAddNote: (reportId: string, note: string) => Promise<SubmitReportResult>;
  currentUser: string;
  appSettings?: AppSettings;
  userProfile?: UserProfile;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  onClose,
  onUpdateStatus,
  onAddNote,
  appSettings,
  userProfile,
}) => {
  const [newNote, setNewNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const prio = priorityLabels[report.priority] || priorityLabels.sedang;
  const stat = statusLabels[report.status] || statusLabels.menunggu;
  const entries = Array.isArray(report.entries) ? report.entries : [];
  const hasEntries = entries.length > 0;
  const jenjangList = getReportJenjangBadgeList(report);
  const hasYesFindings = reportHasYesFindings(report);

  const isKepalaSekolahReport = isKepalaSekolahReporter(report);
  const reporterRoleLabel = getReporterRoleDisplayLabel(report);

  const defaultKopLogo =
    'https://vectorez.biz.id/wp-content/uploads/2024/05/Logo-Kementerian-Sosial-Kemensos-Republik-Indonesia@0.5x.png';
  const customKopLogo = appSettings?.kopLogoUrl?.trim();
  const safeKopLogoSrc = customKopLogo
    ? sanitizeImageUrl(customKopLogo)
    : sanitizeImageUrl(defaultKopLogo);
  const kopAddress =
    appSettings?.kopAddress ||
    'Desa Kebon Cau, Kecamatan Ujung Jaya Kabupaten Sumedang Kode Pos 45383';

  const safeSignatureUrl = sanitizeImageUrl(report.reporterSignature);

  const chiefRole =
    userProfile?.roleKey === 'kepala_sekolah' && userProfile?.role
      ? userProfile.role
      : report.picRole || 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang';
  const chiefName =
    report.reporterName ||
    (userProfile?.roleKey === 'kepala_sekolah' && userProfile?.name ? userProfile.name : '') ||
    'Kepala Sekolah';
  const chiefNipRaw =
    report.reporterNip ||
    (userProfile?.roleKey === 'kepala_sekolah' && userProfile?.nip ? userProfile.nip : '');

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNote.trim();
    if (!trimmed || isAddingNote || isUpdatingStatus) return;
    setActionError(null);
    setIsAddingNote(true);
    try {
      const res = await onAddNote(report.id, trimmed);
      if (res.success) {
        setNewNote('');
      } else {
        setActionError(res.error || 'Gagal menyimpan catatan tindak lanjut ke database Supabase.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Gagal menyimpan catatan tindak lanjut ke database Supabase.');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleStatusChangeSubmit = async (newSt: ReportStatus) => {
    if (newSt === report.status || isUpdatingStatus || isAddingNote) return;
    setActionError(null);
    setIsUpdatingStatus(true);
    try {
      const res = await onUpdateStatus(report.id, newSt, undefined);
      if (!res.success) {
        setActionError(res.error || 'Gagal memperbarui status laporan ke database Supabase.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Gagal memperbarui status laporan ke database Supabase.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePrint = () => {
    openPrintPdfTab(report, appSettings, userProfile);
  };

  const getStepIndex = () => {
    if (report.status === 'draft') return -1;
    if (report.status === 'menunggu') return 0;
    if (report.status === 'diproses') return 2;
    if (report.status === 'selesai') return 3;
    if (report.status === 'ditolak') return -2;
    return 0;
  };

  const currentStep = getStepIndex();

  const steps = [
    { title: 'Diajukan', desc: 'Laporan tercatat' },
    { title: 'Verifikasi', desc: 'Asesmen & Penugasan' },
    { title: 'Penanganan', desc: 'Tindakan teknisi / guru' },
    { title: 'Selesai', desc: 'Insiden teratasi' },
  ];

  const printDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:max-h-none print:shadow-none print:border-none print:m-0 print:p-0 print:w-full">
        
        {/* Modal Top Header (Hidden on print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0 no-print">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-xs font-mono font-bold text-indigo-700 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
              {formatReportTicketNumber(report)}
            </span>
            {jenjangList.map((j) => (
              <span
                key={j}
                className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200"
              >
                {j}
              </span>
            ))}
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${prio.badge}`}>
                {prio.label}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                <span className={`w-2 h-2 rounded-full ${stat.dotClass}`} />
                <span>{stat.label}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition flex items-center gap-1.5 shadow-2xs"
              title="Cetak Laporan / Simpan PDF dengan Kop Surat Kemensos"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Laporan (PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Document */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 print:p-0 print:overflow-visible">
          
          {/* ================= OFFICIAL KOP SURAT KEMENSOS ================= */}
          <div className="border-b-2 border-slate-900 pb-2.5">
            <div className="flex items-center justify-between gap-4">
              <div className="shrink-0 flex items-center justify-center">
                {safeKopLogoSrc && (
                  <img
                    src={safeKopLogoSrc}
                    alt="Logo Kementerian Sosial RI"
                    className="w-18 h-18 sm:w-20 sm:h-20 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
              </div>

              <div className="text-center flex-1 pr-4 sm:pr-8">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 uppercase tracking-wider leading-tight">
                  Kementerian Sosial Republik Indonesia
                </h3>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wide mt-0.5 leading-tight">
                  Sekolah Rakyat Terintegerasi 1 Sumedang
                </h4>
                <p className="text-[10.5px] font-semibold text-emerald-800 mt-1">
                  Sistem Informasi Berita Aktual Harian (SIBAHAR)
                </p>
                <p className="text-[9.5px] text-slate-600 mt-0.5 leading-tight">
                  {kopAddress}
                </p>
              </div>
            </div>

            <div className="mt-3 border-t-2 border-slate-900 w-full" />
            <div className="mt-0.5 border-t border-slate-700 w-full" />
          </div>

          {/* Kepada */}
          <div className="pt-1 pb-1 text-xs text-slate-900 flex justify-start">
            <div className="text-left leading-relaxed">
              <span className="text-slate-600 text-[11px] block">Kepada :</span>
              {isKepalaSekolahReport ? (
                <>
                  <span className="font-bold text-slate-900 block text-xs sm:text-sm">Yth. Menteri Sosial Republik Indonesia</span>
                  <span className="text-slate-700 block text-xs">di Jakarta</span>
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-900 block text-xs sm:text-sm">Yth. Kepala Sekolah Rakyat Terintegerasi 1 Sumedang</span>
                  <span className="text-slate-700 block text-xs">di Sumedang</span>
                </>
              )}
            </div>
          </div>

          {/* Judul Berita Acara Laporan */}
          <div className="text-center pt-1 pb-1">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider underline">
              Laporan Berita Aktual Harian
            </h2>
            <p className="text-xs font-mono text-slate-600 mt-0.5">
              Nomor: <strong>{formatReportTicketNumber(report)}</strong>
            </p>
          </div>
          
          {/* Title and Category */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-indigo-700">
                Kategori Utama: {getCategoryDisplayLabel(report.category, report.customCategory)}
              </span>
              {jenjangList.length > 0 && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-200">
                  Jenjang: {jenjangList.join(', ')}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {report.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Tanggal Kejadian: <strong className="text-slate-800 font-mono">{formatDateOnly(report.incidentDate)}</strong>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Waktu Registrasi: <strong className="text-slate-800 font-mono">{formatDateTime(report.createdAt)}</strong>
              </span>
              <span>·</span>
              <span>
                Prioritas Tertinggi: <strong className="text-slate-800">{prio.label}</strong>
              </span>
            </div>
          </div>

          {/* Indikator Peringatan Jawaban "Ya" untuk Kepala Sekolah */}
          {hasYesFindings && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Perhatian Pimpinan: Ditemukan Jawaban &ldquo;Ya&rdquo; pada Checklist Kondisi Sekolah/Asrama</p>
                <p className="text-amber-800 mt-0.5">
                  Terdapat indikator temuan pada salah satu atau lebih entri jenjang yang memerlukan pencermatan dan tindak lanjut.
                </p>
              </div>
            </div>
          )}

          {/* Ringkasan Jenjang & Jenis Asrama (tepat setelah judul laporan) */}
          {hasEntries && (
            <div className="border border-emerald-200 rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-emerald-50/80 border-b border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Ringkasan Jenjang &amp; Jenis Asrama ({entries.length} Jenjang)
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2 px-3 w-10 text-center">No</th>
                      <th className="py-2 px-3">Jenjang</th>
                      <th className="py-2 px-3">Jenis Asrama</th>
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 px-3">Risiko</th>
                      <th className="py-2 px-3">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry, idx) => {
                      const entryPrio = priorityLabels[entry.priority] || priorityLabels.sedang;
                      const entryYes = entryHasYesFindings(entry);
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-emerald-900">{entry.jenjang || '-'}</td>
                          <td className="py-2 px-3 text-slate-700">{entry.dormitoryType || '-'}</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">
                            {getCategoryDisplayLabel(entry.category, entry.customCategory)}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-medium ${entryPrio.badge}`}>
                              {entryPrio.label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            {entry.mode === 'checklist' ? (
                              <span className={`font-semibold ${entryYes ? 'text-amber-700' : 'text-emerald-700'}`}>
                                Checklist {entryYes ? '(Ada Ya)' : '(Semua Tidak)'}
                              </span>
                            ) : (
                              <span className="text-slate-700 font-medium">Kejadian Lainnya</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Tracker (Stepper) - Dihilangkan dari Laporan PDF Cetak */}
          <div className="no-print print:hidden hidden">
            {report.status === 'ditolak' ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-900">Laporan Ditolak / Dibatalkan</p>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Laporan ini tidak dapat diproses lebih lanjut sesuai dengan catatan verifikasi.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Tahapan Progres Tiket
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {steps.map((step, idx) => {
                    const isPast = idx <= currentStep;
                    return (
                      <div key={step.title} className="flex flex-col items-center text-center">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition ${
                            isPast
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {idx < currentStep ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold ${isPast ? 'text-slate-900' : 'text-slate-400'}`}>
                          {step.title}
                        </p>
                        <p className="text-[10px] text-slate-400 hidden sm:block">
                          {step.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Info Grid (Pelapor & Lokasi) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Pelapor</span>
              <p className="font-semibold text-slate-900 mt-0.5">{report.reporterName}</p>
              <p className="text-slate-600 text-[11px]">{reporterRoleLabel}{report.reporterNip ? ` · NIP. ${report.reporterNip}` : ''}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] font-medium">Lokasi / Area Kejadian</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {report.location || 'Lingkungan Sekolah Rakyat 1 Sumedang'}
              </p>
            </div>
          </div>

          {/* Rincian Per Jenjang (untuk laporan baru) atau Deskripsi Klasik (untuk laporan lama) */}
          {hasEntries ? (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Rincian Laporan Per Jenjang ({entries.length} Bagian)
              </h4>

              {entries.map((entry, idx) => {
                const entryPrio = priorityLabels[entry.priority] || priorityLabels.sedang;
                const entryYes = entryHasYesFindings(entry);
                const checklistRows =
                  entry.mode === 'checklist' ? normalizeChecklistAnswers(entry.checklistAnswers) : [];

                return (
                  <div
                    key={entry.id}
                    className={`rounded-xl border overflow-hidden bg-white ${
                      entryYes ? 'border-amber-300' : 'border-slate-200'
                    }`}
                  >
                    <div
                      className={`px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2 ${
                        entryYes
                          ? 'bg-amber-50/90 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                          Jenjang {entry.jenjang || '-'}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {entry.dormitoryType || 'Jenis Asrama Tidak Tercatat'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          (Bagian {idx + 1})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.mode === 'checklist' && entryYes && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-200/80 text-amber-950 border border-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            Ada Jawaban Ya
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-medium ${entryPrio.badge}`}>
                          {entryPrio.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Kategori Laporan</span>
                          <span className="font-semibold text-slate-900">
                            {getCategoryDisplayLabel(entry.category, entry.customCategory)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Mode Deskripsi</span>
                          <span className="font-semibold text-slate-900">
                            {entry.mode === 'checklist'
                              ? 'Checklist Kondisi Sekolah/Asrama'
                              : 'Laporan Kejadian Lainnya'}
                          </span>
                        </div>
                      </div>

                      {entry.mode === 'checklist' ? (
                        <div className="space-y-3">
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                                  <th className="py-2 px-2.5 w-10 text-center">No</th>
                                  <th className="py-2 px-2.5">Pertanyaan Pemeriksaan Kondisi</th>
                                  <th className="py-2 px-2.5 w-20 text-center">Jawaban</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {checklistRows.map((row) => {
                                  const isYes = row.answer === 'ya';
                                  return (
                                    <tr key={row.questionIndex} className={isYes ? 'bg-amber-50/60' : ''}>
                                      <td className="py-2 px-2.5 text-center font-mono text-slate-500 align-top">
                                        {row.questionIndex}
                                      </td>
                                      <td className="py-2 px-2.5 text-slate-800 leading-relaxed align-top">
                                        {row.question}
                                      </td>
                                      <td className="py-2 px-2.5 text-center align-top">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                                            isYes
                                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                              : row.answer === 'tidak'
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                              : 'bg-slate-100 text-slate-500'
                                          }`}
                                        >
                                          {isYes ? 'Ya' : row.answer === 'tidak' ? 'Tidak' : '-'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              {entryYes ? 'Deskripsi Kejadian (Tindak Lanjut Jawaban Ya)' : 'Keterangan Checklist'}
                            </p>
                            <div
                              className={`p-3.5 rounded-lg border text-xs sm:text-sm leading-relaxed text-justify whitespace-pre-wrap ${
                                entryYes
                                  ? 'bg-amber-50/40 border-amber-200 text-slate-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              {entryYes
                                ? entry.incidentDescription || '-'
                                : 'Seluruh kondisi yang diperiksa dalam checklist dinyatakan Tidak ditemukan.'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Deskripsi Kejadian
                          </p>
                          <div className="p-3.5 bg-white rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed text-justify">
                            {entry.incidentDescription || '-'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Uraian Kronologi / Deskripsi Kejadian
              </h4>
              <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed text-justify">
                {report.description}
              </div>
            </div>
          )}

          {/* Kolom Khusus untuk Gambar yang di-upload / Lampiran Dokumen (Tampil di Layar & PDF Cetak) */}
          {report.attachments && report.attachments.length > 0 && (
            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 print:bg-white print:border-slate-300">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-600 print:text-black" />
                  <span>Kolom Dokumentasi Bukti Foto &amp; Lampiran ({report.attachments.length} Berkas)</span>
                </h4>
                <span className="text-[10px] text-slate-500 font-mono no-print">Maksimal 2 Gambar</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {report.attachments.map((file, idx) => {
                  const safeFileUrl = sanitizeImageUrl(file.dataUrl);
                  return (
                  <div key={file.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs print:border-slate-300">
                    {safeFileUrl ? (
                      <div className="p-2 flex flex-col items-center">
                        <div className="w-full flex items-center justify-center bg-slate-100 rounded p-1 mb-1.5 max-h-56 sm:max-h-64 overflow-hidden">
                          <img
                            src={safeFileUrl}
                            alt={`Bukti Foto ${idx + 1}: ${file.name}`}
                            className="max-h-52 sm:max-h-60 w-auto object-contain mx-auto"
                          />
                        </div>
                        <div className="w-full pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                          <span className="truncate font-medium">{file.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">({formatFileSize(file.size)})</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => alert(`Mengunduh berkas: ${file.name}`)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded transition no-print"
                          title="Unduh berkas"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline / Audit Trail */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Riwayat Tindak Lanjut &amp; Log Penanganan
            </h4>
            <div className="space-y-2.5">
              {report.logs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                    <span className="font-semibold text-slate-900">{log.action}</span>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Oleh: <strong className="text-slate-800">{log.actor}</strong>
                  </p>
                  {log.note && (
                    <p className="text-slate-700 mt-1 p-2 bg-white rounded border border-slate-100 text-xs leading-relaxed">
                      &ldquo;{log.note}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Lembar Pengesahan Tanda Tangan Resmi (Sebelah Kanan) */}
          <div className="pt-6 border-t border-slate-300 flex justify-end text-xs print:text-[11px] print:pt-4">
            <div className="text-center w-64">
              <p className="text-slate-600">Sumedang, {printDate}</p>
              <p className="text-slate-700 font-semibold">{isKepalaSekolahReport ? chiefRole : reporterRoleLabel}</p>
              <div className="h-16 flex items-center justify-center">
                {safeSignatureUrl ? (
                  <img
                    src={safeSignatureUrl}
                    alt="Ttd Pembuat Laporan"
                    className="max-h-14 max-w-[130px] object-contain"
                  />
                ) : report.status === 'selesai' ? (
                  <span className="font-serif italic font-bold text-lg text-slate-900 tracking-wider">( Ttd )</span>
                ) : null}
              </div>
              <p className="font-bold text-slate-900 underline">{isKepalaSekolahReport ? chiefName : report.reporterName}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {isKepalaSekolahReport
                  ? (chiefNipRaw ? `NIP. ${chiefNipRaw}` : '')
                  : (report.reporterNip ? `NIP. ${report.reporterNip}` : '')}
              </p>
            </div>
          </div>

          {actionError && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start justify-between gap-2 no-print"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Gagal Menyimpan ke Supabase</p>
                  <p className="mt-0.5">{actionError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-rose-600 hover:text-rose-900 font-semibold px-2 py-0.5 rounded hover:bg-rose-100 shrink-0"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Form Tambah Catatan Tindak Lanjut (No print) */}
          <div className="pt-2 no-print">
            <form onSubmit={handleAddNoteSubmit} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Tambah Catatan Progres / Tanggapan Baru (Opsional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => {
                    setNewNote(e.target.value);
                    if (actionError) setActionError(null);
                  }}
                  disabled={isAddingNote || isUpdatingStatus}
                  placeholder="Ketik catatan tindak lanjut, konseling, mediasi, atau hasil koordinasi..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
                />
                <button
                  type="submit"
                  disabled={!newNote.trim() || isAddingNote || isUpdatingStatus}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAddingNote ? 'Menyimpan...' : 'Kirim'}</span>
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Modal Bottom Actions (Hidden on print) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3 shrink-0 no-print">
          {/* Quick status change buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1 hidden sm:inline">Ubah Status:</span>
            {report.status !== 'diproses' && report.status !== 'selesai' && (
              <button
                type="button"
                disabled={isUpdatingStatus || isAddingNote}
                onClick={() => handleStatusChangeSubmit('diproses')}
                className="px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 border border-amber-300 rounded-md transition cursor-pointer"
              >
                {isUpdatingStatus ? 'Memproses...' : 'Tandai Diproses'}
              </button>
            )}
            {report.status !== 'selesai' && (
              <button
                type="button"
                disabled={isUpdatingStatus || isAddingNote}
                onClick={() => handleStatusChangeSubmit('selesai')}
                className="px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 border border-emerald-300 rounded-md transition cursor-pointer"
              >
                {isUpdatingStatus ? 'Memproses...' : 'Tandai Selesai'}
              </button>
            )}
            {report.status !== 'ditolak' && report.status !== 'selesai' && (
              <button
                type="button"
                disabled={isUpdatingStatus || isAddingNote}
                onClick={() => handleStatusChangeSubmit('ditolak')}
                className="px-2.5 py-1.5 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 border border-rose-300 rounded-md transition cursor-pointer"
              >
                {isUpdatingStatus ? 'Memproses...' : 'Tolak'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Laporan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
            >
              Tutup Jendela
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
