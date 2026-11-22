import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Database,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KemensosLogo } from './KemensosLogo';

interface AuthViewProps {
  onSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const {
    loginWithEmail,
    isLoading,
    authError,
    clearAuthError,
    supabaseStatus,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLocalError('');
  }, []);

  const displayedError = localError || authError || '';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearAuthError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Mohon masukkan alamat email dan kata sandi akun SIBAHAR Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithEmail(trimmedEmail, password);
      if (res.success) {
        onSuccess?.();
      } else {
        setLocalError(res.error || 'Email atau kata sandi tidak valid.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || isLoading;

  const isGatewayReady =
    supabaseStatus.state === 'connected' || supabaseStatus.state === 'auth_required';
  const isPartial =
    supabaseStatus.state === 'needs_schema' || supabaseStatus.state === 'permission_error';

  const statusPillLabel =
    supabaseStatus.state === 'connected'
      ? 'Supabase Terhubung'
      : supabaseStatus.state === 'auth_required'
      ? 'Gateway Supabase Aktif (Silakan Login)'
      : supabaseStatus.state === 'needs_schema'
      ? 'Gateway Aktif - Skema Database Belum Siap'
      : supabaseStatus.state === 'permission_error'
      ? 'Gateway Aktif - Izin Database Terbatas'
      : supabaseStatus.state === 'auth_error'
      ? 'Autentikasi Supabase Ditolak'
      : supabaseStatus.state === 'network_error'
      ? 'Tidak Dapat Menjangkau Supabase'
      : supabaseStatus.state === 'not_configured'
      ? 'Konfigurasi Supabase Belum Tersedia'
      : 'Memeriksa Koneksi Supabase...';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-900 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-800/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Institutional Header */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-emerald-950 to-emerald-900 text-white text-center relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <KemensosLogo className="w-44 h-44 text-white" />
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md p-2 flex items-center justify-center border border-white/20 mb-3 shadow-md">
              <KemensosLogo className="w-12 h-12" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-white/10 rounded-full border border-white/20 text-[10px] text-emerald-200 uppercase tracking-wider font-semibold mb-2">
              <Building2 className="w-3 h-3 text-amber-300" />
              <span>Kementerian Sosial Republik Indonesia</span>
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight">
              Sekolah Rakyat Terintegerasi 1 Sumedang
            </h2>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wider font-mono mt-1">
              SIBAHAR
            </h1>
            <p className="text-xs text-emerald-100 font-semibold tracking-wide mt-0.5 uppercase">
              SISTEM INFORMASI BERITA AKTUAL HARIAN
            </p>

            <div
              className={`mt-3.5 inline-flex items-center gap-2 text-[10.5px] px-3 py-1 rounded-full border ${
                isGatewayReady
                  ? 'text-emerald-200 bg-black/25 border-white/15'
                  : isPartial
                  ? 'text-amber-200 bg-amber-950/60 border-amber-400/30'
                  : 'text-rose-200 bg-rose-950/60 border-rose-400/30'
              }`}
            >
              <Database
                className={`w-3.5 h-3.5 shrink-0 ${
                  isGatewayReady
                    ? 'text-emerald-300'
                    : isPartial
                    ? 'text-amber-300'
                    : 'text-rose-300'
                }`}
              />
              <span className="truncate max-w-xs" title={supabaseStatus.message}>
                {statusPillLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Login Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3 className="text-sm font-bold tracking-tight">Masuk ke Akun SIBAHAR</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Masukkan email dan kata sandi resmi Anda yang terdaftar pada Supabase Auth.
            </p>
          </div>

          {displayedError && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed font-medium">{displayedError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="sibahar-login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="sibahar-login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (localError) setLocalError('');
                    if (authError) clearAuthError();
                  }}
                  placeholder="nama@srt1sumedang.sch.id"
                  required
                  disabled={busy}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sibahar-login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="sibahar-login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localError) setLocalError('');
                    if (authError) clearAuthError();
                  }}
                  placeholder="Masukkan kata sandi"
                  required
                  disabled={busy}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={busy}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg focus:outline-hidden cursor-pointer"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed text-center">
            Akun pengguna SIBAHAR dikelola oleh Administrator. Hubungi Administrator apabila akun belum aktif atau lupa kata sandi.
          </div>
        </div>
      </div>

      <div className="mt-6 px-4 text-center text-xs text-emerald-200/80 space-y-1">
        <p>SIBAHAR · Sistem Informasi Berita Aktual Harian · Sekolah Rakyat Terintegerasi 1 Sumedang · Kementerian Sosial RI</p>
      </div>
    </div>
  );
};
