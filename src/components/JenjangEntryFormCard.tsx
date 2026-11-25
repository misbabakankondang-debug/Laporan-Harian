import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Trash2,
} from 'lucide-react';
import {
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
  NEW_CATEGORY_OPTIONS,
  entryHasYesFindings,
  normalizeChecklistAnswers,
} from '../utils/formatters';

interface JenjangEntryFormCardProps {
  entry: ReportJenjangEntry;
  index: number;
  totalEntries: number;
  usedJenjangsByOthers: JenjangType[];
  errors?: EntryValidationErrors;
  hideTopJenjangSelector?: boolean;
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
  onChange,
  onRemove,
  compact = false,
}) => {
  const checklistAnswers = normalizeChecklistAnswers(entry.checklistAnswers);
  const answeredCount = checklistAnswers.filter(
    (q) => q.answer === 'ya' || q.answer === 'tidak'
  ).length;
  const yesCount = checklistAnswers.filter((q) => q.answer === 'ya').length;
  const hasYes = entryHasYesFindings({ ...entry, checklistAnswers });

  const handleFieldChange = <K extends keyof ReportJenjangEntry>(
    field: K,
    value: ReportJenjangEntry[K]
  ) => {
    onChange({
      ...entry,
      [field]: value,
    });
  };

  const handleAnswerChange = (questionIndex: number, answer: ChecklistAnswer) => {
    const nextAnswers = checklistAnswers.map((item) =>
      item.questionIndex === questionIndex
        ? {
            ...item,
            answer,
            description: answer === 'tidak' ? '' : item.description || '',
          }
        : item
    );
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
          {entry.dormitoryType && (
            <span className="text-xs font-medium text-slate-700">
              · {entry.dormitoryType}
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

      {/* Pilihan Jenjang & Jenis Asrama */}
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
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Jenis Asrama <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DORMITORY_OPTIONS.map((opt: DormitoryType) => {
              const isSelected = entry.dormitoryType === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleFieldChange('dormitoryType', opt)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
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
                10 pertanyaan pemantauan harian (Ya/Tidak). Deskripsi wajib jika ada jawaban Ya.
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
                Tulis kronologi atau uraian kejadian secara manual dan bebas.
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
                  {entry.dormitoryType || 'Pilih Asrama'})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Semua 10 pertanyaan wajib dijawab dengan memilih Ya atau Tidak.
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
                const isYes = item.answer === 'ya';
                return (
                  <div
                    key={item.questionIndex}
                    className={`py-3 px-2.5 rounded-lg space-y-2.5 ${
                      isUnanswered || yesDescError
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
                      <div className="pl-0 sm:pl-7 space-y-1.5">
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
                      Pastikan kolom &ldquo;Deskripsikan kondisi yang terjadi&rdquo; pada masing-masing pertanyaan bertanda Ya di atas telah diisi dengan jelas.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              answeredCount === 10 && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Seluruh 10 kondisi dijawab <strong>Tidak</strong> — tidak perlu menulis deskripsi kejadian.
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
                Deskripsi Kejadian ({entry.jenjang || 'Jenjang'} · {entry.dormitoryType || 'Asrama'}) <span className="text-rose-500">*</span>
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
    </div>
  );
};
