import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { MainDashboardView } from './components/MainDashboardView';
import { CreateReportView } from './components/CreateReportView';
import { SummaryStatsView } from './components/SummaryStatsView';
import { HistoryTrackingView } from './components/HistoryTrackingView';
import { ReportDetailModal } from './components/ReportDetailModal';
import { SettingsView } from './components/SettingsView';
import { AuthView } from './components/AuthView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  ReportItem, 
  UserProfile, 
  AppSettings, 
  NotificationItem, 
  ReportStatus,
  USER_ROLES
} from './types/report';
import { 
  initialReports, 
  initialSettings
} from './data/initialData';
import { KemensosLogo } from './components/KemensosLogo';
import { 
  getSupabaseClient, 
  mapDbReportToReportItem, 
  logAuditEvent,
  generateUniqueReportId,
  mapDbNotificationToNotificationItem,
  isNotificationVisibleToUser,
  fetchNotificationsFromSupabase,
  markNotificationsReadInSupabase,
  submitReportToSupabase,
  updateReportInSupabase,
  updateReportStatusInSupabase,
  addReportNoteInSupabase,
  deleteReportInSupabase,
  deleteReportsInSupabase,
  resolveReportForNotification,
  normalizeReportUserRole,
  SubmitReportResult,
  DeleteReportResult,
  DeleteReportsBulkResult
} from './lib/supabase';
import { formatReportTicketNumber, canDeleteReport } from './utils/formatters';

