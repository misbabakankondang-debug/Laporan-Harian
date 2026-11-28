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

const isDuplicateKeyError = (err: { message?: string; code?: string } | null | undefined): boolean => {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '23505' ||
    msg.includes('duplicate key') ||
    msg.includes('profiles_pkey') ||
    msg.includes('unique constraint')
  );
};

const normalizeComparableText = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

const normalizeComparableRole = (value: unknown): string => {
  const raw = normalizeComparableText(value);
  return raw === 'keamanan' ? 'tenaga_keamanan' : raw;
};

interface ProfileIdentityCheckParams {
  profile: Record<string, any>;
  expectedUserId: string;
  authEmail: string;
  expectedEmail: string;
  expectedName: string;
  expectedRole: string;
}

function validateProfileIdentity(
  params: ProfileIdentityCheckParams
): { ok: true } | { ok: false; error: string } {
  const { profile, expectedUserId, authEmail, expectedEmail, expectedName, expectedRole } = params;

  if (!profile?.id || String(profile.id).trim() !== expectedUserId) {
    return {
      ok: false,
      error: `Identitas profil tidak cocok: profiles.id (${profile?.id || 'kosong'}) berbeda dengan UUID Auth (${expectedUserId}).`,
    };
  }

  const profileEmail = normalizeComparableText(profile.email);
  if (!profileEmail || profileEmail !== authEmail || profileEmail !== expectedEmail) {
    return {
      ok: false,
      error: `Identitas profil tidak cocok: email profil (${profileEmail || 'kosong'}) tidak sesuai dengan email akun Auth (${authEmail}).`,
    };
  }

  const profileName = normalizeComparableText(profile.full_name ?? profile.name);
  if (!profileName || profileName !== normalizeComparableText(expectedName)) {
    return {
      ok: false,
      error: `Identitas profil tidak cocok: nama profil ("${profile.full_name || ''}") tidak sesuai dengan metadata akun ("${expectedName}").`,
    };
  }

  const profileRole = normalizeComparableRole(profile.role);
  if (!profileRole || profileRole !== normalizeComparableRole(expectedRole)) {
    return {
      ok: false,
      error: `Identitas profil tidak cocok: role profil ("${profile.role || ''}") tidak sesuai dengan role akun ("${expectedRole}").`,
    };
  }

  return { ok: true };
}

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
      jabatan,
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

    const normalizedJabatan = typeof jabatan === 'string' ? jabatan.trim().slice(0, 100) : '';
    const normalizedNip = nip ? String(nip).trim() : '-';
    const normalizedPhone = phone ? String(phone).trim() : '';
    const normalizedDepartment = department
      ? String(department).trim()
      : 'Sekolah Rakyat Terintegerasi 1 Sumedang';
    const initials =
      normalizedName
        .split(/\s+/)
        .filter(Boolean)
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'SR';

    try {
      let userId = '';
      let authEmail = normalizedEmail;
      let confirmedEmailAt: string | null = null;

      if (isContinuingProfile) {
        // 4a. Mode "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)":
        // Tidak memanggil createUser / signUp lagi!
        // Pastikan UUID benar-benar milik akun Auth yang sudah ada dan emailnya cocok
        const { data: verifiedAuth, error: verifyErr } =
          await supabaseAdmin.auth.admin.getUserById(requestedAuthId);

        if (verifyErr || !verifiedAuth?.user?.id) {
          return res.status(404).json({
            error: `Akun Auth dengan UUID ${requestedAuthId} tidak ditemukan di Supabase Auth.`,
          });
        }

        const resolvedAuthEmail = normalizeComparableText(verifiedAuth.user.email);
        if (!resolvedAuthEmail || resolvedAuthEmail !== normalizedEmail) {
          return res.status(409).json({
            error: `Email profil (${normalizedEmail}) tidak cocok dengan email akun Supabase Auth (${resolvedAuthEmail || 'kosong'}).`,
            code: 'AUTH_EMAIL_MISMATCH',
          });
        }

        userId = verifiedAuth.user.id;
        authEmail = resolvedAuthEmail;
        confirmedEmailAt = verifiedAuth.user.email_confirmed_at || null;

        // Konfirmasi email otomatis sebelum menyimpan/memverifikasi profil apabila akun Auth belum terkonfirmasi
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
        // 4b. Mode Buat Pengguna Baru:
        // Tolak lebih awal jika profil dengan email tersebut sudah ada di public.profiles
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

        // Buat user di Supabase Auth dengan metadata lengkap untuk trigger handle_new_user()
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: {
            full_name: normalizedName,
            role: normalizedRole,
            ...(normalizedJabatan ? { jabatan: normalizedJabatan } : {}),
            nip: normalizedNip,
            department: normalizedDepartment,
            phone: normalizedPhone,
            avatar_initials: initials,
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
        authEmail = normalizeComparableText(authData.user.email || normalizedEmail);
        confirmedEmailAt = authData.user.email_confirmed_at || null;

        // Pastikan akun baru berstatus email terkonfirmasi sebelum verifikasi/simpan profil
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

      // 5. Periksa apakah profil dengan UUID Auth yang sama sudah tersedia di public.profiles
      // (misalnya otomatis dibuat oleh trigger on_auth_user_created -> handle_new_user())
      const { data: existingProfileById, error: existingByIdErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (existingByIdErr && !isSchemaCacheError(existingByIdErr)) {
        return res.status(500).json({
          error: `Gagal memeriksa profil pada tabel public.profiles: ${existingByIdErr.message}`,
          partialAuthSuccess: true,
          pendingAuthUserId: userId,
        });
      }

      let savedProfile: Record<string, any> | null = null;
      let profileAlreadyExisted = false;

      if (existingProfileById?.id) {
        const identityCheck = validateProfileIdentity({
          profile: existingProfileById,
          expectedUserId: userId,
          authEmail,
          expectedEmail: normalizedEmail,
          expectedName: normalizedName,
          expectedRole: normalizedRole,
        });

        if (!identityCheck.ok) {
          return res.status(409).json({
            error: identityCheck.error,
            code: 'PROFILE_IDENTITY_MISMATCH',
          });
        }

        // Profil sudah dibuat (oleh trigger atau proses sebelumnya) dan identitasnya cocok — jangan INSERT ulang!
        if (
          normalizedJabatan &&
          String(existingProfileById.jabatan || '').trim() !== normalizedJabatan
        ) {
          const { data: updatedTriggerProfile, error: jabatanUpdateErr } = await supabaseAdmin
            .from('profiles')
            .update({
              jabatan: normalizedJabatan,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
            .select('*')
            .maybeSingle();

          if (jabatanUpdateErr) {
            const schemaMismatch = isSchemaCacheError(jabatanUpdateErr);
            return res.status(500).json({
              error: schemaMismatch
                ? `Akun Auth sudah dibuat (UUID: ${userId}), namun gagal menyimpan jabatan "${normalizedJabatan}" karena kolom jabatan belum tersedia di tabel profiles. Jalankan migrasi SQL terlebih dahulu.`
                : `Akun Auth sudah dibuat (UUID: ${userId}), namun gagal menyimpan jabatan pada tabel profiles: ${jabatanUpdateErr.message}`,
              partialAuthSuccess: true,
              pendingAuthUserId: userId,
              schemaMismatch,
              code: schemaMismatch ? 'PROFILES_SCHEMA_MISMATCH' : 'PROFILES_SAVE_FAILED',
            });
          }

          savedProfile = updatedTriggerProfile || {
            ...existingProfileById,
            jabatan: normalizedJabatan,
          };
        } else {
          savedProfile = existingProfileById;
        }
        profileAlreadyExisted = true;
      } else {
        // Pastikan email belum dipakai oleh profil dengan UUID berbeda sebelum melakukan INSERT
        const { data: conflictByEmail, error: conflictByEmailErr } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (conflictByEmailErr && !isSchemaCacheError(conflictByEmailErr)) {
          return res.status(500).json({
            error: `Gagal memeriksa konflik email pada tabel profiles: ${conflictByEmailErr.message}`,
            partialAuthSuccess: true,
            pendingAuthUserId: userId,
          });
        }

        if (conflictByEmail?.id && conflictByEmail.id !== userId) {
          return res.status(409).json({
            error: `Email ${normalizedEmail} sudah terdaftar pada profil lain dengan UUID berbeda (${conflictByEmail.id}).`,
            code: 'PROFILE_EMAIL_CONFLICT',
          });
        }

        const profileRow: Record<string, any> = {
          id: userId,
          full_name: normalizedName,
          email: normalizedEmail,
          role: normalizedRole,
          ...(normalizedJabatan ? { jabatan: normalizedJabatan } : {}),
          nip: normalizedNip,
          phone: normalizedPhone,
          department: normalizedDepartment,
          avatar_initials: initials,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        // 6. Jika profil belum tersedia, simpan ke public.profiles via service-role client
        const { data: insertedProfile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert(profileRow)
          .select('*')
          .single();

        if (profileError) {
          // Penanganan race condition jika trigger baru saja menyisipkan baris tepat sebelum INSERT backend
          if (isDuplicateKeyError(profileError)) {
            const { data: racedProfile, error: racedErr } = await supabaseAdmin
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();

            if (!racedErr && racedProfile?.id) {
              const identityCheck = validateProfileIdentity({
                profile: racedProfile,
                expectedUserId: userId,
                authEmail,
                expectedEmail: normalizedEmail,
                expectedName: normalizedName,
                expectedRole: normalizedRole,
              });

              if (!identityCheck.ok) {
                return res.status(409).json({
                  error: identityCheck.error,
                  code: 'PROFILE_IDENTITY_MISMATCH',
                });
              }

              savedProfile = racedProfile;
              profileAlreadyExisted = true;
            }
          }

          if (!savedProfile) {
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
        } else {
          savedProfile = insertedProfile || profileRow;
        }
      }

      // 7. Catat ke audit_logs secara non-blokir
      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: callerAuth.user.id,
          user_role: 'admin',
          action: isContinuingProfile ? 'ADMIN_CONTINUE_SAVE_PROFILE' : 'ADMIN_CREATE_USER',
          entity_type: 'profiles',
          entity_id: userId,
          details: {
            email: normalizedEmail,
            role: normalizedRole,
            ...(normalizedJabatan ? { jabatan: normalizedJabatan } : {}),
            fullName: normalizedName,
            profileSource: profileAlreadyExisted ? 'existing_verified' : 'backend_inserted',
          },
          created_at: new Date().toISOString(),
        });
      } catch {}

      return res.status(200).json({
        success: true,
        emailConfirmed: Boolean(confirmedEmailAt),
        emailConfirmedAt: confirmedEmailAt,
        profileAlreadyExisted,
        message: isContinuingProfile
          ? profileAlreadyExisted
            ? `Email akun terkonfirmasi dan profil yang sudah tersedia untuk ${normalizedName} (${normalizedRole}) terverifikasi valid (UUID Auth ${userId}).`
            : `Email akun terkonfirmasi dan profil untuk ${normalizedName} (${normalizedRole}) berhasil disimpan dengan UUID Auth ${userId}.`
          : profileAlreadyExisted
          ? `Akun ${normalizedName} (${normalizedRole}) berhasil dibuat, terkonfirmasi, dan profil otomatis dari trigger database telah terverifikasi.`
          : `Akun dan profil untuk ${normalizedName} (${normalizedRole}) berhasil dibuat, terkonfirmasi, dan disimpan.`,
        user: savedProfile,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err?.message || 'Terjadi kesalahan internal pada server.' });
    }
  };
}

export default createAdminCreateUserHandler();
