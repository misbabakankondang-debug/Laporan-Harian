// Vercel Serverless Function: Operasi Administrasi Pembuatan Akun Pengguna oleh Admin
// Path: /api/admin-create-user
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ROLES = new Set([
  'admin',
  'wali_asrama',
  'wali_asuh',
  'guru',
  'tenaga_keamanan',
  'kepala_sekolah',
]);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode HTTP tidak diizinkan. Gunakan POST.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ 
      error: 'Konfigurasi backend belum lengkap: SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_URL belum diatur di Vercel Environment Variables.' 
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
      error: 'Sesi login Supabase tidak ditemukan. Silakan login menggunakan akun Administrator Supabase terlebih dahulu.',
    });
  }

  const { data: callerAuth, error: callerAuthErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerAuthErr || !callerAuth?.user) {
    return res.status(401).json({
      error: 'Token sesi Administrator tidak valid atau kedaluwarsa. Silakan login ulang.',
    });
  }

  const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', callerAuth.user.id)
    .maybeSingle();

  if (callerProfileErr || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
    return res.status(403).json({
      error: 'Akses ditolak: Hanya akun Administrator aktif yang berwenang menambah pengguna baru.',
    });
  }

  const { email, password, fullName, role, nip, department, phone } = req.body || {};

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ 
      error: 'Data tidak lengkap. Email, password, nama lengkap, dan role wajib diisi.' 
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(fullName).trim();
  const normalizedRole = String(role).trim() === 'keamanan' ? 'tenaga_keamanan' : String(role).trim();

  if (!ALLOWED_ROLES.has(normalizedRole)) {
    return res.status(400).json({
      error: `Jabatan/role "${normalizedRole}" tidak valid.`,
    });
  }

  if (String(password).length < 6) {
    return res.status(400).json({
      error: 'Kata sandi minimal 6 karakter.',
    });
  }

  try {
    // Cek duplikasi email di tabel profiles agar tidak menimpa pengguna lain
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return res.status(409).json({
        error: `Email ${normalizedEmail} sudah terdaftar pada pengguna lain.`,
      });
    }

    // 1. Buat user di Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        role: normalizedRole,
        nip: nip ? String(nip).trim() : '-',
        department: department ? String(department).trim() : 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      },
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Gagal membuat pengguna di auth.users' });
    }

    const userId = authData.user.id;
    const initials = normalizedName
      .split(' ')
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
      department: department ? String(department).trim() : 'Sekolah Rakyat Terintegerasi 1 Sumedang',
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
      // Rollback user auth agar tidak menjadi orphan auth.users tanpa profil
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch {}
      return res.status(500).json({ 
        error: `Pengguna dibuat di Auth, namun gagal menyimpan profil: ${profileError.message}` 
      });
    }

    // 3. Catat ke audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      user_id: callerAuth.user.id,
      user_role: 'admin',
      action: 'ADMIN_CREATE_USER',
      entity_type: 'profiles',
      entity_id: userId,
      details: { email: normalizedEmail, role: normalizedRole, fullName: normalizedName },
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ 
      success: true, 
      message: `Akun untuk ${normalizedName} (${normalizedRole}) berhasil dibuat.`,
      user: savedProfile || profileRow,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan internal pada server' });
  }
}
