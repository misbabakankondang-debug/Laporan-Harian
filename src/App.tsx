import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { MainDashboardView } from './components/MainDashboardView';
import { CreateReportView } from './components/CreateReportView';
import { SummaryStatsView } from './components/SummaryStatsView';
import { HistoryTrackingView } from './components/HistoryTrackingView';
import { ReportDetailModal } from './components/ReportDetailModal';
import { SettingsView } from './components/SettingsView';
import { 
  ReportItem, 
  UserProfile, 
  AppSettings, 
  NotificationItem, 
  ReportStatus 
} from './types/report';
import { 
  initialReports, 
  initialProfile, 
  initialSettings, 
  initialNotifications 
} from './data/initialData';

export default function App() {
  // Local storage persistence (Requirement: Hapus Semua Laporan yang ada sehingga menjadi kosong semua)
  const [reports, setReports] = useState<ReportItem[]>(() => {
    try {
      const isCleared = localStorage.getItem('sibahar_empty_initialized_v2');
      if (isCleared === 'true') {
        const saved = localStorage.getItem('sibahar_items');
        return saved ? JSON.parse(saved) : [];
      }
      // Initialize as clean empty slate
      localStorage.setItem('sibahar_empty_initialized_v2', 'true');
      localStorage.setItem('sibahar_items', JSON.stringify([]));
      localStorage.removeItem('reporthub_items');
      return [];
    } catch {
      return [];
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('sibahar_profile') || localStorage.getItem('reporthub_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name === 'John Doe') {
          return initialProfile;
        }
        return parsed;
      }
      return initialProfile;
    } catch {
      return initialProfile;
    }
  });

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('sibahar_settings') || localStorage.getItem('reporthub_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.ticketPrefix === 'REP-2026') {
          return initialSettings;
        }
        return parsed;
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

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('sibahar_items', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('sibahar_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('sibahar_settings', JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem('sibahar_notifs', JSON.stringify(notifications));
  }, [notifications]);

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
    // Generate sequential ticket ID with format: Tanggal Input Laporan / Nomor Urut (e.g. 20261106/001)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

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
      createdAt: now.toISOString(),
      logs: [
        {
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          timestamp: timeFormatted,
          actor: userProfile.name,
          action: 'Laporan Dibuat',
          note: 'Laporan berhasil didaftarkan ke antrean sistem SIBAHAR.',
        },
      ],
    };

    setReports((prev) => [newReport, ...prev]);

    // Add notification
    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: 'Laporan Baru Terkirim',
      message: `Tiket #${ticketId} ("${newReport.title.slice(0, 35)}...") berhasil dikirim ke antrean SIBAHAR.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
      reportId: ticketId,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    return newReport;
  };

  const handleSaveDraft = (draftData: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>): ReportItem => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

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
      status: 'draft',
      createdAt: now.toISOString(),
      logs: [
        {
          id: 'log-' + Math.random().toString(36).substring(2, 9),
          timestamp: timeFormatted,
          actor: userProfile.name,
          action: 'Draft Disimpan',
        },
      ],
    };

    setReports((prev) => [draftReport, ...prev]);
    return draftReport;
  };

  const handleDeleteDraft = (draftId: string) => {
    setReports((prev) => prev.filter((r) => r.id !== draftId));
  };

  const handleEditReport = (updatedReport: ReportItem) => {
    setReports((prev) => prev.map((r) => (r.id === updatedReport.id ? updatedReport : r)));
    if (selectedReportForDetail?.id === updatedReport.id) {
      setSelectedReportForDetail(updatedReport);
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
  };

  const handleDeleteReport = (reportId: string) => {
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    if (selectedReportForDetail?.id === reportId) {
      setSelectedReportForDetail(null);
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
  };

  const handleDeleteReportsByRange = (startDate: string, endDate: string) => {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate + 'T23:59:59').getTime() : Infinity;

    const toDelete = reports.filter((r) => {
      const d = new Date(r.incidentDate || r.createdAt).getTime();
      return d >= start && d <= end;
    });

    const count = toDelete.length;
    if (count === 0) return;

    setReports((prev) =>
      prev.filter((r) => {
        const d = new Date(r.incidentDate || r.createdAt).getTime();
        return !(d >= start && d <= end);
      })
    );

    const newNotif: NotificationItem = {
      id: 'notif-' + Date.now(),
      title: 'Pembersihan Riwayat Laporan',
      message: `${count} laporan dalam rentang tanggal ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'} telah dihapus dari sistem SIBAHAR.`,
      time: 'Baru saja',
      read: false,
      type: 'system',
    };
    setNotifications((prev) => [newNotif, ...prev]);
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
          return {
            ...r,
            status: newStatus,
            logs: [
              ...r.logs,
              {
                id: 'log-' + Math.random().toString(36).substring(2, 9),
                timestamp: timeFormatted,
                actor: userProfile.name,
                action: actionLabel,
                note: note || undefined,
              },
            ],
          };
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
          return {
            ...r,
            logs: [
              ...r.logs,
              {
                id: 'log-' + Math.random().toString(36).substring(2, 9),
                timestamp: timeFormatted,
                actor: userProfile.name,
                action: 'Catatan Tindak Lanjut',
                note,
              },
            ],
          };
        }
        return r;
      })
    );
  };

  const handleResetToDefault = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset seluruh data kembali ke data contoh bawaan SIBAHAR?')) {
      setReports(initialReports);
      setUserProfile(initialProfile);
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
      alert('Data sistem SIBAHAR telah direset ke setelan awal.');
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

  // Count active non-draft tickets for sidebar badge
  const activeTicketsCount = reports.filter(
    (r) => r.status === 'diproses' || r.status === 'menunggu'
  ).length;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 antialiased overflow-hidden">
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
        userProfile={userProfile}
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
              userProfile={userProfile}
              appSettings={appSettings}
              onNavigateToTab={(tab) => {
                setCurrentTab(tab);
                if (tab === 'history') {
                  setHistoryStatusFilter('all');
                }
              }}
              onViewReport={(report) => setSelectedReportForDetail(report)}
            />
          )}

          {currentTab === 'create' && (
            <CreateReportView
              reports={reports}
              userProfile={userProfile}
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
              reports={reports}
              onViewReport={(report) => setSelectedReportForDetail(report)}
              onNavigateToHistory={handleNavigateToHistory}
            />
          )}

          {currentTab === 'history' && (
            <HistoryTrackingView
              reports={reports}
              onViewReportDetail={(report) => setSelectedReportForDetail(report)}
              onNavigateToCreate={() => setCurrentTab('create')}
              onEditReport={handleEditReport}
              onDeleteReport={handleDeleteReport}
              initialStatusFilter={historyStatusFilter}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              userProfile={userProfile}
              appSettings={appSettings}
              reports={reports}
              onSaveProfile={setUserProfile}
              onSaveSettings={setAppSettings}
              onResetToDefault={handleResetToDefault}
              onDeleteReportsByRange={handleDeleteReportsByRange}
            />
          )}
        </main>
      </div>

      {/* Detail Modal */}
      {selectedReportForDetail && (
        <ReportDetailModal
          report={selectedReportForDetail}
          onClose={() => setSelectedReportForDetail(null)}
          onUpdateStatus={handleUpdateStatus}
          onAddNote={handleAddNote}
          currentUser={userProfile.name}
          appSettings={appSettings}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}
