import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Clock, 
  CheckCircle, 
  Calendar, 
  Paperclip, 
  Download, 
  Send,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';
import { ReportItem, ReportStatus, AppSettings, UserProfile } from '../types/report';
import { 
  categoryLabels, 
  priorityLabels, 
  statusLabels, 
  formatDateTime, 
  formatDateOnly,
  formatFileSize 
} from '../utils/formatters';
import { KemensosLogo } from './KemensosLogo';
import { openPrintPdfTab } from '../utils/printPdf';

interface ReportDetailModalProps {
  report: ReportItem;
  onClose: () => void;
  onUpdateStatus: (reportId: string, newStatus: ReportStatus, note?: string) => void;
  onAddNote: (reportId: string, note: string) => void;
  currentUser: string;
  appSettings?: AppSettings;
  userProfile?: UserProfile;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  onClose,
  onUpdateStatus,
  onAddNote,
  currentUser,
  appSettings,
  userProfile,
}) => {
  const [newNote, setNewNote] = useState('');

  const prio = priorityLabels[report.priority] || priorityLabels.sedang;
  const stat = statusLabels[report.status] || statusLabels.menunggu;

  const isKepalaSekolahReport = 
    report.userRole === 'kepala_sekolah' ||
    (report.picRole && report.picRole.toLowerCase().includes('kepala sekolah')) ||
    (report.reporterName && report.reporterName.toLowerCase().includes('cece enjang')) ||
    (report.reporterNip && report.reporterNip.replace(/\s+/g, '') === '197807062005011011');

  const defaultKopLogo = 'https://vectorez.biz.id/wp-content/uploads/2024/05/Logo-Kementerian-Sosial-Kemensos-Republik-Indonesia@0.5x.png';
  const kopLogoSrc = appSettings?.kopLogoUrl || defaultKopLogo;
  const kopAddress = appSettings?.kopAddress || 'Desa Kebon Cau, Kecamatan Ujung Jaya Kabupaten Sumedang Kode Pos 45383';

  const getRoleLabel = () => {
    if (isKepalaSekolahReport) return 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang';
    if (report.picRole && report.picRole.trim()) return report.picRole;
    if (report.reporterDept && report.reporterDept.trim()) return report.reporterDept;
    if (report.userRole === 'wali_asrama') return 'Wali Asrama';
    if (report.userRole === 'wali_asuh') return 'Wali Asuh';
    if (report.userRole === 'guru') return 'Guru';
    if (report.userRole === 'tenaga_keamanan' || report.userRole === 'keamanan') return 'Tenaga Keamanan';
    if (report.userRole === 'admin') return 'Administrator Sistem';
    return 'Staf / Petugas';
  };
  const reporterRoleLabel = getRoleLabel();

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    onAddNote(report.id, newNote.trim());
    setNewNote('');
  };

  const handleStatusChangeSubmit = (newSt: ReportStatus) => {
    if (newSt === report.status) return;
    // Requirement 4: Tidak wajib mengisi catatan progres/tanggapan di akun manapun
    onUpdateStatus(report.id, newSt, undefined);
  };

  const handlePrint = () => {
    // Membuka tab baru yang langsung memformat dan memicu cetak / simpan PDF Legal
    openPrintPdfTab(report, appSettings, userProfile);
  };

  // Determine active step index for the progress stepper
  const getStepIndex = () => {
    if (report.status === 'draft') return -1;
    if (report.status === 'menunggu') return 0;
    if (report.status === 'diproses') return 2;
    if (report.status === 'selesai') return 3;
    if (report.status === 'ditolak') return -2; // rejected
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
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-indigo-700 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
              {report.id}
            </span>
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
              {/* Logo Kementerian Sosial Republik Indonesia di sebelah kiri */}
              <div className="shrink-0 flex items-center justify-center">
                <img
                  src={kopLogoSrc}
                  alt="Logo Kementerian Sosial RI"
                  className="w-18 h-18 sm:w-20 sm:h-20 object-contain"
                  onError={(e) => {
                    // Fallback jika gambar URL bermasalah
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Teks Kop Surat */}
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

            {/* Garis Ganda Kop Surat Resmi Pemerintah (Tebal atas, Tipis bawah) */}
            <div className="mt-3 border-t-2 border-slate-900 w-full" />
            <div className="mt-0.5 border-t border-slate-700 w-full" />
          </div>

          {/* Kepada : Yth. Menteri Sosial RI (Kepsek) atau Yth. Kepala Sekolah (Staf) */}
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
              Nomor: <strong>{report.id}</strong>
            </p>
          </div>
          
          {/* Title and Category */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-indigo-700 block mb-1">
              Kategori: {categoryLabels[report.category]?.label || report.category}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {report.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-600 mt-2 flex-wrap">
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
                Prioritas: <strong className="text-slate-800">{prio.label}</strong>
              </span>
            </div>
          </div>

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

          {/* Info Grid (Pelapor, Lokasi, Penanggung Jawab / Laporan dari) */}
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

          {/* Description Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Uraian Kronologi / Deskripsi Kejadian
            </h4>
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {report.description}
            </div>
          </div>

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
                {report.attachments.map((file, idx) => (
                  <div key={file.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs print:border-slate-300">
                    {file.dataUrl ? (
                      <div className="p-2 flex flex-col items-center">
                        <div className="w-full flex items-center justify-center bg-slate-100 rounded p-1 mb-1.5 max-h-56 sm:max-h-64 overflow-hidden">
                          <img
                            src={file.dataUrl}
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
                ))}
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
              <p className="text-slate-700 font-semibold">{isKepalaSekolahReport ? (userProfile?.role || 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang') : reporterRoleLabel}</p>
              <div className="h-16 flex items-center justify-center">
                {report.reporterSignature ? (
                  <img
                    src={report.reporterSignature}
                    alt="Ttd Pembuat Laporan"
                    className="max-h-14 max-w-[130px] object-contain"
                  />
                ) : report.status === 'selesai' ? (
                  <span className="font-serif italic font-bold text-lg text-slate-900 tracking-wider">( Ttd )</span>
                ) : null}
              </div>
              <p className="font-bold text-slate-900 underline">{isKepalaSekolahReport ? (userProfile?.name || 'Cece Enjang Kartiwa, S.Pd.,MM') : report.reporterName}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {isKepalaSekolahReport ? `NIP. ${userProfile?.nip || '19780706 200501 1 011'}` : (report.reporterNip ? `NIP. ${report.reporterNip}` : '')}
              </p>
            </div>
          </div>

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
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ketik catatan tindak lanjut, konseling, mediasi, atau hasil koordinasi..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim</span>
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
                onClick={() => handleStatusChangeSubmit('diproses')}
                className="px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition"
              >
                Tandai Diproses
              </button>
            )}
            {report.status !== 'selesai' && (
              <button
                onClick={() => handleStatusChangeSubmit('selesai')}
                className="px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition"
              >
                Tandai Selesai
              </button>
            )}
            {report.status !== 'ditolak' && report.status !== 'selesai' && (
              <button
                onClick={() => handleStatusChangeSubmit('ditolak')}
                className="px-2.5 py-1.5 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md transition"
              >
                Tolak
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
