-- ==============================================================================
-- SIBAHAR Migration: Lengkapi Kolom & RLS Tabel public.profiles
-- Aman dijalankan berulang kali di Supabase SQL Editor tanpa menghapus data lama.
-- ==============================================================================

-- 1. Pastikan tipe ENUM user_role_type tersedia
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

-- 2. Tambahkan seluruh kolom yang dibutuhkan aplikasi secara aman (tidak mengubah data lama)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role user_role_type NOT NULL DEFAULT 'guru';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nip TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Sekolah Rakyat Terintegerasi 1 Sumedang';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_initials TEXT DEFAULT 'SR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 3. Pastikan nilai NULL pada is_active (bila kolom sudah ada sebelumnya sebagai nullable) terisi TRUE
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
ALTER TABLE public.profiles ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN is_active SET NOT NULL;

-- 4. Pastikan indeks performa & keunikan email tersedia
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND contype = 'u'
          AND conname = 'profiles_email_key'
    ) THEN
        BEGIN
            ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
        EXCEPTION
            WHEN duplicate_table OR duplicate_object THEN null;
        END;
    END IF;
END $$;

-- 5. Pastikan fungsi helper & RLS public.profiles aman untuk Admin
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_kepala_sekolah()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'kepala_sekolah' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Profiles SELECT" ON public.profiles;
CREATE POLICY "Profiles SELECT"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_kepala_sekolah() OR public.is_admin());

DROP POLICY IF EXISTS "Profiles INSERT by Admin or Self" ON public.profiles;
CREATE POLICY "Profiles INSERT by Admin or Self"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Profiles UPDATE" ON public.profiles;
CREATE POLICY "Profiles UPDATE"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Profiles DELETE by Admin" ON public.profiles;
CREATE POLICY "Profiles DELETE by Admin"
    ON public.profiles FOR DELETE
    USING (public.is_admin());

-- 6. Muat ulang schema cache PostgREST agar kolom baru (termasuk is_active) langsung terbaca
NOTIFY pgrst, 'reload schema';
