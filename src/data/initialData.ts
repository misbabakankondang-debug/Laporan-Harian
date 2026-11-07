import { ReportItem, UserProfile, AppSettings, NotificationItem } from '../types/report';

export const initialProfile: UserProfile = {
  name: 'Cece Enjang Kartiwa, S.Pd.,MM',
  nip: '19740512 200212 1 003',
  email: 'cece.enjang@kemensos.go.id',
  phone: '0812-2345-6789',
  department: 'Kementerian Sosial Republik Indonesia',
  role: 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang',
  avatarInitials: 'CK',
};

export const initialSettings: AppSettings = {
  ticketPrefix: 'Tanggal Input Laporan/Nomor Urut',
  emailNotification: true,
  whatsappNotification: true,
  autoSaveDraft: true,
  kopAddress: 'Jl. Raya Sumedang - Wado, Paseh, Kabupaten Sumedang, Jawa Barat 45311 | Pos-el: srt1sumedang@kemensos.go.id',
  helpDeskNumber: '8800 / 8801',
};

// Requirement: Hapus Semua Laporan yang ada sehingga menjadi kosong semua
export const initialReports: ReportItem[] = [];

export const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-welcome',
    title: 'Sistem SIBAHAR Siap Digunakan',
    message: 'Seluruh riwayat laporan telah dibersihkan. Sistem SIBAHAR siap untuk pencatatan berita aktual harian baru.',
    time: 'Baru saja',
    read: false,
    type: 'system',
  },
];
