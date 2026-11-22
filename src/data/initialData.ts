import { ReportItem, UserProfile, AppSettings, NotificationItem } from '../types/report';

export const initialProfile: UserProfile = {
  id: '',
  name: '',
  nip: '',
  email: '',
  phone: '',
  department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
  role: '',
  roleKey: 'guru',
  avatarInitials: 'SR',
};

export const initialSettings: AppSettings = {
  ticketPrefix: 'DDMMYYYY/Nomor Urut',
  emailNotification: true,
  whatsappNotification: true,
  autoSaveDraft: true,
  mainLogoUrl: 'https://kitasiar.com/wp-content/uploads/2025/12/Logo-Sekolah-Rakyat.jpeg',
  kopLogoUrl: 'https://vectorez.biz.id/wp-content/uploads/2024/05/Logo-Kementerian-Sosial-Kemensos-Republik-Indonesia@0.5x.png',
  kopAddress: 'Desa Kebon Cau, Kecamatan Ujung Jaya Kabupaten Sumedang Kode Pos 45383',
  helpDeskNumber: '8800 / 8801',
  backgroundHeroUrl: '',
};

// Requirement: Laporan kosong awal, tersimpan secara otomatis di Supabase
export const initialReports: ReportItem[] = [];

export const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-welcome',
    title: 'Sistem SIBAHAR Terintegerasi Supabase Aktif',
    message: 'SIBAHAR telah dikonfigurasi dengan 6 Hak Akses Pengguna (RBAC) & keamanan RLS. Kepala Sekolah menerima notifikasi terpusat secara otomatis.',
    time: 'Baru saja',
    read: false,
    type: 'system',
    recipientRole: 'kepala_sekolah',
  },
];
