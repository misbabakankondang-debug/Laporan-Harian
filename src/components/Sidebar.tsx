import React from 'react';
import { 
  LayoutDashboard,
  FilePlus, 
  BarChart3, 
  ListFilter, 
  Settings, 
  X,
  PhoneCall,
  LogOut
} from 'lucide-react';
import { UserProfile, USER_ROLES } from '../types/report';
import { useAuth } from '../context/AuthContext';

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
  mainLogoUrl = 'https://kitasiar.com/wp-content/uploads/2025/12/Logo-Sekolah-Rakyat.jpeg',
  helpDeskNumber = '8800 / 8801',
}) => {
  const effectiveLogoUrl = mainLogoUrl || 'https://kitasiar.com/wp-content/uploads/2025/12/Logo-Sekolah-Rakyat.jpeg';
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

  const { currentRole, logout } = useAuth();

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const handleLogout = () => {
    onCloseMobile();
    void logout();
  };

  const currentRoleInfo = USER_ROLES[currentRole] || USER_ROLES.guru;

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
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-emerald-50 via-teal-50/70 to-emerald-100 text-slate-800 flex flex-col justify-between shrink-0 transform transition-transform duration-200 ease-in-out md:translate-x-0 border-r border-emerald-200/90 shadow-md ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand / Logo */}
          <div className="h-20 flex items-center justify-between px-5 border-b border-emerald-200/80 bg-white/80 backdrop-blur-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-emerald-300 shadow-sm overflow-hidden">
                <img src={effectiveLogoUrl} alt="Logo SIBAHAR" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-lg tracking-tight text-emerald-950 block">SIBAHAR</span>
                <span className="text-[9px] text-emerald-700 font-semibold block -mt-0.5 tracking-wide leading-tight line-clamp-2">
                  Sistem Informasi Berita Aktual Harian
                </span>
              </div>
            </div>
            {/* Close button for mobile */}
            <button 
              onClick={onCloseMobile}
              className="md:hidden text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-200/50"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <div className="p-3.5 space-y-4">
            <div>
              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-2.5 px-3">
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition text-left cursor-pointer ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md font-semibold ring-1 ring-emerald-500'
                          : 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-200/70 font-medium'
                      }`}
                    >
                      <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-700'}`} />
                      <span className="truncate">
                        {item.numberPrefix && <span className={`${isActive ? 'text-emerald-100' : 'text-emerald-700'} mr-1.5 font-mono text-xs font-semibold`}>{item.numberPrefix}</span>}
                        {item.label}
                      </span>
                      {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-mono tabular-nums font-semibold ${
                          isActive 
                            ? 'bg-emerald-800 text-white border border-emerald-500' 
                            : 'bg-emerald-200 text-emerald-900 border border-emerald-300'
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
            <div className="mx-0.5 p-3 rounded-xl bg-white/80 border border-emerald-200/90 text-xs text-slate-800 shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
                <p className="font-bold text-emerald-950 text-xs">Pusat Bantuan Cepat</p>
              </div>
              <p className="text-emerald-800/90 text-[11px] leading-relaxed mb-2">
                Kendala sarpras, keamanan, atau darurat kesehatan? Hubungi meja piket.
              </p>
              <div className="text-[11px] font-mono tabular-nums text-slate-700 flex items-center justify-between pt-1.5 border-t border-emerald-200">
                <span className="text-emerald-800 font-sans text-[10.5px] font-medium">Ext. Help Desk:</span>
                <span className="font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  {helpDeskNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Card & Role Switcher */}
        <div className="p-3 m-2.5 rounded-xl bg-white/85 border border-emerald-200/90 space-y-2 shadow-2xs">
          {/* User Info */}
          <div 
            onClick={() => handleNavClick('settings')}
            className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition"
            title="Buka Pengaturan Profil"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-emerald-300 overflow-hidden">
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt={userProfile.name} className="w-full h-full object-cover" />
              ) : (
                userProfile.avatarInitials
              )}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-bold truncate text-slate-900" title={userProfile.name}>{userProfile.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-semibold px-1.5 py-0.2 rounded border border-emerald-200 truncate">
                  {currentRoleInfo.label}
                </span>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="pt-2 border-t border-emerald-200">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Keluar / Logout dari Sesi SIBAHAR"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar / Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
