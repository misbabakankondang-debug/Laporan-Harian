import React, { useState } from 'react';
import { 
  LayoutDashboard,
  FilePlus, 
  BarChart3, 
  ListFilter, 
  Settings, 
  FileText,
  X,
  PhoneCall,
  UserCheck,
  LogOut,
  ChevronDown,
  Copy,
  Check
} from 'lucide-react';
import { UserProfile, UserRole, USER_ROLES } from '../types/report';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_ROLE_USERS } from '../data/initialData';

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

  const { currentRole, loginWithRole, logout } = useAuth();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const handleSelectRole = (r: UserRole) => {
    loginWithRole(r);
    setShowRoleModal(false);
  };

  const handleLogout = () => {
    logout();
    setShowRoleModal(false);
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
              {mainLogoUrl ? (
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-emerald-300 shadow-sm overflow-hidden">
                  <img src={mainLogoUrl} alt="Logo SIBAHAR" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="bg-emerald-600 p-2.5 rounded-xl text-white shadow-sm shrink-0 border border-emerald-500">
                  <FileText className="w-5 h-5" />
                </div>
              )}
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

          {/* Role Switcher Button */}
          <div className="pt-2 border-t border-emerald-200 flex items-center justify-between gap-1.5">
            <button
              onClick={() => setShowRoleModal(true)}
              className="flex-1 text-[11px] font-semibold text-emerald-900 hover:text-emerald-950 bg-emerald-100/90 hover:bg-emerald-200 px-2 py-1.5 rounded-lg border border-emerald-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Ganti Jenis Akun (6 Role)"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ganti Role</span>
              <ChevronDown className="w-3 h-3 text-emerald-700" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition cursor-pointer"
              title="Keluar / Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Modal Pemilihan 6 Role Pengguna */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Pilih Akun / Role SIBAHAR</h3>
                <p className="text-xs text-emerald-200">Ganti wewenang untuk menguji hak akses RBAC &amp; RLS</p>
              </div>
              <button 
                onClick={() => setShowRoleModal(false)}
                className="text-emerald-300 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
              {(Object.keys(DEFAULT_ROLE_USERS) as UserRole[]).map((rKey) => {
                const u = DEFAULT_ROLE_USERS[rKey];
                const info = USER_ROLES[rKey];
                const isActive = currentRole === rKey;

                return (
                  <button
                    key={rKey}
                    onClick={() => handleSelectRole(rKey)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 overflow-hidden ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.avatarInitials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate">{info.label}</span>
                        {isActive && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                            Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 truncate font-medium">{u.name}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{info.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?portal=staf`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Tersalin!' : 'Salin Link Staf & Kepala Sekolah'}</span>
              </button>
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
