import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { ReportItem, ReportCategory, ReportPriority } from '../types/report';

interface EditReportModalProps {
  report: ReportItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedReport: ReportItem) => void;
}

export const EditReportModal: React.FC<EditReportModalProps> = ({
  report,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(report.title);
  const [category, setCategory] = useState<ReportCategory>(report.category);
  const [priority, setPriority] = useState<ReportPriority>(report.priority);
  const [incidentDate, setIncidentDate] = useState(report.incidentDate);
  const [location, setLocation] = useState(report.location || '');
  const [description, setDescription] = useState(report.description);
  const [assignedTo, setAssignedTo] = useState(report.assignedTo || '');

  // Penanggung Jawab / Laporan dari (Ditulis Manual)
  const [picName, setPicName] = useState(report.picName || report.reporterName || '');
  const [picRole, setPicRole] = useState(report.picRole || 'Kepala Sekolah');
  const [picNip, setPicNip] = useState(report.picNip || report.reporterNip || '19740512 200212 1 003');

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCategoryChange = (val: ReportCategory) => {
    setCategory(val);
    if (val === 'nihil') {
      setPriority('nihil');
      setDescription('Nihil');
      if (!title.trim() || title === 'Laporan Harian') {
        setTitle('Laporan Harian Nihil');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul laporan tidak boleh kosong.');
      return;
    }
    if (!description.trim()) {
      setError('Deskripsi laporan tidak boleh kosong.');
      return;
    }

    const now = new Date();
    const timeFormatted = now.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const updated: ReportItem = {
      ...report,
      title: title.trim(),
      category,
      priority,
      incidentDate,
      location: location.trim(),
      description: description.trim(),
      picName: picName.trim(),
      picRole: picRole.trim(),
      picNip: picNip.trim(),
      reporterName: picName.trim() || report.reporterName,
      reporterNip: picNip.trim() || report.reporterNip,
      assignedTo: assignedTo.trim() || undefined,
      logs: [
        ...report.logs,
        {
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          timestamp: timeFormatted,
          actor: picName.trim() || 'Petugas / Admin',
          action: 'Laporan Diperbarui (Edit)',
          note: 'Informasi data laporan dan penanggung jawab telah diperbarui.',
        },
      ],
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Edit Data Laporan: <span className="font-mono text-indigo-700">{report.id}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbarui rincian kasus, kategori, urgensi, penanggung jawab, atau deskripsi
            </p>
          </div>
          <button
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

          {/* Kategori & Tingkat Prioritas (2 Kolom) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Kategori Laporan <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ReportCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="kategori_1">Tata Tertib, Relasi &amp; Prilaku, Adaptasi dan Motivasi, Kedisiplinan</option>
                <option value="kategori_2">Tata Tertib &amp; Perundungan, Kekerasan &amp; Relasi, Kesehatan dan Psikologis, Pendikan &amp; Kehadiran</option>
                <option value="kategori_3">Keselamatan &amp; Kekerasan, Hukum &amp; Perlindungan, Kesehatan &amp; Keselamatan Diri, Ruang Digital &amp; Nilai</option>
                <option value="nihil">Nihil</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Tingkat Prioritas <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ReportPriority)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="ringan">Kasus Ringan / Resiko Rendah</option>
                <option value="sedang">Kasus Sedang / Resiko Sedang</option>
                <option value="berat">Kasus Berat/Kompleks atau Resiko Tinggi/Kritis</option>
                <option value="nihil">Nihil</option>
              </select>
            </div>
          </div>

          {/* Requirement 4: Penanggung Jawab / Laporan dari (Nama, Jabatan, NIP ditulis manual) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Penanggung Jawab / Laporan dari (Ditulis Manual)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  Nama Penanggung Jawab <span className="text-rose-500">*</span>
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
                  Jabatan Penanggung Jawab <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={picRole}
                  onChange={(e) => setPicRole(e.target.value)}
                  placeholder="Jabatan"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                  NIP Penanggung Jawab <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={picNip}
                  onChange={(e) => setPicNip(e.target.value)}
                  placeholder="NIP"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Tanggal & Lokasi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Tanggal Kejadian
              </label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Lokasi / Area Terkait
              </label>
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

          {/* Deskripsi */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Deskripsi &amp; Kronologi Kejadian <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError('');
              }}
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