function SIBAHARAppContent() {
  const { 
    currentUser, 
    currentRole, 
    isLoggedIn, 
    isAuthLoading,
    isSupabaseConnected, 
    updateCurrentUserProfile 
  } = useAuth();

  const [reports, setReports] = useState<ReportItem[]>([]);

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('sibahar_settings') || localStorage.getItem('reporthub_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.ticketPrefix === 'REP-2026') {
          return initialSettings;
        }
        return {
          ...initialSettings,
          ...parsed,
          mainLogoUrl: parsed.mainLogoUrl || initialSettings.mainLogoUrl,
          ticketPrefix:
            !parsed.ticketPrefix || parsed.ticketPrefix === 'Tanggal Input Laporan/Nomor Urut'
              ? initialSettings.ticketPrefix
              : parsed.ticketPrefix,
        };
      }
      return initialSettings;
    } catch {
      return initialSettings;
    }
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // UI Navigation states
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [selectedReportForDetail, setSelectedReportForDetail] = useState<ReportItem | null>(null);
  const [notificationOpenError, setNotificationOpenError] = useState<string | null>(null);
  const [reportActionError, setReportActionError] = useState<string | null>(null);
  const [isLoadingNotifReport, setIsLoadingNotifReport] = useState(false);
  const [isOpenMobileSidebar, setIsOpenMobileSidebar] = useState(false);

  // Sync with localStorage only while authenticated
  useEffect(() => {
    if (!isLoggedIn) return;
    localStorage.setItem('sibahar_items', JSON.stringify(reports));
  }, [reports, isLoggedIn]);

  // Sinkronkan judul browser resmi SIBAHAR
  useEffect(() => {
    try {
      document.title = 'SIBAHAR - Sistem Informasi Berita Aktual Harian';
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('sibahar_settings', JSON.stringify(appSettings));
  }, [appSettings]);

  // Bersihkan state sensitif & arahkan kembali ke halaman login saat belum terotentikasi / logout
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      setReports([]);
      setNotifications([]);
      setSelectedReportForDetail(null);
      setNotificationOpenError(null);
      setIsLoadingNotifReport(false);
      setCurrentTab('dashboard');
      setHistoryStatusFilter('all');
      setIsOpenMobileSidebar(false);
      try {
        localStorage.removeItem('sibahar_items');
        localStorage.removeItem('sibahar_notifs');
        localStorage.removeItem('reporthub_notifs');
        localStorage.removeItem('sibahar_active_user');
        if (window.location.pathname !== '/' || window.location.search.includes('portal=')) {
          window.history.replaceState({}, '', '/');
        }
      } catch {}
    }
  }, [isAuthLoading, isLoggedIn]);

  // Sync reports & notifications with Supabase Database (HANYA setelah autentikasi Supabase terverifikasi)
  useEffect(() => {
    if (isAuthLoading || !isLoggedIn || !currentUser.id) return;
    const client = getSupabaseClient();
    if (!client) return;

    let isMounted = true;
    try {
      localStorage.removeItem('sibahar_notifs');
      localStorage.removeItem('reporthub_notifs');
    } catch {}

    const fetchSupabaseReports = async () => {
      try {
        const { data, error } = await client
          .from('reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Gagal memuat daftar laporan dari Supabase:', error.message);
          return;
        }
        if (data && isMounted) {
          const mapped = data.map(mapDbReportToReportItem);
          setReports(mapped);
        }
      } catch (err) {
        console.warn('Gagal memuat data laporan dari Supabase:', err);
      }
    };

    const fetchInitialNotifications = async () => {
      const res = await fetchNotificationsFromSupabase(client, currentUser.id, currentRole);
      if (res.error) {
        console.warn('Gagal memuat notifikasi dari Supabase:', res.error);
        return;
      }
      if (isMounted) {
        setNotifications(res.notifications);
      }
    };

    void fetchSupabaseReports();
    void fetchInitialNotifications();

    // Supabase Realtime Channel
    const channel = client
      .channel(`sibahar_realtime_${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        (payload: any) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const mapped = mapDbReportToReportItem(payload.new);
            setReports((prev) => {
              if (prev.some((r) => r.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const mapped = mapDbReportToReportItem(payload.new);
            setReports((prev) =>
              prev.map((r) => (r.id === mapped.id ? mapped : r))
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = payload.old.id;
            setReports((prev) => prev.filter((r) => r.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload: any) => {
          if (payload.new) {
            const mappedNotif = mapDbNotificationToNotificationItem(payload.new);
            if (!isNotificationVisibleToUser(mappedNotif, currentUser.id, currentRole)) {
              return;
            }
            setNotifications((prev) => {
              if (prev.some((n) => n.id === mappedNotif.id)) return prev;
              return [mappedNotif, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload: any) => {
          if (payload.new) {
            const mappedNotif = mapDbNotificationToNotificationItem(payload.new);
            setNotifications((prev) =>
              prev.map((n) => (n.id === mappedNotif.id ? mappedNotif : n))
            );
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Koneksi Supabase Realtime bermasalah:', status, err?.message || '');
        }
      });

    return () => {
      isMounted = false;
      client.removeChannel(channel);
    };
  }, [isAuthLoading, isLoggedIn, isSupabaseConnected, currentUser.id, currentRole]);

  // Keep selectedReportForDetail in sync with updated report items
  useEffect(() => {
    if (selectedReportForDetail) {
      const updated = reports.find((r) => r.id === selectedReportForDetail.id);
      if (updated) {
        setSelectedReportForDetail(updated);
      }
    }
  }, [reports]);

  // Handlers for creating reports (wajib berhasil INSERT ke Supabase sebelum state/notifikasi/banner sukses)
  const handleSubmitReport = async (
    newReportData: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>
  ): Promise<SubmitReportResult> => {
    const client = getSupabaseClient();
    const result = await submitReportToSupabase(client, newReportData, currentUser);

    if (!result.success || !result.report) {
      return {
        success: false,
        error: result.error || 'Gagal menyimpan laporan ke database Supabase.',
      };
    }

    const savedReport = result.report;

    // Perbarui state reports hanya setelah INSERT Supabase berhasil (tanpa duplikasi)
    setReports((prev) =>
      prev.some((r) => r.id === savedReport.id)
        ? prev.map((r) => (r.id === savedReport.id ? savedReport : r))
        : [savedReport, ...prev]
    );

    // Notifikasi resmi Kepala Sekolah dihasilkan oleh trigger DB on_report_inserted pada public.notifications.
    // Untuk akun non-Kepala Sekolah pengirim, tampilkan konfirmasi in-memory hanya setelah INSERT sukses.
    const normalizedRole = normalizeReportUserRole(currentUser.roleKey);
    if (normalizedRole !== 'kepala_sekolah') {
      const senderRoleLabel = USER_ROLES[normalizedRole]?.label || currentUser.role;
      const ticketDisplay = formatReportTicketNumber(savedReport);
      const senderNotif: NotificationItem = {
        id: `local-sent-${savedReport.id}`,
        title: `Laporan Terkirim [${senderRoleLabel}]`,
        message: `Tiket #${ticketDisplay} ("${savedReport.title.slice(0, 35)}...") berhasil tersimpan di Supabase.`,
        time: 'Baru saja',
        read: false,
        type: 'system',
        reportId: savedReport.id,
        recipientId: currentUser.id,
      };
      setNotifications((prev) =>
        prev.some((n) => n.id === senderNotif.id) ? prev : [senderNotif, ...prev]
      );
    }

    // Record audit event hanya setelah laporan benar-benar tersimpan
    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: normalizedRole,
      action: 'CREATE_REPORT',
      resourceType: 'reports',
      resourceId: savedReport.id,
      details: {
        title: savedReport.title,
        category: savedReport.category,
        priority: savedReport.priority,
      },
    });

    return {
      success: true,
      report: savedReport,
    };
  };

  const handleSaveDraft = (draftData: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>): ReportItem => {
    const now = new Date();
    const draftId = generateUniqueReportId('draft');

    const timeFormatted = now.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const draftReport: ReportItem = {
      ...draftData,
      id: draftId,
      userId: currentUser.id,
      userRole: currentUser.roleKey,
      status: 'draft',
      createdAt: now.toISOString(),
      logs: [
        {
          id: `log-${generateUniqueReportId().slice(0, 8)}`,
          timestamp: timeFormatted,
          actor: currentUser.name,
          action: 'Draft Disimpan',
        },
      ],
    };

    setReports((prev) => [draftReport, ...prev]);
    return draftReport;
  };

  const handleDeleteDraft = (draftId: string) => {
    const target = reports.find((r) => r.id === draftId);
    // Hanya draft lokal yang belum pernah masuk tabel public.reports yang boleh dibersihkan di memori/localStorage
    if (!target || target.status !== 'draft' || !target.id.startsWith('draft-')) {
      return;
    }

    setReports((prev) => {
      const updated = prev.filter((r) => r.id !== draftId);
      try {
        localStorage.setItem('sibahar_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleEditReport = async (updatedReport: ReportItem): Promise<SubmitReportResult> => {
    // Draft lokal yang belum pernah masuk tabel reports Supabase dapat diperbarui langsung di state
    if (updatedReport.status === 'draft' && updatedReport.id.startsWith('draft-')) {
      setReports((prev) => prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)));
      if (selectedReportForDetail?.id === updatedReport.id) {
        setSelectedReportForDetail(updatedReport);
      }
      return { success: true, report: updatedReport };
    }

    const client = getSupabaseClient();
    const result = await updateReportInSupabase(client, updatedReport, currentUser);

    if (!result.success || !result.report) {
      return {
        success: false,
        error: result.error || 'Gagal memperbarui laporan ke database Supabase.',
      };
    }

    const confirmedReport = result.report;

    setReports((prev) =>
      prev.map((r) => (r.id === confirmedReport.id ? confirmedReport : r))
    );
    if (selectedReportForDetail?.id === confirmedReport.id) {
      setSelectedReportForDetail(confirmedReport);
    }

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: `Laporan #${formatReportTicketNumber(confirmedReport)} Diperbarui`,
      message: `Data laporan "${confirmedReport.title}" telah diperbarui di Supabase.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
      reportId: confirmedReport.id,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'UPDATE_REPORT',
      resourceType: 'reports',
      resourceId: confirmedReport.id,
      details: { title: confirmedReport.title, status: confirmedReport.status },
    });

    return {
      success: true,
      report: confirmedReport,
    };
  };

  const handleDeleteReport = async (reportId: string): Promise<DeleteReportResult> => {
    setReportActionError(null);
    const targetReport =
      reports.find((r) => r.id === reportId) ||
      (selectedReportForDetail?.id === reportId ? selectedReportForDetail : undefined);

    if (!targetReport) {
      const errMsg = 'Data laporan tidak ditemukan untuk dihapus.';
      setReportActionError(errMsg);
      return { success: false, error: errMsg };
    }

    const permission = canDeleteReport(targetReport, currentUser);
    if (!permission.allowed) {
      const errMsg =
        permission.reason || 'Anda tidak memiliki hak akses untuk menghapus laporan ini.';
      setReportActionError(errMsg);
      return { success: false, error: errMsg };
    }

    const client = getSupabaseClient();
    const result = await deleteReportInSupabase(client, targetReport, currentUser);

    if (!result.success) {
      const errMsg = result.error || 'Gagal menghapus laporan dari database Supabase.';
      setReportActionError(errMsg);
      return { success: false, error: errMsg };
    }

    setReports((prev) => {
      const updated = prev.filter((r) => r.id !== reportId);
      try {
        localStorage.setItem('sibahar_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (selectedReportForDetail?.id === reportId) {
      setSelectedReportForDetail(null);
    }

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: 'Laporan Dihapus',
      message: `Tiket #${formatReportTicketNumber(targetReport)} telah dihapus dari sistem SIBAHAR.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'DELETE_REPORT',
      resourceType: 'reports',
      resourceId: reportId,
      details: { status: targetReport.status, ownerId: targetReport.userId },
    });

    return { success: true, deletedId: reportId };
  };

  const handleDeleteReportsByRange = async (
    startDate: string,
    endDate: string
  ): Promise<DeleteReportsBulkResult> => {
    setReportActionError(null);
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

    const toDelete = reports.filter((r) => {
      const d = new Date(r.incidentDate || r.createdAt).getTime();
      if (d < start || d > end) return false;
      return canDeleteReport(r, currentUser).allowed;
    });

    if (toDelete.length === 0) {
      return {
        success: false,
        deletedIds: [],
        error:
          'Tidak ada laporan milik Anda yang berstatus Selesai dalam rentang tanggal tersebut.',
      };
    }

    const client = getSupabaseClient();
    const result = await deleteReportsInSupabase(client, toDelete, currentUser);

    if (!result.success || result.deletedIds.length === 0) {
      const errMsg = result.error || 'Gagal menghapus kumpulan laporan dari database Supabase.';
      setReportActionError(errMsg);
      return { success: false, deletedIds: [], error: errMsg };
    }

    const confirmedSet = new Set(result.deletedIds);
    setReports((prev) => {
      const updated = prev.filter((r) => !confirmedSet.has(r.id));
      try {
        localStorage.setItem('sibahar_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (selectedReportForDetail && confirmedSet.has(selectedReportForDetail.id)) {
      setSelectedReportForDetail(null);
    }

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: 'Pembersihan Riwayat Laporan',
      message: `${result.deletedIds.length} laporan selesai dalam rentang tanggal ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'} telah dihapus dari sistem SIBAHAR.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'DELETE_REPORTS_RANGE',
      resourceType: 'reports',
      resourceId: 'BULK',
      details: { startDate, endDate, count: result.deletedIds.length },
    });

    return {
      success: true,
      deletedIds: result.deletedIds,
    };
  };

  const handleUpdateStatus = async (
    reportId: string,
    newStatus: ReportStatus,
    note?: string
  ): Promise<SubmitReportResult> => {
    const targetReport =
      reports.find((r) => r.id === reportId) ||
      (selectedReportForDetail?.id === reportId ? selectedReportForDetail : undefined);

    if (!targetReport) {
      return {
        success: false,
        error: 'Data laporan tidak ditemukan untuk diperbarui.',
      };
    }

    const client = getSupabaseClient();
    const result = await updateReportStatusInSupabase(
      client,
      targetReport,
      newStatus,
      currentUser,
      note
    );

    if (!result.success || !result.report) {
      return {
        success: false,
        error: result.error || 'Gagal memperbarui status laporan ke database Supabase.',
      };
    }

    const confirmedReport = result.report;

    setReports((prev) =>
      prev.some((r) => r.id === confirmedReport.id)
        ? prev.map((r) => (r.id === confirmedReport.id ? confirmedReport : r))
        : [confirmedReport, ...prev]
    );
    if (selectedReportForDetail?.id === confirmedReport.id) {
      setSelectedReportForDetail(confirmedReport);
    }

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: `Status #${formatReportTicketNumber(confirmedReport)} Diperbarui`,
      message: `Status tiket diubah menjadi ${newStatus.toUpperCase()}${note ? `: "${note}"` : '.'}`,
      time: 'Baru saja',
      read: false,
      type: 'status_update',
      reportId: confirmedReport.id,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'UPDATE_STATUS',
      resourceType: 'reports',
      resourceId: confirmedReport.id,
      details: { newStatus, note },
    });

    return {
      success: true,
      report: confirmedReport,
    };
  };

  const handleAddNote = async (
    reportId: string,
    note: string
  ): Promise<SubmitReportResult> => {
    const targetReport =
      reports.find((r) => r.id === reportId) ||
      (selectedReportForDetail?.id === reportId ? selectedReportForDetail : undefined);

    if (!targetReport) {
      return {
        success: false,
        error: 'Data laporan tidak ditemukan untuk menambahkan catatan.',
      };
    }

    const client = getSupabaseClient();
    const result = await addReportNoteInSupabase(client, targetReport, note, currentUser);

    if (!result.success || !result.report) {
      return {
        success: false,
        error: result.error || 'Gagal menyimpan catatan laporan ke database Supabase.',
      };
    }

    const confirmedReport = result.report;

    setReports((prev) =>
      prev.some((r) => r.id === confirmedReport.id)
        ? prev.map((r) => (r.id === confirmedReport.id ? confirmedReport : r))
        : [confirmedReport, ...prev]
    );
    if (selectedReportForDetail?.id === confirmedReport.id) {
      setSelectedReportForDetail(confirmedReport);
    }

    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'ADD_REPORT_NOTE',
      resourceType: 'reports',
      resourceId: confirmedReport.id,
      details: { note },
    });

    return {
      success: true,
      report: confirmedReport,
    };
  };

  // Requirement 7: Sinkronisasi NIP atau data profil pengguna ke seluruh laporan & database Supabase
  const handleSaveProfileWithReportsSync = (profileUpdates: Partial<UserProfile>) => {
    updateCurrentUserProfile(profileUpdates);

    const newName = profileUpdates.name?.trim();
    const newNip = profileUpdates.nip?.trim();
    const newDept = profileUpdates.department?.trim();
    const newRole = profileUpdates.role?.trim();

    setReports((prevReports) => {
      let hasChanges = false;
      const updatedReports = prevReports.map((r) => {
        const isUserReport = 
          (r.userId && r.userId === currentUser.id) ||
          (r.reporterEmail && r.reporterEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
          (r.reporterName === currentUser.name) ||
          Boolean(r.reporterNip && currentUser.nip && r.reporterNip === currentUser.nip);

        if (isUserReport) {
          hasChanges = true;
          const updated: ReportItem = {
            ...r,
            reporterName: newName || r.reporterName,
            reporterNip: newNip !== undefined ? newNip : r.reporterNip,
            reporterDept: newDept || r.reporterDept,
            picName: (r.picName === currentUser.name && newName) ? newName : r.picName,
            picNip: (r.picNip === currentUser.nip && newNip !== undefined) ? newNip : r.picNip,
            picRole: (newRole && r.picRole === currentUser.role) ? newRole : r.picRole,
          };

          // Simpan perubahan langsung ke database Supabase
          const client = getSupabaseClient();
          if (client) {
            client
              .from('reports')
              .update({
                reporter_name: updated.reporterName,
                reporter_nip: updated.reporterNip,
                reporter_dept: updated.reporterDept,
                pic_name: updated.picName,
                pic_nip: updated.picNip,
                pic_role: updated.picRole,
                updated_at: new Date().toISOString(),
              })
              .eq('id', r.id)
              .then(
                ({ error }) => {
                  if (error) console.warn('Supabase sync report on profile update warning:', error.message);
                },
                (err: any) => console.warn('Supabase sync report profile network warning:', err?.message || err)
              );
          }

          return updated;
        }
        return r;
      });

      if (hasChanges) {
        try {
          localStorage.setItem('sibahar_items', JSON.stringify(updatedReports));
        } catch {}
      }

      return updatedReports;
    });
  };

  const handleResetToDefault = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset pengaturan tampilan lokal kembali ke setelan awal SIBAHAR?')) {
      setReports(initialReports);
      setAppSettings(initialSettings);
      setNotifications([]);
      localStorage.removeItem('sibahar_items');
      localStorage.removeItem('sibahar_profile');
      localStorage.removeItem('sibahar_settings');
      localStorage.removeItem('sibahar_notifs');
      localStorage.removeItem('reporthub_items');
      localStorage.removeItem('reporthub_profile');
      localStorage.removeItem('reporthub_settings');
      localStorage.removeItem('reporthub_notifs');
      alert('Pengaturan tampilan lokal SIBAHAR telah direset ke setelan awal.');
    }
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    const client = getSupabaseClient();
    if (client) {
      void markNotificationsReadInSupabase(client, [id]).then((res) => {
        if (!res.success && res.error) {
          console.warn('Gagal menyinkronkan status dibaca notifikasi ke Supabase:', res.error);
        }
      });
    }
  };

  const handleMarkAllNotificationsRead = () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const client = getSupabaseClient();
    if (client && unreadIds.length > 0) {
      void markNotificationsReadInSupabase(client, unreadIds).then((res) => {
        if (!res.success && res.error) {
          console.warn('Gagal menyinkronkan status seluruh notifikasi dibaca:', res.error);
        }
      });
    }
  };

  const handleSelectReportFromNotif = async (reportId: string) => {
    setNotificationOpenError(null);
    setIsLoadingNotifReport(true);
    try {
      const client = getSupabaseClient();
      const result = await resolveReportForNotification(client, reports, reportId);
      if (!result.success || !result.report) {
        setNotificationOpenError(
          result.error || `Laporan dengan ID ${reportId} tidak dapat ditemukan.`
        );
        return;
      }

      const resolved = result.report;
      if (result.fromDatabase) {
        setReports((prev) =>
          prev.some((r) => r.id === resolved.id)
            ? prev.map((r) => (r.id === resolved.id ? resolved : r))
            : [resolved, ...prev]
        );
      }

      setSelectedReportForDetail(resolved);
    } finally {
      setIsLoadingNotifReport(false);
    }
  };

  // Switch to History with pre-selected filter
  const handleNavigateToHistory = (statusFilter?: string) => {
    if (statusFilter) {
      setHistoryStatusFilter(statusFilter);
    } else {
      setHistoryStatusFilter('all');
    }
    setCurrentTab('history');
  };

  // Sesuai Aturan RBAC:
  // - Kepala Sekolah melihat seluruh laporan dari semua staf (non-draft) + laporan milik sendiri
  // - 5 peran lainnya (Admin, Wali Asrama, Wali Asuh, Guru, Tenaga Keamanan) HANYA melihat laporan miliknya sendiri
  const isKepalaSekolah = currentRole === 'kepala_sekolah';

  const roleFilteredReports = useMemo(() => {
    if (isKepalaSekolah) {
      return reports.filter((r) => r.status !== 'draft' || r.userId === currentUser.id);
    }
    // Peran lainnya hanya laporan milik sendiri
    return reports.filter((r) => 
      (r.userId && r.userId === currentUser.id) ||
      r.reporterName.toLowerCase() === currentUser.name.toLowerCase()
    );
  }, [reports, isKepalaSekolah, currentUser]);

  // Count active non-draft tickets for sidebar badge
  const activeTicketsCount = roleFilteredReports.filter(
    (r) => r.status === 'diproses' || r.status === 'menunggu'
  ).length;

  // Auth loading gate (mencegah kilasan dashboard sebelum sesi Supabase Auth diverifikasi)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-emerald-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md p-2.5 flex items-center justify-center border border-white/20 shadow-lg">
            <KemensosLogo className="w-11 h-11" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-extrabold tracking-wider font-mono text-amber-300">SIBAHAR</p>
            <p className="text-[11px] font-semibold tracking-wide text-emerald-200 uppercase">
              SISTEM INFORMASI BERITA AKTUAL HARIAN
            </p>
            <p className="text-xs text-emerald-100/90">Memverifikasi sesi autentikasi Supabase...</p>
          </div>
          <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-amber-300 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Unauthenticated screen — wajib login untuk semua URL dan kondisi sebelum sesi terverifikasi
  if (!isLoggedIn) {
    return <AuthView />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50/40 via-slate-50 to-teal-50/30 font-sans text-slate-800 antialiased overflow-hidden">
      {/* ================= SIDEBAR ================= */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'history') {
            setHistoryStatusFilter('all');
          }
        }}
        activeTicketsCount={activeTicketsCount}
        userProfile={currentUser}
        isOpenMobile={isOpenMobileSidebar}
        onCloseMobile={() => setIsOpenMobileSidebar(false)}
        mainLogoUrl={appSettings.mainLogoUrl}
        helpDeskNumber={appSettings.helpDeskNumber}
      />

      {/* ================= KONTEN UTAMA ================= */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Header Atas */}
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsOpenMobileSidebar(true)}
          onSwitchTab={setCurrentTab}
          notifications={notifications}
          mainLogoUrl={appSettings.mainLogoUrl}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onSelectReportFromNotif={handleSelectReportFromNotif}
        />

        {/* Konten Halaman */}
        <main className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          {isLoadingNotifReport && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-medium flex items-center gap-2.5">
              <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin shrink-0" />
              <span>Memuat detail laporan dari database Supabase...</span>
            </div>
          )}
          {notificationOpenError && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-3"
            >
              <div>
                <p className="font-bold">Laporan Tidak Dapat Dibuka dari Notifikasi</p>
                <p className="text-rose-800 mt-0.5">{notificationOpenError}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotificationOpenError(null)}
                className="text-rose-600 hover:text-rose-900 font-semibold shrink-0 px-2 py-0.5 rounded hover:bg-rose-100 transition"
              >
                Tutup
              </button>
            </div>
          )}
          {reportActionError && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-3"
            >
              <div>
                <p className="font-bold">Penghapusan Laporan Tidak Diizinkan / Gagal</p>
                <p className="text-rose-800 mt-0.5">{reportActionError}</p>
              </div>
              <button
                type="button"
                onClick={() => setReportActionError(null)}
                className="text-rose-600 hover:text-rose-900 font-semibold shrink-0 px-2 py-0.5 rounded hover:bg-rose-100 transition"
              >
                Tutup
              </button>
            </div>
          )}
          {currentTab === 'dashboard' && (
            <MainDashboardView
              reports={reports}
              userProfile={currentUser}
              appSettings={appSettings}
              onNavigateToTab={(tab) => {
                setCurrentTab(tab);
                if (tab === 'history') {
                  setHistoryStatusFilter('all');
                }
              }}
              onViewReport={(report) => setSelectedReportForDetail(report)}
              onDeleteReport={handleDeleteReport}
            />
          )}

          {currentTab === 'create' && (
            <CreateReportView
              reports={reports}
              userProfile={currentUser}
              onSubmitReport={handleSubmitReport}
              onSaveDraft={handleSaveDraft}
              onNavigateTab={(tab, filter) => {
                if (tab === 'history') {
                  handleNavigateToHistory(filter);
                } else {
                  setCurrentTab(tab);
                }
              }}
              onViewReportDetail={(report) => setSelectedReportForDetail(report)}
              onDeleteDraft={handleDeleteDraft}
            />
          )}

          {currentTab === 'stats' && (
            <SummaryStatsView
              reports={roleFilteredReports}
              onViewReport={(report) => setSelectedReportForDetail(report)}
              onNavigateToHistory={handleNavigateToHistory}
            />
          )}

          {currentTab === 'history' && (
            <HistoryTrackingView
              reports={roleFilteredReports}
              onViewReportDetail={(report) => setSelectedReportForDetail(report)}
              onNavigateToCreate={() => setCurrentTab('create')}
              onEditReport={handleEditReport}
              onDeleteReport={handleDeleteReport}
              initialStatusFilter={historyStatusFilter}
              currentUserId={currentUser.id}
              currentUserName={currentUser.name}
              currentUserEmail={currentUser.email}
              currentUserRole={currentRole}
              currentUserIsActive={currentUser.isActive}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              userProfile={currentUser}
              appSettings={appSettings}
              reports={reports}
              onSaveProfile={handleSaveProfileWithReportsSync}
              onSaveSettings={setAppSettings}
              onResetToDefault={handleResetToDefault}
              onDeleteReportsByRange={handleDeleteReportsByRange}
            />
          )}
        </main>

        {/* Institutional Footer */}
        <footer className="mt-auto px-4 sm:px-6 md:px-8 py-4 border-t border-emerald-100/80 bg-white/60 text-center text-[11px] text-slate-500">
          <p className="font-medium text-slate-600">
            <strong className="text-emerald-900">SIBAHAR</strong> — Sistem Informasi Berita Aktual Harian · Sekolah Rakyat Terintegerasi 1 Sumedang · Kementerian Sosial Republik Indonesia
          </p>
        </footer>
      </div>

      {/* Detail Modal */}
      {selectedReportForDetail && (
        <ReportDetailModal
          report={selectedReportForDetail}
          onClose={() => setSelectedReportForDetail(null)}
          onUpdateStatus={handleUpdateStatus}
          onAddNote={handleAddNote}
          currentUser={currentUser.name}
          appSettings={appSettings}
          userProfile={currentUser}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SIBAHARAppContent />
    </AuthProvider>
  );
}
