import { ReportItem, UserProfile, AppSettings, NotificationItem, UserRole } from '../types/report';

export const initialProfile: UserProfile = {
  id: 'usr-kepala-001',
  name: 'Cece Enjang Kartiwa, S.Pd.,MM',
  nip: '19780706 200501 1 011',
  email: 'cece.enjang@kemensos.go.id',
  phone: '0812-2345-6789',
  department: 'Kementerian Sosial Republik Indonesia',
  role: 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang',
  roleKey: 'kepala_sekolah',
  avatarInitials: 'CK',
};

// 6 Akun Pengguna Standar Sesuai Struktur Resmi Sekolah Rakyat & Kemensos
export const DEFAULT_ROLE_USERS: Record<UserRole, UserProfile & { defaultPassword: string }> = {
  admin: {
    id: 'usr-admin-001',
    name: 'Igar Nurdiansah, S.Kom',
    nip: '19940613 202622 1 001',
    email: 'admin@srt1sumedang.sch.id',
    phone: '0813-9876-5432',
    department: 'Subbag Tata Usaha & IT',
    role: 'Administrator Sistem SIBAHAR',
    roleKey: 'admin',
    avatarInitials: 'IN',
    defaultPassword: 'password123',
    isActive: true,
  },
  wali_asrama: {
    id: 'usr-asrama-001',
    name: 'Romi Apek Nugraha, S.Pd',
    nip: '19830610 200902 1 004',
    email: 'wali.asrama@srt1sumedang.sch.id',
    phone: '0821-4567-8901',
    department: 'Unit Pengelolaan Asrama Terpadu',
    role: 'Wali Asrama',
    roleKey: 'wali_asrama',
    avatarInitials: 'RN',
    defaultPassword: 'password123',
    isActive: true,
  },
  wali_asuh: {
    id: 'usr-asuh-001',
    name: 'Iway Sri Wulan',
    nip: '19900822 201403 2 006',
    email: 'wali.asuh@srt1sumedang.sch.id',
    phone: '0852-7890-1234',
    department: 'Unit Bimbingan Konseling & Karakter',
    role: 'Wali Asuh & Pengasuh Siswa',
    roleKey: 'wali_asuh',
    avatarInitials: 'IW',
    defaultPassword: 'password123',
    isActive: true,
  },
  guru: {
    id: 'usr-guru-001',
    name: 'Rizal Abdul Rosyid',
    nip: '19781119 200501 1 002',
    email: 'guru@srt1sumedang.sch.id',
    phone: '0878-1234-5678',
    department: 'Kelompok Tenaga Pendidik / Guru',
    role: 'Guru Kelas & Pembina Akademik',
    roleKey: 'guru',
    avatarInitials: 'RR',
    defaultPassword: 'password123',
    isActive: true,
  },
  tenaga_keamanan: {
    id: 'usr-keamanan-001',
    name: 'Riki',
    nip: '19810214 201004 1 008',
    email: 'keamanan@srt1sumedang.sch.id',
    phone: '0896-2345-6789',
    department: 'Unit Keamanan & Ketertiban Lingkungan',
    role: 'Tenaga Keamanan',
    roleKey: 'tenaga_keamanan',
    avatarInitials: 'RK',
    defaultPassword: 'password123',
    isActive: true,
  },
  // Alias untuk kompatibilitas tipe UserRole (hanya merujuk ke data tunggal Riki)
  keamanan: {
    id: 'usr-keamanan-001',
    name: 'Riki',
    nip: '19810214 201004 1 008',
    email: 'keamanan@srt1sumedang.sch.id',
    phone: '0896-2345-6789',
    department: 'Unit Keamanan & Ketertiban Lingkungan',
    role: 'Tenaga Keamanan',
    roleKey: 'tenaga_keamanan',
    avatarInitials: 'RK',
    defaultPassword: 'password123',
    isActive: true,
  },
  kepala_sekolah: {
    id: 'usr-kepala-001',
    name: 'Cece Enjang Kartiwa, S.Pd.,MM',
    nip: '19780706 200501 1 011',
    email: 'kepala.sekolah@srt1sumedang.sch.id',
    phone: '0812-2345-6789',
    department: 'Kementerian Sosial Republik Indonesia',
    role: 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang',
    roleKey: 'kepala_sekolah',
    avatarInitials: 'CK',
    defaultPassword: 'password123',
    isActive: true,
  },
};

// 6 Akun Standar Resmi Tunggal Tanpa Duplikasi
export const CANONICAL_ROLE_USERS: (UserProfile & { defaultPassword: string })[] = [
  DEFAULT_ROLE_USERS.admin,
  DEFAULT_ROLE_USERS.wali_asrama,
  DEFAULT_ROLE_USERS.wali_asuh,
  DEFAULT_ROLE_USERS.guru,
  DEFAULT_ROLE_USERS.tenaga_keamanan,
  DEFAULT_ROLE_USERS.kepala_sekolah,
];

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
