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
  initialSettings, 
  initialNotifications 
} from './data/initialData';
import { KemensosLogo } from './components/KemensosLogo';
import { 
  getSupabaseClient, 
  mapDbReportToReportItem, 
  mapReportItemToDbRow,
  logAuditEvent 
} from './lib/supabase';

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

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem('sibahar_notifs') || localStorage.getItem('reporthub_notifs');
      return saved ? JSON.parse(saved) : initialNotifications;
    } catch {
      return initialNotifications;
    }
  });

  // UI Navigation states
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [selectedReportForDetail, setSelectedReportForDetail] = useState<ReportItem | null>(null);
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

  useEffect(() => {
    if (!isLoggedIn) return;
    localStorage.setItem('sibahar_notifs', JSON.stringify(notifications));
  }, [notifications, isLoggedIn]);

  // Bersihkan state sensitif & arahkan kembali ke halaman login saat belum terotentikasi / logout
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      setReports([]);
      setSelectedReportForDetail(null);
      setCurrentTab('dashboard');
      setHistoryStatusFilter('all');
      setIsOpenMobileSidebar(false);
      try {
        localStorage.removeItem('sibahar_items');
        localStorage.removeItem('sibahar_active_user');
        if (window.location.pathname !== '/' || window.location.search.includes('portal=')) {
          window.history.replaceState({}, '', '/');
        }
      } catch {}
    }
  }, [isAuthLoading, isLoggedIn]);

  // Sync with Supabase Database and listen to Realtime changes (HANYA setelah autentikasi Supabase terverifikasi)
  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;
    const client = getSupabaseClient();
    if (!client || !isSupabaseConnected) return;

    let isMounted = true;
    const fetchSupabaseReports = async () => {
      try {
        const { data, error } = await client
          .from('reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && isMounted) {
          const mapped = data.map(mapDbReportToReportItem);
          setReports(mapped);
        }
      } catch (err) {
        console.warn('Gagal memuat data dari Supabase:', err);
      }
    };

    fetchSupabaseReports();

    // Supabase Realtime Channel
    const channel = client
      .channel('sibahar_realtime_channel')
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
            const newNotif: NotificationItem = {
              id: payload.new.id || 'notif-' + Date.now(),
              title: payload.new.title,
              message: payload.new.message,
              time: 'Baru saja',
              read: payload.new.read || false,
              type: payload.new.type || 'system',
              reportId: payload.new.report_id,
            };
            setNotifications((prev) => [newNotif, ...prev]);
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
  }, [isAuthLoading, isLoggedIn, isSupabaseConnected]);

  // Keep selectedReportForDetail in sync with updated report items
  useEffect(() => {
    if (selectedReportForDetail) {
      const updated = reports.find((r) => r.id === selectedReportForDetail.id);
      if (updated) {
        setSelectedReportForDetail(updated);
      }
    }
  }, [reports]);

  // Handlers for creating reports
  const handleSubmitReport = (newReportData: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>): ReportItem => {
    // Generate sequential ticket ID with format: DDMMYYYY / Nomor Urut (e.g. 12112026/001)
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const dateStr = `${d}${m}${y}`;

    const nonDrafts = reports.filter((r) => r.id.startsWith(dateStr) && !r.id.includes('DRAFT'));
    const nextNum = nonDrafts.length + 1;
    const ticketId = `${dateStr}/${String(nextNum).padStart(3, '0')}`;

    const timeFormatted = now.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const newReport: ReportItem = {
      ...newReportData,
      id: ticketId,
      userId: currentUser.id,
      userRole: currentUser.roleKey,
      createdAt: now.toISOString(),
      logs: [
        {
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          timestamp: timeFormatted,
          actor: currentUser.name,
          action: 'Laporan Dibuat',
          note: `Laporan berhasil diajukan oleh ${currentUser.name} (${USER_ROLES[currentUser.roleKey]?.label || currentUser.role}) ke antrean sistem SIBAHAR.`,
        },
      ],
    };

    // Update local state
    setReports((prev) => [newReport, ...prev]);

    // Insert to Supabase if connected
    const client = getSupabaseClient();
    if (client) {
      client
        .from('reports')
        .insert(mapReportItemToDbRow(newReport, currentUser.id || 'usr-default', currentUser.roleKey || 'guru'))
        .then(
          ({ error }) => {
            if (error) {
              console.warn('Gagal sync insert ke Supabase:', error.message);
            }
          },
          (err: any) => {
            console.warn('Supabase insert network warning (Failed to fetch):', err?.message || err);
          }
        );
    }

    // Add user notification & automated notification for Kepala Sekolah
    const senderRoleLabel = USER_ROLES[currentUser.roleKey]?.label || currentUser.role;
    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: `Laporan Terkirim [${senderRoleLabel}]`,
      message: `Tiket #${ticketId} ("${newReport.title.slice(0, 35)}...") berhasil diajukan oleh ${currentUser.name} ke sistem SIBAHAR.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
      reportId: ticketId,
    };

    // Otomatis kirim notifikasi masuk ke Akun Kepala Sekolah
    const kepsekNotif: NotificationItem = {
      id: 'notif-kepsek-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: `Laporan Masuk: [${senderRoleLabel}]`,
      message: `Laporan baru masuk dari ${currentUser.name} (${senderRoleLabel} — NIP: ${currentUser.nip || '-'}): "${newReport.title}". Laporan otomatis masuk ke antrean pengawasan Anda.`,
      time: 'Baru saja',
      read: false,
      type: 'new_report',
      reportId: ticketId,
      recipientRole: 'kepala_sekolah',
    };

    setNotifications((prev) => [newNotif, kepsekNotif, ...prev]);

    // Record audit event
    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'CREATE_REPORT',
      resourceType: 'reports',
      resourceId: ticketId,
      details: { title: newReport.title, category: newReport.category, priority: newReport.priority }
    });

    return newReport;
  };

  const handleSaveDraft = (draftData: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>): ReportItem => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const dateStr = `${d}${m}${y}`;

    const draftCount = reports.filter((r) => r.id.startsWith(dateStr) && r.status === 'draft').length + 1;
    const draftId = `${dateStr}/DRAFT-${String(draftCount).padStart(3, '0')}`;

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
          id: 'log-' + Math.random().toString(36).substring(2, 9),
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
    setReports((prev) => {
      const updated = prev.filter((r) => r.id !== draftId);
      try {
        localStorage.setItem('sibahar_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    const client = getSupabaseClient();
    if (client) {
      client.from('reports').delete().eq('id', draftId).then(
        ({ error }) => {
          if (error) console.warn('Supabase draft delete warning:', error.message);
        },
        () => {}
      );
    }
  };

  const handleEditReport = (updatedReport: ReportItem) => {
    setReports((prev) => prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)));
    if (selectedReportForDetail?.id === updatedReport.id) {
      setSelectedReportForDetail(updatedReport);
    }

    // Sync to Supabase
    const client = getSupabaseClient();
    if (client) {
      client
        .from('reports')
        .update(mapReportItemToDbRow(
          updatedReport, 
          updatedReport.userId || currentUser.id || 'usr-default', 
          updatedReport.userRole || currentUser.roleKey || 'guru'
        ))
        .eq('id', updatedReport.id)
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase update error:', error.message);
          },
          (err: any) => {
            console.warn('Supabase update network warning (Failed to fetch):', err?.message || err);
          }
        );
    }

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: `Laporan #${updatedReport.id} Diperbarui`,
      message: `Data laporan "${updatedReport.title}" telah diperbarui.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
      reportId: updatedReport.id,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Record audit event
    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'UPDATE_REPORT',
      resourceType: 'reports',
      resourceId: updatedReport.id,
      details: { title: updatedReport.title, status: updatedReport.status }
    });
  };

  const handleDeleteReport = async (reportId: string) => {
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

    // Sync deletion to Supabase (reports & notifications)
    const client = getSupabaseClient();
    if (client) {
      try {
        const { error: repErr } = await client.from('reports').delete().eq('id', reportId);
        if (repErr) console.warn('Supabase delete report error:', repErr.message);

        const { error: notifErr } = await client.from('notifications').delete().eq('report_id', reportId);
        if (notifErr) console.warn('Supabase delete report notifications warning:', notifErr.message);
      } catch (err: any) {
        console.warn('Supabase delete network warning (Failed to fetch):', err?.message || err);
      }
    }

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: 'Laporan Dihapus',
      message: `Tiket #${reportId} telah dihapus dari sistem SIBAHAR.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Record audit event
    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'DELETE_REPORT',
      resourceType: 'reports',
      resourceId: reportId,
      details: {}
    });
  };

  const handleDeleteReportsByRange = async (startDate: string, endDate: string) => {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

    const toDelete = reports.filter((r) => {
      const d = new Date(r.incidentDate || r.createdAt).getTime();
      return d >= start && d <= end;
    });

    const count = toDelete.length;
    if (count === 0) return;

    const idsToDelete = toDelete.map((r) => r.id);

    setReports((prev) => {
      const updated = prev.filter((r) => {
        const d = new Date(r.incidentDate || r.createdAt).getTime();
        return !(d >= start && d <= end);
      });
      try {
        localStorage.setItem('sibahar_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (selectedReportForDetail && idsToDelete.includes(selectedReportForDetail.id)) {
      setSelectedReportForDetail(null);
    }

    // Sync bulk deletion to Supabase
    const client = getSupabaseClient();
    if (client && idsToDelete.length > 0) {
      try {
        const { error } = await client.from('reports').delete().in('id', idsToDelete);
        if (error) console.warn('Supabase bulk delete reports error:', error.message);
      } catch (err: any) {
        console.warn('Supabase bulk delete network warning:', err?.message || err);
      }
    }

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: 'Pembersihan Riwayat Laporan',
      message: `${count} laporan dalam rentang tanggal ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'} telah dihapus dari sistem SIBAHAR.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Record audit event
    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'DELETE_REPORTS_RANGE',
      resourceType: 'reports',
      resourceId: 'BULK',
      details: { startDate, endDate, count }
    });
  };

  const handleUpdateStatus = (reportId: string, newStatus: ReportStatus, note?: string) => {
    const now = new Date();
    const timeFormatted = now.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    let actionLabel = 'Pembaruan Status';
    if (newStatus === 'diproses') actionLabel = 'Sedang Ditangani';
    if (newStatus === 'selesai') actionLabel = 'Kasus Selesai / Teratasi';
    if (newStatus === 'ditolak') actionLabel = 'Laporan Ditolak / Dibatalkan';

    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId) {
          const updated = {
            ...r,
            status: newStatus,
            logs: [
              ...r.logs,
              {
                id: 'log-' + Math.random().toString(36).substring(2, 9),
                timestamp: timeFormatted,
                actor: currentUser.name,
                action: actionLabel,
                note: note || undefined,
              },
            ],
          };

          // Sync status to Supabase
          const client = getSupabaseClient();
          if (client) {
            client
              .from('reports')
              .update({ status: newStatus, logs: updated.logs, updated_at: now.toISOString() })
              .eq('id', reportId)
              .then(
                ({ error }) => {
                  if (error) console.warn('Supabase status update error:', error.message);
                },
                (err: any) => {
                  console.warn('Supabase status update network warning (Failed to fetch):', err?.message || err);
                }
              );
          }

          return updated;
        }
        return r;
      })
    );

    // Add notification
    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: `Status #${reportId} Diperbarui`,
      message: `Status tiket diubah menjadi ${newStatus.toUpperCase()}${note ? `: "${note}"` : '.'}`,
      time: 'Baru saja',
      read: false,
      type: 'status_update',
      reportId,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Record audit event
    logAuditEvent({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.roleKey,
      action: 'UPDATE_STATUS',
      resourceType: 'reports',
      resourceId: reportId,
      details: { newStatus, note }
    });
  };

  const handleAddNote = (reportId: string, note: string) => {
    const now = new Date();
    const timeFormatted = now.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId) {
          const updatedLogs = [
            ...r.logs,
            {
              id: 'log-' + Math.random().toString(36).substring(2, 9),
              timestamp: timeFormatted,
              actor: currentUser.name,
              action: 'Catatan Tindak Lanjut',
              note,
            },
          ];

          // Sync note log to Supabase
          const client = getSupabaseClient();
          if (client) {
            client
              .from('reports')
              .update({ logs: updatedLogs, updated_at: now.toISOString() })
              .eq('id', reportId)
              .then(
                ({ error }) => {
                  if (error) console.warn('Supabase log note update error:', error.message);
                },
                (err: any) => {
                  console.warn('Supabase log note update network warning (Failed to fetch):', err?.message || err);
                }
              );
          }

          return {
            ...r,
            logs: updatedLogs,
          };
        }
        return r;
      })
    );
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
      setNotifications(initialNotifications);
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
          onMarkNotificationRead={(id) => {
            setNotifications((prev) =>
              prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
          }}
          onMarkAllNotificationsRead={() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          }}
          onSelectReportFromNotif={(reportId) => {
            const match = reports.find((r) => r.id === reportId);
            if (match) {
              setSelectedReportForDetail(match);
            }
          }}
        />

        {/* Konten Halaman */}
        <main className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
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
