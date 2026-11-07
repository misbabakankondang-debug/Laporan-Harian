import { ReportItem, UserProfile, AppSettings, NotificationItem, UserRole } from '../types/report';

export const initialProfile: UserProfile = {
  id: 'usr-kepala-001',
  name: 'Cece Enjang Kartiwa, S.Pd.,MM',
  nip: '19740512 200212 1 003',
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
    name: 'Ahmad Fauzi, S.Kom',
    nip: '19880415 201201 1 005',
    email: 'admin@srt1sumedang.sch.id',
    phone: '0813-9876-5432',
    department: 'Subbag Tata Usaha & IT',
    role: 'Administrator Sistem SIBAHAR',
    roleKey: 'admin',
    avatarInitials: 'AF',
    defaultPassword: 'password123',
  },
  wali_asrama: {
    id: 'usr-asrama-001',
    name: 'H. Dedi Mulyana, S.Pd.I',
    nip: '19830610 200902 1 004',
    email: 'wali.asrama@srt1sumedang.sch.id',
    phone: '0821-4567-8901',
    department: 'Unit Pengelolaan Asrama Terpadu',
    role: 'Wali Asrama',
    roleKey: 'wali_asrama',
    avatarInitials: 'DM',
    defaultPassword: 'password123',
  },
  wali_asuh: {
    id: 'usr-asuh-001',
    name: 'Siti Rahmawati, S.Psi',
    nip: '19900822 201403 2 006',
    email: 'wali.asuh@srt1sumedang.sch.id',
    phone: '0852-7890-1234',
    department: 'Unit Bimbingan Konseling & Karakter',
    role: 'Wali Asuh & Pengasuh Siswa',
    roleKey: 'wali_asuh',
    avatarInitials: 'SR',
    defaultPassword: 'password123',
  },
  guru: {
    id: 'usr-guru-001',
    name: 'Drs. Bambang Sudrajat',
    nip: '19781119 200501 1 002',
    email: 'guru@srt1sumedang.sch.id',
    phone: '0878-1234-5678',
    department: 'Kelompok Tenaga Pendidik / Guru',
    role: 'Guru Kelas & Pembina Akademik',
    roleKey: 'guru',
    avatarInitials: 'BS',
    defaultPassword: 'password123',
  },
  keamanan: {
    id: 'usr-keamanan-001',
    name: 'Agus Supriyanto',
    nip: '19810214 201004 1 008',
    email: 'keamanan@srt1sumedang.sch.id',
    phone: '0896-2345-6789',
    department: 'Unit Keamanan & Ketertiban Lingkungan',
    role: 'Komandan Regu Tenaga Keamanan',
    roleKey: 'keamanan',
    avatarInitials: 'AS',
    defaultPassword: 'password123',
  },
  kepala_sekolah: {
    id: 'usr-kepala-001',
    name: 'Cece Enjang Kartiwa, S.Pd.,MM',
    nip: '19740512 200212 1 003',
    email: 'kepala.sekolah@srt1sumedang.sch.id',
    phone: '0812-2345-6789',
    department: 'Kementerian Sosial Republik Indonesia',
    role: 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang',
    roleKey: 'kepala_sekolah',
    avatarInitials: 'CK',
    defaultPassword: 'password123',
  },
};

export const initialSettings: AppSettings = {
  ticketPrefix: 'Tanggal Input Laporan/Nomor Urut',
  emailNotification: true,
  whatsappNotification: true,
  autoSaveDraft: true,
  kopAddress: 'Jl. Raya Sumedang - Wado, Paseh, Kabupaten Sumedang, Jawa Barat 45311 | Pos-el: srt1sumedang@kemensos.go.id',
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
