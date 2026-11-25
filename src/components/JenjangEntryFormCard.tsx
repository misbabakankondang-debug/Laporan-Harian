import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  AttachmentFile,
  ChecklistAnswer,
  DORMITORY_OPTIONS,
  DormitoryType,
  JENJANG_OPTIONS,
  JenjangType,
  ReportCategory,
  ReportEntryMode,
  ReportJenjangEntry,
  ReportPriority,
} from '../types/report';
import {
  EntryValidationErrors,
  MAX_CHECKLIST_EVIDENCE_PHOTOS,
  NEW_CATEGORY_OPTIONS,
  entryHasYesFindings,
  formatDormitoryTypesLabel,
  formatFileSize,
  normalizeChecklistAnswers,
  normalizeDormitoryTypes,
} from '../utils/formatters';
import { compressEvidenceImage } from '../utils/imageCompression';
import {
  getStorageAttachmentPublicUrl,
  resolveAttachmentDisplayUrls,
  uploadAttachmentToStorage,
} from '../lib/supabase';
import { sanitizeImageUrl } from '../utils/printPdf';

interface JenjangEntryFormCardProps {
  entry: ReportJenjangEntry;
  index: number;
  totalEntries: number;
  usedJenjangsByOthers: JenjangType[];
  errors?: EntryValidationErrors;
  hideTopJenjangSelector?: boolean;
  uploadContextId?: string;
  onUploadingChange?: (entryId: string, isUploading: boolean) => void;
  onChange: (updated: ReportJenjangEntry) => void;
  onRemove?: () => void;
  compact?: boolean;
}

