import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Save, AlertCircle, Plus, UploadCloud, Loader2, File, Image as ImageIcon } from 'lucide-react';
import {
  AttachmentFile,
  ReportItem,
  ReportCategory,
  ReportPriority,
  ReportJenjangEntry,
  JENJANG_OPTIONS,
  JenjangType,
  SHIFT_OPTIONS,
  JABATAN_OPTIONS,
} from '../types/report';
import {
  formatReportTicketNumber,
  formatFileSize,
  NEW_CATEGORY_OPTIONS,
  LEGACY_CATEGORY_OPTIONS,
  normalizeJenjangEntry,
  createEmptyJenjangEntry,
  validateJenjangEntries,
  buildReportSummariesFromEntries,
  isImageAttachmentFile,
  EntryValidationErrors,
} from '../utils/formatters';
import { JenjangEntryFormCard } from './JenjangEntryFormCard';
import {
  SubmitReportResult,
  getStorageAttachmentPublicUrl,
  resolveAttachmentDisplayUrls,
  uploadAttachmentToStorage,
} from '../lib/supabase';
import { compressEvidenceImage } from '../utils/imageCompression';
import { sanitizeImageUrl } from '../utils/printPdf';

interface EditReportModalProps {
  report: ReportItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedReport: ReportItem) => Promise<SubmitReportResult>;
  currentUserName?: string;
}

