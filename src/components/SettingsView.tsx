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
import {
  EXPECTED_SUPABASE_URL,
  isValidSupabaseUrl,
  isValidSupabaseKey,
  cleanCredentialString,
  getSupabaseConfig,
  getEnvSupabaseUrl,
  getEnvSupabaseKey,
  SupabaseConnectionStatus,
} from '../lib/supabase';
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
  
  const [mainLogoUrl, setMainLogoUrl] = useState<string>(
    appSettings.mainLogoUrl || 'https://kitasiar.com/wp-content/uploads/2025/12/Logo-Sekolah-Rakyat.jpeg'
  );
  const [kopLogoUrl, setKopLogoUrl] = useState<string>(
    appSettings.kopLogoUrl || 'https://vectorez.biz.id/wp-content/uploads/2024/05/Logo-Kementerian-Sosial-Kemensos-Republik-Indonesia@0.5x.png'
  );
  const [backgroundHeroUrl, setBackgroundHeroUrl] = useState<string>(appSettings.backgroundHeroUrl || '');
  const [kopAddress, setKopAddress] = useState<string>(
    appSettings.kopAddress || 'Desa Kebon Cau, Kecamatan Ujung Jaya Kabupaten Sumedang Kode Pos 45383'
  );

  // Supabase Configuration (Prioritas Utama: Environment Variables Vercel)
  const initialSupabaseConfig = useMemo(() => getSupabaseConfig(), []);
  const hasAnyEnvInBuild = initialSupabaseConfig.hasEnvConfig;
  const hasActiveEnvConfig = initialSupabaseConfig.source === 'env' && initialSupabaseConfig.isConfigured;
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => {
    return initialSupabaseConfig.envUrl || initialSupabaseConfig.url || '';
  });
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => {
    return getEnvSupabaseKey() || initialSupabaseConfig.key || '';
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
  const [testFeedback, setTestFeedback] = useState<SupabaseConnectionStatus | null>(null);

  // Modal State for Add User by Admin
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('guru');
  const [newUserNip, setNewUserNip] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserDepartment, setNewUserDepartment] = useState('Sekolah Rakyat Terintegerasi 1 Sumedang');
  const [newUserPassword, setNewUserPassword] = useState('Sibahar2026!');
  const [isSavingNewUser, setIsSavingNewUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [pendingAuthUser, setPendingAuthUser] = useState<{
    id: string;
    token?: string;
    email: string;
    schemaMismatch?: boolean;
  } | null>(null);

  // Modal State for Edit User by Admin
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('guru');
  const [editNip, setEditNip] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  // Modal State for Delete User Confirmation
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');
  const [userMgmtSuccessMsg, setUserMgmtSuccessMsg] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

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

    const cleanedInputUrl = cleanCredentialString(supabaseUrlInput).replace(/\/+$/, '');
    const cleanedInputKey = cleanCredentialString(supabaseKeyInput);
    const envUrl = getEnvSupabaseUrl();
    const envKey = getEnvSupabaseKey();

    const isMatchingEnv =
      hasAnyEnvInBuild &&
      cleanedInputUrl === envUrl &&
      (!envKey || cleanedInputKey === envKey);

    const result = isMatchingEnv
      ? await checkSupabaseConnection()
      : await checkSupabaseConnection(supabaseUrlInput, supabaseKeyInput);

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
    setShowBulkDeleteModal(true);
  };

  const handleConfirmBulkDelete = () => {
    if (onDeleteReportsByRange) {
      onDeleteReportsByRange(deleteStartDate, deleteEndDate);
    }
    setShowBulkDeleteModal(false);
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
      supabaseUrl: isValidSupabaseUrl(getEnvSupabaseUrl()) ? getEnvSupabaseUrl() : supabaseUrlInput.trim(),
      supabaseAnonKey: '',
    });

    const trimmedUrl = cleanCredentialString(supabaseUrlInput);
    const trimmedKey = cleanCredentialString(supabaseKeyInput);
    const envUrl = getEnvSupabaseUrl();
    const envKey = getEnvSupabaseKey();

    if (hasAnyEnvInBuild || (isValidSupabaseUrl(envUrl) && isValidSupabaseKey(envKey))) {
      // Environment Variables Vercel aktif di build produksi: bersihkan sisa localStorage agar tidak menimpa produksi
      localStorage.removeItem('sibahar_supabase_url');
      localStorage.removeItem('sibahar_supabase_key');
      checkSupabaseConnection();
    } else if (isValidSupabaseUrl(trimmedUrl) && isValidSupabaseKey(trimmedKey)) {
      localStorage.setItem('sibahar_supabase_url', trimmedUrl);
      localStorage.setItem('sibahar_supabase_key', trimmedKey);
      checkSupabaseConnection(trimmedUrl, trimmedKey);
    } else {
      localStorage.removeItem('sibahar_supabase_url');
      localStorage.removeItem('sibahar_supabase_key');
      checkSupabaseConnection();
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
    setNewUserPassword('Sibahar2026!');
    setAddUserError('');
    setPendingAuthUser(null);
    setShowAddUserModal(true);
  };

  const handleCloseAddUser = () => {
    setShowAddUserModal(false);
    setPendingAuthUser(null);
    setAddUserError('');
  };

  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingNewUser) return;
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setAddUserError('Nama lengkap dan alamat email wajib diisi.');
      return;
    }

    const cleanedEmailInput = newUserEmail.trim().toLowerCase();
    const isContinuingPending = Boolean(
      pendingAuthUser?.id && pendingAuthUser.email === cleanedEmailInput
    );

    setAddUserError('');
    setIsSavingNewUser(true);
    try {
      const res = await addNewUserByAdmin({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        roleKey: newUserRole,
        nip: newUserNip.trim(),
        phone: newUserPhone.trim(),
        department: newUserDepartment.trim(),
        defaultPassword: newUserPassword.trim() || 'Sibahar2026!',
        ...(isContinuingPending && pendingAuthUser
          ? {
              continueProfileOnly: true,
              existingAuthUserId: pendingAuthUser.id,
              existingAuthToken: pendingAuthUser.token,
            }
          : {}),
      });

      if (!res.success) {
        if (res.partialAuthSuccess && res.pendingAuthUserId) {
          setPendingAuthUser({
            id: res.pendingAuthUserId,
            token: res.pendingAuthAccessToken,
            email: cleanedEmailInput,
            schemaMismatch: res.schemaMismatch,
          });
        }
        setAddUserError(res.error || 'Gagal menyimpan pengguna baru ke Supabase.');
        return;
      }

      setPendingAuthUser(null);
      setShowAddUserModal(false);
      setUserMgmtSuccessMsg(`Pengguna "${res.user?.name || newUserName.trim()}" berhasil disimpan.`);
      setTimeout(() => setUserMgmtSuccessMsg(''), 4000);
    } finally {
      setIsSavingNewUser(false);
    }
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.roleKey === 'keamanan' ? 'tenaga_keamanan' : user.roleKey);
    setEditNip(user.nip || '');
    setEditPhone(user.phone || '');
    setEditDepartment(user.department || 'Sekolah Rakyat Terintegerasi 1 Sumedang');
    setEditUserError('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || isUpdatingUser) return;
    if (!editName.trim()) {
      setEditUserError('Nama pengguna wajib diisi.');
      return;
    }

    setEditUserError('');
    setIsUpdatingUser(true);
    try {
      const targetId = editingUser.id || editingUser.email;
      const normalizedEditRole: UserRole = editRole === 'keamanan' ? 'tenaga_keamanan' : editRole;
      const res = await updateUserByAdmin(targetId, {
        name: editName.trim(),
        roleKey: normalizedEditRole,
        role: USER_ROLES[normalizedEditRole]?.label || normalizedEditRole,
        nip: editNip.trim(),
        phone: editPhone.trim(),
        department: editDepartment.trim(),
      });

      if (!res.success) {
        setEditUserError(res.error || 'Gagal memperbarui data pengguna di Supabase.');
        return;
      }

      setEditingUser(null);
      setUserMgmtSuccessMsg(`Perubahan data "${editName.trim()}" berhasil disimpan.`);
      setTimeout(() => setUserMgmtSuccessMsg(''), 4000);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser || isDeletingUser) return;
    const targetDeleteId =
      deletingUser.id ||
      (deletingUser as any).user_id ||
      (deletingUser as any).uid ||
      deletingUser.email ||
      '';

    if (!targetDeleteId) {
      setDeleteUserError('Gagal menghapus: ID atau Email pengguna tidak ditemukan.');
      return;
    }

    setDeleteUserError('');
    setIsDeletingUser(true);
    try {
      const deletedName = deletingUser.name;
      const res = await deleteUserByAdmin(targetDeleteId);
      if (!res.success) {
        setDeleteUserError(res.error || 'Gagal menghapus pengguna dari Supabase.');
        return;
      }
      setDeletingUser(null);
      setUserMgmtSuccessMsg(`Pengguna "${deletedName}" berhasil dihapus.`);
      setTimeout(() => setUserMgmtSuccessMsg(''), 4000);
    } finally {
      setIsDeletingUser(false);
    }
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
          {(() => {
            const activeStat = testFeedback || supabaseStatus;
            const badgeConfig: Record<
              SupabaseConnectionStatus['state'],
              { label: string; cls: string }
            > = {
              connected: {
                label: 'Supabase Terhubung',
                cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
              },
              auth_required: {
                label: 'Gateway & API Key Aktif (Login Diperlukan)',
                cls: 'bg-sky-100 text-sky-900 border border-sky-300',
              },
              needs_schema: {
                label: 'Supabase Terhubung - Skema Database Belum Siap',
                cls: 'bg-amber-100 text-amber-900 border border-amber-300',
              },
              permission_error: {
                label: 'Supabase Terhubung - Izin Database Terbatas',
                cls: 'bg-amber-100 text-amber-900 border border-amber-300',
              },
              auth_error: {
                label: 'Autentikasi Supabase Ditolak',
                cls: 'bg-rose-100 text-rose-800 border border-rose-300',
              },
              network_error: {
                label: 'Tidak Dapat Menjangkau Supabase',
                cls: 'bg-rose-100 text-rose-800 border border-rose-300',
              },
              unknown_error: {
                label: 'Terjadi Kesalahan Koneksi',
                cls: 'bg-rose-100 text-rose-800 border border-rose-300',
              },
              not_configured: {
                label: 'Konfigurasi Supabase Belum Lengkap',
                cls: 'bg-slate-100 text-slate-700 border border-slate-300',
              },
            };
            const currentBadge = badgeConfig[activeStat.state] || badgeConfig.unknown_error;
            return (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${currentBadge.cls}`}
                title={activeStat.message}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>{currentBadge.label}</span>
              </span>
            );
          })()}
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

            {/* Feedback Status Box & Diagnostik Lengkap */}
            {(() => {
              const currentStat = testFeedback || supabaseStatus;
              const sourceLabel =
                currentStat.source === 'env'
                  ? 'Vercel Environment'
                  : currentStat.source === 'localStorage'
                  ? 'Browser Manual Configuration'
                  : currentStat.source === 'mixed'
                  ? 'Kombinasi Vercel Environment & Browser Manual'
                  : 'Belum Terkonfigurasi';

              const stateMeta: Record<
                SupabaseConnectionStatus['state'],
                {
                  title: string;
                  summary: string;
                  boxCls: string;
                  titleCls: string;
                  subCls: string;
                  badgeIcon: 'check' | 'warn' | 'error' | 'db';
                }
              > = {
                connected: {
                  title: 'Supabase Terhubung',
                  summary: 'Gateway, API Key, sesi autentikasi pengguna, dan akses profil Supabase berhasil.',
                  boxCls: 'bg-emerald-50 border-emerald-200 text-emerald-950',
                  titleCls: 'text-emerald-950',
                  subCls: 'text-emerald-800',
                  badgeIcon: 'check',
                },
                auth_required: {
                  title: 'Gateway & API Key Terhubung (Login Diperlukan untuk Cek Tabel)',
                  summary:
                    'Gateway Supabase dan API Key valid. Pemeriksaan akses tabel profiles membutuhkan sesi autentikasi pengguna.',
                  boxCls: 'bg-sky-50 border-sky-200 text-sky-950',
                  titleCls: 'text-sky-950',
                  subCls: 'text-sky-800',
                  badgeIcon: 'db',
                },
                needs_schema: {
                  title: 'Supabase Terhubung - Skema Database Belum Siap',
                  summary: 'Gateway dan API Key berhasil, tetapi tabel profiles belum ditemukan.',
                  boxCls: 'bg-amber-50 border-amber-300 text-amber-950',
                  titleCls: 'text-amber-950',
                  subCls: 'text-amber-900',
                  badgeIcon: 'warn',
                },
                permission_error: {
                  title: 'Supabase Terhubung - Izin Database Terbatas',
                  summary: 'API Key diterima, tetapi akses tabel profiles dibatasi oleh izin database atau RLS.',
                  boxCls: 'bg-amber-50 border-amber-300 text-amber-950',
                  titleCls: 'text-amber-950',
                  subCls: 'text-amber-900',
                  badgeIcon: 'warn',
                },
                auth_error: {
                  title: 'Autentikasi Supabase Ditolak',
                  summary: 'Periksa API Key atau sesi autentikasi pengguna.',
                  boxCls: 'bg-rose-50 border-rose-200 text-rose-950',
                  titleCls: 'text-rose-950',
                  subCls: 'text-rose-800',
                  badgeIcon: 'error',
                },
                network_error: {
                  title: 'Tidak Dapat Menjangkau Supabase',
                  summary: 'Periksa jaringan, DNS, atau ketersediaan server.',
                  boxCls: 'bg-rose-50 border-rose-200 text-rose-950',
                  titleCls: 'text-rose-950',
                  subCls: 'text-rose-800',
                  badgeIcon: 'error',
                },
                unknown_error: {
                  title: 'Terjadi Kesalahan Koneksi',
                  summary: 'Periksa informasi diagnostik.',
                  boxCls: 'bg-rose-50/80 border-rose-200 text-rose-950',
                  titleCls: 'text-rose-950',
                  subCls: 'text-rose-800',
                  badgeIcon: 'error',
                },
                not_configured: {
                  title: 'Konfigurasi Supabase Belum Lengkap',
                  summary: 'Periksa pengaturan URL dan API Key Supabase.',
                  boxCls: 'bg-slate-50 border-slate-200 text-slate-900',
                  titleCls: 'text-slate-900',
                  subCls: 'text-slate-700',
                  badgeIcon: 'db',
                },
              };

              const meta = stateMeta[currentStat.state] || stateMeta.unknown_error;
              const formattedTestedAt = currentStat.testedAt
                ? new Date(currentStat.testedAt).toLocaleString('id-ID')
                : '—';

              const authStatusLabel =
                currentStat.authSessionStatus === 'authenticated'
                  ? 'Sudah Login (Sesi Aktif)'
                  : currentStat.authSessionStatus === 'expired'
                  ? 'Sesi Kedaluwarsa (Login Ulang)'
                  : currentStat.authSessionStatus === 'invalid'
                  ? 'Token Sesi Tidak Valid'
                  : 'Belum Login (Tanpa Sesi Auth)';

              const dbStatusText =
                currentStat.databaseAccessStatus === 'accessible' || currentStat.databaseAccessible
                  ? 'Dapat Diakses Sesuai RLS'
                  : currentStat.databaseAccessStatus === 'requires_auth_session' || currentStat.state === 'auth_required'
                  ? 'Membutuhkan Sesi Autentikasi'
                  : currentStat.state === 'needs_schema'
                  ? 'Tabel profiles Belum Tersedia'
                  : currentStat.state === 'permission_error'
                  ? 'Dibatasi RLS / Izin Role'
                  : currentStat.databaseAccessStatus === 'auth_error'
                  ? 'Ditolak (Sesi Auth Invalid)'
                  : 'Tidak Dapat Diakses';

              return (
                <div className={`p-4 rounded-xl border text-xs space-y-3 ${meta.boxCls}`}>
                  <div className="flex items-start gap-2.5">
                    {meta.badgeIcon === 'check' && (
                      <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    )}
                    {meta.badgeIcon === 'warn' && (
                      <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                        !
                      </div>
                    )}
                    {meta.badgeIcon === 'error' && (
                      <div className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                        ×
                      </div>
                    )}
                    {meta.badgeIcon === 'db' && (
                      <Database className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    )}

                    <div className="space-y-1 flex-1">
                      <p className={`font-bold ${meta.titleCls}`}>{meta.title}</p>
                      <p className={`text-[11px] font-medium ${meta.subCls}`}>{meta.summary}</p>
                      <p className={`text-[11px] leading-relaxed ${meta.subCls}`}>
                        Detail: {currentStat.message}
                      </p>
                      {currentStat.state === 'auth_required' && (
                        <p className="text-[11px] text-sky-800 font-medium pt-0.5">
                          Tabel <code className="font-mono bg-white px-1 rounded border border-sky-200">profiles</code> diamankan oleh RLS dan hak akses{' '}
                          <code className="font-mono bg-white px-1 rounded border border-sky-200">authenticated</code>. Silakan login menggunakan email &amp; kata sandi akun Supabase Anda agar pemeriksaan akses profil aktif dapat dijalankan.
                        </p>
                      )}
                      {currentStat.state === 'needs_schema' && (
                        <p className="text-[11px] text-amber-800 font-medium pt-0.5">
                          Klik tombol <strong>&quot;Salin SQL Schema&quot;</strong> di bawah, buka menu{' '}
                          <strong>SQL Editor</strong> di dashboard Supabase Anda, tempel kodenya dan klik{' '}
                          <strong>Run</strong>.
                        </p>
                      )}
                      {currentStat.state === 'auth_error' && (
                        <p className="text-[10.5px] text-rose-700 pt-0.5">
                          Pastikan Project URL adalah{' '}
                          <code className="font-mono bg-white px-1 rounded border border-rose-200">
                            {EXPECTED_SUPABASE_URL}
                          </code>{' '}
                          dan periksa <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> /{' '}
                          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> atau login ulang ke akun Supabase Anda.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Panel Diagnostik 4 Komponen Terpisah (Tanpa Kredensial Rahasia) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2.5 border-t border-black/10 text-[11px]">
                    <div className="bg-white/75 rounded-lg px-2.5 py-1.5 border border-black/5">
                      <span className="block text-[10px] text-slate-500">1. Gateway Supabase (Auth Health)</span>
                      <span className={`font-semibold ${currentStat.gatewayReachable ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {currentStat.gatewayReachable ? 'Aktif / Terhubung' : 'Tidak Terhubung'}
                        {currentStat.gatewayHttpStatus !== null ? ` (HTTP ${currentStat.gatewayHttpStatus})` : ''}
                      </span>
                    </div>

                    <div className="bg-white/75 rounded-lg px-2.5 py-1.5 border border-black/5">
                      <span className="block text-[10px] text-slate-500">2. Validitas API Key</span>
                      <span
                        className={`font-semibold ${
                          currentStat.apiKeyAccepted
                            ? 'text-emerald-700'
                            : currentStat.apiKeyFormatValid
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {currentStat.apiKeyAccepted
                          ? 'Diterima Server'
                          : !currentStat.apiKeyPresent && currentStat.errorCode !== 'INVALID_KEY_FORMAT'
                          ? 'Belum Tersedia'
                          : currentStat.apiKeyFormatValid
                          ? 'Format Valid (Belum Diterima)'
                          : 'Ditolak / Tidak Valid'}
                      </span>
                    </div>

                    <div className="bg-white/75 rounded-lg px-2.5 py-1.5 border border-black/5">
                      <span className="block text-[10px] text-slate-500">3. Status Autentikasi Pengguna</span>
                      <span
                        className={`font-semibold ${
                          currentStat.authSessionStatus === 'authenticated'
                            ? 'text-emerald-700'
                            : currentStat.authSessionStatus === 'unauthenticated'
                            ? 'text-sky-800'
                            : 'text-rose-700'
                        }`}
                      >
                        {authStatusLabel}
                      </span>
                    </div>

                    <div className="bg-white/75 rounded-lg px-2.5 py-1.5 border border-black/5">
                      <span className="block text-[10px] text-slate-500">4. Akses Database (profiles)</span>
                      <span
                        className={`font-semibold ${
                          currentStat.databaseAccessible
                            ? 'text-emerald-700'
                            : currentStat.state === 'auth_required'
                            ? 'text-sky-800'
                            : currentStat.state === 'needs_schema' || currentStat.state === 'permission_error'
                            ? 'text-amber-800'
                            : 'text-rose-700'
                        }`}
                      >
                        {dbStatusText}
                        {currentStat.databaseHttpStatus !== null ? ` (HTTP ${currentStat.databaseHttpStatus})` : ''}
                      </span>
                    </div>

                    <div className="bg-white/75 rounded-lg px-2.5 py-1.5 border border-black/5">
                      <span className="block text-[10px] text-slate-500">HTTP Status (Gateway / DB)</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {currentStat.gatewayHttpStatus !== null || currentStat.databaseHttpStatus !== null
                          ? `${currentStat.gatewayHttpStatus ?? '—'} / ${currentStat.databaseHttpStatus ?? '—'}`
                          : currentStat.httpStatus ?? '—'}
                      </span>
                    </div>

                    <div className="bg-white/75 rounded-lg px-2.5 py-1.5 border border-black/5">
                      <span className="block text-[10px] text-slate-500">Error Code / Waktu Uji</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {currentStat.errorCode || 'Tidak ada'}
                        {currentStat.failedStage ? ` (${currentStat.failedStage})` : ''}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{formattedTestedAt}</span>
                    </div>
                  </div>

                  {!currentStat.connected &&
                    currentStat.state !== 'auth_required' &&
                    currentStat.diagnosticDetails &&
                    (currentStat.diagnosticDetails.sbErrorCode ||
                      currentStat.diagnosticDetails.code ||
                      currentStat.diagnosticDetails.hint ||
                      currentStat.diagnosticDetails.details) && (
                      <div className="bg-white/80 rounded-lg px-3 py-2 border border-black/10 text-[10.5px] space-y-0.5 text-slate-700">
                        <p className="font-semibold text-slate-800">Respons Diagnostik Server (Disanitasi):</p>
                        {currentStat.diagnosticDetails.sbErrorCode && (
                          <p>
                            <span className="font-medium">sb-error-code:</span>{' '}
                            <code className="font-mono">{currentStat.diagnosticDetails.sbErrorCode}</code>
                          </p>
                        )}
                        {currentStat.diagnosticDetails.code && (
                          <p>
                            <span className="font-medium">code:</span>{' '}
                            <code className="font-mono">{currentStat.diagnosticDetails.code}</code>
                          </p>
                        )}
                        {currentStat.diagnosticDetails.details && (
                          <p>
                            <span className="font-medium">details:</span> {currentStat.diagnosticDetails.details}
                          </p>
                        )}
                        {currentStat.diagnosticDetails.hint && (
                          <p>
                            <span className="font-medium">hint:</span> {currentStat.diagnosticDetails.hint}
                          </p>
                        )}
                      </div>
                    )}

                  <div className="text-[10.5px] opacity-85 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Sumber Kredensial: <strong>{sourceLabel}</strong>
                    </span>
                    {currentStat.url && (
                      <span className="font-mono">Endpoint: {currentStat.url}</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {hasActiveEnvConfig && (
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-[11px] text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>Vercel Environment Aktif:</strong> Kredensial dari{' '}
                  <code className="font-mono">VITE_SUPABASE_URL</code> dan API Key Vercel menjadi sumber konfigurasi utama aplikasi secara otomatis.
                </div>
                {(cleanCredentialString(supabaseUrlInput).replace(/\/+$/, '') !== getEnvSupabaseUrl() ||
                  (getEnvSupabaseKey() && cleanCredentialString(supabaseKeyInput) !== getEnvSupabaseKey())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupabaseUrlInput(getEnvSupabaseUrl());
                      setSupabaseKeyInput(getEnvSupabaseKey());
                      setTestFeedback(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-50 cursor-pointer"
                  >
                    Reset ke Vercel Env
                  </button>
                )}
              </div>
            )}

            {(initialSupabaseConfig.localConflictWarning ||
              supabaseStatus.localConflictWarning ||
              (hasAnyEnvInBuild &&
                (cleanCredentialString(supabaseUrlInput).replace(/\/+$/, '') !== getEnvSupabaseUrl() ||
                  (getEnvSupabaseKey() && cleanCredentialString(supabaseKeyInput) !== getEnvSupabaseKey())))) && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-950">
                <strong>Peringatan Konfigurasi Lokal:</strong>{' '}
                {initialSupabaseConfig.localConflictWarning ||
                  supabaseStatus.localConflictWarning ||
                  'Nilai input manual di browser saat ini berbeda dengan Environment Variables produksi Vercel. Pengujian akan ditandai sebagai Browser Manual Configuration.'}
              </div>
            )}

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
                    placeholder={EXPECTED_SUPABASE_URL}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Project URL resmi: {EXPECTED_SUPABASE_URL}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1 font-mono">
                    VITE_SUPABASE_ANON_KEY / PUBLISHABLE_KEY
                  </label>
                  <input
                    type="password"
                    value={supabaseKeyInput}
                    onChange={(e) => {
                      setSupabaseKeyInput(e.target.value);
                      setTestFeedback(null);
                    }}
                    placeholder="eyJhbGciOiJIUzI1NiIs... atau sb_publishable_..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Salin dari Supabase &gt; Project Settings &gt; API (anon / publishable key)
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

            {userMgmtSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-medium">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{userMgmtSuccessMsg}</span>
              </div>
            )}

            {/* List Pengguna Aktif */}
            <div className="divide-y divide-slate-100 overflow-x-auto text-xs">
              <div className="min-w-[600px] space-y-1">
                {allUsersList.map((u) => {
                  const roleInfo = USER_ROLES[u.roleKey] || { label: u.role, badgeClass: 'bg-slate-100 text-slate-700' };
                  const isCurrentAdmin =
                    (Boolean(userProfile.id) && u.id === userProfile.id) ||
                    u.email.toLowerCase() === userProfile.email.toLowerCase();

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
                          onClick={() => {
                            setDeleteUserError('');
                            setDeletingUser(u);
                          }}
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
                onClick={handleCloseAddUser}
                className="text-purple-300 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="p-5 space-y-4 text-xs">
              {addUserError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs space-y-1.5">
                  <p className="font-medium leading-relaxed">{addUserError}</p>
                  {pendingAuthUser && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 space-y-1">
                      <p className="font-semibold">
                        Akun Auth sudah terbuat (UUID:{' '}
                        <span className="font-mono select-all">{pendingAuthUser.id}</span>)
                      </p>
                      <p>
                        {pendingAuthUser.schemaMismatch
                          ? 'Jalankan SQL migrasi kolom public.profiles & NOTIFY pgrst di Supabase SQL Editor (gunakan tombol Salin SQL Schema di menu Pengaturan), lalu klik tombol "Lanjutkan Simpan Profil" di bawah tanpa membuat akun Auth ganda.'
                          : 'Klik tombol "Lanjutkan Simpan Profil" di bawah untuk menyimpan profil ke tabel public.profiles tanpa membuat akun Auth ganda.'}
                      </p>
                    </div>
                  )}
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
                    <option value="tenaga_keamanan">4. Tenaga Keamanan</option>
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
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setNewUserEmail(nextVal);
                      if (pendingAuthUser && nextVal.trim().toLowerCase() !== pendingAuthUser.email) {
                        setPendingAuthUser(null);
                      }
                    }}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Kata Sandi Awal (Min. 6 Karakter)
                  </label>
                  <input
                    type="text"
                    minLength={6}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Sibahar2026!"
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-purple-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingNewUser}
                  onClick={handleCloseAddUser}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewUser}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg font-bold transition shadow-xs"
                >
                  {isSavingNewUser
                    ? 'Menyimpan ke Supabase...'
                    : pendingAuthUser
                      ? 'Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)'
                      : 'Simpan Pengguna Baru'}
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
              {editUserError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {editUserError}
                </div>
              )}

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
                    <option value="tenaga_keamanan">4. Tenaga Keamanan</option>
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
                  disabled={isUpdatingUser}
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg font-bold transition shadow-xs"
                >
                  {isUpdatingUser ? 'Menyimpan...' : 'Simpan Perubahan'}
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

            {deleteUserError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs text-left">
                {deleteUserError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={isDeletingUser}
                className="flex-1 py-2 text-xs border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser}
                className="flex-1 py-2 text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-lg font-bold transition shadow-xs"
              >
                {isDeletingUser ? 'Menghapus...' : 'Ya, Hapus Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI HAPUS MASSAL LAPORAN ================= */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-rose-200 p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">Hapus {matchingDeleteCount} Laporan?</h3>
              <p className="text-xs text-slate-600">
                Laporan pada rentang tanggal <strong>{deleteStartDate || 'Awal'}</strong> s/d <strong>{deleteEndDate || 'Sekarang'}</strong> akan dihapus permanen dari riwayat dan database Supabase.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="flex-1 py-2 text-xs border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="flex-1 py-2 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition shadow-xs"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
