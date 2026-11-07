import React from 'react';
import { 
  LayoutDashboard,
  FilePlus, 
  BarChart3, 
  ListFilter, 
  Settings, 
  FileText,
  X,
  PhoneCall
} from 'lucide-react';
import { UserProfile } from '../types/report';

export type TabType = 'dashboard' | 'create' | 'stats' | 'history' | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  activeTicketsCount: number;
  userProfile: UserProfile;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  mainLogoUrl?: string;
  helpDeskNumber?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeTicketsCount,
  userProfile,
  isOpenMobile,
  onCloseMobile,
  mainLogoUrl,
  helpDeskNumber = '8800 / 8801',
}) => {
  const navItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard Utama',
      icon: LayoutDashboard,
      highlight: true,
    },
    {
      id: 'create' as TabType,
      label: 'Buat Laporan',
      icon: FilePlus,
      numberPrefix: '1.',
    },
    {
      id: 'stats' as TabType,
      label: 'Ringkasan / Statistik',
      icon: BarChart3,
      numberPrefix: '2.',
    },
    {
      id: 'history' as TabType,
      label: 'Riwayat & Status',
      icon: ListFilter,
      numberPrefix: '3.',
      badgeCount: activeTicketsCount,
    },
    {
      id: 'settings' as TabType,
      label: 'Pengaturan',
      icon: Settings,
      numberPrefix: '4.',
    },
  ];

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container with Green & White Collaboration */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-emerald-950 text-white flex flex-col justify-between shrink-0 transform transition-transform duration-200 ease-in-out md:translate-x-0 border-r border-emerald-900/80 shadow-lg ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand / Logo */}
          <div className="h-20 flex items-center justify-between px-5 border-b border-emerald-900/70 bg-emerald-900/40">
            <div className="flex items-center gap-3">
              {mainLogoUrl ? (
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-emerald-700 shadow-sm overflow-hidden">
                  <img src={mainLogoUrl} alt="Logo SIBAHAR" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-sm shrink-0 border border-emerald-500/50">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <span className="font-bold text-lg tracking-tight text-white block">SIBAHAR</span>
                <span className="text-[9px] text-emerald-300 font-medium block -mt-0.5 tracking-wide leading-tight line-clamp-2">
                  Sistem Informasi Berita Aktual Harian
                </span>
              </div>
            </div>
            {/* Close button for mobile */}
            <button 
              onClick={onCloseMobile}
              className="md:hidden text-emerald-300 hover:text-white p-1"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <div className="p-3.5 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2.5 px-3">
                Menu Utama
              </p>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition text-left ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md font-semibold ring-1 ring-emerald-400/40'
                          : 'text-emerald-200/80 hover:text-white hover:bg-emerald-900/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                      <span className="truncate">
                        {item.numberPrefix && <span className="text-emerald-300/80 mr-1.5 font-mono text-xs">{item.numberPrefix}</span>}
                        {item.label}
                      </span>
                      {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-mono tabular-nums ${
                          isActive 
                            ? 'bg-emerald-800 text-emerald-100 border border-emerald-500' 
                            : 'bg-emerald-900 text-emerald-300 border border-emerald-700'
                        }`}>
                          {item.badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Helper Box (Dynamic Help Desk) */}
            <div className="mx-0.5 p-3.5 rounded-xl bg-emerald-900/50 border border-emerald-800/80 text-xs text-emerald-100 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <p className="font-semibold text-white text-xs">Pusat Bantuan Cepat</p>
              </div>
              <p className="text-emerald-300/90 text-[11px] leading-relaxed mb-2.5">
                Kendala sarpras, keamanan, atau darurat kesehatan? Hubungi meja piket.
              </p>
              <div className="text-[11px] font-mono tabular-nums text-emerald-200 flex items-center justify-between pt-2 border-t border-emerald-800/80">
                <span className="text-emerald-400 font-sans text-[10.5px]">Ext. Help Desk:</span>
                <span className="font-bold text-white bg-emerald-800/80 px-2 py-0.5 rounded border border-emerald-700">
                  {helpDeskNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div 
          onClick={() => handleNavClick('settings')}
          className="p-3.5 m-2.5 rounded-xl bg-emerald-900/60 border border-emerald-800/80 flex items-center gap-3 hover:bg-emerald-900 cursor-pointer transition shadow-xs"
          title="Buka Pengaturan Profil"
        >
          <div className="w-9 h-9 rounded-full bg-white text-emerald-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-emerald-200">
            {userProfile.avatarInitials}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-xs font-semibold truncate text-white" title={userProfile.name}>{userProfile.name}</p>
            <p className="text-[10px] text-emerald-300 truncate" title={userProfile.role}>{userProfile.role}</p>
          </div>
        </div>
      </aside>
    </>
  );
};
