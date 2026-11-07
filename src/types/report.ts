export type ReportStatus = 'draft' | 'menunggu' | 'diproses' | 'selesai' | 'ditolak';

export type ReportPriority = 
  | 'ringan' 
  | 'sedang' 
  | 'berat'
  | 'nihil'
  | 'rendah' // backward compatibility
  | 'tinggi'; // backward compatibility

export type ReportCategory = 
  | 'kategori_1' // Tata Tertib, Relasi & Prilaku, Adaptasi dan Motivasi, Kedisiplinan
  | 'kategori_2' // Tata Tertib & Perundungan, Kekerasan & Relasi, Kesehatan dan Psikologis, Pendikan & Kehadiran
  | 'kategori_3' // Keselamatan & Kekerasan, Hukum & Perlindungan, Kesehatan & Keselamatan Diri, Ruang Digital & Nilai
  | 'nihil'      // Nihil
  | 'kegiatan_asrama' // Tambahan kegiatan asrama
  | 'pengasuhan'      // Pembinaan & pengasuhan
  | 'pembelajaran'    // Pembelajaran & kelas
  | 'keamanan_lingkungan' // Keamanan & ketertiban
  | 'teknis'
  | 'operasional'
  | 'keuangan'
  | 'keluhan'
  | 'fasilitas'
  | 'lainnya';

export type UserRole = 
  | 'admin'
  | 'wali_asrama'
  | 'wali_asuh'
  | 'guru'
  | 'keamanan'
  | 'kepala_sekolah';

export interface UserRoleInfo {
  role: UserRole;
  label: string;
  description: string;
  badgeClass: string;
}

export const USER_ROLES: Record<UserRole, UserRoleInfo> = {
  admin: {
    role: 'admin',
    label: 'Admin',
    description: 'Pengelolaan pengguna, pengaturan sistem, dan laporan administratif pribadi.',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  wali_asrama: {
    role: 'wali_asrama',
    label: 'Wali Asrama',
    description: 'Pencatatan kegiatan asrama, piket kedisiplinan, dan kondisi fasilitas kamar santri/siswa.',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  wali_asuh: {
    role: 'wali_asuh',
    label: 'Wali Asuh',
    description: 'Pembinaan karakter, bimbingan moral, kesehatan mental, dan pengasuhan harian siswa.',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  guru: {
    role: 'guru',
    label: 'Guru',
    description: 'Pelaporan kegiatan belajar mengajar, presensi kelas, bimbingan akademik, dan tugas sekolah.',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  keamanan: {
    role: 'keamanan',
    label: 'Tenaga Keamanan',
    description: 'Pengawasan ketertiban gerbang, patroli malam lingkungan, dan laporan insiden darurat.',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  kepala_sekolah: {
    role: 'kepala_sekolah',
    label: 'Kepala Sekolah',
    description: 'Akses pengawasan penuh seluruh laporan staf, audit rekapitulasi, disposisi, dan pelaporan pusat Kemensos.',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
  },
};

export interface AttachmentFile {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  dataUrl?: string;
  storagePath?: string;
}

export interface ReportLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  note?: string;
}

export interface ReportItem {
  id: string; // e.g. "20261106/001"
  userId?: string; // UUID in Supabase
  userRole?: UserRole; // Role of creator
  title: string;
  category: ReportCategory;
  priority: ReportPriority;
  location?: string;
  incidentDate: string;
  createdAt: string;
  description: string;
  status: ReportStatus;
  reporterName: string;
  reporterEmail: string;
  reporterDept: string;
  reporterNip?: string;
  // Penanggung Jawab / Laporan dari (Ditulis manual)
  picName?: string;
  picRole?: string;
  picNip?: string;
  assignedTo?: string;
  attachments: AttachmentFile[];
  logs: ReportLog[];
}

export interface UserProfile {
  id?: string; // Supabase user UUID
  name: string;
  nip: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  roleKey: UserRole;
  avatarInitials: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'status_update' | 'new_comment' | 'system' | 'new_report';
  reportId?: string;
  recipientId?: string;
  recipientRole?: UserRole;
}

export interface AppSettings {
  ticketPrefix: string;
  emailNotification: boolean;
  whatsappNotification: boolean;
  autoSaveDraft: boolean;
  mainLogoUrl?: string; // Logo Utama aplikasi
  kopLogoUrl?: string;  // Logo Kop Surat
  kopAddress?: string;  // Alamat Kop Surat
  helpDeskNumber?: string; // Nomor telepon / ext Help Desk
  backgroundHeroUrl?: string; // Foto background landscape Dashboard Utama
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
