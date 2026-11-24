-- ==============================================================================
-- SIBAHAR Migration: Dukungan Jenjang & Multi-Entri Checklist pada public.reports
-- Non-destruktif, idempoten, aman dijalankan di Supabase SQL Editor.
-- Tidak mengubah data lama, primary key, RLS, GRANT, trigger, maupun fungsi DB.
-- ==============================================================================

-- 1. Pastikan kolom tanda tangan pelapor tersedia bila database live belum memilikinya
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS reporter_signature TEXT;

-- 2. Tambahkan kolom ringkasan jenjang dan detail entri multi-jenjang (JSONB)
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS jenjang TEXT;

ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS entries JSONB DEFAULT '[]'::jsonb;

-- 3. Tambahkan kolom custom_category agar kategori manual laporan lama tersimpan di DB
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS custom_category TEXT;

-- 4. Indeks ringan untuk filter/pencarian jenjang tanpa memengaruhi data lama
CREATE INDEX IF NOT EXISTS idx_reports_jenjang ON public.reports(jenjang);

-- 5. Muat ulang schema cache PostgREST agar kolom baru langsung terbaca API
NOTIFY pgrst, 'reload schema';
