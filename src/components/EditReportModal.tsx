import React, { useState } from 'react';
import { X, Save, AlertCircle, Plus } from 'lucide-react';
import {
  ReportItem,
  ReportCategory,
  ReportPriority,
  ReportJenjangEntry,
  JENJANG_OPTIONS,
  JenjangType,
} from '../types/report';
import {
  formatReportTicketNumber,
  NEW_CATEGORY_OPTIONS,
  LEGACY_CATEGORY_OPTIONS,
  normalizeJenjangEntry,
  createEmptyJenjangEntry,
  validateJenjangEntries,
  buildReportSummariesFromEntries,
  EntryValidationErrors,
} from '../utils/formatters';
import { JenjangEntryFormCard } from './JenjangEntryFormCard';
import { SubmitReportResult } from '../lib/supabase';

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
  const [location, setLocation] = useState(report.location || '');
  const [assignedTo, setAssignedTo] = useState(report.assignedTo || '');

  // Penanggung Jawab / Laporan dari (diambil apa adanya dari data laporan)
  const [picName, setPicName] = useState(report.picName || report.reporterName || '');
  const [picRole, setPicRole] = useState(report.picRole || '');
  const [picNip, setPicNip] = useState(report.picNip || report.reporterNip || '');

  // State khusus laporan baru terstruktur (1 atau beberapa entri jenjang)
  const [entries, setEntries] = useState<ReportJenjangEntry[]>(() =>
    hasStructuredEntries
      ? report.entries!.map((e, idx) => normalizeJenjangEntry(e, idx))
      : []
  );
  const [entryErrors, setEntryErrors] = useState<Record<string, EntryValidationErrors>>({});

  // State khusus laporan lama (tanpa entries) agar tetap kompatibel penuh
  const [legacyCategory, setLegacyCategory] = useState<ReportCategory>(report.category);
  const [legacyCustomCategory, setLegacyCustomCategory] = useState(report.customCategory || '');
  const [legacyPriority, setLegacyPriority] = useState<ReportPriority>(report.priority);
  const [legacyDescription, setLegacyDescription] = useState(report.description);

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!title.trim()) {
      setError('Judul laporan tidak boleh kosong.');
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
        incidentDate,
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
                  value={picRole}
                  onChange={(e) => setPicRole(e.target.value)}
                  placeholder="Kosongkan jika belum ada"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
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

          {/* Tanggal & Lokasi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    onChange={(updated) => handleEntryChange(entry.id, updated)}
                    onRemove={() => handleRemoveEntry(entry.id)}
                    compact
                  />
                );
              })}
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
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan ke Supabase...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
