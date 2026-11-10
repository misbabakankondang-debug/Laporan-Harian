-- ==============================================================================
-- SIBAHAR (Sistem Informasi Berita Aktual Harian) - Supabase Database Schema
-- Sekolah Rakyat Terintegerasi 1 Sumedang, Kementerian Sosial Republik Indonesia
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TIPE ROLE PENGGUNA (6 Role Resmi)
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM (
        'admin',
        'wali_asrama',
        'wali_asuh',
        'guru',
        'tenaga_keamanan',
        'kepala_sekolah'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABEL PROFILES (Terhubung ke auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role user_role_type NOT NULL DEFAULT 'guru',
    nip TEXT,
    phone TEXT,
    department TEXT DEFAULT 'Sekolah Rakyat Terintegerasi 1 Sumedang',
    avatar_initials TEXT DEFAULT 'SR',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);

-- 4. TABEL REPORT_CATEGORIES
CREATE TABLE IF NOT EXISTS public.report_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed Categories Bawaan
INSERT INTO public.report_categories (code, category_name, description)
VALUES 
    ('kategori_1', 'Tata Tertib, Relasi & Prilaku, Adaptasi dan Motivasi, Kedisiplinan', 'Pembinaan kedisiplinan dan hubungan antar santri/siswa'),
    ('kategori_2', 'Tata Tertib & Perundungan, Kekerasan & Relasi, Kesehatan dan Psikologis, Pendikan & Kehadiran', 'Penanganan kasus relasi dan kesehatan mental'),
    ('kategori_3', 'Keselamatan & Kekerasan, Hukum & Perlindungan, Kesehatan & Keselamatan Diri, Ruang Digital & Nilai', 'Keamanan dan keselamatan darurat'),
    ('kegiatan_asrama', 'Kegiatan Asrama & Kebersihan Kamar', 'Piket kamar dan ketertiban asrama'),
    ('pengasuhan', 'Pengasuhan & Bimbingan Karakter', 'Pendampingan wali asuh'),
    ('pembelajaran', 'Kegiatan Pembelajaran & Kelas', 'Akademik dan presensi sekolah'),
    ('keamanan_lingkungan', 'Keamanan & Ketertiban Lingkungan', 'Patroli dan pos jaga sekolah'),
    ('nihil', 'Nihil', 'Laporan nihil tanpa kejadian khusus / situasi kondusif')
ON CONFLICT (code) DO NOTHING;

-- 5. TABEL REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY, -- Format: Tanggal Input Laporan / Nomor Urut (contoh: 20261107/001)
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_role user_role_type NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'sedang',
    description TEXT NOT NULL,
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'menunggu', -- draft, menunggu, diproses, selesai, ditolak
    reporter_name TEXT NOT NULL,
    reporter_email TEXT,
    reporter_dept TEXT,
    reporter_nip TEXT,
    pic_name TEXT,
    pic_role TEXT,
    pic_nip TEXT,
    assigned_to TEXT,
    attachment_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_incident_date ON public.reports(incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON public.reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

-- 6. TABEL NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_role user_role_type,
    report_id TEXT REFERENCES public.reports(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON public.notifications(recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);

-- 7. TABEL AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_role TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) WAJIB
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: cek apakah user saat ini aktif
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: cek apakah user saat ini adalah Kepala Sekolah
CREATE OR REPLACE FUNCTION public.is_kepala_sekolah()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'kepala_sekolah' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: cek apakah user saat ini adalah Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- A. KEBIJAKAN RLS PROFILES ---
CREATE POLICY "Profiles SELECT"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_kepala_sekolah() OR public.is_admin());

CREATE POLICY "Profiles UPDATE"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles INSERT by Admin or Self"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- Mencegah non-admin mengubah role atau status aktif sendiri
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        NEW.role := OLD.role;
        NEW.is_active := OLD.is_active;
        NEW.email := OLD.email;
    END IF;
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- --- B. KEBIJAKAN RLS REPORT CATEGORIES ---
CREATE POLICY "Categories SELECT"
    ON public.report_categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Categories INSERT/UPDATE/DELETE by Admin"
    ON public.report_categories FOR ALL
    USING (public.is_admin());

-- --- C. KEBIJAKAN RLS REPORTS (KETAT) ---
-- 1. SELECT: Staff HANYA melihat miliknya sendiri. Kepala Sekolah membaca SELURUH laporan.
-- Admin TIDAK otomatis membaca laporan orang lain.
CREATE POLICY "Reports SELECT Policy"
    ON public.reports FOR SELECT
    USING (
        public.is_user_active() AND (
            auth.uid() = user_id 
            OR (public.is_kepala_sekolah() AND status <> 'draft')
        )
    );

-- 2. INSERT: Hanya pengguna aktif untuk user_id miliknya sendiri
CREATE POLICY "Reports INSERT Policy"
    ON public.reports FOR INSERT
    WITH CHECK (
        public.is_user_active() AND auth.uid() = user_id
    );

-- 3. UPDATE: HANYA pemilik laporan sendiri. Kepala Sekolah TIDAK BISA mengubah laporan orang lain.
CREATE POLICY "Reports UPDATE Policy"
    ON public.reports FOR UPDATE
    USING (
        public.is_user_active() AND auth.uid() = user_id
    )
    WITH CHECK (
        public.is_user_active() AND auth.uid() = user_id
    );

-- 4. DELETE: HANYA pemilik laporan sendiri. Kepala Sekolah TIDAK BISA menghapus laporan orang lain.
CREATE POLICY "Reports DELETE Policy"
    ON public.reports FOR DELETE
    USING (
        public.is_user_active() AND auth.uid() = user_id
    );

-- --- D. KEBIJAKAN RLS NOTIFICATIONS ---
CREATE POLICY "Notifications SELECT"
    ON public.notifications FOR SELECT
    USING (
        public.is_user_active() AND (
            auth.uid() = recipient_id
            OR (recipient_role = 'kepala_sekolah' AND public.is_kepala_sekolah())
            OR (recipient_role = 'admin' AND public.is_admin())
        )
    );

CREATE POLICY "Notifications UPDATE"
    ON public.notifications FOR UPDATE
    USING (
        public.is_user_active() AND (
            auth.uid() = recipient_id
            OR (recipient_role = 'kepala_sekolah' AND public.is_kepala_sekolah())
        )
    );

CREATE POLICY "Notifications INSERT"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- --- E. KEBIJAKAN RLS AUDIT_LOGS ---
CREATE POLICY "Audit Logs INSERT"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Audit Logs SELECT"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin() OR public.is_kepala_sekolah());

-- ==============================================================================
-- 9. TRIGGERS & OTOMASI NOTIFIKASI KEPALA SEKOLAH
-- ==============================================================================

-- A. Trigger: Notifikasi otomatis ke Kepala Sekolah saat laporan non-draft diajukan
CREATE OR REPLACE FUNCTION public.notify_kepala_sekolah_on_report()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status <> 'draft' THEN
        INSERT INTO public.notifications (
            recipient_role,
            report_id,
            title,
            message,
            is_read
        )
        VALUES (
            'kepala_sekolah',
            NEW.id,
            'Laporan Baru: ' || NEW.reporter_name || ' (' || NEW.user_role || ')',
            'Tiket #' || NEW.id || ' - "' || SUBSTRING(NEW.title, 1, 60) || '" telah diajukan dan masuk ke antrean verifikasi.',
            false
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_report_inserted ON public.reports;
CREATE TRIGGER on_report_inserted
    AFTER INSERT ON public.reports
    FOR EACH ROW EXECUTE FUNCTION public.notify_kepala_sekolah_on_report();

-- ==============================================================================
-- 10. REALTIME ACTIVATION
-- ==============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 11. SUPABASE STORAGE (BUCKET: report-attachments)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-attachments', 'report-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'report-attachments');

CREATE POLICY "Allow public read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'report-attachments');

-- ==============================================================================
-- 12. RPC FUNCTION: Hapus Pengguna oleh Admin (Aman dengan Verifikasi Hak Admin)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.delete_user_profile(target_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    target_uuid UUID;
    caller_role user_role_type;
    target_role user_role_type;
    admin_count INT;
BEGIN
    -- 1. Validasi format UUID
    BEGIN
        target_uuid := target_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Format ID target tidak valid (harus berupa UUID).');
    END;

    -- 2. Cek autentikasi penyeru
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tidak terotentikasi. Silakan login terlebih dahulu.');
    END IF;

    -- 3. Verifikasi hak penyeru (hanya role admin)
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
    IF caller_role IS NULL OR caller_role <> 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Hanya akun Administrator yang berwenang menghapus pengguna.');
    END IF;

    -- 4. Cegah menghapus akun yang sedang digunakan
    IF auth.uid() = target_uuid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tidak dapat menghapus akun Administrator yang sedang aktif digunakan.');
    END IF;

    -- 5. Ambil data role target
    SELECT role INTO target_role FROM public.profiles WHERE id = target_uuid;
    IF target_role IS NULL THEN
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_uuid) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Pengguna target tidak ditemukan di sistem.');
        END IF;
    END IF;

    -- 6. Cegah menghapus akun Admin terakhir
    IF target_role = 'admin' THEN
        SELECT COUNT(*) INTO admin_count FROM public.profiles WHERE role = 'admin' AND is_active = true;
        IF admin_count <= 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Sistem harus memiliki minimal satu akun Administrator aktif.');
        END IF;
    END IF;

    -- 7. Hapus dari public.profiles dan auth.users
    DELETE FROM public.profiles WHERE id = target_uuid;
    DELETE FROM auth.users WHERE id = target_uuid;

    -- 8. Catat ke audit_logs
    INSERT INTO public.audit_logs (user_id, user_role, action, entity_type, entity_id, details)
    VALUES (
        auth.uid(),
        'admin',
        'ADMIN_DELETE_USER',
        'profiles',
        target_id,
        jsonb_build_object('deleted_user_id', target_id, 'deleted_at', now())
    );

    RETURN jsonb_build_object('success', true, 'message', 'Pengguna berhasil dihapus secara permanen dari database Supabase.');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Alias untuk penanganan parameter tipe UUID langsung
CREATE OR REPLACE FUNCTION public.delete_user_profile(target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN public.delete_user_profile(target_id::TEXT);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_profile(TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_user_profile(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_profile(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user_profile(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_user_profile(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_profile(UUID) TO authenticated;

