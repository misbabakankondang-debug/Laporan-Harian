export type ReportStatus = 'draft' | 'menunggu' | 'diproses' | 'selesai' | 'ditolak';

export type ReportPriority = 
  | 'ringan' 
  | 'sedang' 
  | 'berat'
  | 'nihil'
  | 'rendah' // backward compatibility
  | 'tinggi'; // backward compatibility

export type JenjangType = 'SRD' | 'SRMP' | 'SRMA';

export type DormitoryType = 'Asrama Putera' | 'Asrama Puteri';

export type ReportEntryMode = 'checklist' | 'other';

export type ChecklistAnswer = 'ya' | 'tidak';

export const JENJANG_OPTIONS: readonly JenjangType[] = ['SRD', 'SRMP', 'SRMA'];

export const DORMITORY_OPTIONS: readonly DormitoryType[] = ['Asrama Putera', 'Asrama Puteri'];

export const CHECKLIST_QUESTIONS: readonly string[] = [
  'Apakah hari ini terjadi perundungan (bullying), baik fisik, verbal, sosial, maupun melalui media digital?',
  'Apakah terjadi dugaan kekerasan fisik, psikis, seksual, atau tindakan yang membahayakan peserta didik?',
  'Apakah terjadi tindakan diskriminasi, intoleransi, atau konflik terkait agama, suku, maupun perbedaan latar belakang?',
  'Apakah terdapat peserta didik/SDM SR sakit, dugaan penyakit menular, atau kondisi kesehatan yang memerlukan penanganan khusus?',
  'Apakah terdapat masalah keamanan, seperti kehilangan, pencurian, peserta didik meninggalkan sekolah tanpa izin, atau ancaman dari luar?',
  'Apakah terdapat kerusakan atau gangguan fasilitas penting, seperti asrama, toilet, air bersih, listrik, dapur, dan ruang kelas?',
  'Apakah terdapat kendala penyediaan makanan, kualitas makanan, kebersihan dapur, atau kebutuhan dasar peserta didik?',
  'Apakah kegiatan pembelajaran hari ini mengalami gangguan signifikan, termasuk ketidakhadiran guru atau keterbatasan sarana belajar?',
  'Apakah terdapat masalah pengasuhan, kondisi psikososial, konflik antarpeserta didik, atau peserta didik yang memerlukan pendampingan khusus?',
  'Apakah terdapat kejadian penting lainnya yang berpotensi mengganggu operasional sekolah atau memerlukan perhatian pimpinan?',
];

export interface ChecklistItemResponse {
  questionIndex: number; // 1..10
  question: string;
  answer: ChecklistAnswer | '';
  description?: string; // Deskripsi kondisi khusus jika answer === 'ya'
}

export interface ReportJenjangEntry {
  id: string;
  jenjang: JenjangType | '';
  dormitoryType: DormitoryType | '';
  category: ReportCategory | '';
  customCategory?: string; // Wajib jika category === 'lainnya_manual'
  priority: ReportPriority;
  mode: ReportEntryMode;
  checklistAnswers?: ChecklistItemResponse[];
  hasYesAnswer?: boolean;
  incidentDescription?: string;
}

export type ReportCategory = 
  // 14 Kategori Resmi Baru
  | 'tata_tertib'
  | 'relasi_perilaku'
  | 'motivasi'
  | 'kedisiplinan'
  | 'tata_tertib_perundungan'
  | 'kekerasan_relasi'
  | 'kesehatan_psikologis'
  | 'pendidikan_kehadiran'
  | 'keselamatan_kekerasan'
  | 'hukum_perundungan'
  | 'kesehatan_keselamatan_diri'
  | 'ruang_digital_pancasila'
  | 'lainnya_manual'
  | 'nihil'
  // Kategori Lama (dipertahankan untuk kompatibilitas laporan historis)
  | 'kategori_1'
  | 'kategori_2'
  | 'kategori_3'
  | 'kegiatan_asrama'
  | 'pengasuhan'
  | 'pembelajaran'
  | 'keamanan_lingkungan'
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
  | 'tenaga_keamanan'
  | 'keamanan' // alias for tenaga_keamanan
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
  tenaga_keamanan: {
    role: 'tenaga_keamanan',
    label: 'Tenaga Keamanan',
    description: 'Pengawasan ketertiban gerbang, patroli malam lingkungan, dan laporan insiden darurat.',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
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
  id: string; // e.g. UUID v4 or legacy "20261106/001"
  userId?: string; // UUID in Supabase
  userRole?: UserRole; // Role of creator
  title: string;
  jenjang?: string; // Ringkasan jenjang (mis. "SRD" atau "SRD, SRMP, SRMA")
  category: ReportCategory;
  customCategory?: string; // Jika kategori utama memakai 'lainnya_manual'
  priority: ReportPriority;
  location?: string;
  incidentDate: string;
  createdAt: string;
  description: string;
  entries?: ReportJenjangEntry[]; // Rincian per jenjang (SRD/SRMP/SRMA) dalam 1 laporan utama
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
  reporterSignature?: string; // Tanda tangan digital pembuat laporan (PNG data URL / URL gambar)
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
  avatarUrl?: string; // Foto profil pengguna
  isActive?: boolean;
}

export interface AuditLogItem {
  id: string;
  userId?: string;
  userRole?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: any;
  createdAt: string;
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
