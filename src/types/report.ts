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
  | 'teknis'
  | 'operasional'
  | 'keuangan'
  | 'keluhan'
  | 'fasilitas'
  | 'lainnya';

export interface AttachmentFile {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  dataUrl?: string;
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
  name: string;
  nip: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  avatarInitials: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'status_update' | 'new_comment' | 'system';
  reportId?: string;
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
}
