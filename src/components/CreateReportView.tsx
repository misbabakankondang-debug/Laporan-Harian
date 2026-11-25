import React, { useState, useRef } from 'react';
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
  ArrowRight,
  Trash2,
  ExternalLink,
  Plus,
} from 'lucide-react';
import {
  ReportItem,
  AttachmentFile,
  UserProfile,
  ReportJenjangEntry,
  JENJANG_OPTIONS,
  JenjangType,
} from '../types/report';
import {
  formatFileSize,
  formatDateOnly,
  formatReportTicketNumber,
  createEmptyJenjangEntry,
  normalizeJenjangEntry,
  validateJenjangEntries,
  buildReportSummariesFromEntries,
  getReportJenjangBadgeList,
  getReportEntriesSummaryCategories,
  EntryValidationErrors,
} from '../utils/formatters';
import { SubmitReportResult } from '../lib/supabase';
import { TabType } from './Sidebar';
import { SignaturePadInput } from './SignaturePadInput';
import { JenjangEntryFormCard } from './JenjangEntryFormCard';

interface CreateReportViewProps {
  reports: ReportItem[];
  userProfile: UserProfile;
  onSubmitReport: (newReport: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>) => Promise<SubmitReportResult>;
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
  // Header form states
  const [title, setTitle] = useState('');
  const [incidentDate, setIncidentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [location, setLocation] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [reporterSignature, setReporterSignature] = useState<string>('');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Multi-jenjang entries state (Entri pertama jenjang dipilih di awal formulir sebelum Judul)
  const [entries, setEntries] = useState<ReportJenjangEntry[]>(() => [
    createEmptyJenjangEntry(''),
  ]);

  // Independent errors per field & per entry
  const [titleError, setTitleError] = useState('');
  const [entryErrors, setEntryErrors] = useState<Record<string, EntryValidationErrors>>({});

  // Penanggung Jawab otomatis terisi dari akun profil pengguna yang sedang login
  const picName = userProfile.name;
  const picRole = userProfile.role;
  const picNip = userProfile.nip || '';

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<ReportItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute summary metrics
  const draftReports = reports.filter((r) => r.status === 'draft');
  const inProgressReports = reports.filter((r) => r.status === 'diproses');
  const resolvedThisMonth = reports.filter((r) => r.status === 'selesai');

  const primaryEntry = entries[0];
  const otherJenjangsUsedByLaterEntries = entries
    .slice(1)
    .map((e) => e.jenjang)
    .filter((j): j is JenjangType => Boolean(j));
  const usedJenjangsAll = entries
    .map((e) => e.jenjang)
    .filter((j): j is JenjangType => Boolean(j));
  const availableAdditionalJenjangs = JENJANG_OPTIONS.filter(
    (j) => !usedJenjangsAll.includes(j)
  );

  // Update a single entry without touching any other entry's data or errors
  const handleEntryChange = (entryId: string, updatedEntry: ReportJenjangEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? updatedEntry : e)));
    setEntryErrors((prev) => {
      if (!prev[entryId]) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  };

  const handleAddJenjangEntry = () => {
    if (entries.length >= JENJANG_OPTIONS.length || availableAdditionalJenjangs.length === 0) {
      return;
    }
    const nextJenjang = availableAdditionalJenjangs[0] || '';
    const newEntry = createEmptyJenjangEntry(nextJenjang);
    setEntries((prev) => [...prev, newEntry]);
  };

  const handleRemoveEntry = (entryId: string) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    setEntryErrors((prev) => {
      if (!prev[entryId]) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  };

  // Handle file uploads (Maksimal 2 gambar/berkas)
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    if (attachments.length + fileList.length > 2) {
      alert('Lampiran dokumen/bukti foto maksimal 2 gambar.');
      return;
    }

    const newAttachments: AttachmentFile[] = [];
    Array.from(fileList).forEach((f) => {
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

  const validateAll = (): boolean => {
    let nextTitleError = '';
    if (!title.trim()) {
      nextTitleError = 'Judul laporan wajib diisi';
    } else if (title.trim().length < 3) {
      nextTitleError = 'Judul laporan minimal 3 karakter';
    }
    setTitleError(nextTitleError);

    const entryValidation = validateJenjangEntries(entries);
    setEntryErrors(entryValidation.entryErrors);

    if (nextTitleError || !entryValidation.valid) {
      const firstInvalidEntryId = Object.keys(entryValidation.entryErrors)[0];
      if (!nextTitleError && firstInvalidEntryId) {
        const el = document.getElementById(`entry-card-${firstInvalidEntryId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    setSubmitError(null);
    setSubmittedReport(null);
    setIsSubmitting(true);

    try {
      const summary = buildReportSummariesFromEntries(entries);

      const result = await onSubmitReport({
        title: title.trim(),
        jenjang: summary.jenjang,
        category: summary.category,
        customCategory: summary.customCategory,
        priority: summary.priority,
        incidentDate: incidentDate || new Date().toISOString().split('T')[0],
        location: location.trim() || 'Lingkungan Sekolah Rakyat Terintegerasi 1 Sumedang',
        description: summary.description,
        entries: summary.normalizedEntries,
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

      if (!result.success || !result.report) {
        setSubmitError(
          result.error ||
            'Gagal menyimpan laporan ke database Supabase. Silakan periksa koneksi atau hak akses lalu coba lagi.'
        );
        return;
      }

      if (editingDraftId && onDeleteDraft) {
        onDeleteDraft(editingDraftId);
      }

      setSubmittedReport(result.report);
      resetForm();
    } catch (err: any) {
      setSubmitError(err?.message || 'Terjadi kesalahan saat menyimpan laporan ke Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    const hasAnyEntryInput = entries.some(
      (e) =>
        Boolean(e.jenjang) ||
        Boolean(e.dormitoryType) ||
        Boolean(e.category) ||
        Boolean(e.customCategory?.trim()) ||
        Boolean(e.incidentDescription?.trim()) ||
        (e.checklistAnswers || []).some(
          (q) => q.answer === 'ya' || q.answer === 'tidak' || Boolean(q.description?.trim())
        )
    );

    if (!title.trim() && !hasAnyEntryInput) {
      alert('Tuliskan minimal judul, jenjang, atau isian awal sebelum menyimpan draft.');
      return;
    }

    // Pertahankan seluruh jawaban parsial/lengkap per entri apa adanya saat disimpan sebagai draft
    const preservedEntries = entries.map((entry, idx) => normalizeJenjangEntry(entry, idx));
    const jenjangList = preservedEntries
      .map((e) => e.jenjang)
      .filter(Boolean)
      .join(', ');
    const firstEntry = preservedEntries[0];
    const summaryDesc =
      preservedEntries
        .map((e) => {
          const head = `[${e.jenjang || 'Jenjang belum dipilih'} · ${e.dormitoryType || 'Asrama belum dipilih'}]`;
          if (e.mode === 'checklist') {
            const yesWithDesc = (e.checklistAnswers || [])
              .filter((q) => q.answer === 'ya' && q.description?.trim())
              .map((q) => `No.${q.questionIndex}: ${q.description?.trim()}`)
              .join('; ');
            if (yesWithDesc) return `${head} ${yesWithDesc}`;
          }
          return e.incidentDescription?.trim() ? `${head} ${e.incidentDescription.trim()}` : head;
        })
        .join('\n') || 'Draft laporan SIBAHAR';

    const saved = onSaveDraft({
      title: title.trim() || 'Draft Tanpa Judul - ' + new Date().toLocaleTimeString('id-ID'),
      jenjang: jenjangList,
      category: (firstEntry?.category || 'tata_tertib') as any,
      customCategory:
        firstEntry?.category === 'lainnya_manual' ? firstEntry.customCategory : undefined,
      priority: firstEntry?.priority || 'sedang',
      incidentDate: incidentDate || new Date().toISOString().split('T')[0],
      location: location.trim() || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      description: summaryDesc,
      entries: preservedEntries,
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
    alert('Draft laporan berhasil disimpan! Seluruh jenjang, asrama, kategori, checklist, dan deskripsi akan dipulihkan saat draft dibuka.');
  };

  const resetForm = () => {
    setTitle('');
    setLocation('');
    setAttachments([]);
    setReporterSignature('');
    setEditingDraftId(null);
    setEntries([createEmptyJenjangEntry('')]);
    setTitleError('');
    setEntryErrors({});
  };

  const loadDraftIntoForm = (draft: ReportItem) => {
    setTitle(draft.title.startsWith('Draft Tanpa Judul') ? '' : draft.title);
    setIncidentDate(draft.incidentDate || new Date().toISOString().split('T')[0]);
    setLocation(draft.location || '');
    setAttachments(draft.attachments || []);
    setReporterSignature(draft.reporterSignature || '');
    setEditingDraftId(draft.id);
    setTitleError('');
    setEntryErrors({});

    if (Array.isArray(draft.entries) && draft.entries.length > 0) {
      setEntries(
        draft.entries.map((entry, idx) => {
          const normalized = normalizeJenjangEntry(entry, idx);
          if (normalized.mode === 'checklist' && normalized.incidentDescription?.trim()) {
            const yesItems = (normalized.checklistAnswers || []).filter((q) => q.answer === 'ya');
            const hasPerQDesc = yesItems.some((q) => Boolean(q.description?.trim()));
            if (yesItems.length === 1 && !hasPerQDesc) {
              const targetIdx = yesItems[0].questionIndex;
              return {
                ...normalized,
                checklistAnswers: (normalized.checklistAnswers || []).map((q) =>
                  q.questionIndex === targetIdx
                    ? { ...q, description: normalized.incidentDescription?.trim() || '' }
                    : q
                ),
              };
            }
          }
          return normalized;
        })
      );
    } else {
      // Kompatibilitas draft format lama sebelum ada kolom entries
      const fallbackEntry = createEmptyJenjangEntry(
        draft.jenjang === 'SRD' || draft.jenjang === 'SRMP' || draft.jenjang === 'SRMA'
          ? draft.jenjang
          : ''
      );
      setEntries([
        {
          ...fallbackEntry,
          category: draft.category || '',
          customCategory: draft.customCategory || '',
          priority: draft.priority || 'sedang',
          mode: 'other',
          incidentDescription: draft.description || '',
        },
      ]);
    }

    setShowDraftModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Cepat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setShowDraftModal(true)}
          className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-xs hover:border-indigo-300 hover:shadow-sm transition text-left group cursor-pointer"
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

        <button
          type="button"
          onClick={() => onNavigateTab('history', 'diproses')}
          className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-xs hover:border-amber-300 hover:shadow-sm transition text-left group cursor-pointer"
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

        <button
          type="button"
          onClick={() => onNavigateTab('history', 'selesai')}
          className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition text-left group cursor-pointer"
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

      {/* Error Banner if Supabase INSERT failed */}
      {submitError && (
        <div
          role="alert"
          className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-xs flex items-start justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-lg shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950">
                Laporan Gagal Disimpan ke Supabase
              </h4>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                {submitError}
              </p>
              <p className="text-[11px] text-rose-700 mt-1">
                Seluruh isian jenjang, checklist, dan deskripsi tetap dipertahankan agar Anda dapat mencoba mengirim ulang. Notifikasi tidak dikirim sebelum laporan tersimpan di database.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="p-1.5 text-rose-600 hover:text-rose-900 shrink-0"
            title="Tutup pesan kesalahan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Banner if newly submitted */}
      {submittedReport && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                Laporan Berhasil Disimpan!
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Nomor Tiket:{' '}
                <span className="font-mono font-bold text-emerald-900">
                  {formatReportTicketNumber(submittedReport)}
                </span>{' '}
                {submittedReport.jenjang ? `(${submittedReport.jenjang}) ` : ''}— {submittedReport.title}
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Laporan utama beserta seluruh rincian jenjang telah tersimpan di Supabase &amp; satu pemberitahuan resmi telah diteruskan ke Kepala Sekolah.
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
                Formulir Pembuatan Laporan SIBAHAR
              </h2>
              {editingDraftId && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-mono">
                  Memuat Draft: {formatReportTicketNumber(editingDraftId)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih jenjang terlebih dahulu sebelum judul laporan. Anda dapat menambahkan lebih dari satu jenjang dalam satu laporan utama.
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
          {/* 1. PILIH JENJANG SEBELUM JUDUL LAPORAN (Untuk Entri Pertama) */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-sm font-bold text-emerald-950">
                Jenjang Laporan Utama <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-emerald-800">
                Wajib diisi sebelum Judul Laporan
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {JENJANG_OPTIONS.map((opt) => {
                const isSelected = primaryEntry.jenjang === opt;
                const isDisabled = otherJenjangsUsedByLaterEntries.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={isDisabled}
                    onClick={() =>
                      handleEntryChange(primaryEntry.id, {
                        ...primaryEntry,
                        jenjang: opt,
                      })
                    }
                    className={`py-2.5 px-4 rounded-lg text-sm font-bold border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : isDisabled
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50'
                    }`}
                  >
                    {opt}
                    {isDisabled ? ' (Terpakai di bawah)' : ''}
                  </button>
                );
              })}
            </div>

            {entryErrors[primaryEntry.id]?.jenjang && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{entryErrors[primaryEntry.id].jenjang}</span>
              </p>
            )}
          </div>

          {/* 2. JUDUL LAPORAN */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Judul Laporan <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Ringkas &amp; spesifik</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              placeholder="Contoh: Evaluasi Kondisi Harian Sekolah dan Asrama"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition focus:outline-hidden ${
                titleError
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20'
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              }`}
            />
            {titleError && (
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {titleError}
              </p>
            )}
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
                placeholder="Contoh: Asrama Putera, Gedung Pembelajaran, Lingkungan Sekolah"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition"
              />
            </div>
          </div>

          {/* 3. ENTRI JENJANG (Jenis Asrama, Kategori, Risiko/Prioritas, Mode Checklist/Lainnya) */}
          <div className="space-y-4">
            {entries.map((entry, idx) => {
              const others = entries
                .filter((e) => e.id !== entry.id)
                .map((e) => e.jenjang)
                .filter((j): j is JenjangType => Boolean(j));

              return (
                <JenjangEntryFormCard
                  key={entry.id}
                  entry={entry}
                  index={idx}
                  totalEntries={entries.length}
                  usedJenjangsByOthers={others}
                  errors={entryErrors[entry.id]}
                  hideTopJenjangSelector={idx === 0}
                  onChange={(updated) => handleEntryChange(entry.id, updated)}
                  onRemove={() => handleRemoveEntry(entry.id)}
                />
              );
            })}

            {/* Tombol + Tambah Jenjang Lain */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              {availableAdditionalJenjangs.length > 0 ? (
                <button
                  type="button"
                  onClick={handleAddJenjangEntry}
                  className="px-4 py-2.5 rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 font-bold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Jenjang Lain</span>
                  <span className="text-[11px] font-normal text-emerald-700">
                    (Tersedia: {availableAdditionalJenjangs.join(', ')})
                  </span>
                </button>
              ) : (
                <p className="text-xs text-slate-500 font-medium">
                  Seluruh jenjang (SRD, SRMP, SRMA) telah ditambahkan dalam satu laporan utama ini.
                </p>
              )}
              <span className="text-xs font-mono text-slate-500">
                Total bagian jenjang: <strong>{entries.length}/3</strong>
              </span>
            </div>
          </div>

          {/* 4. UPLOAD LAMPIRAN */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Lampiran Dokumen / Bukti Foto (Maksimal 2 Berkas)
              </label>
              <span
                className={`text-[11px] font-semibold ${
                  attachments.length >= 2 ? 'text-amber-600' : 'text-slate-500'
                }`}
              >
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
                  <span className="text-amber-700 font-semibold">
                    Batas maksimal 2 lampiran telah tercapai
                  </span>
                ) : (
                  <>
                    Tarik berkas ke sini, atau{' '}
                    <span className="text-indigo-600 underline">pilih dari perangkat</span>
                  </>
                )}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Maksimal 2 gambar / berkas (Format JPG, PNG, PDF maks 10MB)
              </p>
            </div>

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

          {/* 5. TANDA TANGAN PEMBUAT LAPORAN */}
          <SignaturePadInput
            value={reporterSignature}
            onChange={setReporterSignature}
            reporterName={userProfile.name}
          />

          {/* Tombol Aksi */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-3">
            <div className="text-xs text-slate-600 bg-emerald-50/70 border border-emerald-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Penanggung Jawab Otomatis: <strong className="text-slate-800">{userProfile.name}</strong>{' '}
                ({userProfile.role} — NIP: {userProfile.nip || '-'})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer"
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
                <p className="text-xs text-slate-500">
                  Pilih draft untuk melanjutkan pengisian beserta seluruh jenjang &amp; checklist
                </p>
              </div>
              <button
                type="button"
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
                draftReports.map((draft) => {
                  const jenjangBadges = getReportJenjangBadgeList(draft);
                  return (
                    <div
                      key={draft.id}
                      className="p-3.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] font-mono text-slate-500">
                            {formatReportTicketNumber(draft)}
                          </span>
                          <span className="text-[11px] text-slate-400">·</span>
                          <span className="text-[11px] text-slate-500">
                            {formatDateOnly(draft.incidentDate)}
                          </span>
                          {jenjangBadges.length > 0 && (
                            <>
                              <span className="text-[11px] text-slate-400">·</span>
                              <span className="text-[11px] font-mono font-bold text-emerald-800">
                                {jenjangBadges.join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-slate-800 truncate">
                          {draft.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {getReportEntriesSummaryCategories(draft)} — {draft.description || 'Belum ada deskripsi'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        <button
                          type="button"
                          onClick={() => loadDraftIntoForm(draft)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition cursor-pointer"
                        >
                          Buka Draft
                        </button>
                        {onDeleteDraft && (
                          <button
                            type="button"
                            onClick={() => onDeleteDraft(draft.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                            title="Hapus draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
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
