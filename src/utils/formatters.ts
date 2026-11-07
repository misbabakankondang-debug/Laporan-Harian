import { ReportCategory, ReportPriority, ReportStatus } from '../types/report';

export function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDateOnly(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const categoryLabels: Record<string, { label: string; subtext: string }> = {
  kategori_1: {
    label: 'Tata Tertib, Relasi & Prilaku, Adaptasi dan Motivasi, Kedisiplinan',
    subtext: 'Pembinaan karakter, ketertiban harian, dan motivasi belajar siswa',
  },
  kategori_2: {
    label: 'Tata Tertib & Perundungan, Kekerasan & Relasi, Kesehatan dan Psikologis, Pendikan & Kehadiran',
    subtext: 'Pencegahan perundungan, konseling psikologis, dan kedisiplinan kehadiran',
  },
  kategori_3: {
    label: 'Keselamatan & Kekerasan, Hukum & Perlindungan, Kesehatan & Keselamatan Diri, Ruang Digital & Nilai',
    subtext: 'Perlindungan anak, penanganan kekerasan, keselamatan fisik & etika digital',
  },
  nihil: {
    label: 'Nihil',
    subtext: 'Tidak ada kejadian atau insiden khusus pada hari ini',
  },
  // Legacy aliases mapped
  teknis: {
    label: 'Tata Tertib, Relasi & Prilaku, Adaptasi dan Motivasi, Kedisiplinan',
    subtext: 'Pembinaan karakter, ketertiban harian, dan motivasi belajar siswa',
  },
  operasional: {
    label: 'Tata Tertib & Perundungan, Kekerasan & Relasi, Kesehatan dan Psikologis, Pendikan & Kehadiran',
    subtext: 'Pencegahan perundungan, konseling psikologis, dan kedisiplinan kehadiran',
  },
  keuangan: {
    label: 'Keselamatan & Kekerasan, Hukum & Perlindungan, Kesehatan & Keselamatan Diri, Ruang Digital & Nilai',
    subtext: 'Perlindungan anak, penanganan kekerasan, keselamatan fisik & etika digital',
  },
  keluhan: {
    label: 'Tata Tertib & Perundungan, Kekerasan & Relasi, Kesehatan dan Psikologis, Pendikan & Kehadiran',
    subtext: 'Pengaduan & penanganan relasi siswa',
  },
  fasilitas: {
    label: 'Keselamatan & Kekerasan, Hukum & Perlindungan, Kesehatan & Keselamatan Diri, Ruang Digital & Nilai',
    subtext: 'Sarana keselamatan & lingkungan',
  },
  lainnya: {
    label: 'Tata Tertib, Relasi & Prilaku, Adaptasi dan Motivasi, Kedisiplinan',
    subtext: 'Laporan umum tata tertib',
  },
};

export const priorityLabels: Record<string, { label: string; description: string; color: string; badge: string }> = {
  ringan: {
    label: 'Kasus Ringan / Resiko Rendah',
    description: 'Penanganan bimbingan dan pembinaan berkala oleh wali asuh/guru',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badge: 'border border-emerald-300 text-emerald-800 bg-emerald-50',
  },
  sedang: {
    label: 'Kasus Sedang / Resiko Sedang',
    description: 'Perlu mediasi, konseling terpadu, dan pendampingan lanjutan (12-24 jam)',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    badge: 'border border-amber-300 text-amber-800 bg-amber-50',
  },
  berat: {
    label: 'Kasus Berat/Kompleks atau Resiko Tinggi/Kritis',
    description: 'Mendesak / Butuh tindakan darurat segera, intervensi medis/hukum (<4 jam)',
    color: 'text-rose-700 bg-rose-50 border-rose-200',
    badge: 'border border-rose-300 text-rose-800 bg-rose-50',
  },
  nihil: {
    label: 'Nihil',
    description: 'Kondisi aman, tertib, dan terkendali tanpa laporan insiden',
    color: 'text-slate-600 bg-slate-100 border-slate-200',
    badge: 'border border-slate-300 text-slate-700 bg-slate-100',
  },
  // Legacy aliases mapped
  rendah: {
    label: 'Kasus Ringan / Resiko Rendah',
    description: 'Penanganan bimbingan dan pembinaan berkala oleh wali asuh/guru',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badge: 'border border-emerald-300 text-emerald-800 bg-emerald-50',
  },
  tinggi: {
    label: 'Kasus Berat/Kompleks atau Resiko Tinggi/Kritis',
    description: 'Mendesak / Butuh tindakan darurat segera, intervensi medis/hukum (<4 jam)',
    color: 'text-rose-700 bg-rose-50 border-rose-200',
    badge: 'border border-rose-300 text-rose-800 bg-rose-50',
  },
};

export const statusLabels: Record<ReportStatus, { label: string; colorClass: string; dotClass: string }> = {
  draft: {
    label: 'Draft',
    colorClass: 'text-slate-600 bg-slate-100 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  menunggu: {
    label: 'Menunggu',
    colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  diproses: {
    label: 'Sedang Diproses',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  selesai: {
    label: 'Selesai',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  ditolak: {
    label: 'Ditolak',
    colorClass: 'text-rose-700 bg-rose-50 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};
