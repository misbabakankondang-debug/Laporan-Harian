-- ==============================================================================
-- SIBAHAR (Sistem Informasi Berita Aktual Harian) - Supabase Database Schema
-- Sekolah Rakyat Terintegerasi 1 Sumedang, Kementerian Sosial Republik Indonesia
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TIPE ROLE PENGGUNA
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM (
        'admin',
        'wali_asrama',
        'wali_asuh',
        'guru',
        'keamanan',
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. TABEL REPORT_CATEGORIES
CREATE TABLE IF NOT EXISTS public.report_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed Categories
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

-- Indeks performa pencarian laporan sesuai kebutuhan poin 4
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

-- ==============================================================================
-- 7. KEAMANAN DATABASE (ROW LEVEL SECURITY - RLS WAJIB)
-- ==============================================================================

-- Aktifkan RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_categories ENABLE ROW LEVEL SECURITY;

-- Helper function: cek apakah user saat ini adalah Kepala Sekolah
CREATE OR REPLACE FUNCTION public.is_kepala_sekolah()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'kepala_sekolah'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: cek apakah user saat ini adalah Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- A. KEBIJAKAN RLS PROFILES ---
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_kepala_sekolah() OR public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admin can manage profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- --- B. KEBIJAKAN RLS REPORT CATEGORIES ---
CREATE POLICY "Anyone authenticated can view categories"
    ON public.report_categories FOR SELECT
    TO authenticated
    USING (true);

-- --- C. KEBIJAKAN RLS REPORTS (KETAT SESUAI KETENTUAN USER) ---
-- 1. SELECT Policy:
-- - Setiap pengguna HANYA dapat SELECT laporan miliknya sendiri (auth.uid() = user_id)
-- - Kepala Sekolah DAPAT SELECT SELURUH laporan dari SEMUA pengguna (is_kepala_sekolah())
-- - Admin TIDAK otomatis melihat laporan orang lain!
CREATE POLICY "Reports SELECT Policy"
    ON public.reports FOR SELECT
    USING (
        auth.uid() = user_id 
        OR public.is_kepala_sekolah()
    );

-- 2. INSERT Policy:
-- - Setiap pengguna hanya dapat INSERT laporan dengan user_id miliknya sendiri
CREATE POLICY "Reports INSERT Policy"
    ON public.reports FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
    );

-- 3. UPDATE Policy:
-- - Setiap pengguna HANYA dapat UPDATE laporan miliknya sendiri
-- - Kepala Sekolah TIDAK BOLEH mengedit laporan milik orang lain!
CREATE POLICY "Reports UPDATE Policy"
    ON public.reports FOR UPDATE
    USING (
        auth.uid() = user_id
    )
    WITH CHECK (
        auth.uid() = user_id
    );

-- 4. DELETE Policy:
-- - Setiap pengguna HANYA dapat DELETE laporan miliknya sendiri
-- - Kepala Sekolah TIDAK BOLEH menghapus laporan milik orang lain!
CREATE POLICY "Reports DELETE Policy"
    ON public.reports FOR DELETE
    USING (
        auth.uid() = user_id
    );

-- --- D. KEBIJAKAN RLS NOTIFICATIONS ---
CREATE POLICY "Notifications SELECT Policy"
    ON public.notifications FOR SELECT
    USING (
        auth.uid() = recipient_id
        OR (recipient_role = 'kepala_sekolah' AND public.is_kepala_sekolah())
        OR (recipient_role = 'admin' AND public.is_admin())
    );

CREATE POLICY "Notifications UPDATE Policy"
    ON public.notifications FOR UPDATE
    USING (
        auth.uid() = recipient_id
        OR (recipient_role = 'kepala_sekolah' AND public.is_kepala_sekolah())
    );

CREATE POLICY "Notifications INSERT Policy"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- ==============================================================================
-- 8. TRIGGERS & OTOMASI NOTIFIKASI KEPALA SEKOLAH (POIN 3 & 4)
-- ==============================================================================

-- A. Trigger profil otomatis saat user register di auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, nip, department, avatar_initials)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Pengguna SIBAHAR'),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role_type, 'guru'::public.user_role_type),
        COALESCE(NEW.raw_user_meta_data->>'nip', '-'),
        COALESCE(NEW.raw_user_meta_data->>'department', 'Sekolah Rakyat Terintegerasi 1 Sumedang'),
        UPPER(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'full_name', 'SR'), 1, 2))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. Trigger: Buat notifikasi otomatis ke Kepala Sekolah setiap ada laporan baru masuk
CREATE OR REPLACE FUNCTION public.notify_kepala_sekolah_on_report()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika laporan berstatus selain draft (laporan resmi diajukan)
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
-- 9. SUPABASE STORAGE (BUCKET: report-attachments)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-attachments', 'report-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy Storage: siapa pun yang terautentikasi dapat mengunggah lampiran
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'report-attachments');

-- Policy Storage: siapa pun dapat melihat lampiran publik
CREATE POLICY "Allow public read on attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'report-attachments');
