// Vercel Serverless Function: Operasi Administrasi Pembuatan Akun Pengguna oleh Admin
// Path: /api/admin-create-user
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode HTTP tidak diizinkan. Gunakan POST.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ 
      error: 'Konfigurasi backend belum lengkap: SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_URL belum diatur di Vercel Environment Variables.' 
    });
  }

  const { email, password, fullName, role, nip, department, phone } = req.body || {};

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ 
      error: 'Data tidak lengkap. Email, password, nama lengkap, dan role wajib diisi.' 
    });
  }

  // Buat Supabase Admin Client menggunakan Service Role Key (hanya berjalan di sisi server)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Buat user di Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role: role,
        nip: nip?.trim() || '-',
        department: department?.trim() || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      },
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Gagal membuat pengguna di auth.users' });
    }

    const userId = authData.user.id;
    const initials = fullName
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SR';

    // 2. Simpan atau perbarui data di public.profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: fullName.trim(),
      email: email.trim(),
      role: role,
      nip: nip?.trim() || '-',
      phone: phone?.trim() || '',
      department: department?.trim() || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      avatar_initials: initials,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      return res.status(500).json({ 
        error: `Pengguna dibuat di Auth, namun gagal membuat profil: ${profileError.message}` 
      });
    }

    // 3. Catat ke audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      user_role: 'admin',
      action: 'ADMIN_CREATE_USER',
      entity_type: 'profiles',
      entity_id: userId,
      details: { email: email.trim(), role, fullName: fullName.trim() },
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ 
      success: true, 
      message: `Akun untuk ${fullName} (${role}) berhasil dibuat.`,
      user: { id: userId, email: email.trim(), role } 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan internal pada server' });
  }
}
