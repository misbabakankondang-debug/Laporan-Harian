// Vercel Serverless Function: Pembuatan Akun Pengguna & Penyimpanan Profil oleh Administrator
// Path: /api/admin-create-user
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: any) => any;
}

const ALLOWED_ROLES = new Set([
  'admin',
  'wali_asrama',
  'wali_asuh',
  'guru',
  'tenaga_keamanan',
  'kepala_sekolah',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isSchemaCacheError = (err: { message?: string; code?: string } | null | undefined): boolean => {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes('schema cache') ||
    msg.includes('could not find the') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
};

async function findAuthUserByEmail(
  supabaseAdmin: SupabaseClient,
  targetEmail: string
): Promise<{ id: string; email?: string } | null> {
  const normalized = targetEmail.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) break;
    const found = data.users.find(
      (u) => (u.email || '').trim().toLowerCase() === normalized
    );
    if (found) {
      return { id: found.id, email: found.email };
    }
    if (data.users.length < perPage) break;
  }
  return null;
}

function extractBearerToken(headers: ApiRequest['headers']): string {
  const raw = headers?.authorization ?? headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export interface AdminCreateUserDependencies {
  createServiceClient?: (url: string, serviceRoleKey: string) => SupabaseClient;
  getEnv?: () => { supabaseUrl?: string; serviceRoleKey?: string };
}

export function createAdminCreateUserHandler(deps: AdminCreateUserDependencies = {}) {
  const getServiceClient = deps.createServiceClient ?? ((url: string, key: string) =>
    createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  );

  const getEnv = deps.getEnv ?? (() => ({
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }));

  return async function handler(req: ApiRequest, res: ApiResponse) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Metode HTTP tidak diizinkan. Gunakan POST.' });
    }

    const { supabaseUrl, serviceRoleKey } = getEnv();
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error:
          'Konfigurasi backend belum lengkap: SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_URL belum diatur di Vercel Environment Variables.',
      });
    }

    // Client dengan Service Role Key hanya berjalan di sisi server Vercel
    const supabaseAdmin = getServiceClient(supabaseUrl, serviceRoleKey);

    // 1. Wajib verifikasi Bearer JWT pengguna pemohon
    const accessToken = extractBearerToken(req.headers);
    if (!accessToken) {
      return res.status(401).json({
        error:
          'Sesi login Supabase tidak ditemukan. Silakan login menggunakan akun Administrator Supabase terlebih dahulu.',
      });
    }

    const { data: callerAuth, error: callerAuthErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerAuthErr || !callerAuth?.user?.id) {
      return res.status(401).json({
        error: 'Token sesi Administrator tidak valid atau kedaluwarsa. Silakan login ulang.',
      });
    }

    // 2. Wajib periksa public.profiles: role = 'admin' dan is_active = true
    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', callerAuth.user.id)
      .maybeSingle();

    if (
      callerProfileErr ||
      !callerProfile ||
      callerProfile.role !== 'admin' ||
      callerProfile.is_active !== true
    ) {
      return res.status(403).json({
        error:
          'Akses ditolak: Hanya akun Administrator aktif (role = admin, is_active = true) yang berwenang menambah atau menyimpan profil pengguna.',
      });
    }

    // 3. Validasi input payload
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const {
      email,
      password,
      fullName,
      role,
      nip,
      department,
      phone,
      existingAuthUserId,
      continueProfileOnly,
    } = body;

    const isContinuingProfile = Boolean(continueProfileOnly);

    if (isContinuingProfile && !existingAuthUserId) {
      return res.status(400).json({
        error: 'UUID akun Auth (existingAuthUserId) wajib disertakan untuk melanjutkan simpan profil.',
      });
    }

    if (!email || !fullName || !role || (!isContinuingProfile && !password)) {
      return res.status(400).json({
        error: isContinuingProfile
          ? 'Data tidak lengkap. Email, nama lengkap, role, dan UUID Auth wajib diisi.'
          : 'Data tidak lengkap. Email, password, nama lengkap, dan role wajib diisi.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(fullName).trim();
    const rawRole = String(role).trim().toLowerCase();
    const normalizedRole = rawRole === 'keamanan' ? 'tenaga_keamanan' : rawRole;

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        error: 'Format alamat email tidak valid.',
      });
    }

    if (!normalizedName) {
      return res.status(400).json({
        error: 'Nama lengkap wajib diisi.',
      });
    }

    if (!ALLOWED_ROLES.has(normalizedRole)) {
      return res.status(400).json({
        error: `Jabatan/role "${normalizedRole}" tidak valid.`,
      });
    }

    if (!isContinuingProfile && String(password).length < 6) {
      return res.status(400).json({
        error: 'Kata sandi minimal 6 karakter.',
      });
    }

    const requestedAuthId = existingAuthUserId ? String(existingAuthUserId).trim() : '';
    if (isContinuingProfile && !UUID_REGEX.test(requestedAuthId)) {
      return res.status(400).json({
        error: 'Format existingAuthUserId tidak valid (harus UUID).',
      });
    }

    try {
      // 4. Tolak jika profil sudah ada di public.profiles (berdasarkan email atau UUID) agar tidak terjadi duplikasi
      const { data: existingByEmail, error: existingByEmailErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingByEmailErr && !isSchemaCacheError(existingByEmailErr)) {
        return res.status(500).json({
          error: `Gagal memeriksa tabel profiles: ${existingByEmailErr.message}`,
        });
      }

      if (existingByEmail?.id) {
        return res.status(409).json({
          error: `Profil untuk email ${normalizedEmail} sudah terdaftar di tabel public.profiles (ID: ${existingByEmail.id}). Penyimpanan ditolak untuk mencegah duplikasi.`,
          code: 'PROFILE_ALREADY_EXISTS',
        });
      }

      let userId = '';
      let confirmedEmailAt: string | null = null;

      if (isContinuingProfile) {
        // 5a. Mode "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)":
        // Tidak memanggil createUser / signUp lagi!
        const { data: existingById, error: existingByIdErr } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('id', requestedAuthId)
          .maybeSingle();

        if (existingByIdErr && !isSchemaCacheError(existingByIdErr)) {
          return res.status(500).json({
            error: `Gagal memeriksa UUID pada tabel profiles: ${existingByIdErr.message}`,
          });
        }

        if (existingById?.id) {
          return res.status(409).json({
            error: `Profil untuk UUID Auth ${requestedAuthId} sudah tersimpan di tabel public.profiles. Penyimpanan ditolak untuk mencegah duplikasi.`,
            code: 'PROFILE_ALREADY_EXISTS',
          });
        }

        // Pastikan UUID benar-benar milik akun Auth yang sudah ada dan emailnya cocok
        const { data: verifiedAuth, error: verifyErr } =
          await supabaseAdmin.auth.admin.getUserById(requestedAuthId);

        if (verifyErr || !verifiedAuth?.user?.id) {
          return res.status(404).json({
            error: `Akun Auth dengan UUID ${requestedAuthId} tidak ditemukan di Supabase Auth.`,
          });
        }

        const authEmail = (verifiedAuth.user.email || '').trim().toLowerCase();
        if (!authEmail || authEmail !== normalizedEmail) {
          return res.status(409).json({
            error: `Email profil (${normalizedEmail}) tidak cocok dengan email akun Supabase Auth (${authEmail || 'kosong'}).`,
          });
        }

        userId = verifiedAuth.user.id;
        confirmedEmailAt = verifiedAuth.user.email_confirmed_at || null;

        // Konfirmasi email otomatis sebelum menyimpan profil apabila akun Auth belum terkonfirmasi
        if (!confirmedEmailAt) {
          const { data: confirmedAuth, error: confirmErr } =
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              email_confirm: true,
            });

          if (confirmErr || !confirmedAuth?.user?.email_confirmed_at) {
            return res.status(500).json({
              error: `Akun Auth ditemukan (UUID: ${userId}), namun gagal mengonfirmasi email secara otomatis: ${confirmErr?.message || 'email_confirmed_at masih kosong'}.`,
              partialAuthSuccess: true,
              pendingAuthUserId: userId,
              code: 'AUTH_EMAIL_CONFIRM_FAILED',
            });
          }

          confirmedEmailAt = confirmedAuth.user.email_confirmed_at;
        }
      } else {
        // 5b. Mode Buat Pengguna Baru:
        // Cek terlebih dahulu di Supabase Auth agar tidak membuat akun Auth ganda
        const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
        if (existingAuthUser) {
          const { data: profileByAuthId } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', existingAuthUser.id)
            .maybeSingle();

          if (profileByAuthId?.id) {
            return res.status(409).json({
              error: `Pengguna ${normalizedEmail} sudah terdaftar lengkap di Supabase Auth dan tabel public.profiles.`,
              code: 'PROFILE_ALREADY_EXISTS',
            });
          }

          return res.status(409).json({
            error: `Akun Auth untuk ${normalizedEmail} sudah dibuat sebelumnya (UUID: ${existingAuthUser.id}), namun belum tersimpan di tabel profiles. Gunakan tombol "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)".`,
            partialAuthSuccess: true,
            pendingAuthUserId: existingAuthUser.id,
            code: 'AUTH_EXISTS_PROFILE_MISSING',
          });
        }

        // Buat user di Supabase Auth (hanya satu kali)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: {
            full_name: normalizedName,
            role: normalizedRole,
            nip: nip ? String(nip).trim() : '-',
            department: department
              ? String(department).trim()
              : 'Sekolah Rakyat Terintegerasi 1 Sumedang',
          },
        });

        if (authError || !authData?.user?.id) {
          const lowerAuthErr = String(authError?.message || '').toLowerCase();
          if (
            lowerAuthErr.includes('already') ||
            lowerAuthErr.includes('registered') ||
            lowerAuthErr.includes('exists')
          ) {
            const recovered = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
            if (recovered) {
              return res.status(409).json({
                error: `Akun Auth untuk ${normalizedEmail} sudah terdaftar di Supabase Auth (UUID: ${recovered.id}), namun belum tersimpan di tabel profiles. Gunakan tombol "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)".`,
                partialAuthSuccess: true,
                pendingAuthUserId: recovered.id,
                code: 'AUTH_EXISTS_PROFILE_MISSING',
              });
            }
          }
          return res
            .status(400)
            .json({ error: authError?.message || 'Gagal membuat pengguna di Supabase Auth.' });
        }

        userId = authData.user.id;
        confirmedEmailAt = authData.user.email_confirmed_at || null;

        // Pastikan akun baru berstatus email terkonfirmasi sebelum menyimpan profil
        if (!confirmedEmailAt) {
          const { data: confirmedAuth, error: confirmErr } =
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              email_confirm: true,
            });

          if (confirmErr || !confirmedAuth?.user?.email_confirmed_at) {
            return res.status(500).json({
              error: `Akun Auth sudah dibuat (UUID: ${userId}), namun gagal mengonfirmasi email secara otomatis: ${confirmErr?.message || 'email_confirmed_at masih kosong'}. Klik "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)" untuk mencoba ulang konfirmasi dan simpan profil.`,
              partialAuthSuccess: true,
              pendingAuthUserId: userId,
              code: 'AUTH_EMAIL_CONFIRM_FAILED',
            });
          }

          confirmedEmailAt = confirmedAuth.user.email_confirmed_at;
        }
      }

      const initials =
        normalizedName
          .split(/\s+/)
          .filter(Boolean)
          .map((part: string) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'SR';

      const profileRow = {
        id: userId,
        full_name: normalizedName,
        email: normalizedEmail,
        role: normalizedRole,
        nip: nip ? String(nip).trim() : '-',
        phone: phone ? String(phone).trim() : '',
        department: department
          ? String(department).trim()
          : 'Sekolah Rakyat Terintegerasi 1 Sumedang',
        avatar_initials: initials,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      // 6. Simpan profil ke public.profiles menggunakan service-role client (INSERT ketat dengan UUID Auth yang sama)
      const { data: savedProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert(profileRow)
        .select('*')
        .single();

      if (profileError) {
        const schemaMismatch = isSchemaCacheError(profileError);
        // Pertahankan UUID Auth agar Admin dapat mencoba ulang via "Lanjutkan Simpan Profil" tanpa membuat akun Auth ganda
        return res.status(500).json({
          error: schemaMismatch
            ? `Akun Auth sudah dibuat (UUID: ${userId}), namun gagal menyimpan ke tabel profiles karena skema database belum lengkap: ${profileError.message}. Klik "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)" setelah skema diperbarui.`
            : `Akun Auth sudah dibuat (UUID: ${userId}), namun gagal menyimpan ke tabel profiles: ${profileError.message}. Anda dapat mencoba ulang menggunakan tombol "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)".`,
          partialAuthSuccess: true,
          pendingAuthUserId: userId,
          schemaMismatch,
          code: schemaMismatch ? 'PROFILES_SCHEMA_MISMATCH' : 'PROFILES_SAVE_FAILED',
        });
      }

      // 7. Catat ke audit_logs secara non-blokir
      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: callerAuth.user.id,
          user_role: 'admin',
          action: isContinuingProfile ? 'ADMIN_CONTINUE_SAVE_PROFILE' : 'ADMIN_CREATE_USER',
          entity_type: 'profiles',
          entity_id: userId,
          details: { email: normalizedEmail, role: normalizedRole, fullName: normalizedName },
          created_at: new Date().toISOString(),
        });
      } catch {}

      return res.status(200).json({
        success: true,
        emailConfirmed: Boolean(confirmedEmailAt),
        emailConfirmedAt: confirmedEmailAt,
        message: isContinuingProfile
          ? `Email akun terkonfirmasi dan profil untuk ${normalizedName} (${normalizedRole}) berhasil disimpan dengan UUID Auth ${userId}.`
          : `Akun dan profil untuk ${normalizedName} (${normalizedRole}) berhasil dibuat, terkonfirmasi, dan disimpan.`,
        user: savedProfile || profileRow,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err?.message || 'Terjadi kesalahan internal pada server.' });
    }
  };
}

export default createAdminCreateUserHandler();
