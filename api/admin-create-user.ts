// Vercel Serverless Function: Operasi Administrasi Pembuatan Akun Pengguna oleh Admin
// Path: /api/admin-create-user
import type { Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ALLOWED_ROLES = new Set([
  'admin',
  'wali_asrama',
  'wali_asuh',
  'guru',
  'tenaga_keamanan',
  'kepala_sekolah',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode HTTP tidak diizinkan. Gunakan POST.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error:
        'Konfigurasi backend belum lengkap: SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_URL belum diatur di Vercel Environment Variables.',
    });
  }

  // Buat Supabase Admin Client menggunakan Service Role Key (hanya berjalan di sisi server)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verifikasi sesi & kewenangan Administrator dari header Authorization: Bearer <jwt>
  const authHeader = req.headers.authorization || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = bearerMatch ? bearerMatch[1].trim() : '';

  if (!accessToken) {
    return res.status(401).json({
      error:
        'Sesi login Supabase tidak ditemukan. Silakan login menggunakan akun Administrator Supabase terlebih dahulu.',
    });
  }

  const { data: callerAuth, error: callerAuthErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerAuthErr || !callerAuth?.user) {
    return res.status(401).json({
      error: 'Token sesi Administrator tidak valid atau kedaluwarsa. Silakan login ulang.',
    });
  }

  let callerProfile: { id: string; role: string; is_active?: boolean } | null = null;
  let callerProfileErr: any = null;

  const fullCallerRes = await supabaseAdmin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', callerAuth.user.id)
    .maybeSingle();

  if (fullCallerRes.error && isSchemaCacheError(fullCallerRes.error)) {
    const fallbackCallerRes = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', callerAuth.user.id)
      .maybeSingle();
    callerProfile = fallbackCallerRes.data
      ? { ...fallbackCallerRes.data, is_active: true }
      : null;
    callerProfileErr = fallbackCallerRes.error;
  } else {
    callerProfile = fullCallerRes.data;
    callerProfileErr = fullCallerRes.error;
  }

  if (
    callerProfileErr ||
    !callerProfile ||
    callerProfile.role !== 'admin' ||
    callerProfile.is_active === false
  ) {
    return res.status(403).json({
      error: 'Akses ditolak: Hanya akun Administrator aktif yang berwenang menambah pengguna baru.',
    });
  }

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
  } = req.body || {};

  const isContinuingProfile = Boolean(continueProfileOnly && existingAuthUserId);

  if (!email || !fullName || !role || (!isContinuingProfile && !password)) {
    return res.status(400).json({
      error: isContinuingProfile
        ? 'Data tidak lengkap. Email, nama lengkap, role, dan UUID Auth wajib diisi.'
        : 'Data tidak lengkap. Email, password, nama lengkap, dan role wajib diisi.',
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(fullName).trim();
  const normalizedRole =
    String(role).trim() === 'keamanan' ? 'tenaga_keamanan' : String(role).trim();

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

  if (isContinuingProfile && !UUID_REGEX.test(String(existingAuthUserId).trim())) {
    return res.status(400).json({
      error: 'Format existingAuthUserId tidak valid (harus UUID).',
    });
  }

  try {
    // Cek duplikasi email di tabel profiles agar tidak menimpa pengguna lain
    const { data: existingProfile, error: existingProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfileErr && !isSchemaCacheError(existingProfileErr)) {
      return res.status(500).json({
        error: `Gagal memeriksa tabel profiles: ${existingProfileErr.message}`,
      });
    }

    if (
      existingProfile &&
      !(isContinuingProfile && existingProfile.id === String(existingAuthUserId).trim())
    ) {
      return res.status(409).json({
        error: `Email ${normalizedEmail} sudah terdaftar di Auth dan tabel profiles.`,
      });
    }

    let userId = '';

    if (isContinuingProfile) {
      // Lanjutkan penyimpanan profil tanpa membuat akun Auth baru
      const requestedId = String(existingAuthUserId).trim();
      const { data: verifiedAuth, error: verifyErr } =
        await supabaseAdmin.auth.admin.getUserById(requestedId);

      if (verifyErr || !verifiedAuth?.user) {
        return res.status(404).json({
          error: `Akun Auth dengan UUID ${requestedId} tidak ditemukan di Supabase Auth.`,
        });
      }

      const authEmail = (verifiedAuth.user.email || '').trim().toLowerCase();
      if (authEmail && authEmail !== normalizedEmail) {
        return res.status(409).json({
          error: `Email ${normalizedEmail} tidak cocok dengan akun Auth (${authEmail}).`,
        });
      }

      userId = verifiedAuth.user.id;
    } else {
      // Cek terlebih dahulu di auth.users agar tidak membuat akun Auth ganda
      const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
      if (existingAuthUser) {
        return res.status(409).json({
          error: `Akun Auth untuk ${normalizedEmail} sudah dibuat sebelumnya (UUID: ${existingAuthUser.id}), namun belum tersimpan di tabel profiles. Gunakan tombol "Lanjutkan Simpan Profil" tanpa membuat Auth baru.`,
          partialAuthSuccess: true,
          pendingAuthUserId: existingAuthUser.id,
          code: 'AUTH_EXISTS_PROFILE_MISSING',
        });
      }

      // 1. Buat user di Supabase Auth (hanya satu kali)
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

      if (authError || !authData.user) {
        const lowerAuthErr = String(authError?.message || '').toLowerCase();
        if (
          lowerAuthErr.includes('already') ||
          lowerAuthErr.includes('registered') ||
          lowerAuthErr.includes('exists')
        ) {
          const recovered = await findAuthUserByEmail(supabaseAdmin, normalizedEmail);
          if (recovered) {
            return res.status(409).json({
              error: `Akun Auth untuk ${normalizedEmail} sudah terdaftar di Supabase Auth (UUID: ${recovered.id}), namun belum tersimpan di tabel profiles. Gunakan tombol "Lanjutkan Simpan Profil" tanpa membuat Auth baru.`,
              partialAuthSuccess: true,
              pendingAuthUserId: recovered.id,
              code: 'AUTH_EXISTS_PROFILE_MISSING',
            });
          }
        }
        return res
          .status(400)
          .json({ error: authError?.message || 'Gagal membuat pengguna di auth.users' });
      }

      userId = authData.user.id;
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

    // 2. Simpan data ke public.profiles menggunakan UUID unik dari auth.users
    const { data: savedProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' })
      .select('*')
      .single();

    if (profileError) {
      const schemaMismatch = isSchemaCacheError(profileError);
      // Pertahankan akun Auth agar Admin dapat melanjutkan penyimpanan profil setelah migrasi SQL tanpa membuat Auth ganda
      return res.status(500).json({
        error: schemaMismatch
          ? `Akun Auth dibuat, namun gagal menyimpan ke tabel profiles: ${profileError.message}. Jalankan SQL migrasi kolom public.profiles & NOTIFY pgrst, 'reload schema' di Supabase SQL Editor, lalu klik "Lanjutkan Simpan Profil".`
          : `Akun Auth dibuat, namun gagal menyimpan ke tabel profiles: ${profileError.message}`,
        partialAuthSuccess: true,
        pendingAuthUserId: userId,
        schemaMismatch,
        code: schemaMismatch ? 'PROFILES_SCHEMA_MISMATCH' : 'PROFILES_SAVE_FAILED',
      });
    }

    // 3. Catat ke audit_logs secara non-blokir
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: callerAuth.user.id,
        user_role: 'admin',
        action: isContinuingProfile ? 'ADMIN_REPAIR_USER_PROFILE' : 'ADMIN_CREATE_USER',
        entity_type: 'profiles',
        entity_id: userId,
        details: { email: normalizedEmail, role: normalizedRole, fullName: normalizedName },
        created_at: new Date().toISOString(),
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Akun untuk ${normalizedName} (${normalizedRole}) berhasil disimpan.`,
      user: savedProfile || profileRow,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message || 'Terjadi kesalahan internal pada server' });
  }
}