export const EditReportModal: React.FC<EditReportModalProps> = ({
  report,
  isOpen,
  onClose,
  onSave,
  currentUserName,
}) => {
  const hasStructuredEntries = Array.isArray(report.entries) && report.entries.length > 0;

  const [title, setTitle] = useState(report.title);
  const [incidentDate, setIncidentDate] = useState(report.incidentDate);
  const [shift, setShift] = useState(report.shift || '');
  const [location, setLocation] = useState(report.location || '');
  const [assignedTo, setAssignedTo] = useState(report.assignedTo || '');

  // Penanggung Jawab / Laporan dari (diambil apa adanya dari data laporan)
  const [picName, setPicName] = useState(report.picName || report.reporterName || '');
  const [picRole, setPicRole] = useState(report.picRole || '');
  const [picNip, setPicNip] = useState(report.picNip || report.reporterNip || '');

  // State khusus laporan baru terstruktur (1 atau beberapa entri jenjang)
  const [entries, setEntries] = useState<ReportJenjangEntry[]>(() =>
    hasStructuredEntries
      ? report.entries!.map((e, idx) => {
          const normalized = normalizeJenjangEntry(e, idx);
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
      : []
  );
  const [entryErrors, setEntryErrors] = useState<Record<string, EntryValidationErrors>>({});
  const [uploadingEntries, setUploadingEntries] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<AttachmentFile[]>(() =>
    Array.isArray(report.attachments) ? report.attachments : []
  );
  const [isModeBUploading, setIsModeBUploading] = useState(false);
  const [modeBUploadNotice, setModeBUploadNotice] = useState<string | null>(null);
  const [resolvedModeBUrls, setResolvedModeBUrls] = useState<Record<string, string>>({});
  const modeBFileInputRef = useRef<HTMLInputElement>(null);
  const latestAttachmentsRef = useRef<AttachmentFile[]>(attachments);
  latestAttachmentsRef.current = attachments;

  // State khusus laporan lama (tanpa entries) agar tetap kompatibel penuh
  const [legacyCategory, setLegacyCategory] = useState<ReportCategory>(report.category);
  const [legacyCustomCategory, setLegacyCustomCategory] = useState(report.customCategory || '');
  const [legacyPriority, setLegacyPriority] = useState<ReportPriority>(report.priority);
  const [legacyDescription, setLegacyDescription] = useState(report.description);

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const missingPaths = attachments.filter(
      (att) => att.storagePath && !resolvedModeBUrls[att.storagePath]
    );
    if (missingPaths.length === 0) return;

    let cancelled = false;
    void resolveAttachmentDisplayUrls(missingPaths, 3600).then((urls) => {
      if (cancelled || Object.keys(urls).length === 0) return;
      setResolvedModeBUrls((prev) => ({ ...prev, ...urls }));
    });
    return () => {
      cancelled = true;
    };
  }, [attachments, resolvedModeBUrls]);

  const isAnyEntryPhotoUploading = Object.values(uploadingEntries).some(Boolean);
  const isAnyPhotoUploading = isAnyEntryPhotoUploading || isModeBUploading;
  const hasAnyOtherModeEntry = entries.some((e) => e.mode === 'other');
  const handleEntryUploadingChange = useCallback((entryId: string, isUploading: boolean) => {
    setUploadingEntries((prev) => {
      if (Boolean(prev[entryId]) === isUploading) return prev;
      return { ...prev, [entryId]: isUploading };
    });
  }, []);

  if (!isOpen) return null;

  const usedJenjangsAll = entries
    .map((e) => e.jenjang)
    .filter((j): j is JenjangType => Boolean(j));
  const availableAdditionalJenjangs = JENJANG_OPTIONS.filter(
    (j) => !usedJenjangsAll.includes(j)
  );

  const handleEntryChange = (entryId: string, updatedEntry: ReportJenjangEntry) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? updatedEntry : e)));
    setEntryErrors((prev) => {
      if (!prev[entryId]) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    setError('');
  };

  const handleAddEntry = () => {
    if (entries.length >= JENJANG_OPTIONS.length || availableAdditionalJenjangs.length === 0) {
      return;
    }
    setEntries((prev) => [...prev, createEmptyJenjangEntry(availableAdditionalJenjangs[0])]);
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

  const handleLegacyCategoryChange = (val: ReportCategory) => {
    setLegacyCategory(val);
    if (val !== 'lainnya_manual') {
      setLegacyCustomCategory('');
    }
  };

  const handleModeBFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const currentAttachments = latestAttachmentsRef.current;
    if (currentAttachments.length >= 2) {
      setModeBUploadNotice(
        'Batas maksimal lampiran Mode B adalah 2 berkas. Hapus salah satu berkas terlebih dahulu.'
      );
      return;
    }

    const availableSlots = 2 - currentAttachments.length;
    const filesArray = Array.from(fileList);
    const filesToProcess = filesArray.slice(0, availableSlots);
    const notices: string[] = [];

    if (filesArray.length > availableSlots) {
      notices.push(`Hanya ${availableSlots} berkas pertama yang diproses (maksimal 2 berkas).`);
    }

    setModeBUploadNotice(null);
    setIsModeBUploading(true);

    const confirmedUploads: AttachmentFile[] = [];
    const newlyResolvedUrls: Record<string, string> = {};
    const failedFileReasons: string[] = [];

    try {
      const folderKey = `${report.id}/mode-b`;

      for (const rawFile of filesToProcess) {
        const attId = `att-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
        const isImg = isImageAttachmentFile({ name: rawFile.name, type: rawFile.type });

        try {
          if (isImg) {
            const compressed = await compressEvidenceImage(rawFile);
            const storageRes = await uploadAttachmentToStorage(compressed.file, folderKey);

            if (storageRes.confirmed && storageRes.storagePath) {
              confirmedUploads.push({
                id: attId,
                name: compressed.file.name,
                size: compressed.compressedSize,
                originalSize: compressed.originalSize,
                type: 'image/jpeg',
                storagePath: storageRes.storagePath,
              });
              if (storageRes.previewUrl) {
                newlyResolvedUrls[storageRes.storagePath] = storageRes.previewUrl;
              }
            } else {
              failedFileReasons.push(
                `"${rawFile.name}" (${storageRes.error || 'upload ke Supabase Storage gagal'})`
              );
            }
          } else {
            if (rawFile.size <= 0) {
              failedFileReasons.push(`"${rawFile.name}" (file kosong/rusak)`);
              continue;
            }
            if (rawFile.size > 10 * 1024 * 1024) {
              failedFileReasons.push(`"${rawFile.name}" (melebihi batas 10 MB)`);
              continue;
            }

            const storageRes = await uploadAttachmentToStorage(rawFile, folderKey);
            if (storageRes.confirmed && storageRes.storagePath) {
              confirmedUploads.push({
                id: attId,
                name: rawFile.name,
                size: rawFile.size,
                type: rawFile.type || 'application/octet-stream',
                storagePath: storageRes.storagePath,
              });
              if (storageRes.previewUrl) {
                newlyResolvedUrls[storageRes.storagePath] = storageRes.previewUrl;
              }
            } else {
              failedFileReasons.push(
                `"${rawFile.name}" (${storageRes.error || 'upload ke Supabase Storage gagal'})`
              );
            }
          }
        } catch (err: any) {
          failedFileReasons.push(
            `"${rawFile.name}" (${err?.message || 'gagal memproses file'})`
          );
        }
      }

      if (Object.keys(newlyResolvedUrls).length > 0) {
        setResolvedModeBUrls((prev) => ({ ...prev, ...newlyResolvedUrls }));
      }

      if (confirmedUploads.length > 0) {
        setAttachments((prev) => [...prev, ...confirmedUploads].slice(0, 2));
      }

      if (failedFileReasons.length > 0) {
        const partialInfo =
          confirmedUploads.length > 0
            ? ` (${confirmedUploads.length} berkas lain berhasil diunggah dan dipertahankan).`
            : ' Perubahan laporan tetap dapat disimpan tanpa berkas tersebut.';
        notices.push(
          `Berkas ${failedFileReasons.join(', ')} gagal diunggah dan tidak akan disertakan dalam laporan.${partialInfo}`
        );
      }

      if (notices.length > 0) {
        setModeBUploadNotice(notices.join(' '));
      }
    } finally {
      setIsModeBUploading(false);
    }
  };

  const handleRemoveModeBAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
    setModeBUploadNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (isAnyPhotoUploading) {
      setError('Tunggu hingga proses unggah foto selesai sebelum menyimpan perubahan.');
      return;
    }

    if (!title.trim()) {
      setError('Judul laporan tidak boleh kosong.');
      return;
    }

    if (Boolean(report.shift) && !shift.trim()) {
      setError('Shift laporan tidak boleh dikosongkan.');
      return;
    }

    const now = new Date();
    const timeFormatted =
      now.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }) +
      ' ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const logActor = currentUserName?.trim() || report.reporterName || picName.trim() || 'Petugas';

    let payloadToSave: ReportItem;

    if (hasStructuredEntries) {
      const validation = validateJenjangEntries(entries);
      setEntryErrors(validation.entryErrors);
      if (!validation.valid) {
        setError(
          validation.firstErrorMessage ||
            'Periksa kembali entri jenjang atau checklist yang belum lengkap.'
        );
        return;
      }

      const summary = buildReportSummariesFromEntries(entries);
      payloadToSave = {
        ...report,
        title: title.trim(),
        jenjang: summary.jenjang,
        category: summary.category,
        customCategory: summary.customCategory,
        priority: summary.priority,
        description: summary.description,
        entries: summary.normalizedEntries,
        attachments: hasAnyOtherModeEntry || attachments.length > 0 ? attachments : [],
        incidentDate,
        shift: shift.trim() || undefined,
        location: location.trim(),
        picName: picName.trim(),
        picRole: picRole.trim(),
        picNip: picNip.trim(),
        assignedTo: assignedTo.trim() || undefined,
        logs: [
          ...report.logs,
          {
            id: 'log-' + Math.random().toString(36).substring(2, 9),
            timestamp: timeFormatted,
            actor: logActor,
            action: 'Laporan Diperbarui (Edit)',
            note: `Data laporan beserta rincian jenjang (${summary.jenjang}) telah diperbarui.`,
          },
        ],
      };
    } else {
      // Validasi & simpan laporan lama (kompatibilitas tanpa entries)
      if (legacyCategory === 'lainnya_manual' && !legacyCustomCategory.trim()) {
        setError('Kategori manual wajib diisi saat memilih "Lainnya (Tulis Manual)".');
        return;
      }
      if (!legacyDescription.trim()) {
        setError('Deskripsi laporan tidak boleh kosong.');
        return;
      }

      payloadToSave = {
        ...report,
        title: title.trim(),
        category: legacyCategory,
        customCategory: legacyCategory === 'lainnya_manual' ? legacyCustomCategory.trim() : undefined,
        priority: legacyPriority,
        incidentDate,
        shift: shift.trim() || undefined,
        location: location.trim(),
        description: legacyDescription.trim(),
        picName: picName.trim(),
        picRole: picRole.trim(),
        picNip: picNip.trim(),
        assignedTo: assignedTo.trim() || undefined,
        logs: [
          ...report.logs,
          {
            id: 'log-' + Math.random().toString(36).substring(2, 9),
            timestamp: timeFormatted,
            actor: logActor,
            action: 'Laporan Diperbarui (Edit)',
            note: 'Informasi data laporan dan penanggung jawab telah diperbarui.',
          },
        ],
      };
    }

    setError('');
    setIsSaving(true);
    try {
      const result = await onSave(payloadToSave);
      if (result.success) {
        onClose();
      } else {
        setError(
          result.error ||
            'Gagal menyimpan perubahan laporan ke database Supabase. Perubahan Anda belum tersimpan.'
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Gagal menyimpan perubahan laporan ke database Supabase. Perubahan Anda belum tersimpan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Edit Data Laporan:{' '}
              <span className="font-mono text-indigo-700">{formatReportTicketNumber(report)}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasStructuredEntries
                ? 'Perbarui rincian laporan utama serta seluruh entri jenjang, asrama, kategori, risiko, dan checklist'
                : 'Perbarui rincian kasus, kategori, urgensi, penanggung jawab, atau deskripsi'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Judul Laporan */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Judul Laporan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Penanggung Jawab / Laporan dari */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Penanggung Jawab / Laporan dari (Opsional)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Nama Penanggung Jawab
                </label>
                <input
                  type="text"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="Nama &amp; gelar"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Jabatan Penanggung Jawab
                </label>
                <input
                  type="text"
                  list="edit-pic-role-options"
                  value={picRole}
                  onChange={(e) => setPicRole(e.target.value)}
                  placeholder="Misal: Tim Piket, Guru, Wali Asrama"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
                <datalist id="edit-pic-role-options">
                  {JABATAN_OPTIONS.map((jab) => (
                    <option key={jab} value={jab} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  NIP Penanggung Jawab
                </label>
                <input
                  type="text"
                  value={picNip}
                  onChange={(e) => setPicNip(e.target.value)}
                  placeholder="Kosongkan jika belum ada NIP"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Tanggal Kejadian, Shift, & Lokasi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Tanggal Kejadian</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Shift {Boolean(report.shift) && <span className="text-rose-500">*</span>}
              </label>
              <select
                value={shift}
                onChange={(e) => {
                  setShift(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">
                  {report.shift ? '-- Pilih Shift --' : '-- Tidak Tercatat (Laporan Lama) --'}
                </option>
                {SHIFT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Lokasi / Area Terkait</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Misal: Asrama Putra, Kelas 9, Lapangan"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Petugas Penanganan Terkait */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Petugas Penanganan Terkait (PIC)
            </label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Contoh: Tim BK, Wali Asuh, Pembina Asrama"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* EDITOR MULTI-JENJANG & CHECKLIST (Laporan Baru) VS EDITOR KLASIK (Laporan Lama) */}
          {hasStructuredEntries ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rincian Entri Jenjang ({entries.length})
                </h4>
                {availableAdditionalJenjangs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddEntry}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Tambah Jenjang Lain</span>
                  </button>
                )}
              </div>

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
                    uploadContextId={report.id}
                    onUploadingChange={handleEntryUploadingChange}
                    onChange={(updated) => handleEntryChange(entry.id, updated)}
                    onRemove={() => handleRemoveEntry(entry.id)}
                    compact
                  />
                );
              })}

              {(hasAnyOtherModeEntry || attachments.length > 0) && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800">
                      Lampiran Dokumen / Bukti Foto Mode B (Opsional · Maks. 2 Berkas)
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {attachments.length}/2 Berkas
                    </span>
                  </div>

                  {attachments.length < 2 && hasAnyOtherModeEntry && (
                    <>
                      <input
                        ref={modeBFileInputRef}
                        type="file"
                        multiple
                        disabled={isModeBUploading}
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={(e) => {
                          void handleModeBFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        disabled={isModeBUploading}
                        onClick={() => modeBFileInputRef.current?.click()}
                        className="w-full p-3 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white text-xs font-medium text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                      >
                        {isModeBUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                            <span>Mengompresi &amp; mengunggah berkas ke Supabase Storage...</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4 text-indigo-600" />
                            <span>Tambah Lampiran Mode B (Foto otomatis dikompresi)</span>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {modeBUploadNotice && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <span>{modeBUploadNotice}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModeBUploadNotice(null)}
                        className="text-amber-700 hover:text-amber-950 p-0.5 shrink-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {attachments.map((file) => {
                        const resolvedUrl =
                          (file.storagePath
                            ? resolvedModeBUrls[file.storagePath] ||
                              getStorageAttachmentPublicUrl(file.storagePath)
                            : '') ||
                          file.url ||
                          file.dataUrl;
                        const safePreviewSrc = isImageAttachmentFile(file)
                          ? sanitizeImageUrl(resolvedUrl)
                          : null;
                        return (
                          <div
                            key={file.id}
                            className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {safePreviewSrc ? (
                                <img
                                  src={safePreviewSrc}
                                  alt={file.name}
                                  className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                                />
                              ) : isImageAttachmentFile(file) ? (
                                <ImageIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                              ) : (
                                <File className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-[10.5px] text-slate-400 font-mono tabular-nums">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveModeBAttachment(file.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer shrink-0"
                              title="Hapus lampiran"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Kategori Laporan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={legacyCategory}
                    onChange={(e) => handleLegacyCategoryChange(e.target.value as ReportCategory)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <optgroup label="Kategori Resmi">
                      {NEW_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Kategori Laporan Lama">
                      {LEGACY_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Tingkat Prioritas <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={legacyPriority}
                    onChange={(e) => setLegacyPriority(e.target.value as ReportPriority)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="ringan">Kasus Ringan / Resiko Rendah</option>
                    <option value="sedang">Kasus Sedang / Resiko Sedang</option>
                    <option value="berat">Kasus Berat/Kompleks atau Resiko Tinggi/Kritis</option>
                    <option value="nihil">Nihil</option>
                  </select>
                </div>
              </div>

              {legacyCategory === 'lainnya_manual' && (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Tulis Kategori Manual <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={legacyCustomCategory}
                    onChange={(e) => setLegacyCustomCategory(e.target.value)}
                    placeholder="Masukkan kategori secara manual..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Deskripsi &amp; Kronologi Kejadian <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={legacyDescription}
                  onChange={(e) => {
                    setLegacyDescription(e.target.value);
                    setError('');
                  }}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 font-medium cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || isAnyPhotoUploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isAnyPhotoUploading
                  ? 'Mengunggah Foto...'
                  : isSaving
                    ? 'Menyimpan ke Supabase...'
                    : 'Simpan Perubahan'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
