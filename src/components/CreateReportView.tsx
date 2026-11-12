import React, { useState, useRef, useEffect } from 'react';
import { 
  FilePlus, 
  Clock, 
  CheckCircle2, 
  UploadCloud, 
  X, 
  File, 
  Image as ImageIcon, 
  AlertCircle, 
  Send, 
  Bookmark, 
  Sparkles,
  ArrowRight,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { 
  ReportItem, 
  ReportCategory, 
  ReportPriority, 
  AttachmentFile, 
  UserProfile 
} from '../types/report';
import { formatFileSize, formatDateOnly } from '../utils/formatters';
import { TabType } from './Sidebar';
import { SignaturePadInput } from './SignaturePadInput';

interface CreateReportViewProps {
  reports: ReportItem[];
  userProfile: UserProfile;
  onSubmitReport: (newReport: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>) => ReportItem;
  onSaveDraft: (draftData: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>) => ReportItem;
  onNavigateTab: (tab: TabType, filterStatus?: string) => void;
  onViewReportDetail: (report: ReportItem) => void;
  onDeleteDraft?: (draftId: string) => void;
}

export const CreateReportView: React.FC<CreateReportViewProps> = ({
  reports,
  userProfile,
  onSubmitReport,
  onSaveDraft,
  onNavigateTab,
  onViewReportDetail,
  onDeleteDraft,
}) => {
  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [priority, setPriority] = useState<ReportPriority>('sedang');
  const [incidentDate, setIncidentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [reporterSignature, setReporterSignature] = useState<string>('');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Penanggung Jawab otomatis terisi dari akun profil pengguna yang sedang login
  const picName = userProfile.name;
  const picRole = userProfile.role;
  const picNip = userProfile.nip || '';

  // Auto-set priority & description to "Nihil" when category is "Nihil"
  const handleCategorySelect = (selectedCat: ReportCategory | '') => {
    setCategory(selectedCat);
    if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));

    if (selectedCat === 'nihil') {
      setPriority('nihil');
      setDescription('Nihil');
      if (!title.trim()) {
        setTitle('Laporan Harian Nihil');
      }
    }
  };
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<ReportItem | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute summary metrics
  const draftReports = reports.filter((r) => r.status === 'draft');
  const inProgressReports = reports.filter((r) => r.status === 'diproses');
  const resolvedThisMonth = reports.filter((r) => r.status === 'selesai');

  // Handle file uploads (Requirement 3: Maksimal 2 gambar)
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    if (attachments.length + fileList.length > 2) {
      alert('Lampiran dokumen/bukti foto maksimal 2 gambar.');
      return;
    }

    const newAttachments: AttachmentFile[] = [];
    Array.from(fileList).forEach((f) => {
      // 10MB limit check
      if (f.size > 10 * 1024 * 1024) {
        alert(`Berkas ${f.name} melebihi batas 10MB.`);
        return;
      }

      const reader = new FileReader();
      const attId = 'att-' + Math.random().toString(36).substring(2, 9);

      if (f.type.startsWith('image/')) {
        reader.onload = (e) => {
          setAttachments((prev) => {
            if (prev.length >= 2) return prev;
            return [
              ...prev,
              {
                id: attId,
                name: f.name,
                size: f.size,
                type: f.type,
                dataUrl: e.target?.result as string,
              },
            ];
          });
        };
        reader.readAsDataURL(f);
      } else {
        newAttachments.push({
          id: attId,
          name: f.name,
          size: f.size,
          type: f.type,
        });
      }
    });

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments].slice(0, 2));
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!title.trim()) {
      errs.title = 'Judul laporan wajib diisi';
    } else if (title.trim().length < 3) {
      errs.title = 'Judul laporan minimal 3 karakter';
    }

    if (!category) {
      errs.category = 'Pilih kategori laporan';
    }

    if (!description.trim()) {
      errs.description = 'Deskripsi atau kronologi kejadian wajib diisi';
    } else if (category !== 'nihil' && description.trim().length < 5) {
      errs.description = 'Jelaskan kronologi kejadian (minimal 5 karakter)';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const created = onSubmitReport({
        title: title.trim(),
        category: category as ReportCategory,
        priority,
        incidentDate: incidentDate || new Date().toISOString().split('T')[0],
        location: location.trim() || 'Lingkungan Sekolah Rakyat Terintegerasi 1 Sumedang',
        description: description.trim(),
        status: 'menunggu',
        reporterName: picName.trim() || userProfile.name,
        reporterEmail: userProfile.email,
        reporterDept: userProfile.department,
        reporterNip: picNip.trim() || userProfile.nip,
        picName: picName.trim() || userProfile.name,
        picRole: picRole.trim() || userProfile.role,
        picNip: picNip.trim() || userProfile.nip,
        attachments,
        reporterSignature: reporterSignature || undefined,
      });

      // If we were editing a draft, remove the draft
      if (editingDraftId && onDeleteDraft) {
        onDeleteDraft(editingDraftId);
      }

      setIsSubmitting(false);
      setSubmittedReport(created);
      resetForm();
    }, 400);
  };

  const handleSaveDraft = () => {
    if (!title.trim() && !description.trim()) {
      alert('Tuliskan minimal judul atau catatan awal untuk menyimpan draft.');
      return;
    }

    const saved = onSaveDraft({
      title: title.trim() || 'Draft Tanpa Judul - ' + new Date().toLocaleTimeString('id-ID'),
      category: (category as ReportCategory) || 'kategori_1',
      priority,
      incidentDate: incidentDate || new Date().toISOString().split('T')[0],
      location: location.trim() || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      description: description.trim(),
      status: 'draft',
      reporterName: picName.trim() || userProfile.name,
      reporterEmail: userProfile.email,
      reporterDept: userProfile.department,
      reporterNip: picNip.trim() || userProfile.nip,
      picName: picName.trim() || userProfile.name,
      picRole: picRole.trim() || userProfile.role,
      picNip: picNip.trim() || userProfile.nip,
      attachments,
      reporterSignature: reporterSignature || undefined,
    });

    if (editingDraftId && onDeleteDraft && editingDraftId !== saved.id) {
      onDeleteDraft(editingDraftId);
    }

    resetForm();
    alert('Draft laporan berhasil disimpan! Anda dapat membukanya kembali dari menu Draft.');
  };

  const resetForm = () => {
    setTitle('');
    setCategory('');
    setPriority('sedang');
    setLocation('');
    setDescription('');
    setAttachments([]);
    setReporterSignature('');
    setEditingDraftId(null);
    setErrors({});
  };

  const loadDraftIntoForm = (draft: ReportItem) => {
    setTitle(draft.title.startsWith('Draft Tanpa Judul') ? '' : draft.title);
    setCategory(draft.category);
    setPriority(draft.priority);
    setIncidentDate(draft.incidentDate);
    setLocation(draft.location || '');
    setDescription(draft.description);
    setAttachments(draft.attachments || []);
    setReporterSignature(draft.reporterSignature || '');
    setEditingDraftId(draft.id);
    setShowDraftModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Cepat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Draft Tersimpan */}
        <button
          onClick={() => setShowDraftModal(true)}
          className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-xs hover:border-indigo-300 hover:shadow-sm transition text-left group"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition">
            <FilePlus className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 font-medium">Draft Tersimpan</p>
            <h3 className="text-lg font-bold text-slate-900 font-mono tabular-nums">
              {draftReports.length} Laporan
            </h3>
            <span className="text-[11px] text-indigo-600 font-medium group-hover:underline flex items-center gap-1 mt-0.5">
              Kelola draft <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Sedang Diproses */}
        <button
          onClick={() => onNavigateTab('history', 'diproses')}
          className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-xs hover:border-amber-300 hover:shadow-sm transition text-left group"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-100 transition">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 font-medium">Sedang Diproses</p>
            <h3 className="text-lg font-bold text-slate-900 font-mono tabular-nums">
              {inProgressReports.length} Laporan
            </h3>
            <span className="text-[11px] text-amber-700 font-medium group-hover:underline flex items-center gap-1 mt-0.5">
              Lihat di riwayat <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Selesai Bulan Ini */}
        <button
          onClick={() => onNavigateTab('history', 'selesai')}
          className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition text-left group"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 font-medium">Selesai Ditangani</p>
            <h3 className="text-lg font-bold text-slate-900 font-mono tabular-nums">
              {resolvedThisMonth.length} Laporan
            </h3>
            <span className="text-[11px] text-emerald-700 font-medium group-hover:underline flex items-center gap-1 mt-0.5">
              Laporan teratasi <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>

      {/* Success Banner if newly submitted */}
      {submittedReport && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Laporan Berhasil Diajukan!
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Nomor Tiket: <span className="font-mono font-bold text-emerald-900">{submittedReport.id}</span> — {submittedReport.title}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Laporan telah tercatat di antrean Helpdesk & tim penanggung jawab akan segera memverifikasi.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => onViewReportDetail(submittedReport)}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1.5"
            >
              Lihat Detail Tiket <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSubmittedReport(null)}
              className="p-1.5 text-emerald-600 hover:text-emerald-900"
              title="Tutup pemberitahuan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Formulir: Buat Laporan */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Detail Laporan Baru
              </h2>
              {editingDraftId && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-mono">
                  Memuat Draft: {editingDraftId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Isi seluruh informasi yang diperlukan secara akurat dan lengkap untuk penanganan cepat.
            </p>
          </div>

          {editingDraftId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Batal Edit Draft (Form Baru)
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Judul Laporan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Judul Laporan <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Ringkas & spesifik</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="Contoh: Kendala Server Database Unit 2 Mengalami Timeout"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition focus:outline-hidden ${
                errors.title 
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20' 
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              }`}
            />
            {errors.title && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Kategori & Tingkat Urgensi (2 Kolom) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kategori Laporan <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => handleCategorySelect(e.target.value as ReportCategory)}
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition bg-white focus:outline-hidden ${
                  errors.category 
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20' 
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                }`}
              >
                <option value="">Pilih Kategori Laporan...</option>
                <option value="kategori_1">Tata Tertib, Relasi &amp; Prilaku, Adaptasi dan Motivasi, Kedisiplinan</option>
                <option value="kategori_2">Tata Tertib &amp; Perundungan, Kekerasan &amp; Relasi, Kesehatan dan Psikologis, Pendikan &amp; Kehadiran</option>
                <option value="kategori_3">Keselamatan &amp; Kekerasan, Hukum &amp; Perlindungan, Kesehatan &amp; Keselamatan Diri, Ruang Digital &amp; Nilai</option>
                <option value="nihil">Nihil</option>
              </select>
              {errors.category && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tingkat Prioritas <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ReportPriority)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition bg-white"
              >
                <option value="ringan">Kasus Ringan / Resiko Rendah</option>
                <option value="sedang">Kasus Sedang / Resiko Sedang</option>
                <option value="berat">Kasus Berat/Kompleks atau Resiko Tinggi/Kritis</option>
                <option value="nihil">Nihil</option>
              </select>
            </div>
          </div>

          {/* Tanggal Kejadian & Lokasi (2 Kolom) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tanggal Kejadian / Terkait
              </label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Lokasi / Area Terkait
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Gedung A Lantai 3, Ruang Server, Cabang XYZ"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition"
              />
            </div>
          </div>

          {/* Isi / Deskripsi Laporan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Deskripsi / Kronologi Kejadian <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {description.length} karakter
              </span>
            </div>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="Jelaskan secara rinci apa yang terjadi, kronologi waktu, unit terdampak, serta dampak langsung terhadap operasional..."
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition focus:outline-hidden ${
                errors.description 
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20' 
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              }`}
            />
            {errors.description && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Upload File / Lampiran (Requirement 3: Maksimal 2 gambar) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Lampiran Dokumen / Bukti Foto (Maksimal 2 Berkas)
              </label>
              <span className={`text-[11px] font-semibold ${attachments.length >= 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                {attachments.length}/2 Berkas Terunggah
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={attachments.length >= 2}
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div
              onClick={() => {
                if (attachments.length < 2) {
                  fileInputRef.current?.click();
                } else {
                  alert('Batas maksimal lampiran adalah 2 gambar. Hapus salah satu berkas terlebih dahulu.');
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (attachments.length < 2) setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (attachments.length < 2) {
                  handleFiles(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                attachments.length >= 2
                  ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-80'
                  : isDragOver 
                    ? 'border-indigo-500 bg-indigo-50/50' 
                    : 'border-slate-300 hover:border-indigo-500 bg-slate-50/60'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">
                {attachments.length >= 2 ? (
                  <span className="text-amber-700 font-semibold">Batas maksimal 2 lampiran telah tercapai</span>
                ) : (
                  <>Tarik berkas ke sini, atau <span className="text-indigo-600 underline">pilih dari perangkat</span></>
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Maksimal 2 gambar / berkas (Format JPG, PNG, PDF maks 10MB)
              </p>
            </div>

            {/* Attachment Preview List */}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  Berkas Terlampir ({attachments.length}):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {file.dataUrl ? (
                          <img
                            src={file.dataUrl}
                            alt={file.name}
                            className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                          />
                        ) : file.type.includes('image') ? (
                          <ImageIcon className="w-5 h-5 text-indigo-500 shrink-0" />
                        ) : (
                          <File className="w-5 h-5 text-slate-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttachment(file.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                        title="Hapus lampiran"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tanda Tangan Pembuat Laporan (Gambar atau Upload .PNG) */}
          <SignaturePadInput
            value={reporterSignature}
            onChange={setReporterSignature}
            reporterName={userProfile.name}
          />

          {/* Tombol Aksi */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-3">
            <div className="text-xs text-slate-600 bg-emerald-50/70 border border-emerald-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                Penanggung Jawab Otomatis: <strong className="text-slate-800">{userProfile.name}</strong> ({userProfile.role} — NIP: {userProfile.nip || '-'})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs sm:text-sm transition flex items-center gap-2"
              >
                <Bookmark className="w-4 h-4 text-slate-500" />
                <span>Simpan Draft</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm transition shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Mengirim...' : 'Kirim Laporan'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal Daftar Draft Tersimpan */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Draft Laporan Tersimpan</h3>
                <p className="text-xs text-slate-500">Pilih draft untuk melanjutkan pengisian</p>
              </div>
              <button
                onClick={() => setShowDraftModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {draftReports.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Tidak ada draft tersimpan saat ini.
                </div>
              ) : (
                draftReports.map((draft) => (
                  <div
                    key={draft.id}
                    className="p-3.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono text-slate-500">{draft.id}</span>
                        <span className="text-[11px] text-slate-400">·</span>
                        <span className="text-[11px] text-slate-500">{formatDateOnly(draft.incidentDate)}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800 truncate">
                        {draft.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {draft.description || 'Belum ada deskripsi'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <button
                        onClick={() => loadDraftIntoForm(draft)}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition"
                      >
                        Buka Draft
                      </button>
                      {onDeleteDraft && (
                        <button
                          onClick={() => onDeleteDraft(draft.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition"
                          title="Hapus draft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowDraftModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
