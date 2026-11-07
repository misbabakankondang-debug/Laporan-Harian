import React, { useState } from 'react';
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
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole, USER_ROLES } from '../types/report';
import { DEFAULT_ROLE_USERS } from '../data/initialData';
import { KemensosLogo } from './KemensosLogo';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { loginWithRole, loginWithEmail, registerWithEmail, isLoading, isSupabaseConnected } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register form
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('guru');
  const [regNip, setRegNip] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      setErrorMsg(res.error || 'Gagal login. Periksa email atau gunakan akun cepat.');
    }
  };

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

  const handleQuickRoleSelect = (role: UserRole) => {
    loginWithRole(role);
    onSuccess?.();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-800">
      
      {/* Container Card */}
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-emerald-800/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Branding */}
        <div className="bg-emerald-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-15 pointer-events-none">
            <KemensosLogo className="w-48 h-48 text-white" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md p-2 flex items-center justify-center border border-white/20 mb-3 shadow-md">
              <KemensosLogo className="w-12 h-12" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-emerald-800/80 rounded-full border border-emerald-700 text-[10px] text-emerald-200 uppercase tracking-wider font-semibold mb-2">
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

            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-200 bg-white/10 px-3 py-1 rounded-full border border-white/15">
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                {isSupabaseConnected ? 'Database Supabase PostgreSQL Terhubung' : 'Mode Offline / Siap Supabase Connection'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Role Switcher (Simulasi 6 Role Pengguna) */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
              <KeyRound className="w-4 h-4 text-emerald-700" />
              <span>Pilih Masuk Cepat (6 Hak Akses Role RBAC)</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
              1-Klik Akses
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(DEFAULT_ROLE_USERS) as UserRole[]).map((r) => {
              const u = DEFAULT_ROLE_USERS[r];
              const roleInfo = USER_ROLES[r];
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleQuickRoleSelect(r)}
                  className="p-2.5 bg-white hover:bg-emerald-50 rounded-xl border border-slate-200 hover:border-emerald-400 transition text-left shadow-2xs group flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <span className={`inline-block px-1.5 py-0.2 text-[9.5px] font-bold rounded ${roleInfo.badgeClass}`}>
                      {roleInfo.label}
                    </span>
                    <p className="font-semibold text-xs text-slate-900 group-hover:text-emerald-700 transition truncate mt-1">
                      {u.name.split(',')[0]}
                    </p>
                  </div>
                  <span className="text-[9.5px] text-slate-400 font-mono mt-1 block truncate">
                    {u.email}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Toggle: Login / Register */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => { setTab('login'); setErrorMsg(''); }}
              className={`flex-1 pb-3 text-xs sm:text-sm font-bold text-center border-b-2 transition cursor-pointer ${
                tab === 'login'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Masuk dengan Email &amp; Password
            </button>
            <button
              onClick={() => { setTab('register'); setErrorMsg(''); }}
              className={`flex-1 pb-3 text-xs sm:text-sm font-bold text-center border-b-2 transition cursor-pointer ${
                tab === 'register'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Login */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Alamat Email Akun
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@srt1sumedang.sch.id"
                    required
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs"
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
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Memproses...' : 'Masuk ke Aplikasi SIBAHAR'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Form Register */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Nama Lengkap &amp; Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, S.Pd"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Jenis Hak Akses (Role) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:border-emerald-500 text-xs font-medium"
                  >
                    <option value="wali_asrama">1. Wali Asrama</option>
                    <option value="wali_asuh">2. Wali Asuh</option>
                    <option value="guru">3. Guru</option>
                    <option value="keamanan">4. Tenaga Keamanan</option>
                    <option value="admin">5. Admin</option>
                    <option value="kepala_sekolah">6. Kepala Sekolah</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    NIP Pegawai
                  </label>
                  <input
                    type="text"
                    value={regNip}
                    onChange={(e) => setRegNip(e.target.value)}
                    placeholder="Contoh: 19850610..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Alamat Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="email@srt1sumedang.sch.id"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Kata Sandi (Minimal 6 karakter) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:border-emerald-500 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Mendaftarkan...' : 'Daftarkan Akun & Masuk'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

        </div>

      </div>

      <div className="mt-6 text-center text-xs text-emerald-200/80">
        SIBAHAR v2.5 · Sekolah Rakyat Terintegerasi 1 Sumedang · Kementerian Sosial RI
      </div>

    </div>
  );
};
