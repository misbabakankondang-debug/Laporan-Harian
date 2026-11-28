-- ==============================================================================
-- SIBAHAR Migration: Penambahan Kolom Shift (reports) & Jabatan (profiles)
-- Non-destruktif, idempoten, aman dijalankan di Supabase SQL Editor.
-- Tidak mengubah data laporan lama, pengguna lama, enum role, RLS, maupun trigger.
-- ==============================================================================

-- 1. Kolom Shift pada tabel public.reports (nullable agar laporan lama tetap utuh)
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS shift TEXT;

-- 2. Kolom Jabatan pada tabel public.profiles (nullable; mendukung "Tim Piket" tanpa menambah enum role)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS jabatan TEXT;

-- 3. Indeks ringan untuk pencarian/filter shift tanpa memengaruhi data lama
CREATE INDEX IF NOT EXISTS idx_reports_shift ON public.reports(shift);

-- 4. Muat ulang schema cache PostgREST agar kolom baru langsung terbaca API
NOTIFY pgrst, 'reload schema';
