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
  Calendar,
  Database,
  Users,
  Copy,
  ExternalLink,
  KeyRound,
  ShieldAlert,
  UserPlus,
  Edit2,
  X,
  Lock,
  Link as LinkIcon
} from 'lucide-react';
import { UserProfile, AppSettings, ReportItem, UserRole, USER_ROLES } from '../types/report';
import { KemensosLogo } from './KemensosLogo';
import { useAuth } from '../context/AuthContext';
import { isValidSupabaseUrl, isValidSupabaseKey, cleanCredentialString } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { FULL_SUPABASE_SCHEMA_SQL } from '../data/supabaseSchema';

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
  const { 
    currentRole, 
    allUsersList, 
    addNewUserByAdmin,
    updateUserByAdmin,
    deleteUserByAdmin,
    updateUserRoleByAdmin, 
    isSupabaseConnected,
    supabaseStatus,
    checkSupabaseConnection 
  } = useAuth();
  
  const isAdmin = currentRole === 'admin';

  // Profile fields
  const [name, setName] = useState(userProfile.name);
  const [nip, setNip] = useState(userProfile.nip || '19780706 200501 1 011');
  const [email, setEmail] = useState(userProfile.email);
  const [phone, setPhone] = useState(userProfile.phone);
  const [department, setDepartment] = useState(userProfile.department);
  const [role, setRole] = useState(userProfile.role);

  // System & Kop Surat Settings
  const [ticketPrefix, setTicketPrefix] = useState(appSettings.ticketPrefix || 'DDMMYYYY/Nomor Urut');
  const [helpDeskNumber, setHelpDeskNumber] = useState(appSettings.helpDeskNumber || '8800 / 8801');
  const [emailNotification, setEmailNotification] = useState(appSettings.emailNotification);
  const [whatsappNotification, setWhatsappNotification] = useState(appSettings.whatsappNotification);
  const [autoSaveDraft, setAutoSaveDraft] = useState(appSettings.autoSaveDraft);
  
  const [mainLogoUrl, setMainLogoUrl] = useState<string>(appSettings.mainLogoUrl || '');
  const [kopLogoUrl, setKopLogoUrl] = useState<string>(
    appSettings.kopLogoUrl || 'https://vectorez.biz.id/wp-content/uploads/2024/05/Logo-Kementerian-Sosial-Kemensos-Republik-Indonesia@0.5x.png'
  );
  const [backgroundHeroUrl, setBackgroundHeroUrl] = useState<string>(appSettings.backgroundHeroUrl || '');
  const [kopAddress, setKopAddress] = useState<string>(
    appSettings.kopAddress || 'Desa Kebon Cau, Kecamatan Ujung Jaya Kabupaten Sumedang Kode Pos 45383'
  );

  // Supabase Manual Configuration
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => {
    return localStorage.getItem('sibahar_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  });
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => {
    return localStorage.getItem('sibahar_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  });

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
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedUserPortalLink, setCopiedUserPortalLink] = useState(false);
  const [copiedAdminPortalLink, setCopiedAdminPortalLink] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testFeedback, setTestFeedback] = useState<any>(null);

  // Modal State for Add User by Admin
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('guru');
  const [newUserNip, setNewUserNip] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState('Sekolah Rakyat Terintegerasi 1 Sumedang');
  const [addUserError, setAddUserError] = useState('');

  // Modal State for Edit User by Admin
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('guru');
  const [editNip, setEditNip] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');

  // Modal State for Delete User Confirmation
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  // User Profile Photo State
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>(userProfile.avatarUrl || '');
  const userAvatarInputRef = useRef<HTMLInputElement>(null);

  const mainLogoInputRef = useRef<HTMLInputElement>(null);
  const kopLogoInputRef = useRef<HTMLInputElement>(null);
  const backgroundHeroInputRef = useRef<HTMLInputElement>(null);

  // Portal URLs
  const userPortalUrl = useMemo(() => {
    try {
      return `${window.location.origin}${window.location.pathname}?portal=user`;
    } catch {
      return '?portal=user';
    }
  }, []);

  const adminPortalUrl = useMemo(() => {
    try {
      return `${window.location.origin}${window.location.pathname}?portal=admin`;
    } catch {
      return '?portal=admin';
    }
  }, []);

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

  const handleTestConnection = async () => {
    if (!isAdmin) return;
    setIsTestingConnection(true);
    setTestFeedback(null);
    const result = await checkSupabaseConnection(supabaseUrlInput, supabaseKeyInput);
    setIsTestingConnection(false);
    setTestFeedback(result);
  };

  // File to base64 handlers
  const handleUserAvatarChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran file foto profil maksimal 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUserAvatarUrl(dataUrl);
      onSaveProfile({
        ...userProfile,
        avatarUrl: dataUrl,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveUserAvatar = () => {
    setUserAvatarUrl('');
    onSaveProfile({
      ...userProfile,
      avatarUrl: '',
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleMainLogoChange = (files: FileList | null) => {
    if (!isAdmin || !files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setMainLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleKopLogoChange = (files: FileList | null) => {
    if (!isAdmin || !files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setKopLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundHeroChange = (files: FileList | null) => {
    if (!isAdmin || !files || files.length === 0) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file background maksimal 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setBackgroundHeroUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteDateRangeDelete = () => {
    if (!isAdmin) {
      alert('Hanya akun Admin yang berwenang menghapus riwayat laporan secara massal.');
      return;
    }
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
    if (!isAdmin) {
      alert('Hanya Administrator yang memiliki wewenang untuk mengubah pengaturan aplikasi.');
      return;
    }

    // compute initials
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AD';

    onSaveProfile({
      id: userProfile.id || 'usr-default',
      name: name.trim(),
      nip: nip.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department: department.trim(),
      role: role.trim(),
      roleKey: userProfile.roleKey || 'admin',
      avatarInitials: initials,
      avatarUrl: userAvatarUrl,
    });

    onSaveSettings({
      ticketPrefix: ticketPrefix.trim() || 'DDMMYYYY/Nomor Urut',
      helpDeskNumber: helpDeskNumber.trim(),
      emailNotification,
      whatsappNotification,
      autoSaveDraft,
      mainLogoUrl,
      kopLogoUrl,
      kopAddress: kopAddress.trim(),
      backgroundHeroUrl,
      supabaseUrl: supabaseUrlInput.trim(),
      supabaseAnonKey: supabaseKeyInput.trim(),
    });

    const trimmedUrl = cleanCredentialString(supabaseUrlInput);
    const trimmedKey = cleanCredentialString(supabaseKeyInput);

    if (isValidSupabaseUrl(trimmedUrl) && isValidSupabaseKey(trimmedKey)) {
      localStorage.setItem('sibahar_supabase_url', trimmedUrl);
      localStorage.setItem('sibahar_supabase_key', trimmedKey);
      checkSupabaseConnection(trimmedUrl, trimmedKey);
    } else {
      localStorage.removeItem('sibahar_supabase_url');
      localStorage.removeItem('sibahar_supabase_key');
      checkSupabaseConnection('', '');
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // User Management Actions for Admin
  const handleOpenAddUser = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('guru');
    setNewUserNip('');
    setNewUserPhone('');
    setNewUserDepartment('Sekolah Rakyat Terintegerasi 1 Sumedang');
    setAddUserError('');
    setShowAddUserModal(true);
  };

  const handleSaveNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setAddUserError('Nama lengkap dan alamat email wajib diisi.');
      return;
    }

    addNewUserByAdmin({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      roleKey: newUserRole,
      nip: newUserNip.trim(),
      phone: newUserPhone.trim(),
      department: newUserDepartment.trim(),
    });

    setShowAddUserModal(false);
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.roleKey);
    setEditNip(user.nip || '');
    setEditPhone(user.phone || '');
    setEditDepartment(user.department || 'Sekolah Rakyat Terintegerasi 1 Sumedang');
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      alert('Nama pengguna wajib diisi.');
      return;
    }

    const targetId = editingUser.id || editingUser.email;
    updateUserByAdmin(targetId, {
      name: editName.trim(),
      roleKey: editRole,
      role: USER_ROLES[editRole]?.label || editRole,
      nip: editNip.trim(),
      phone: editPhone.trim(),
      department: editDepartment.trim(),
    });

    setEditingUser(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    const targetDeleteId = deletingUser.id || (deletingUser as any).user_id || (deletingUser as any).uid || '';
    
    if (!targetDeleteId) {
      alert('Gagal menghapus: ID pengguna tidak ditemukan.');
      return;
    }

    // Memanggil fungsi RPC Supabase di sisi server database
    try {
      const { error } = await supabase.rpc('delete_user_profile', {
        target_id: targetDeleteId,
      });

      if (error && error.code !== 'NOT_CONFIGURED') {
        console.warn('Supabase RPC delete_user_profile warning:', error.message);
      }
    } catch (rpcErr: any) {
      console.warn('Gagal memanggil RPC delete_user_profile:', rpcErr);
    }

    // Hapus dari state lokal aplikasi
    const res = deleteUserByAdmin(targetDeleteId);
    if (!res.success) {
      alert(res.error || 'Gagal menghapus pengguna.');
    } else {
      alert('Pengguna berhasil dihapus.');
    }
    setDeletingUser(null);
  };

  const sqlSchemaSnippet = FULL_SUPABASE_SCHEMA_SQL;

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Top Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Pengaturan Sistem &amp; Manajemen SIBAHAR
            </h2>
            {isAdmin ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                Akses Administrator Penuh
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                Mode Hanya Baca (Read-Only)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola profil pelapor, tautan portal login, upload background landscape hero, logo kop surat, integrasi Supabase, dan data pengguna.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isSupabaseConnected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            <Database className="w-3.5 h-3.5" />
            <span>{isSupabaseConnected ? 'Supabase Terhubung' : 'Supabase Standby'}</span>
          </span>
        </div>
      </div>

      {/* Lock Warning Banner for Non-Admin */}
      {!isAdmin && (
        <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-amber-950">
              Wewenang Terbatas: Hanya Akun Admin yang Dapat Mengubah Pengaturan Aplikasi SIBAHAR
            </h4>
            <p className="text-amber-900 leading-relaxed">
              Anda sedang masuk sebagai <strong>{userProfile.role}</strong> ({userProfile.name}). Sesuai ketentuan kebijakan RBAC SIBAHAR:
            </p>
            <ul className="list-disc list-inside text-amber-800 space-y-0.5 pl-1">
              <li>Pengaturan fitur, logo kop surat, hero background, nomor help desk, dan konfigurasi database Supabase dikunci.</li>
              <li>Manajemen akun pengguna dan penghapusan data massal hanya dapat dilakukan oleh Administrator.</li>
              <li>Anda dapat melihat informasi profil Anda sendiri di bawah ini.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tautan Khusus Portal Login SIBAHAR (Admin View) */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 text-white p-5 rounded-2xl border border-emerald-800 shadow-md space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-amber-300" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Tautan Portal Login SIBAHAR (Khusus Pengguna vs Administrator)
                </h3>
                <p className="text-xs text-emerald-200">
                  Bagikan tautan khusus pengguna kepada staf atau gunakan tautan admin untuk mengelola sistem.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* 1. Link Khusus Pengguna / Staf */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-300" />
                  <span>1. Link Khusus Pengguna / Staf</span>
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded">
                  ?portal=user
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 leading-tight">
                Untuk Wali Asrama, Wali Asuh, Guru, Tenaga Keamanan, dan Kepala Sekolah:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={userPortalUrl}
                  className="flex-1 bg-black/30 border border-white/20 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-emerald-200 select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(userPortalUrl);
                    setCopiedUserPortalLink(true);
                    setTimeout(() => setCopiedUserPortalLink(false), 2500);
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  {copiedUserPortalLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUserPortalLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* 2. Link Khusus Administrator */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                  <span>2. Link Khusus Administrator (Saat Ini)</span>
                </span>
                <span className="text-[10px] font-mono bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded">
                  ?portal=admin
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 leading-tight">
                Tautan default yang Anda gunakan saat ini untuk akses penuh Administrator:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={adminPortalUrl}
                  className="flex-1 bg-black/30 border border-white/20 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-amber-200 select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(adminPortalUrl);
                    setCopiedAdminPortalLink(true);
                    setTimeout(() => setCopiedAdminPortalLink(false), 2500);
                  }}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  {copiedAdminPortalLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAdminPortalLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section 1: Profil Akun */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Informasi Akun Pengguna Aktif &amp; Foto Profil
              </h3>
              <p className="text-xs text-slate-500">
                {isAdmin ? 'Sesuaikan profil administrator dan foto akun Anda' : 'Detail profil akun Anda yang terdaftar pada sistem SIBAHAR'}
              </p>
            </div>
          </div>

          {/* Upload Foto Profil Pengguna (Tersedia untuk Semua Pengguna) */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-full bg-white text-emerald-900 border-2 border-emerald-500 shadow-sm shrink-0 overflow-hidden flex items-center justify-center font-bold text-base">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={userProfile.name} className="w-full h-full object-cover" />
                ) : (
                  userProfile.avatarInitials
                )}
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                  Foto Profil Pengguna ({userProfile.role})
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Unggah foto kedinasan formal. Foto profil ini akan otomatis ditampilkan pada menu sidebar, header, dan laporan yang Anda buat.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={userAvatarInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleUserAvatarChange(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => userAvatarInputRef.current?.click()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Foto Pengguna</span>
              </button>
              {userAvatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveUserAvatar}
                  className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nama Lengkap &amp; Gelar
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-lg border text-xs ${
                  isAdmin 
                    ? 'border-slate-300 focus:outline-hidden focus:border-emerald-500 bg-white' 
                    : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-400" />
                <span>NIP Pegawai (Otomatis pada Kop/Tanda Tangan)</span>
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-lg border font-mono text-xs ${
                  isAdmin 
                    ? 'border-slate-300 focus:outline-hidden focus:border-emerald-500 bg-white' 
                    : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Alamat Email Kedinasan
              </label>
              <input
                type="email"
                disabled={!isAdmin}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-lg border text-xs ${
                  isAdmin 
                    ? 'border-slate-300 focus:outline-hidden focus:border-emerald-500 bg-white' 
                    : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                disabled={!isAdmin}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-3.5 py-2 rounded-lg border text-xs ${
                  isAdmin 
                    ? 'border-slate-300 focus:outline-hidden focus:border-emerald-500 bg-white' 
                    : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Unit / Instansi
              </label>
              <input
                type="text"
                disabled
                value={department}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Jabatan / Hak Akses Sistem
              </label>
              <div className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-between">
                <span>{userProfile.role}</span>
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  {userProfile.roleKey}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Upload Foto Background Landscape Dashboard Utama (Hanya Admin) */}
        <div className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isAdmin ? 'bg-white border-emerald-100' : 'bg-slate-50/70 border-slate-200 opacity-90'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Upload Foto Background Landscape (Dashboard Utama)</span>
                  {!isAdmin && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </h3>
                <p className="text-xs text-slate-500">
                  Foto background berukuran presisi dari ujung kiri sampai kanan di banner selamat datang dashboard utama.
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <input
                  ref={backgroundHeroInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleBackgroundHeroChange(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => backgroundHeroInputRef.current?.click()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih Foto Lanskap</span>
                </button>
                {backgroundHeroUrl && (
                  <button
                    type="button"
                    onClick={() => setBackgroundHeroUrl('')}
                    className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                  >
                    Hapus
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pratinjau Foto Lanskap Presisi Ujung ke Ujung */}
          <div className="space-y-2">
            <span className="text-xs text-slate-600 font-medium block">
              Pratinjau Foto Banner Lanskap (Rasio Lebar Penuh):
            </span>
            <div className="relative w-full h-36 sm:h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner flex items-center justify-center">
              {backgroundHeroUrl ? (
                <>
                  <img
                    src={backgroundHeroUrl}
                    alt="Pratinjau Background Lanskap SIBAHAR"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-transparent pointer-events-none flex items-center p-4 sm:p-6">
                    <div className="text-white space-y-1">
                      <p className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                        SIBAHAR KEMENSOS RI
                      </p>
                      <h4 className="text-base sm:text-lg font-extrabold text-white">
                        Sekolah Rakyat Terintegerasi 1 Sumedang
                      </h4>
                      <p className="text-xs text-emerald-100 italic">
                        "Pratinjau banner berukuran presisi dari ujung kiri sampai ujung kanan"
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-4 text-slate-400 space-y-1">
                  <ImageIcon className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                  <p className="text-xs font-medium text-slate-300">Belum ada foto landscape yang diupload</p>
                  <p className="text-[11px] text-slate-400">
                    {isAdmin ? 'Klik "Pilih Foto Lanskap" untuk mengunggah banner bangunan / asrama' : 'Hanya Administrator yang dapat mengunggah foto'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Logo Resmi & Kop Surat Legal (Hanya Admin) */}
        <div className={`p-6 rounded-2xl border shadow-sm space-y-4 ${
          isAdmin ? 'bg-white border-emerald-100' : 'bg-slate-50/70 border-slate-200 opacity-90'
        }`}>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileText className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Logo Resmi Aplikasi SIBAHAR &amp; Kop Surat Kedinasan</span>
                {!isAdmin && <Lock className="w-3.5 h-3.5 text-slate-400" />}
              </h3>
              <p className="text-xs text-slate-500">
                Logo resmi Kementerian Sosial RI dan konfigurasi alamat pada kop surat format cetak Legal
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Logo Utama */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <span className="font-semibold text-slate-700 block">Logo Utama Aplikasi</span>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-300 p-2 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {mainLogoUrl ? (
                    <img src={mainLogoUrl} alt="Logo Utama" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <KemensosLogo className="w-12 h-12" />
                  )}
                </div>
                {isAdmin && (
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
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo</span>
                      </button>
                      {mainLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setMainLogoUrl('')}
                          className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Logo Kop Surat */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <span className="font-semibold text-slate-700 block">Logo pada Kop Surat Resmi</span>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-300 p-2 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {kopLogoUrl ? (
                    <img src={kopLogoUrl} alt="Logo Kop Surat" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <KemensosLogo className="w-10 h-10" />
                  )}
                </div>
                {isAdmin && (
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
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Kop</span>
                      </button>
                      {kopLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setKopLogoUrl('')}
                          className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs">
            <label className="block text-slate-700 font-medium mb-1">
              Alamat Lengkap untuk Kop Surat Resmi
            </label>
            <textarea
              rows={2}
              disabled={!isAdmin}
              value={kopAddress}
              onChange={(e) => setKopAddress(e.target.value)}
              className={`w-full px-3.5 py-2 rounded-lg border text-xs font-sans ${
                isAdmin 
                  ? 'border-slate-300 focus:outline-hidden focus:border-emerald-500 bg-white' 
                  : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        {/* Section 4: Integrasi Database Supabase & Vercel (Hanya Admin) */}
        {isAdmin && (
          <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Konfigurasi Supabase PostgreSQL &amp; Vercel Deployment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Hubungkan database Supabase untuk penyimpanan cloud terpusat, notifikasi Kepala Sekolah, dan Row Level Security (RLS).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 shadow-2xs"
                >
                  {isTestingConnection ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                      <span>Menguji...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Uji Koneksi Supabase</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Feedback Status Box */}
            {(() => {
              const currentStat = testFeedback || supabaseStatus;
              if (currentStat.state === 'connected') {
                return (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">Supabase Terhubung Sempurna!</p>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        Kredensial valid, server terhubung, dan tabel database siap digunakan untuk sinkronisasi laporan otomatis.
                      </p>
                    </div>
                  </div>
                );
              }

              if (currentStat.state === 'needs_schema') {
                return (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">!</div>
                    <div className="space-y-1">
                      <p className="font-bold">Kredensial Valid &amp; Server Supabase Terhubung!</p>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        Namun tabel database (<code className="font-mono bg-white px-1 py-0.2 rounded border border-amber-200">profiles</code> &amp; <code className="font-mono bg-white px-1 py-0.2 rounded border border-amber-200">reports</code>) belum dibuat di Supabase Anda.
                      </p>
                      <p className="text-[11px] text-amber-800 font-medium">
                        👉 Klik tombol <strong>"Salin SQL Schema"</strong> di bawah, buka menu <strong>SQL Editor</strong> di dashboard Supabase Anda, tempel kodenya dan klik <strong>Run</strong>.
                      </p>
                    </div>
                  </div>
                );
              }

              if (currentStat.state === 'auth_error' || currentStat.state === 'network_error') {
                return (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">×</div>
                    <div>
                      <p className="font-bold">Koneksi Supabase Gagal</p>
                      <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                        {currentStat.message}
                      </p>
                      <p className="text-[10.5px] text-rose-700 mt-1">
                        Periksa kembali <strong>Project URL</strong> dan <strong>Anon Key</strong> di menu <em>Project Settings &gt; API</em> pada dashboard Supabase.
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                  <Database className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900">Mode Penyimpanan Standby (Siap Supabase)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      SIBAHAR beroperasi menggunakan penyimpanan browser terproteksi. Masukkan kredensial Supabase di bawah jika Anda ingin mengaktifkan sinkronisasi cloud terpusat.
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    VITE_SUPABASE_URL
                  </label>
                  <input
                    type="text"
                    value={supabaseUrlInput}
                    onChange={(e) => {
                      setSupabaseUrlInput(e.target.value);
                      setTestFeedback(null);
                    }}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Salin dari Supabase &gt; Project Settings &gt; API &gt; Project URL
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    VITE_SUPABASE_ANON_KEY
                  </label>
                  <input
                    type="password"
                    value={supabaseKeyInput}
                    onChange={(e) => {
                      setSupabaseKeyInput(e.target.value);
                      setTestFeedback(null);
                    }}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Salin dari Supabase &gt; Project Settings &gt; API &gt; anon key
                  </span>
                </div>
              </div>

              {/* Step-by-Step & SQL Copy Banner */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-bold text-emerald-950 text-xs block">
                      Skrip SQL Schema &amp; RLS Otomatis (Lengkap 100% Siap Pakai)
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Mencakup tabel profiles, reports, notifications, trigger notifikasi Kepala Sekolah, dan Row Level Security (RLS).
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(sqlSchemaSnippet);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2500);
                      }}
                      className="px-3.5 py-1.5 bg-white border border-emerald-400 hover:bg-emerald-50 text-emerald-900 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{copiedSql ? '✓ Berhasil Disalin!' : 'Salin SQL Schema'}</span>
                    </button>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 transition shadow-2xs"
                    >
                      <span>Buka Supabase</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Manajemen Akun Pengguna (Fitur Lengkap Khusus Admin) */}
        {isAdmin && (
          <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100 flex-wrap gap-2 text-purple-900">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Manajemen Akun Pengguna (Kewenangan Khusus Admin)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Tambah pengguna baru, ubah nama, ganti jabatan/role, dan hapus pengguna sistem SIBAHAR.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenAddUser}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Tambah Pengguna Baru</span>
              </button>
            </div>

            {/* List Pengguna Aktif */}
            <div className="divide-y divide-slate-100 overflow-x-auto text-xs">
              <div className="min-w-[600px] space-y-1">
                {allUsersList.map((u) => {
                  const roleInfo = USER_ROLES[u.roleKey] || { label: u.role, badgeClass: 'bg-slate-100 text-slate-700' };
                  const isCurrentAdmin = u.id === userProfile.id;

                  return (
                    <div 
                      key={u.id || u.email} 
                      className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center shrink-0 text-xs border border-purple-200">
                          {u.avatarInitials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-xs sm:text-sm">{u.name}</p>
                            {isCurrentAdmin && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-200">
                                Akun Anda
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {u.email} · NIP: {u.nip || '-'} {u.phone ? `· HP: ${u.phone}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${roleInfo.badgeClass}`}>
                          {roleInfo.label}
                        </span>

                        {/* Tombol Ubah / Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(u)}
                          className="px-2.5 py-1 text-slate-700 hover:text-purple-700 hover:bg-purple-50 border border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                          title="Ubah data pengguna ini"
                        >
                          <Edit2 className="w-3 h-3 text-purple-600" />
                          <span>Ubah</span>
                        </button>

                        {/* Tombol Hapus */}
                        <button
                          type="button"
                          onClick={() => setDeletingUser(u)}
                          disabled={isCurrentAdmin && allUsersList.filter(x => x.roleKey === 'admin').length <= 1}
                          className="px-2.5 py-1 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isCurrentAdmin ? "Tidak dapat menghapus admin utama" : "Hapus akun pengguna"}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Section 6: Edit Nomor Help Desk (Hanya Admin) */}
        {isAdmin && (
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
              </div>
              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs">
                <span className="text-emerald-800 font-semibold block text-[11px]">Pratinjau Tampilan Sidebar:</span>
                <p className="font-mono font-bold text-emerald-950 text-sm mt-1">
                  Ext. Help Desk: <span className="underline">{helpDeskNumber || '8800 / 8801'}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section 7: Hapus Laporan dengan Rentang Waktu (Hanya Admin) */}
        {isAdmin && (
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
        )}

        {/* Action Buttons (Hanya Admin yang dapat menyimpan & reset) */}
        {isAdmin && (
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
                <span>Simpan Seluruh Pengaturan</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ================= MODAL TAMBAH PENGGUNA BARU OLEH ADMIN ================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-300" />
                <div>
                  <h3 className="font-bold text-sm">Tambah Pengguna Baru SIBAHAR</h3>
                  <p className="text-[11px] text-purple-200">Kewenangan Khusus Administrator</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="text-purple-300 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="p-5 space-y-4 text-xs">
              {addUserError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {addUserError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap &amp; Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Contoh: Rina Andriani, S.Pd"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-purple-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Jabatan / Hak Akses (Role) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-purple-500 text-xs font-semibold"
                  >
                    <option value="wali_asrama">1. Wali Asrama</option>
                    <option value="wali_asuh">2. Wali Asuh</option>
                    <option value="guru">3. Guru</option>
                    <option value="keamanan">4. Tenaga Keamanan</option>
                    <option value="kepala_sekolah">5. Kepala Sekolah</option>
                    <option value="admin">6. Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    NIP Pegawai
                  </label>
                  <input
                    type="text"
                    value={newUserNip}
                    onChange={(e) => setNewUserNip(e.target.value)}
                    placeholder="Contoh: 19890412 201503 2 004"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-purple-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Alamat Email Login <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="nama@srt1sumedang.sch.id"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-purple-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-purple-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Unit Kerja / Instansi
                </label>
                <input
                  type="text"
                  value={newUserDepartment}
                  onChange={(e) => setNewUserDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-purple-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition shadow-xs"
                >
                  Simpan Pengguna Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT PENGGUNA OLEH ADMIN ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Ubah Data Pengguna</h3>
                  <p className="text-[11px] text-slate-300 font-mono">{editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap &amp; Gelar Pengguna <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Jabatan / Role Pengguna <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-emerald-500 text-xs font-semibold"
                  >
                    <option value="wali_asrama">1. Wali Asrama</option>
                    <option value="wali_asuh">2. Wali Asuh</option>
                    <option value="guru">3. Guru</option>
                    <option value="keamanan">4. Tenaga Keamanan</option>
                    <option value="kepala_sekolah">5. Kepala Sekolah</option>
                    <option value="admin">6. Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    NIP Pegawai
                  </label>
                  <input
                    type="text"
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Unit Kerja
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS PENGGUNA OLEH ADMIN ================= */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-rose-200 p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Hapus Pengguna SIBAHAR?</h3>
              <p className="text-xs text-slate-600">
                Apakah Anda yakin ingin menghapus akun <strong>{deletingUser.name}</strong> ({deletingUser.email})?
              </p>
              <p className="text-[11px] text-rose-600 font-semibold mt-1">
                Pengguna ini tidak akan bisa login lagi ke aplikasi.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2 text-xs border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition shadow-xs"
              >
                Ya, Hapus Pengguna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