export const JenjangEntryFormCard: React.FC<JenjangEntryFormCardProps> = ({
  entry,
  index,
  totalEntries,
  usedJenjangsByOthers,
  errors,
  hideTopJenjangSelector = false,
  uploadContextId = 'pending',
  onUploadingChange,
  onChange,
  onRemove,
  compact = false,
}) => {
  const checklistAnswers = normalizeChecklistAnswers(entry.checklistAnswers);
  const selectedDormitories = normalizeDormitoryTypes(
    entry.dormitoryTypes,
    entry.dormitoryType
  );
  const dormDisplayLabel = formatDormitoryTypesLabel(
    selectedDormitories,
    entry.dormitoryType
  );

  const answeredCount = checklistAnswers.filter(
    (q) => q.answer === 'ya' || q.answer === 'tidak'
  ).length;
  const yesCount = checklistAnswers.filter((q) => q.answer === 'ya').length;
  const hasYes = entryHasYesFindings({ ...entry, checklistAnswers });

  const latestEntryRef = useRef(entry);
  latestEntryRef.current = entry;

  const [uploadingQuestions, setUploadingQuestions] = useState<Record<number, boolean>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<number, string>>({});
  const [photoNotices, setPhotoNotices] = useState<Record<number, string>>({});
  const [resolvedStorageUrls, setResolvedStorageUrls] = useState<Record<string, string>>({});
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    name: string;
    questionIndex: number;
  } | null>(null);

  useEffect(() => {
    const allPhotos = checklistAnswers.flatMap((q) =>
      Array.isArray(q.attachments) ? q.attachments : []
    );
    const missingPaths = allPhotos.filter(
      (att) => att.storagePath && !resolvedStorageUrls[att.storagePath]
    );
    if (missingPaths.length === 0) return;

    let cancelled = false;
    void resolveAttachmentDisplayUrls(missingPaths, 3600).then((urls) => {
      if (cancelled || Object.keys(urls).length === 0) return;
      setResolvedStorageUrls((prev) => ({ ...prev, ...urls }));
    });
    return () => {
      cancelled = true;
    };
  }, [checklistAnswers, resolvedStorageUrls]);

  const isAnyUploading = Object.values(uploadingQuestions).some(Boolean);
  useEffect(() => {
    onUploadingChange?.(entry.id, isAnyUploading);
  }, [entry.id, isAnyUploading, onUploadingChange]);

  useEffect(() => {
    return () => {
      onUploadingChange?.(entry.id, false);
    };
  }, [entry.id, onUploadingChange]);

  const handleFieldChange = <K extends keyof ReportJenjangEntry>(
    field: K,
    value: ReportJenjangEntry[K]
  ) => {
    onChange({
      ...entry,
      [field]: value,
    });
  };

  const handleToggleDormitory = (opt: DormitoryType) => {
    const exists = selectedDormitories.includes(opt);
    const nextSet = new Set<DormitoryType>(selectedDormitories);
    if (exists) {
      nextSet.delete(opt);
    } else {
      nextSet.add(opt);
    }
    const nextTypes = DORMITORY_OPTIONS.filter((d) => nextSet.has(d));
    const nextLabel = formatDormitoryTypesLabel(nextTypes);
    onChange({
      ...entry,
      dormitoryTypes: nextTypes,
      dormitoryType: nextLabel,
    });
  };

  const handleAnswerChange = (questionIndex: number, answer: ChecklistAnswer) => {
    const nextAnswers = checklistAnswers.map((item) =>
      item.questionIndex === questionIndex
        ? {
            ...item,
            answer,
            description: answer === 'tidak' ? '' : item.description || '',
            attachments: answer === 'tidak' ? [] : item.attachments || [],
          }
        : item
    );
    if (answer === 'tidak') {
      setPhotoErrors((prev) => {
        if (!prev[questionIndex]) return prev;
        const next = { ...prev };
        delete next[questionIndex];
        return next;
      });
      setPhotoNotices((prev) => {
        if (!prev[questionIndex]) return prev;
        const next = { ...prev };
        delete next[questionIndex];
        return next;
      });
    }
    const nextHasYes = nextAnswers.some((item) => item.answer === 'ya');
    onChange({
      ...entry,
      checklistAnswers: nextAnswers,
      hasYesAnswer: nextHasYes,
    });
  };

  const handleChecklistDescriptionChange = (questionIndex: number, description: string) => {
    const nextAnswers = checklistAnswers.map((item) =>
      item.questionIndex === questionIndex ? { ...item, description } : item
    );
    onChange({
      ...entry,
      checklistAnswers: nextAnswers,
      hasYesAnswer: nextAnswers.some((item) => item.answer === 'ya'),
    });
  };

  const handleChecklistPhotoFiles = async (
    questionIndex: number,
    fileList: FileList | null,
    replacePhotoId?: string
  ) => {
    if (!fileList || fileList.length === 0) return;

    const currentItem = checklistAnswers.find((q) => q.questionIndex === questionIndex);
    if (!currentItem || currentItem.answer !== 'ya') return;

    const existingPhotos = Array.isArray(currentItem.attachments)
      ? currentItem.attachments
      : [];

    if (!replacePhotoId && existingPhotos.length >= MAX_CHECKLIST_EVIDENCE_PHOTOS) {
      setPhotoErrors((prev) => ({
        ...prev,
        [questionIndex]: `Maksimal ${MAX_CHECKLIST_EVIDENCE_PHOTOS} foto eviden untuk pertanyaan No. ${questionIndex}. Hapus atau ganti salah satu foto terlebih dahulu.`,
      }));
      return;
    }

    const availableSlots = replacePhotoId
      ? 1
      : MAX_CHECKLIST_EVIDENCE_PHOTOS - existingPhotos.length;
    const filesArray = Array.from(fileList);
    const filesToProcess = filesArray.slice(0, availableSlots);

    setPhotoErrors((prev) => {
      const next = { ...prev };
      if (filesArray.length > availableSlots && !replacePhotoId) {
        next[questionIndex] =
          `Hanya ${availableSlots} foto pertama yang diproses (maksimal ${MAX_CHECKLIST_EVIDENCE_PHOTOS} foto per pertanyaan).`;
      } else {
        delete next[questionIndex];
      }
      return next;
    });

    setUploadingQuestions((prev) => ({ ...prev, [questionIndex]: true }));

    const processedAttachments: AttachmentFile[] = [];
    const newlyResolvedPreviewUrls: Record<string, string> = {};
    const errorMessages: string[] = [];
    const failedUploadNames: string[] = [];

    try {
      for (const rawFile of filesToProcess) {
        try {
          const compressed = await compressEvidenceImage(rawFile);
          const folderKey = `${uploadContextId}/${entry.id}/q${questionIndex}`;
          const storageRes = await uploadAttachmentToStorage(compressed.file, folderKey);

          const photoId = `ev-${questionIndex}-${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .substring(2, 7)}`;

          if (storageRes.confirmed && storageRes.storagePath) {
            processedAttachments.push({
              id: photoId,
              name: compressed.file.name,
              size: compressed.compressedSize,
              originalSize: compressed.originalSize,
              type: 'image/jpeg',
              storagePath: storageRes.storagePath,
            });
            if (storageRes.previewUrl) {
              newlyResolvedPreviewUrls[storageRes.storagePath] = storageRes.previewUrl;
            }
          } else {
            failedUploadNames.push(rawFile.name);
          }
        } catch (err: any) {
          errorMessages.push(
            err?.message || `Gagal memproses foto "${rawFile.name}".`
          );
        }
      }

      if (Object.keys(newlyResolvedPreviewUrls).length > 0) {
        setResolvedStorageUrls((prev) => ({ ...prev, ...newlyResolvedPreviewUrls }));
      }

      if (processedAttachments.length > 0) {
        const latest = latestEntryRef.current;
        const latestNormalized = normalizeChecklistAnswers(latest.checklistAnswers);
        const latestTarget = latestNormalized.find((q) => q.questionIndex === questionIndex);

        if (latestTarget && latestTarget.answer === 'ya') {
          const basePhotos = Array.isArray(latestTarget.attachments)
            ? latestTarget.attachments
            : [];
          let nextPhotos: AttachmentFile[];

          if (replacePhotoId) {
            const replacement = processedAttachments[0];
            nextPhotos = basePhotos.map((p) =>
              p.id === replacePhotoId ? replacement : p
            );
          } else {
            nextPhotos = [...basePhotos, ...processedAttachments].slice(
              0,
              MAX_CHECKLIST_EVIDENCE_PHOTOS
            );
          }

          const nextAnswers = latestNormalized.map((item) =>
            item.questionIndex === questionIndex
              ? { ...item, attachments: nextPhotos }
              : item
          );

          onChange({
            ...latest,
            checklistAnswers: nextAnswers,
            hasYesAnswer: nextAnswers.some((item) => item.answer === 'ya'),
          });
        }
      }

      if (errorMessages.length > 0) {
        setPhotoErrors((prev) => ({
          ...prev,
          [questionIndex]: `${errorMessages.join(' ')} Foto yang gagal tidak disertakan; laporan tetap dapat dikirim.`,
        }));
      }

      if (failedUploadNames.length > 0) {
        const failedList = failedUploadNames.map((n) => `"${n}"`).join(', ');
        const partialSuffix =
          processedAttachments.length > 0
            ? ` (${processedAttachments.length} foto lain berhasil diunggah dan dipertahankan).`
            : ' Anda tetap dapat mengirim laporan tanpa foto tersebut.';
        setPhotoNotices((prev) => ({
          ...prev,
          [questionIndex]: `Foto ${failedList} gagal diunggah ke Supabase Storage dan tidak akan disertakan dalam laporan.${partialSuffix}`,
        }));
      } else if (processedAttachments.length > 0 && errorMessages.length === 0) {
        setPhotoNotices((prev) => {
          if (!prev[questionIndex]) return prev;
          const next = { ...prev };
          delete next[questionIndex];
          return next;
        });
      }
    } finally {
      setUploadingQuestions((prev) => ({ ...prev, [questionIndex]: false }));
    }
  };

  const handleRemoveChecklistPhoto = (questionIndex: number, photoId: string) => {
    const nextAnswers = checklistAnswers.map((item) => {
      if (item.questionIndex !== questionIndex) return item;
      const nextPhotos = (item.attachments || []).filter((p) => p.id !== photoId);
      return { ...item, attachments: nextPhotos };
    });
    setPhotoErrors((prev) => {
      if (!prev[questionIndex]) return prev;
      const next = { ...prev };
      delete next[questionIndex];
      return next;
    });
    onChange({
      ...entry,
      checklistAnswers: nextAnswers,
      hasYesAnswer: nextAnswers.some((item) => item.answer === 'ya'),
    });
  };

  const handleModeChange = (mode: ReportEntryMode) => {
    onChange({
      ...entry,
      mode,
      checklistAnswers,
      hasYesAnswer:
        mode === 'checklist'
          ? checklistAnswers.some((item) => item.answer === 'ya')
          : false,
    });
  };

  const hasAnyError = Boolean(
    errors &&
      (errors.jenjang ||
        errors.dormitoryType ||
        errors.category ||
        errors.customCategory ||
        errors.checklist ||
        errors.checklistDescriptions ||
        errors.checklistAttachments ||
        (errors.missingYesDescriptionIndices && errors.missingYesDescriptionIndices.length > 0) ||
        errors.incidentDescription)
  );

  return (
    <div
      id={`entry-card-${entry.id}`}
      className={`rounded-xl border transition ${
        hasAnyError
          ? 'border-rose-300 bg-rose-50/20'
          : 'border-slate-200 bg-slate-50/50'
      } ${compact ? 'p-4 space-y-4' : 'p-5 space-y-4'}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {index === 0 ? 'Bagian Laporan Utama' : `Bagian Jenjang Tambahan #${index + 1}`}
          </span>
          {entry.jenjang && (
            <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
              Jenjang: {entry.jenjang}
            </span>
          )}
          {dormDisplayLabel && (
            <span className="text-xs font-medium text-slate-700">
              · {dormDisplayLabel}
            </span>
          )}
          {entry.mode === 'checklist' && hasYes && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              <AlertTriangle className="w-3 h-3" />
              {yesCount} Temuan Ya
            </span>
          )}
        </div>

        {totalEntries > 1 && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Jenjang</span>
          </button>
        )}
      </div>

      {/* Pilihan Jenjang & Jenis Asrama (Multi-Select Putera & Puteri) */}
      <div className={`grid grid-cols-1 ${hideTopJenjangSelector ? '' : 'md:grid-cols-2'} gap-4`}>
        {!hideTopJenjangSelector && (
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Jenjang <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {JENJANG_OPTIONS.map((opt) => {
                const isSelected = entry.jenjang === opt;
                const isDisabled = usedJenjangsByOthers.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleFieldChange('jenjang', opt)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : isDisabled
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40'
                    }`}
                    title={isDisabled ? `Jenjang ${opt} sudah dipakai di bagian lain` : `Pilih jenjang ${opt}`}
                  >
                    {opt}
                    {isDisabled ? ' (Terpakai)' : ''}
                  </button>
                );
              })}
            </div>
            {errors?.jenjang && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.jenjang}</span>
              </p>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-xs sm:text-sm font-medium text-slate-700">
              Jenis Asrama <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-slate-500">
              Bisa pilih satu atau keduanya
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DORMITORY_OPTIONS.map((opt: DormitoryType) => {
              const isSelected = selectedDormitories.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => handleToggleDormitory(opt)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                      isSelected
                        ? 'bg-white text-indigo-600 border-white'
                        : 'bg-white border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          {selectedDormitories.length === 2 && (
            <p className="text-[11px] text-indigo-700 font-medium mt-1">
              Dipilih bersamaan: {dormDisplayLabel}
            </p>
          )}
          {errors?.dormitoryType && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.dormitoryType}</span>
            </p>
          )}
        </div>
      </div>

      {/* Kategori & Risiko/Prioritas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
            Kategori Laporan <span className="text-rose-500">*</span>
          </label>
          <select
            value={entry.category}
            onChange={(e) => {
              const nextCat = e.target.value as ReportCategory | '';
              onChange({
                ...entry,
                category: nextCat,
                customCategory: nextCat === 'lainnya_manual' ? entry.customCategory || '' : '',
              });
            }}
            className={`w-full px-3 py-2.5 rounded-lg border text-xs sm:text-sm transition bg-white focus:outline-hidden ${
              errors?.category
                ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            }`}
          >
            <option value="">Pilih Kategori Laporan...</option>
            {NEW_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors?.category && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.category}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
            Risiko / Tingkat Prioritas <span className="text-rose-500">*</span>
          </label>
          <select
            value={entry.priority}
            onChange={(e) => handleFieldChange('priority', e.target.value as ReportPriority)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs sm:text-sm transition bg-white"
          >
            <option value="ringan">Kasus Ringan / Resiko Rendah</option>
            <option value="sedang">Kasus Sedang / Resiko Sedang</option>
            <option value="berat">Kasus Berat/Kompleks atau Resiko Tinggi/Kritis</option>
            <option value="nihil">Nihil</option>
          </select>
        </div>
      </div>

      {/* Input Kategori Manual jika memilih "Lainnya (Tulis Manual)" */}
      {entry.category === 'lainnya_manual' && (
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
            Tulis Kategori Secara Manual <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={entry.customCategory || ''}
            onChange={(e) => handleFieldChange('customCategory', e.target.value)}
            placeholder="Masukkan nama kategori laporan secara manual..."
            className={`w-full px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm bg-white transition focus:outline-hidden ${
              errors?.customCategory
                ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            }`}
          />
          {errors?.customCategory && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.customCategory}</span>
            </p>
          )}
        </div>
      )}

      {/* Pilihan Mode Deskripsi Laporan */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="block text-xs sm:text-sm font-medium text-slate-700">
            Mode Deskripsi Laporan <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-slate-500">
            Jenjang aktif:{' '}
            <strong className="font-mono text-slate-800">{entry.jenjang || 'Belum dipilih'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleModeChange('checklist')}
            className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
              entry.mode === 'checklist'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-2xs'
                : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-300'
            }`}
          >
            <ClipboardCheck
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                entry.mode === 'checklist' ? 'text-emerald-700' : 'text-slate-400'
              }`}
            />
            <div>
              <p className="text-xs font-bold">A. Checklist Kondisi Sekolah/Asrama</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                10 pertanyaan pemantauan (Ya/Tidak). Deskripsi &amp; eviden foto diisi langsung per pertanyaan bernilai Ya.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('other')}
            className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
              entry.mode === 'other'
                ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-2xs'
                : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-300'
            }`}
          >
            <FileText
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                entry.mode === 'other' ? 'text-indigo-700' : 'text-slate-400'
              }`}
            />
            <div>
              <p className="text-xs font-bold">B. Laporan Kejadian Lainnya</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tulis kronologi bebas dan gunakan unggah dokumentasi di bagian bawah formulir.
              </p>
            </div>
          </button>
        </div>

        {/* MODE A: CHECKLIST 10 PERTANYAAN */}
        {entry.mode === 'checklist' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Checklist Kondisi Sekolah/Asrama — {entry.jenjang || 'Pilih Jenjang'} (
                  {dormDisplayLabel || 'Pilih Asrama'})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Semua 10 pertanyaan wajib dijawab Ya atau Tidak. Untuk setiap jawaban Ya, isi deskripsi kondisi dan unggah maksimal 2 foto eviden (opsional).
                </p>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                {answeredCount}/10 Terjawab
              </span>
            </div>

            {errors?.checklist && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errors.checklist}</span>
              </div>
            )}

            {errors?.checklistDescriptions && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errors.checklistDescriptions}</span>
              </div>
            )}

            {errors?.checklistAttachments && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errors.checklistAttachments}</span>
              </div>
            )}

            {hasYes &&
              !checklistAnswers.some(
                (q) => q.answer === 'ya' && Boolean(String(q.description || '').trim())
              ) &&
              Boolean(String(entry.incidentDescription || '').trim()) && (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-1">
                  <p className="font-bold">Catatan Deskripsi Laporan Lama (Referensi):</p>
                  <p className="text-sky-800 whitespace-pre-wrap leading-relaxed">
                    {entry.incidentDescription}
                  </p>
                  <p className="text-[11px] text-sky-700">
                    Silakan salin atau lengkapi deskripsi di atas ke masing-masing pertanyaan yang dijawab Ya.
                  </p>
                </div>
              )}

            <div className="divide-y divide-slate-100">
              {checklistAnswers.map((item) => {
                const isUnanswered = errors?.unansweredIndices?.includes(item.questionIndex);
                const yesDescError = errors?.yesDescriptionErrors?.[item.questionIndex];
                const yesAttError =
                  photoErrors[item.questionIndex] ||
                  errors?.yesAttachmentErrors?.[item.questionIndex];
                const isYes = item.answer === 'ya';
                const photos = Array.isArray(item.attachments) ? item.attachments : [];
                const isUploadingThisQ = Boolean(uploadingQuestions[item.questionIndex]);

                return (
                  <div
                    key={item.questionIndex}
                    className={`py-3 px-2.5 rounded-lg space-y-2.5 ${
                      isUnanswered || yesDescError || yesAttError
                        ? 'bg-rose-50/70 border border-rose-200 my-1'
                        : isYes
                          ? 'bg-amber-50/40 my-1'
                          : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-2 text-xs text-slate-800 leading-relaxed flex-1">
                        <span className="font-mono font-bold text-slate-500 shrink-0 w-5">
                          {item.questionIndex}.
                        </span>
                        <span>{item.question}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(item.questionIndex, 'ya')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            isYes
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'
                          }`}
                        >
                          Ya
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(item.questionIndex, 'tidak')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            item.answer === 'tidak'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'
                          }`}
                        >
                          Tidak
                        </button>
                      </div>
                    </div>

                    {isYes && (
                      <div className="pl-0 sm:pl-7 space-y-3">
                        {/* Deskripsi khusus pertanyaan ini */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="block text-xs font-semibold text-amber-950">
                              Deskripsikan kondisi yang terjadi: <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                              {(item.description || '').length} karakter
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            value={item.description || ''}
                            onChange={(e) =>
                              handleChecklistDescriptionChange(item.questionIndex, e.target.value)
                            }
                            placeholder={`Jelaskan kondisi yang terjadi untuk pertanyaan No. ${item.questionIndex}...`}
                            className={`w-full px-3 py-2 rounded-lg border text-xs sm:text-sm bg-white transition focus:outline-hidden ${
                              yesDescError
                                ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                                : 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                            }`}
                          />
                          {yesDescError && (
                            <p className="text-xs text-rose-600 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{yesDescError}</span>
                            </p>
                          )}
                        </div>

                        {/* Upload Eviden / Dokumentasi Foto Khusus Pertanyaan Ini */}
                        <div className="p-3 rounded-lg bg-white border border-amber-200/90 space-y-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-amber-700" />
                              <span>
                                Upload Eviden / Dokumentasi Foto (Pertanyaan No. {item.questionIndex} · Opsional)
                              </span>
                            </label>
                            <span
                              className={`text-[11px] font-mono font-semibold ${
                                photos.length >= MAX_CHECKLIST_EVIDENCE_PHOTOS
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {photos.length}/{MAX_CHECKLIST_EVIDENCE_PHOTOS} Foto
                            </span>
                          </div>

                          {photos.length < MAX_CHECKLIST_EVIDENCE_PHOTOS && (
                            <label
                              className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed text-xs transition ${
                                isUploadingThisQ
                                  ? 'border-amber-300 bg-amber-50/50 cursor-wait'
                                  : 'border-slate-300 hover:border-amber-500 hover:bg-amber-50/30 cursor-pointer'
                              }`}
                            >
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/*"
                                multiple={MAX_CHECKLIST_EVIDENCE_PHOTOS - photos.length > 1}
                                disabled={isUploadingThisQ}
                                className="hidden"
                                onChange={(e) => {
                                  void handleChecklistPhotoFiles(
                                    item.questionIndex,
                                    e.target.files
                                  );
                                  e.target.value = '';
                                }}
                              />
                              {isUploadingThisQ ? (
                                <>
                                  <Loader2 className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                                  <span className="font-medium text-amber-900">
                                    Mengompresi &amp; mengunggah foto eviden...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Camera className="w-4 h-4 text-slate-500 shrink-0" />
                                  <span className="font-medium text-slate-700 text-center">
                                    Pilih Foto Eviden No. {item.questionIndex}{' '}
                                    <span className="text-indigo-600 underline">
                                      (maks. {MAX_CHECKLIST_EVIDENCE_PHOTOS} foto, otomatis dikompresi)
                                    </span>
                                  </span>
                                </>
                              )}
                            </label>
                          )}

                          <p className="text-[11px] text-slate-500 italic">
                            Jika temuan banyak, foto yang diupload diusahakan sudah berbentuk grid.
                          </p>

                          {yesAttError && (
                            <p className="text-xs text-rose-600 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{yesAttError}</span>
                            </p>
                          )}

                          {photoNotices[item.questionIndex] && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              {photoNotices[item.questionIndex]}
                            </p>
                          )}

                          {photos.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                              {photos.map((photo, pIdx) => {
                                const resolvedUrl =
                                  (photo.storagePath
                                    ? resolvedStorageUrls[photo.storagePath] ||
                                      getStorageAttachmentPublicUrl(photo.storagePath)
                                    : '') ||
                                  photo.url ||
                                  photo.dataUrl;
                                const safeUrl = sanitizeImageUrl(resolvedUrl);
                                return (
                                  <div
                                    key={photo.id}
                                    className="border border-slate-200 rounded-lg p-2 bg-slate-50/70 space-y-2"
                                  >
                                    <div className="relative h-32 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center group">
                                      {safeUrl ? (
                                        <img
                                          src={safeUrl}
                                          alt={`Eviden No.${item.questionIndex} Foto ${pIdx + 1}`}
                                          className="max-h-full max-w-full object-contain cursor-pointer"
                                          onClick={() =>
                                            setPreviewPhoto({
                                              url: safeUrl,
                                              name: photo.name,
                                              questionIndex: item.questionIndex,
                                            })
                                          }
                                        />
                                      ) : (
                                        <span className="text-[11px] text-slate-400">
                                          Preview tidak tersedia
                                        </span>
                                      )}
                                      {safeUrl && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPreviewPhoto({
                                              url: safeUrl,
                                              name: photo.name,
                                              questionIndex: item.questionIndex,
                                            })
                                          }
                                          className="absolute bottom-1.5 right-1.5 p-1 bg-slate-900/75 hover:bg-slate-900 text-white rounded text-[10px] flex items-center gap-1 cursor-pointer"
                                          title="Perbesar foto"
                                        >
                                          <ZoomIn className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                      <div className="min-w-0">
                                        <p
                                          className="font-medium text-slate-800 truncate"
                                          title={photo.name}
                                        >
                                          Foto {pIdx + 1}: {photo.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-mono tabular-nums">
                                          {formatFileSize(photo.size)}
                                          {photo.originalSize && photo.originalSize > photo.size
                                            ? ` (dari ${formatFileSize(photo.originalSize)})`
                                            : ''}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <label
                                          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium cursor-pointer flex items-center gap-1"
                                          title="Ganti foto ini"
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                          <span>Ganti</span>
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/*"
                                            disabled={isUploadingThisQ}
                                            className="hidden"
                                            onChange={(e) => {
                                              void handleChecklistPhotoFiles(
                                                item.questionIndex,
                                                e.target.files,
                                                photo.id
                                              );
                                              e.target.value = '';
                                            }}
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveChecklistPhoto(
                                              item.questionIndex,
                                              photo.id
                                            )
                                          }
                                          className="p-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                                          title="Hapus foto ini"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Indikator kondisi Ya vs Semua Tidak */}
            {hasYes ? (
              <div className="pt-1">
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      Terdapat {yesCount} jawaban &ldquo;Ya&rdquo; yang memerlukan perhatian pimpinan
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Pastikan deskripsi kondisi diisi pada setiap pertanyaan Ya. Foto eviden bersifat opsional (maksimal 2 foto per pertanyaan Ya).
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              answeredCount === 10 && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Seluruh 10 kondisi dijawab <strong>Tidak</strong> — tidak perlu menulis deskripsi kejadian maupun mengunggah foto.
                  </span>
                </div>
              )
            )}
          </div>
        )}

        {/* MODE B: LAPORAN KEJADIAN LAINNYA */}
        {entry.mode === 'other' && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs sm:text-sm font-medium text-slate-700">
                Deskripsi Kejadian ({entry.jenjang || 'Jenjang'} · {dormDisplayLabel || 'Asrama'}) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                {(entry.incidentDescription || '').length} karakter
              </span>
            </div>
            <textarea
              rows={4}
              value={entry.incidentDescription || ''}
              onChange={(e) => handleFieldChange('incidentDescription', e.target.value)}
              placeholder="Jelaskan secara rinci kejadian, waktu, pihak terkait, serta tindak lanjut awal..."
              className={`w-full px-3.5 py-2.5 rounded-lg border text-xs sm:text-sm transition focus:outline-hidden ${
                errors?.incidentDescription
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20'
                  : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              }`}
            />
            {errors?.incidentDescription && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.incidentDescription}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal Preview Perbesar Foto Sebelum Simpan */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
              <p className="text-xs font-bold text-slate-900 truncate">
                Preview Eviden Pertanyaan No. {previewPhoto.questionIndex} — {previewPhoto.name}
              </p>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                aria-label="Tutup preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="max-h-[68vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
