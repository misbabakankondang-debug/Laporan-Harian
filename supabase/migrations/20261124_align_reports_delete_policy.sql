-- ==============================================================================
-- SIBAHAR Migration: Penyelarasan Policy DELETE Tabel public.reports (Tahap 2.2)
-- ==============================================================================
-- Kebijakan penghapusan laporan yang diselaraskan:
-- 1. Pemilik laporan (auth.uid() = user_id) HANYA boleh menghapus laporannya sendiri apabila status = 'selesai'.
-- 2. Kepala Sekolah (public.is_kepala_sekolah()) boleh menghapus laporan milik sendiri maupun pengguna lain apabila status = 'selesai'.
-- 3. Tidak ada pengguna (termasuk pemilik, Admin, maupun Kepala Sekolah) yang boleh menghapus laporan dengan status selain 'selesai' (draft, menunggu, diproses, ditolak).
-- 4. Admin tetap hanya boleh menghapus laporan miliknya sendiri apabila status = 'selesai'.
-- 5. Kebijakan SELECT, INSERT, UPDATE, GRANT, trigger, dan fungsi helper tidak diubah.
-- ==============================================================================

-- Hapus policy DELETE lama pada public.reports (termasuk bila ada nama duplikat yang lebih luas khusus cmd DELETE pada public.reports)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'reports'
          AND cmd = 'DELETE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', pol.policyname);
    END LOOP;
END $$;

-- Buat satu-satunya policy DELETE resmi yang selaras untuk public.reports
CREATE POLICY "Reports DELETE Policy"
    ON public.reports FOR DELETE
    USING (
        auth.uid() IS NOT NULL
        AND status = 'selesai'
        AND (
            auth.uid() = user_id
            OR public.is_kepala_sekolah()
        )
    );

-- Muat ulang schema cache PostgREST
NOTIFY pgrst, 'reload schema';
