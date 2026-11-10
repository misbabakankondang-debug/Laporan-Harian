import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Building2,
  KeyRound,
  Copy,
  Check,
  Shield,
  Users,
  ExternalLink,
  ChevronRight,
  GraduationCap,
  Hash,
  Briefcase,
  LogIn
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole, USER_ROLES } from '../types/report';
import { DEFAULT_ROLE_USERS } from '../data/initialData';
import { KemensosLogo } from './KemensosLogo';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { 
    loginWithRole, 
    loginWithUserProfile, 
    loginWithEmail, 
    registerWithEmail, 
    isLoading, 
    isSupabaseConnected, 
    allUsersList 
  } = useAuth();
  
  // Detect portal parameter from URL (?portal=staf, ?portal=user, or default admin)
  const [portalType, setPortalType] = useState<'admin' | 'user'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('portal');
      if (p === 'user' || p === 'staf' || p === 'staff' || p === 'pegawai') return 'user';
      return 'admin'; // Default (link sekarang) adalah khusus untuk admin
    } catch {
      return 'admin';
    }
  });

  // Filter out admin from general user lists and ensure exactly ONE Tenaga Keamanan
  const operationalUsers = useMemo<UserProfile[]>(() => {
    const list = allUsersList.filter((u: UserProfile) => u.roleKey !== 'admin');
    const result: UserProfile[] = [];
    const seenRoles = new Set<string>();
    const seenEmails = new Set<string>();

    list.forEach((u: UserProfile) => {
      // Tenaga Keamanan hanya satu saja
      if (u.roleKey === 'tenaga_keamanan' || (u.roleKey as string) === 'keamanan') {
        if (seenRoles.has('tenaga_keamanan')) return;
        seenRoles.add('tenaga_keamanan');
      }
      const email = u.email.toLowerCase();
      if (!seenEmails.has(email)) {
        seenEmails.add(email);
        result.push(u);
      }
    });
    return result;
  }, [allUsersList]);
  
  // Default selected user for the Staff Form (defaults to Kepala Sekolah)
  const defaultKepsek = allUsersList.find((u) => u.roleKey === 'kepala_sekolah') || DEFAULT_ROLE_USERS.kepala_sekolah;
  const [selectedStaffId, setSelectedStaffId] = useState<string>(defaultKepsek.id || defaultKepsek.email);
  const [staffName, setStaffName] = useState<string>(defaultKepsek.name);
  const [staffNip, setStaffNip] = useState<string>(defaultKepsek.nip || '');
  const [staffRoleKey, setStaffRoleKey] = useState<UserRole>(defaultKepsek.roleKey || 'kepala_sekolah');

  // Login Mode for User Portal: 'staff_form' (Nama, NIP, Jabatan) or 'email_form'
  const [userLoginMode, setUserLoginMode] = useState<'staff_form' | 'email_form'>('staff_form');

  // Email login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register form (optional)
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('guru');
  const [regNip, setRegNip] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedUserLink, setCopiedUserLink] = useState(false);
  const [copiedAdminLink, setCopiedAdminLink] = useState(false);

  // Synchronize URL query parameter when portal changes
  const switchPortal = (newPortal: 'admin' | 'user') => {
    setPortalType(newPortal);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const url = new URL(window.location.href);
      if (newPortal === 'user') {
        url.searchParams.set('portal', 'staf');
      } else {
        url.searchParams.delete('portal');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  const getUserPortalUrl = () => {
    try {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      return `${origin}${pathname}?portal=staf`;
    } catch {
      return '?portal=staf';
    }
  };

  const copyToClipboard = (text: string, isUserLink: boolean) => {
    navigator.clipboard.writeText(text);
    if (isUserLink) {
      setCopiedUserLink(true);
      setTimeout(() => setCopiedUserLink(false), 2500);
    } else {
      setCopiedAdminLink(true);
      setTimeout(() => setCopiedAdminLink(false), 2500);
    }
  };

  // Handle selection of staff from the list
  const handleSelectStaffUser = (userIdOrEmail: string) => {
    setSelectedStaffId(userIdOrEmail);
    const target = allUsersList.find((u) => (u.id === userIdOrEmail || u.email === userIdOrEmail));
    if (target) {
      setStaffName(target.name);
      setStaffNip(target.nip || '');
      setStaffRoleKey(target.roleKey);
    }
  };

  // 1. Submit Login dengan Nama, NIP, dan Jabatan (Termasuk Kepala Sekolah)
  const handleStaffFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Cari user yang cocok berdasarkan id, email, nama, atau roleKey
    const matchedUser = allUsersList.find(
      (u) => 
        (u.id && u.id === selectedStaffId) ||
        (u.name.toLowerCase() === staffName.trim().toLowerCase()) ||
        (u.nip && staffNip && u.nip.replace(/\s+/g, '') === staffNip.replace(/\s+/g, '')) ||
        (u.roleKey === staffRoleKey)
    ) || DEFAULT_ROLE_USERS[staffRoleKey];

    if (matchedUser) {
      loginWithUserProfile(matchedUser);
      onSuccess?.();
    } else {
      loginWithRole(staffRoleKey);
      onSuccess?.();
    }
  };

  // 2. Submit Login dengan Email & Password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Mohon isi email dan kata sandi.');
      return;
    }

    const res = await loginWithEmail(email, password);
    if (res.success) {
      onSuccess?.();
    } else {
      setErrorMsg(res.error || 'Gagal login. Periksa email atau gunakan formulir Nama & NIP di atas.');
    }
  };

  // 3. Submit Register Akun
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!fullName || !regEmail || !regPassword) {
      setErrorMsg('Semua kolom wajib diisi.');
      return;
    }

    const res = await registerWithEmail(regEmail, regPassword, fullName, regRole, regNip);
    if (res.success) {
      setSuccessMsg('Akun berhasil didaftarkan!');
      setTimeout(() => {
        onSuccess?.();
      }, 500);
    } else {
      setErrorMsg(res.error || 'Gagal mendaftar.');
    }
  };

  const handleQuickLoginUser = (user: UserProfile) => {
    loginWithUserProfile(user);
    onSuccess?.();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-900 flex flex-col items-center justify-center p-3 sm:p-6 text-slate-800">
      
      {/* Container Card */}
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-emerald-800/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Branding */}
        <div className={`p-6 sm:p-8 text-white text-center relative overflow-hidden transition-colors duration-300 ${
          portalType === 'admin' 
            ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-emerald-900' 
            : 'bg-gradient-to-br from-emerald-900 via-emerald-850 to-emerald-950'
        }`}>
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <KemensosLogo className="w-48 h-48 text-white" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md p-2 flex items-center justify-center border border-white/20 mb-3 shadow-md">
              <KemensosLogo className="w-12 h-12" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-white/10 rounded-full border border-white/20 text-[10px] text-emerald-200 uppercase tracking-wider font-semibold mb-2">
              <Building2 className="w-3 h-3 text-amber-300" />
              <span>Kementerian Sosial Republik Indonesia</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
              Sekolah Rakyat Terintegerasi 1 Sumedang
            </h2>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wider font-mono mt-1">
              SIBAHAR
            </h1>
            <p className="text-xs text-emerald-100 font-medium italic mt-0.5">
              (Sistem Informasi Berita Aktual Harian)
            </p>

            {/* Portal Badge Banner */}
            <div className="mt-3.5 flex items-center gap-2">
              {portalType === 'admin' ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs shadow-md border border-amber-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-900" />
                  <span>PORTAL KHUSUS ADMINISTRATOR</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500 text-white font-bold text-xs shadow-md border border-emerald-400">
                  <Users className="w-4 h-4 text-white" />
                  <span>PORTAL LOGIN PENGGUNA &amp; STAF</span>
                </div>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-emerald-200 bg-black/25 px-3 py-1 rounded-full border border-white/10">
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                {isSupabaseConnected ? 'Database Supabase PostgreSQL Terhubung' : 'Mode Offline / Siap Supabase Connection'}
              </span>
            </div>
          </div>
        </div>

        {/* Portal Switcher & Share Banner */}
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Portal Aktif:</span>
            <span className="font-bold text-slate-800">
              {portalType === 'admin' ? 'Khusus Administrator (Link Utama)' : 'Khusus Pengguna (Nama, NIP & Jabatan)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {portalType === 'admin' ? (
              <button
                type="button"
                onClick={() => switchPortal('user')}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
              >
                <span>Buka Link Pengguna</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchPortal('admin')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
              >
                <span>Buka Portal Admin</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ======================= PORTAL PENGGUNA & STAF ========================== */}
        {/* ========================================================================= */}
        {portalType === 'user' ? (
          <div className="p-5 sm:p-7 space-y-6">

            {/* Toggle Mode: Masuk dengan Nama, NIP & Jabatan vs Email */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => { setUserLoginMode('staff_form'); setErrorMsg(''); }}
                className={`flex-1 pb-3 text-xs sm:text-sm font-bold text-center border-b-2 transition cursor-pointer ${
                  userLoginMode === 'staff_form'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                1. Masuk dengan Nama, NIP &amp; Jabatan
              </button>
              <button
                type="button"
                onClick={() => { setUserLoginMode('email_form'); setErrorMsg(''); }}
                className={`flex-1 pb-3 text-xs sm:text-sm font-bold text-center border-b-2 transition cursor-pointer ${
                  userLoginMode === 'email_form'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                2. Masuk dengan Email
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* FORM 1: NAMA PENGGUNA, NIP, JABATAN & TOMBOL LOGIN (TERMASUK KEPALA SEKOLAH) */}
            {userLoginMode === 'staff_form' && (
              <form onSubmit={handleStaffFormSubmit} className="space-y-4 text-xs">
                
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-950 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-700" />
                    <span>Halaman Login Pengguna &amp; Kepala Sekolah</span>
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Pilih nama Anda dari daftar kepegawaian atau tentukan Nama, NIP, dan Jabatan Anda di bawah ini, lalu klik tombol <strong>"Masuk ke Aplikasi SIBAHAR"</strong>.
                  </p>
                </div>

                {/* 1. Pilih Akun Pegawai (Otomatis mengisi Nama, NIP, dan Jabatan) */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Pilih Nama Pegawai / Akun Terdaftar <span className="text-emerald-700 font-normal">(Termasuk Kepala Sekolah)</span>
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => handleSelectStaffUser(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-white font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs sm:text-sm"
                  >
                    {operationalUsers.map((u: UserProfile) => {
                      const roleLabel = USER_ROLES[u.roleKey]?.label || u.role;
                      return (
                        <option key={u.id || u.email} value={u.id || u.email}>
                          {u.name} — [{roleLabel}] — NIP: {u.nip || '-'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* 2. Nama Pengguna */}
                  <div>
                    <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Nama Pengguna</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="Contoh: Cece Enjang Kartiwa, S.Pd.,MM"
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs font-semibold text-slate-800 bg-slate-50/50"
                    />
                  </div>

                  {/* 3. NIP Pegawai */}
                  <div>
                    <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span>NIP Pegawai</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={staffNip}
                      onChange={(e) => setStaffNip(e.target.value)}
                      placeholder="Contoh: 19740512 200212 1 003"
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs font-bold text-slate-800 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* 4. Jabatan Pegawai */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span>Jabatan Pegawai / Wewenang SIBAHAR</span>
                  </label>
                  <select
                    value={staffRoleKey}
                    onChange={(e) => setStaffRoleKey(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-emerald-500 text-xs font-semibold text-slate-800"
                  >
                    <option value="kepala_sekolah">1. Kepala Sekolah Rakyat Terintegerasi 1 Sumedang</option>
                    <option value="wali_asrama">2. Wali Asrama</option>
                    <option value="wali_asuh">3. Wali Asuh &amp; Pengasuh Siswa</option>
                    <option value="guru">4. Guru Kelas &amp; Pembina Akademik</option>
                    <option value="keamanan">5. Komandan Regu Tenaga Keamanan</option>
                  </select>
                </div>

                {/* Tombol Login */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Aplikasi SIBAHAR ({USER_ROLES[staffRoleKey]?.label || staffRoleKey})</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </form>
            )}

            {/* FORM 2: EMAIL & PASSWORD LOGIN */}
            {userLoginMode === 'email_form' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Alamat Email Kedinasan
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="kepala.sekolah@srt1sumedang.sch.id"
                      required
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Kata Sandi (Password)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
                >
                  <span>Masuk dengan Email</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* KARTU AKSES CEPAT (TERMASUK KEPALA SEKOLAH) */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                  <span>Pilih Masuk Cepat (5 Role Pengguna &amp; Kepala Sekolah)</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                  1-Klik Masuk
                </span>
              </div>

              {/* Kartu Khusus Kepala Sekolah (Paling Atas & Menonjol) */}
              {(() => {
                const kepsek = allUsersList.find((u) => u.roleKey === 'kepala_sekolah') || DEFAULT_ROLE_USERS.kepala_sekolah;
                return (
                  <button
                    type="button"
                    onClick={() => handleQuickLoginUser(kepsek)}
                    className="w-full p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 hover:bg-emerald-100/90 transition text-left shadow-xs flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs border-2 border-white overflow-hidden text-sm">
                        {kepsek.avatarUrl ? (
                          <img src={kepsek.avatarUrl} alt={kepsek.name} className="w-full h-full object-cover" />
                        ) : (
                          kepsek.avatarInitials
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-700 text-white font-bold rounded text-[10px] uppercase tracking-wider">
                            Kepala Sekolah
                          </span>
                          <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-200/70 px-1.5 py-0.2 rounded">
                            Pengawasan Seluruh Laporan
                          </span>
                        </div>
                        <p className="font-bold text-sm text-slate-900 group-hover:text-emerald-900 transition mt-0.5">
                          {kepsek.name}
                        </p>
                        <p className="text-[11px] text-emerald-950/80 font-mono">
                          NIP: {kepsek.nip} · {kepsek.department}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-800 group-hover:translate-x-1 transition-transform shrink-0">
                      <span>Masuk Kepsek</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })()}

              {/* Kartu Pengguna Lainnya (Wali Asrama, Wali Asuh, Guru, Keamanan) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {operationalUsers.filter((u: UserProfile) => u.roleKey !== 'kepala_sekolah').map((u: UserProfile) => {
                  const roleInfo = USER_ROLES[u.roleKey] || { label: u.role, badgeClass: 'bg-slate-100 text-slate-700' };
                  return (
                    <button
                      key={u.id || u.email}
                      type="button"
                      onClick={() => handleQuickLoginUser(u)}
                      className="p-3 bg-white hover:bg-emerald-50/70 rounded-xl border border-slate-200 hover:border-emerald-400 transition text-left shadow-2xs group flex items-start justify-between cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs border border-slate-200 overflow-hidden mt-0.5">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            u.avatarInitials
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className={`inline-block px-1.5 py-0.2 text-[9.5px] font-bold rounded ${roleInfo.badgeClass}`}>
                            {roleInfo.label}
                          </span>
                          <p className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition truncate mt-0.5">
                            {u.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">
                            NIP: {u.nip || '-'}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition shrink-0 ml-1 mt-1" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Memerlukan akses Administrator SIBAHAR?</span>
              <button
                type="button"
                onClick={() => switchPortal('admin')}
                className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
              >
                Masuk via Portal Admin &rarr;
              </button>
            </div>

          </div>
        ) : (
          /* ========================================================================= */
          /* ========================= PORTAL ADMINISTRATOR ========================== */
          /* ========================================================================= */
          <div className="p-5 sm:p-7 space-y-5">
            
            {/* Share User Link Banner */}
            <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-xs space-y-2">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Tautan Khusus Pengguna / Staf (Nama, NIP &amp; Jabatan)</span>
              </span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Bagikan tautan ini ke seluruh staf dan Kepala Sekolah agar mereka login melalui portal kepegawaian:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getUserPortalUrl()}
                  className="flex-1 font-mono text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-900 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(getUserPortalUrl(), true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shrink-0 transition shadow-xs cursor-pointer"
                >
                  {copiedUserLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUserLink ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Quick Login Admin */}
            {(() => {
              const adminUser = allUsersList.find((u) => u.roleKey === 'admin') || DEFAULT_ROLE_USERS.admin;
              return (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                    Akses Langsung Administrator:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickLoginUser(adminUser)}
                    className="w-full p-3.5 bg-white hover:bg-amber-50/70 rounded-xl border-2 border-amber-300 hover:border-amber-500 transition text-left shadow-2xs group flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-bold flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                        {adminUser.avatarUrl ? (
                          <img src={adminUser.avatarUrl} alt={adminUser.name} className="w-full h-full object-cover" />
                        ) : (
                          adminUser.avatarInitials
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-1.5 py-0.2 text-[10px] font-bold rounded bg-amber-100 text-amber-900 border border-amber-300">
                            Administrator Sistem
                          </span>
                          <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100 px-1.5 py-0.2 rounded">
                            Hak Akses Penuh
                          </span>
                        </div>
                        <p className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 transition mt-0.5">
                          {adminUser.name}
                        </p>
                        <p className="text-[10.5px] text-slate-500 font-mono">
                          {adminUser.email} · NIP: {adminUser.nip}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
                      <span>Masuk Admin</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Email Form for Admin */}
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs pt-2 border-t border-slate-200">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Email Akun Administrator
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@srt1sumedang.sch.id"
                    required
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Kata Sandi (Password)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
              >
                <span>Masuk ke Portal Administrator</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Ingin masuk sebagai Staf / Guru / Wali / Kepsek?</span>
              <button
                type="button"
                onClick={() => switchPortal('user')}
                className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
              >
                Buka Link Pengguna &rarr;
              </button>
            </div>

          </div>
        )}

      </div>

      <div className="mt-6 text-center text-xs text-emerald-200/80 space-y-1">
        <p>SIBAHAR v2.5 · Sekolah Rakyat Terintegerasi 1 Sumedang · Kementerian Sosial RI</p>
        <p className="text-[11px] text-emerald-300/60 font-mono">
          {portalType === 'admin' ? 'Link Admin: Aktif' : 'Link Pengguna: Aktif (?portal=user)'}
        </p>
      </div>

    </div>
  );
};
