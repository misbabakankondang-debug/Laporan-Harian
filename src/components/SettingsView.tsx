import React, { useState, useRef, useMemo } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  ShieldCheck, 
  Bell, 
  Save, 
  RotateCcw, 
  Check, 
  Hash,
  Image as ImageIcon,
  Upload,
  FileText,
  MapPin,
  Trash2,
  PhoneCall,
  Calendar
} from 'lucide-react';
import { UserProfile, AppSettings, ReportItem } from '../types/report';
import { KemensosLogo } from './KemensosLogo';

interface SettingsViewProps {
  userProfile: UserProfile;
  appSettings: AppSettings;
  reports?: ReportItem[];
  onSaveProfile: (profile: UserProfile) => void;
  onSaveSettings: (settings: AppSettings) => void;
  onResetToDefault: () => void;
  onDeleteReportsByRange?: (startDate: string, endDate: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  appSettings,
  reports = [],
  onSaveProfile,
  onSaveSettings,
  onResetToDefault,
  onDeleteReportsByRange,
}) => {
  const [name, setName] = useState(userProfile.name);
  const [nip, setNip] = useState(userProfile.nip || '19740512 200212 1 003');
  const [email, setEmail] = useState(userProfile.email);
  const [phone, setPhone] = useState(userProfile.phone);
  const [department, setDepartment] = useState(userProfile.department);
  const [role, setRole] = useState(userProfile.role);

  // System & Kop Surat Settings
  const [ticketPrefix, setTicketPrefix] = useState(appSettings.ticketPrefix || 'Tanggal Input Laporan/Nomor Urut');
  const [helpDeskNumber, setHelpDeskNumber] = useState(appSettings.helpDeskNumber || '8800 / 8801');
  const [emailNotification, setEmailNotification] = useState(appSettings.emailNotification);
  const [whatsappNotification, setWhatsappNotification] = useState(appSettings.whatsappNotification);
  const [autoSaveDraft, setAutoSaveDraft] = useState(appSettings.autoSaveDraft);
  
  const [mainLogoUrl, setMainLogoUrl] = useState<string>(appSettings.mainLogoUrl || '');
  const [kopLogoUrl, setKopLogoUrl] = useState<string>(appSettings.kopLogoUrl || '');
  const [kopAddress, setKopAddress] = useState<string>(
    appSettings.kopAddress || 'Jl. Raya Sumedang - Wado, Paseh, Kabupaten Sumedang, Jawa Barat 45311 | Pos-el: srt1sumedang@kemensos.go.id'
  );

  // Date range delete states
  const [deleteStartDate, setDeleteStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [deleteEndDate, setDeleteEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const mainLogoInputRef = useRef<HTMLInputElement>(null);
  const kopLogoInputRef = useRef<HTMLInputElement>(null);

  // Count reports in range for preview
  const matchingDeleteCount = useMemo(() => {
    if (!reports || reports.length === 0) return 0;
    const start = deleteStartDate ? new Date(deleteStartDate).getTime() : 0;
    const end = deleteEndDate ? new Date(deleteEndDate + 'T23:59:59').getTime() : Infinity;
    return reports.filter((r) => {
      const d = new Date(r.incidentDate || r.createdAt).getTime();
      return d >= start && d <= end;
    }).length;
  }, [reports, deleteStartDate, deleteEndDate]);

  // File to base64 handlers
  const handleMainLogoChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setMainLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleKopLogoChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setKopLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteDateRangeDelete = () => {
    if (matchingDeleteCount === 0) {
      alert('Tidak ada laporan yang ditemukan dalam rentang tanggal tersebut.');
      return;
    }

    const confirmed = window.confirm(
      `PERINGATAN: Apakah Anda yakin ingin menghapus ${matchingDeleteCount} laporan yang tercatat dalam rentang tanggal ${deleteStartDate} s/d ${deleteEndDate}?\n\nTindakan ini bersifat permanen dan tidak dapat dibatalkan.`
    );

    if (confirmed && onDeleteReportsByRange) {
      onDeleteReportsByRange(deleteStartDate, deleteEndDate);
      alert(`Berhasil menghapus ${matchingDeleteCount} laporan dari sistem.`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // compute initials
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CK';

    onSaveProfile({
      name: name.trim(),
      nip: nip.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department: department.trim(),
      role: role.trim(),
      avatarInitials: initials,
    });

    onSaveSettings({
      ticketPrefix: ticketPrefix.trim() || 'Tanggal Input Laporan/Nomor Urut',
      helpDeskNumber: helpDeskNumber.trim(),
      emailNotification,
      whatsappNotification,
      autoSaveDraft,
      mainLogoUrl,
      kopLogoUrl,
      kopAddress: kopAddress.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">
          Pengaturan Akun Pelapor &amp; Preferensi Sistem (SIBAHAR)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Kelola profil pejabat pelapor, NIP resmi, nomor Help Desk, kustomisasi logo aplikasi, logo kop surat, alamat kop surat, serta utilitas pembersihan berkas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Profil & Identitas Pelapor */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Profil &amp; Identitas Pelapor
              </h3>
              <p className="text-[11px] text-slate-500">
                Nama dan NIP di bawah ini otomatis dicetak pada lembar pengesahan dan berita acara PDF.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Nama Lengkap */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nama Lengkap &amp; Gelar <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-semibold"
              />
            </div>

            {/* NIP Resmi */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Induk Pegawai (NIP) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="Contoh: 19740512 200212 1 003"
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-mono font-bold text-emerald-800"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                NIP ini akan otomatis tercantum pada tanda tangan lembar PDF cetak.
              </span>
            </div>

            {/* Jabatan */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Jabatan / Kedudukan
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>

            {/* Instansi / Unit */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Unit Kerja / Instansi
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Alamat Email Kedinasan
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>

            {/* Telepon */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Kontak / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Logo Utama, Logo Kop Surat, Alamat Kop Surat */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Kustomisasi Logo &amp; Kop Surat Resmi
              </h3>
              <p className="text-[11px] text-slate-500">
                Atur logo aplikasi, logo kop surat Kemensos, dan teks alamat resmi untuk cetak PDF
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Edit Logo Utama */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-slate-800 font-semibold">
                Logo Utama Aplikasi (Sidebar Brand)
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                  {mainLogoUrl ? (
                    <img src={mainLogoUrl} alt="Logo Utama" className="w-full h-full object-contain" />
                  ) : (
                    <FileText className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    ref={mainLogoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMainLogoChange(e.target.files)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => mainLogoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo</span>
                    </button>
                    {mainLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setMainLogoUrl('')}
                        className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Format PNG, JPG, atau SVG (Maks. 2MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Edit Logo Kop Surat */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-slate-800 font-semibold">
                Logo Kop Surat (PDF Dokumen)
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                  {kopLogoUrl ? (
                    <img src={kopLogoUrl} alt="Logo Kop" className="w-full h-full object-contain" />
                  ) : (
                    <KemensosLogo className="w-10 h-10" />
                  )}
                </div>
                <div className="space-y-1">
                  <input
                    ref={kopLogoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleKopLogoChange(e.target.files)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => kopLogoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Kop Logo</span>
                    </button>
                    {kopLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setKopLogoUrl('')}
                        className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                      >
                        Kembali ke Kemensos
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Logo resmi di sebelah kiri Kop Surat laporan PDF
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Alamat Kop Surat */}
          <div className="pt-2 text-xs">
            <label className="block text-slate-700 font-medium mb-1">
              Alamat Lengkap untuk Kop Surat Resmi
            </label>
            <textarea
              rows={2}
              value={kopAddress}
              onChange={(e) => setKopAddress(e.target.value)}
              placeholder="Jl. Raya Sumedang - Wado, Paseh, Kabupaten Sumedang, Jawa Barat 45311 | Pos-el: srt1sumedang@kemensos.go.id"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-sans"
            />
            <p className="text-[10.5px] text-slate-400">
              Teks alamat ini akan tercantum di baris bawah teks instansi pada Kop Surat PDF.
            </p>
          </div>
        </div>

        {/* Section 3: Edit Nomor Help Desk (Requirement 6) */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <PhoneCall className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Edit Nomor Help Desk &amp; Meja Siaga
              </h3>
              <p className="text-xs text-slate-500">
                Atur nomor ekstensi atau saluran telepon bantuan darurat yang tampil di panel sidebar
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs items-center">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Ekstensi / Telepon Help Desk
              </label>
              <input
                type="text"
                value={helpDeskNumber}
                onChange={(e) => setHelpDeskNumber(e.target.value)}
                placeholder="Contoh: 8800 / 8801 atau (0261) 201234"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs font-bold text-slate-800"
              />
              <span className="text-[10.5px] text-slate-500 mt-1 block">
                Nomor ini akan langsung terhubung ke panel Pusat Bantuan Cepat di sidebar dan dashboard utama.
              </span>
            </div>
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs">
              <span className="text-emerald-800 font-semibold block text-[11px]">Pratinjau Tampilan Sidebar:</span>
              <p className="font-mono font-bold text-emerald-950 text-sm mt-1">
                Ext. Help Desk: <span className="underline">{helpDeskNumber || '8800 / 8801'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Hapus Laporan dengan Rentang Waktu (Requirement 6) */}
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-rose-100 text-rose-700">
            <Trash2 className="w-5 h-5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Hapus Semua Laporan Berdasarkan Rentang Waktu
              </h3>
              <p className="text-xs text-slate-500">
                Pilih periode tanggal kejadian untuk menghapus kumpulan riwayat laporan secara massal
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tanggal Mulai</span>
                </label>
                <input
                  type="date"
                  value={deleteStartDate}
                  onChange={(e) => setDeleteStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-rose-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tanggal Selesai</span>
                </label>
                <input
                  type="date"
                  value={deleteEndDate}
                  onChange={(e) => setDeleteEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-rose-500 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-rose-900 font-bold block text-sm">
                  Laporan Terdeteksi: <strong className="font-mono text-base text-rose-700">{matchingDeleteCount}</strong> tiket
                </span>
                <span className="text-[11px] text-rose-700 mt-0.5 block">
                  Periode kejadian: {deleteStartDate || 'Awal'} s/d {deleteEndDate || 'Sekarang'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleExecuteDateRangeDelete}
                disabled={matchingDeleteCount === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {matchingDeleteCount} Laporan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 5: Format Penomoran Tiket Sistem */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Hash className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Format Penomoran Tiket Sistem
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs items-center">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Format Penomoran Tiket (ID Laporan)
              </label>
              <input
                type="text"
                value={ticketPrefix}
                onChange={(e) => setTicketPrefix(e.target.value)}
                placeholder="Tanggal Input Laporan/Nomor Urut"
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs"
              />
              <span className="text-[10.5px] text-slate-500 mt-1 block">
                Mengikuti standar: Tanggal Input Laporan / Nomor Urut (contoh: 20261106/001)
              </span>
            </div>
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs">
              <span className="text-emerald-800 block text-[11px] font-medium">Format ID Tiket yang Dihasilkan:</span>
              <p className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                {new Date().toISOString().slice(0, 10).replace(/-/g, '')}/001
              </p>
            </div>
          </div>
        </div>

        {/* Section 6: Saluran Notifikasi */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Saluran Notifikasi &amp; Pemulihan Draft
            </h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={emailNotification}
                onChange={(e) => setEmailNotification(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Notifikasi Email Otomatis
                </p>
                <p className="text-[11px] text-slate-500">
                  Kirim salinan konfirmasi tanda terima tiket dan pembaruan berkala saat ada laporan baru.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={whatsappNotification}
                onChange={(e) => setWhatsappNotification(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Notifikasi WhatsApp Gateway
                </p>
                <p className="text-[11px] text-slate-500">
                  Kirim peringatan instan ke nomor WhatsApp yang terdaftar untuk laporan prioritas tinggi &amp; kasus kritis.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={autoSaveDraft}
                onChange={(e) => setAutoSaveDraft(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Fitur Pemulihan Draft Otomatis
                </p>
                <p className="text-[11px] text-slate-500">
                  Cegah hilangnya ketikan formulir pelaporan saat berpindah tab.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onResetToDefault}
            className="px-4 py-2 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ke Contoh Default</span>
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" /> Pengaturan berhasil disimpan!
              </span>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
