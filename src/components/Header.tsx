import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Plus, Check, Clock, ChevronRight } from 'lucide-react';
import { TabType } from './Sidebar';
import { NotificationItem } from '../types/report';

interface HeaderProps {
  currentTab: TabType;
  onOpenMobileSidebar: () => void;
  onSwitchTab: (tab: TabType) => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onSelectReportFromNotif: (reportId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onSwitchTab,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onSelectReportFromNotif,
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Dashboard Utama (SIBAHAR)';
      case 'create':
        return 'Formulir Pembuatan Laporan';
      case 'stats':
        return 'Ringkasan & Statistik Pelaporan';
      case 'history':
        return 'Riwayat & Pelacakan Status Laporan';
      case 'settings':
        return 'Pengaturan Akun & Preferensi Sistem';
      default:
        return 'Dashboard Pelaporan';
    }
  };

  const getPageSubtitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Sekolah Rakyat Terintegerasi 1 Sumedang - Kementerian Sosial Republik Indonesia';
      case 'create':
        return 'Ajukan laporan kendala teknis, sarana, atau operasional kantor';
      case 'stats':
        return 'Pemantauan tren, waktu tanggap, dan metrik penyelesaian';
      case 'history':
        return 'Pantau proses penanganan dan audit tindak lanjut tiket';
      case 'settings':
        return 'Kelola data kontak pelapor, Help Desk, dan pembersihan riwayat';
      default:
        return '';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-emerald-100 flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 relative z-30 shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {getPageTitle()}
          </h1>
          <p className="hidden sm:block text-xs text-slate-500">
            {getPageSubtitle()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Action Button if outside 'create' */}
        {currentTab !== 'create' && (
          <button
            onClick={() => onSwitchTab('create')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition shadow-xs whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Laporan</span>
          </button>
        )}

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full relative transition focus:outline-hidden"
            aria-label="Pemberitahuan"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Pemberitahuan</h3>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">{unreadCount} pesan belum dibaca</span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllNotificationsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Tandai dibaca
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Tidak ada pemberitahuan baru
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        onMarkNotificationRead(notif.id);
                        if (notif.reportId) {
                          onSelectReportFromNotif(notif.reportId);
                        }
                        setShowNotifMenu(false);
                      }}
                      className={`p-3.5 hover:bg-slate-50 cursor-pointer transition flex items-start gap-3 ${
                        !notif.read ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.read ? 'bg-indigo-600' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                            <Clock className="w-2.5 h-2.5" />
                            {notif.time}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        {notif.reportId && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-indigo-600 hover:underline font-mono mt-1">
                            Buka tiket {notif.reportId} <ChevronRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
