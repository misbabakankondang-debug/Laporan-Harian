import {
  AttachmentFile,
  CHECKLIST_QUESTIONS,
  ChecklistItemResponse,
  DORMITORY_OPTIONS,
  DormitoryType,
  JenjangType,
  ReportCategory,
  ReportItem,
  ReportJenjangEntry,
  ReportPriority,
  ReportStatus,
  USER_ROLES,
  UserProfile,
  UserRole,
} from '../types/report';

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

export function formatReportTicketNumber(
  reportOrId: string | { id: string; createdAt?: string; incidentDate?: string }
): string {
  const id = typeof reportOrId === 'string' ? reportOrId : reportOrId?.id || '';
  if (!id) return '-';

  // Pertahankan nomor tiket format lama (mis. 12112026/001 atau 12112026/DRAFT-001)
  if (/^\d{8}\//.test(id) || id.includes('DRAFT-')) {
    return id;
  }

  // Untuk ID unik global berbasis UUID (atau prefix draft-), bentuk nomor tiket tampilan DDMMYYYY/XXXXXXXX
  const cleanHex = id.replace(/^draft-/i, '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const dateSource =
    typeof reportOrId === 'object' ? reportOrId.createdAt || reportOrId.incidentDate : undefined;

  let datePrefix = '';
  if (dateSource) {
    const parsed = new Date(dateSource);
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      datePrefix = `${d}${m}${y}`;
    }
  }

  if (id.toLowerCase().startsWith('draft-')) {
    return datePrefix ? `${datePrefix}/DRAFT-${cleanHex}` : `DRAFT-${cleanHex}`;
  }

  return datePrefix ? `${datePrefix}/${cleanHex}` : cleanHex;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const NEW_CATEGORY_OPTIONS: Array<{ value: ReportCategory; label: string }> = [
  { value: 'tata_tertib', label: 'Tata Tertib' },
  { value: 'relasi_perilaku', label: 'Relasi & Perilaku' },
  { value: 'motivasi', label: 'Motivasi' },
  { value: 'kedisiplinan', label: 'Kedisiplinan' },
  { value: 'tata_tertib_perundungan', label: 'Tata Tertib dan Perundungan' },
  { value: 'kekerasan_relasi', label: 'Kekerasan & Relasi' },
  { value: 'kesehatan_psikologis', label: 'Kesehatan dan Psikologis' },
  { value: 'pendidikan_kehadiran', label: 'Pendidikan dan Kehadiran' },
  { value: 'keselamatan_kekerasan', label: 'Keselamatan dan Kekerasan' },
  { value: 'hukum_perundungan', label: 'Hukum & Perundungan' },
  { value: 'kesehatan_keselamatan_diri', label: 'Kesehatan & Keselamatan Diri' },
  { value: 'ruang_digital_pancasila', label: 'Ruang Digital & Nilai Pancasila' },
  { value: 'lainnya_manual', label: 'Lainnya (Tulis Manual)' },
  { value: 'nihil', label: 'Nihil' },
];

export const LEGACY_CATEGORY_OPTIONS: Array<{ value: ReportCategory; label: string }> = [
  { value: 'kategori_1', label: 'Tata Tertib, Relasi & Prilaku, Adaptasi dan Motivasi, Kedisiplinan (Lama)' },
  { value: 'kategori_2', label: 'Tata Tertib & Perundungan, Kekerasan & Relasi, Kesehatan dan Psikologis (Lama)' },
  { value: 'kategori_3', label: 'Keselamatan & Kekerasan, Hukum & Perlindungan, Kesehatan & Keselamatan Diri (Lama)' },
  { value: 'kegiatan_asrama', label: 'Kegiatan Asrama & Kebersihan Kamar (Lama)' },
  { value: 'pengasuhan', label: 'Pengasuhan & Bimbingan Karakter (Lama)' },
  { value: 'pembelajaran', label: 'Kegiatan Pembelajaran & Kelas (Lama)' },
  { value: 'keamanan_lingkungan', label: 'Keamanan & Ketertiban Lingkungan (Lama)' },
];

export const categoryLabels: Record<string, { label: string; subtext: string }> = {
  // 14 Kategori Resmi Baru
  tata_tertib: {
    label: 'Tata Tertib',
    subtext: 'Kepatuhan aturan sekolah dan asrama',
  },
  relasi_perilaku: {
    label: 'Relasi & Perilaku',
    subtext: 'Interaksi sosial dan perilaku harian peserta didik',
  },
  motivasi: {
    label: 'Motivasi',
    subtext: 'Semangat belajar, adaptasi, dan pengembangan diri',
  },
  kedisiplinan: {
    label: 'Kedisiplinan',
    subtext: 'Ketepatan waktu, piket, dan tanggung jawab rutin',
  },
  tata_tertib_perundungan: {
    label: 'Tata Tertib dan Perundungan',
    subtext: 'Pencegahan dan penanganan indikasi bullying/perundungan',
  },
  kekerasan_relasi: {
    label: 'Kekerasan & Relasi',
    subtext: 'Penanganan konflik, relasi interpersonal, dan tindakan agresif',
  },
  kesehatan_psikologis: {
    label: 'Kesehatan dan Psikologis',
    subtext: 'Kondisi kesehatan fisik, mental, dan konseling peserta didik',
  },
  pendidikan_kehadiran: {
    label: 'Pendidikan dan Kehadiran',
    subtext: 'Aktivitas belajar mengajar dan kedisiplinan presensi',
  },
  keselamatan_kekerasan: {
    label: 'Keselamatan dan Kekerasan',
    subtext: 'Keselamatan lingkungan sekolah/asrama dan perlindungan siswa',
  },
  hukum_perundungan: {
    label: 'Hukum & Perundungan',
    subtext: 'Aspek perlindungan hukum anak dan penanganan pelanggaran berat',
  },
  kesehatan_keselamatan_diri: {
    label: 'Kesehatan & Keselamatan Diri',
    subtext: 'Keselamatan fisik, pertolongan pertama, dan kesehatan darurat',
  },
  ruang_digital_pancasila: {
    label: 'Ruang Digital & Nilai Pancasila',
    subtext: 'Etika bermedia digital, toleransi, dan pengamalan nilai Pancasila',
  },
  lainnya_manual: {
    label: 'Lainnya (Tulis Manual)',
    subtext: 'Kategori khusus sesuai isian manual pelapor',
  },
  nihil: {
    label: 'Nihil',
    subtext: 'Tidak ada kejadian atau insiden khusus pada hari ini',
  },
  // Legacy aliases mapped (dipertahankan penuh agar laporan lama tetap tampil rapi)
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
  kegiatan_asrama: {
    label: 'Kegiatan Asrama & Kebersihan Kamar',
    subtext: 'Piket kamar dan ketertiban asrama',
  },
  pengasuhan: {
    label: 'Pengasuhan & Bimbingan Karakter',
    subtext: 'Pendampingan wali asuh',
  },
  pembelajaran: {
    label: 'Kegiatan Pembelajaran & Kelas',
    subtext: 'Akademik dan presensi sekolah',
  },
  keamanan_lingkungan: {
    label: 'Keamanan & Ketertiban Lingkungan',
    subtext: 'Patroli dan pos jaga sekolah',
  },
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
    label: 'Lainnya',
    subtext: 'Laporan umum tata tertib dan kondisi sekolah/asrama',
  },
};

export function getCategoryDisplayLabel(category?: string, customCategory?: string): string {
  const cat = String(category || '').trim();
  const custom = String(customCategory || '').trim();
  if (cat === 'lainnya_manual') {
    return custom ? `Lainnya: ${custom}` : 'Lainnya (Tulis Manual)';
  }
  return categoryLabels[cat]?.label || custom || cat || '-';
}

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

export const MAX_CHECKLIST_EVIDENCE_PHOTOS = 2;

export function normalizeDormitoryTypes(
  rawDormitoryTypes?: unknown,
  rawDormitoryType?: unknown
): DormitoryType[] {
  const selected = new Set<DormitoryType>();

  if (Array.isArray(rawDormitoryTypes)) {
    rawDormitoryTypes.forEach((val) => {
      const s = String(val || '').trim();
      if (s === 'Asrama Putera' || s === 'Asrama Puteri') {
        selected.add(s);
      }
    });
  }

  if (selected.size === 0 && typeof rawDormitoryType === 'string' && rawDormitoryType.trim()) {
    const rawStr = rawDormitoryType.trim();
    const lower = rawStr.toLowerCase();
    if (lower.includes('putera') || lower.includes('putra')) {
      selected.add('Asrama Putera');
    }
    if (lower.includes('puteri') || lower.includes('putri')) {
      selected.add('Asrama Puteri');
    }
  }

  return DORMITORY_OPTIONS.filter((opt) => selected.has(opt));
}

export function formatDormitoryTypesLabel(
  dormitoryTypes?: DormitoryType[],
  fallbackDormitoryType?: string
): string {
  const normalized = normalizeDormitoryTypes(dormitoryTypes, fallbackDormitoryType);
  if (normalized.length === 0) return '';
  return normalized.join(' & ');
}

const IMAGE_FILE_EXT_REGEX = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

export function isImageAttachmentFile(att: {
  name?: string;
  type?: string;
  dataUrl?: string;
}): boolean {
  const mime = String(att?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const dataUrl = String(att?.dataUrl || '').toLowerCase();
  if (dataUrl.startsWith('data:image/')) return true;
  return IMAGE_FILE_EXT_REGEX.test(String(att?.name || ''));
}

export function normalizeChecklistAttachment(raw: any, fallbackIndex: number): AttachmentFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const dataUrl = typeof raw.dataUrl === 'string' ? raw.dataUrl.trim() : '';
  const storagePath = typeof raw.storagePath === 'string' ? raw.storagePath.trim() : '';
  if (!url && !dataUrl && !storagePath) return null;

  return {
    id: String(raw.id || `ev-${Date.now().toString(36)}-${fallbackIndex}`),
    name: String(raw.name || `eviden_${fallbackIndex + 1}.jpg`),
    size: Number(raw.size) > 0 ? Number(raw.size) : 0,
    type: String(raw.type || 'image/jpeg'),
    ...(storagePath ? { storagePath } : {}),
    ...(url ? { url } : {}),
    ...(dataUrl ? { dataUrl } : {}),
    ...(Number(raw.originalSize) > 0 ? { originalSize: Number(raw.originalSize) } : {}),
  };
}

export function createDefaultChecklistAnswers(): ChecklistItemResponse[] {
  return CHECKLIST_QUESTIONS.map((question, idx) => ({
    questionIndex: idx + 1,
    question,
    answer: '',
    description: '',
    attachments: [],
  }));
}

export function normalizeChecklistAnswers(
  rawAnswers?: ChecklistItemResponse[]
): ChecklistItemResponse[] {
  const byIndex = new Map<number, ChecklistItemResponse>();
  if (Array.isArray(rawAnswers)) {
    rawAnswers.forEach((item, idx) => {
      const qIndex = Number(item?.questionIndex) || idx + 1;
      const ans = item?.answer === 'ya' || item?.answer === 'tidak' ? item.answer : '';
      const rawDesc = typeof item?.description === 'string' ? item.description : '';
      const rawAtts = Array.isArray(item?.attachments)
        ? item.attachments
            .map((att, attIdx) => normalizeChecklistAttachment(att, attIdx))
            .filter((att): att is AttachmentFile => Boolean(att))
        : [];
      byIndex.set(qIndex, {
        questionIndex: qIndex,
        question: CHECKLIST_QUESTIONS[qIndex - 1] || item?.question || `Pertanyaan ${qIndex}`,
        answer: ans,
        description: ans === 'tidak' ? '' : rawDesc,
        attachments: ans === 'tidak' ? [] : rawAtts,
      });
    });
  }

  return CHECKLIST_QUESTIONS.map((question, idx) => {
    const qIndex = idx + 1;
    const found = byIndex.get(qIndex);
    return (
      found || {
        questionIndex: qIndex,
        question,
        answer: '',
        description: '',
        attachments: [],
      }
    );
  });
}

export function createEmptyJenjangEntry(jenjang: JenjangType | '' = ''): ReportJenjangEntry {
  let rand = '';
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      rand = globalThis.crypto.randomUUID().slice(0, 8);
    }
  } catch {}
  if (!rand) {
    rand = Math.random().toString(36).substring(2, 10);
  }
  return {
    id: `entry-${rand}-${Date.now().toString(36)}`,
    jenjang,
    dormitoryType: '',
    dormitoryTypes: [],
    category: '',
    customCategory: '',
    priority: 'sedang',
    mode: 'checklist',
    checklistAnswers: createDefaultChecklistAnswers(),
    hasYesAnswer: false,
    incidentDescription: '',
  };
}

export function normalizeJenjangEntry(raw: any, index = 0): ReportJenjangEntry {
  const mode = raw?.mode === 'other' ? 'other' : 'checklist';
  const checklistAnswers = normalizeChecklistAnswers(raw?.checklistAnswers);
  const hasYesAnswer =
    mode === 'checklist' && checklistAnswers.some((item) => item.answer === 'ya');
  const dormitoryTypes = normalizeDormitoryTypes(raw?.dormitoryTypes, raw?.dormitoryType);
  const dormitoryType = formatDormitoryTypesLabel(dormitoryTypes, raw?.dormitoryType);

  return {
    id: String(raw?.id || `entry-${index + 1}`),
    jenjang:
      raw?.jenjang === 'SRD' || raw?.jenjang === 'SRMP' || raw?.jenjang === 'SRMA'
        ? raw.jenjang
        : '',
    dormitoryType,
    dormitoryTypes,
    category: (raw?.category || '') as ReportCategory | '',
    customCategory: typeof raw?.customCategory === 'string' ? raw.customCategory : '',
    priority: (raw?.priority || 'sedang') as ReportPriority,
    mode,
    checklistAnswers,
    hasYesAnswer,
    incidentDescription:
      typeof raw?.incidentDescription === 'string' ? raw.incidentDescription : '',
  };
}

export function entryHasYesFindings(entry: ReportJenjangEntry): boolean {
  if (entry.mode !== 'checklist') return false;
  if (Array.isArray(entry.checklistAnswers)) {
    return entry.checklistAnswers.some((a) => a.answer === 'ya');
  }
  return Boolean(entry.hasYesAnswer);
}

export function reportHasYesFindings(report: ReportItem): boolean {
  if (!Array.isArray(report.entries) || report.entries.length === 0) return false;
  return report.entries.some((entry) => entryHasYesFindings(entry));
}

export interface EntryValidationErrors {
  jenjang?: string;
  dormitoryType?: string;
  category?: string;
  customCategory?: string;
  checklist?: string;
  checklistDescriptions?: string;
  checklistAttachments?: string;
  unansweredIndices?: number[];
  missingYesDescriptionIndices?: number[];
  yesDescriptionErrors?: Record<number, string>;
  yesAttachmentErrors?: Record<number, string>;
  incidentDescription?: string;
}

export function validateJenjangEntries(entries: ReportJenjangEntry[]): {
  valid: boolean;
  entryErrors: Record<string, EntryValidationErrors>;
  firstErrorMessage?: string;
} {
  const entryErrors: Record<string, EntryValidationErrors> = {};
  const seenJenjang = new Map<string, string>();
  let firstErrorMessage: string | undefined;

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      valid: false,
      entryErrors,
      firstErrorMessage: 'Minimal harus terdapat satu entri jenjang laporan.',
    };
  }

  entries.forEach((entry, idx) => {
    const errs: EntryValidationErrors = {};
    const label = entry.jenjang || `Entri #${idx + 1}`;

    if (!entry.jenjang) {
      errs.jenjang = 'Pilihan Jenjang wajib diisi (SRD / SRMP / SRMA).';
      if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.jenjang}`;
    } else if (seenJenjang.has(entry.jenjang)) {
      errs.jenjang = `Jenjang ${entry.jenjang} sudah dipilih pada entri lain. Gunakan entri berbeda.`;
      if (!firstErrorMessage) firstErrorMessage = errs.jenjang;
    } else {
      seenJenjang.set(entry.jenjang, entry.id);
    }

    const normalizedDorms = normalizeDormitoryTypes(entry.dormitoryTypes, entry.dormitoryType);
    if (normalizedDorms.length === 0) {
      errs.dormitoryType =
        'Pilih minimal satu Jenis Asrama (Asrama Putera dan/atau Asrama Puteri).';
      if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.dormitoryType}`;
    }

    if (!entry.category) {
      errs.category = 'Kategori laporan wajib dipilih.';
      if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.category}`;
    } else if (entry.category === 'lainnya_manual' && !String(entry.customCategory || '').trim()) {
      errs.customCategory = 'Kategori manual wajib ditulis saat memilih "Lainnya (Tulis Manual)".';
      if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.customCategory}`;
    }

    if (entry.mode === 'checklist') {
      const normalizedAnswers = normalizeChecklistAnswers(entry.checklistAnswers);
      const unansweredIndices = normalizedAnswers
        .filter((item) => item.answer !== 'ya' && item.answer !== 'tidak')
        .map((item) => item.questionIndex);

      if (unansweredIndices.length > 0) {
        errs.unansweredIndices = unansweredIndices;
        errs.checklist = `Semua 10 pertanyaan checklist wajib dijawab (belum dijawab: No. ${unansweredIndices.join(', ')}).`;
        if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.checklist}`;
      }

      const missingYesDescriptionIndices: number[] = [];
      const yesDescriptionErrors: Record<number, string> = {};
      const yesAttachmentErrors: Record<number, string> = {};
      const overLimitAttachmentIndices: number[] = [];

      normalizedAnswers.forEach((item) => {
        if (item.answer === 'ya' && !String(item.description || '').trim()) {
          missingYesDescriptionIndices.push(item.questionIndex);
          yesDescriptionErrors[item.questionIndex] =
            'Deskripsi kondisi wajib diisi karena jawaban pertanyaan ini adalah Ya.';
        }
        if (
          item.answer === 'ya' &&
          Array.isArray(item.attachments) &&
          item.attachments.length > MAX_CHECKLIST_EVIDENCE_PHOTOS
        ) {
          overLimitAttachmentIndices.push(item.questionIndex);
          yesAttachmentErrors[item.questionIndex] =
            `Maksimal ${MAX_CHECKLIST_EVIDENCE_PHOTOS} foto eviden per pertanyaan jawaban Ya.`;
        }
      });

      if (missingYesDescriptionIndices.length > 0) {
        errs.missingYesDescriptionIndices = missingYesDescriptionIndices;
        errs.yesDescriptionErrors = yesDescriptionErrors;
        errs.checklistDescriptions = `Deskripsi kondisi wajib diisi untuk pertanyaan jawaban "Ya" nomor: ${missingYesDescriptionIndices.join(', ')}.`;
        if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.checklistDescriptions}`;
      }

      if (overLimitAttachmentIndices.length > 0) {
        errs.yesAttachmentErrors = yesAttachmentErrors;
        errs.checklistAttachments = `Maksimal ${MAX_CHECKLIST_EVIDENCE_PHOTOS} foto eviden pada pertanyaan nomor: ${overLimitAttachmentIndices.join(', ')}.`;
        if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.checklistAttachments}`;
      }
    } else {
      if (!String(entry.incidentDescription || '').trim()) {
        errs.incidentDescription =
          'Deskripsi kejadian wajib diisi pada mode Laporan Kejadian Lainnya.';
        if (!firstErrorMessage) firstErrorMessage = `${label}: ${errs.incidentDescription}`;
      }
    }

    if (Object.keys(errs).length > 0) {
      entryErrors[entry.id] = errs;
    }
  });

  return {
    valid: Object.keys(entryErrors).length === 0,
    entryErrors,
    firstErrorMessage,
  };
}

const PRIORITY_RANK: Record<string, number> = {
  berat: 4,
  tinggi: 4,
  sedang: 3,
  ringan: 2,
  rendah: 2,
  nihil: 1,
};

export function buildReportSummariesFromEntries(entries: ReportJenjangEntry[]): {
  jenjang: string;
  category: ReportCategory;
  customCategory?: string;
  priority: ReportPriority;
  description: string;
  normalizedEntries: ReportJenjangEntry[];
} {
  const normalizedEntries = entries.map((entry, idx) => {
    const normalized = normalizeJenjangEntry(entry, idx);
    const dormitoryTypes = normalizeDormitoryTypes(
      normalized.dormitoryTypes,
      normalized.dormitoryType
    );
    const dormitoryType = formatDormitoryTypesLabel(dormitoryTypes, normalized.dormitoryType);

    if (normalized.mode === 'checklist') {
      const cleanedAnswers = (normalized.checklistAnswers || []).map((item) => ({
        ...item,
        description: item.answer === 'ya' ? String(item.description || '').trim() : '',
        attachments:
          item.answer === 'ya'
            ? (item.attachments || []).slice(0, MAX_CHECKLIST_EVIDENCE_PHOTOS)
            : [],
      }));
      const yesItems = cleanedAnswers.filter((item) => item.answer === 'ya');
      const hasYes = yesItems.length > 0;
      const perQuestionSummary = hasYes
        ? yesItems
            .map(
              (item) =>
                `No.${item.questionIndex} (${item.question}):\n${item.description || '-'}`
            )
            .join('\n\n')
        : '';

      return {
        ...normalized,
        dormitoryTypes,
        dormitoryType,
        checklistAnswers: cleanedAnswers,
        hasYesAnswer: hasYes,
        incidentDescription: perQuestionSummary,
      };
    }
    return {
      ...normalized,
      dormitoryTypes,
      dormitoryType,
      hasYesAnswer: false,
      incidentDescription: String(normalized.incidentDescription || '').trim(),
    };
  });

  const jenjang = normalizedEntries
    .map((e) => e.jenjang)
    .filter(Boolean)
    .join(', ');

  const primaryEntry = normalizedEntries[0];
  const category = (primaryEntry?.category || 'tata_tertib') as ReportCategory;
  const customCategory =
    primaryEntry?.category === 'lainnya_manual' ? primaryEntry.customCategory?.trim() : undefined;

  let highestPriority: ReportPriority = primaryEntry?.priority || 'sedang';
  let highestRank = PRIORITY_RANK[highestPriority] || 0;
  for (const entry of normalizedEntries) {
    const rank = PRIORITY_RANK[entry.priority] || 0;
    if (rank > highestRank) {
      highestRank = rank;
      highestPriority = entry.priority;
    }
  }

  const descriptionParts = normalizedEntries.map((entry) => {
    const catLabel = getCategoryDisplayLabel(entry.category, entry.customCategory);
    const prioLabel = priorityLabels[entry.priority]?.label || entry.priority;
    const dormLabel =
      formatDormitoryTypesLabel(entry.dormitoryTypes, entry.dormitoryType) || '-';
    const header = `[${entry.jenjang || '-'} · ${dormLabel} · ${catLabel} · ${prioLabel}]`;

    if (entry.mode === 'checklist') {
      const yesItems = (entry.checklistAnswers || []).filter((q) => q.answer === 'ya');
      if (yesItems.length === 0) {
        return `${header}\nChecklist Kondisi Sekolah/Asrama: Seluruh kondisi yang diperiksa dalam checklist dinyatakan Tidak ditemukan.`;
      }
      const yesNums = yesItems.map((q) => `No.${q.questionIndex}`).join(', ');
      const perQuestionDetails = yesItems
        .map((q) => {
          const photoCount = Array.isArray(q.attachments) ? q.attachments.length : 0;
          const photoSuffix = photoCount > 0 ? `\n   Eviden Foto: ${photoCount} foto` : '';
          return `${q.questionIndex}. ${q.question}\n   Jawaban: YA\n   Deskripsi kondisi: ${q.description || '-'}${photoSuffix}`;
        })
        .join('\n');
      return `${header}\nChecklist Kondisi Sekolah/Asrama (${yesItems.length} temuan Ya: ${yesNums}):\n${perQuestionDetails}`;
    }

    return `${header}\nLaporan Kejadian Lainnya:\n${entry.incidentDescription || '-'}`;
  });

  return {
    jenjang,
    category,
    customCategory,
    priority: highestPriority,
    description: descriptionParts.join('\n\n'),
    normalizedEntries,
  };
}

export function getReportEntriesSummaryCategories(report: ReportItem): string {
  if (Array.isArray(report.entries) && report.entries.length > 0) {
    const labels = report.entries.map((entry) =>
      getCategoryDisplayLabel(entry.category, entry.customCategory)
    );
    return Array.from(new Set(labels)).join(' · ');
  }
  return getCategoryDisplayLabel(report.category, report.customCategory);
}

export function getReportJenjangBadgeList(report: ReportItem): JenjangType[] {
  if (Array.isArray(report.entries) && report.entries.length > 0) {
    return report.entries
      .map((e) => e.jenjang)
      .filter((j): j is JenjangType => j === 'SRD' || j === 'SRMP' || j === 'SRMA');
  }
  if (report.jenjang) {
    return report.jenjang
      .split(',')
      .map((s) => s.trim())
      .filter((j): j is JenjangType => j === 'SRD' || j === 'SRMP' || j === 'SRMA');
  }
  return [];
}

export function reportMatchesCategory(report: ReportItem, filterCat: string): boolean {
  if (!filterCat || filterCat === 'all') return true;
  if (report.category === filterCat) return true;
  if (Array.isArray(report.entries)) {
    return report.entries.some((entry) => entry.category === filterCat);
  }
  return false;
}

export function reportMatchesJenjang(report: ReportItem, filterJenjang: string): boolean {
  if (!filterJenjang || filterJenjang === 'all') return true;
  const list = getReportJenjangBadgeList(report);
  return list.includes(filterJenjang as JenjangType);
}

export function reportMatchesPriority(report: ReportItem, filterPriority: string): boolean {
  if (!filterPriority || filterPriority === 'all') return true;
  const matchVal = (val: string) => {
    if (filterPriority === 'ringan') return val === 'ringan' || val === 'rendah';
    if (filterPriority === 'berat') return val === 'berat' || val === 'tinggi';
    return val === filterPriority;
  };
  if (matchVal(report.priority)) return true;
  if (Array.isArray(report.entries)) {
    return report.entries.some((entry) => matchVal(entry.priority));
  }
  return false;
}

export function reportMatchesSearchQuery(report: ReportItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (report.title.toLowerCase().includes(q)) return true;
  if (report.id.toLowerCase().includes(q)) return true;
  if (formatReportTicketNumber(report).toLowerCase().includes(q)) return true;
  if (report.description.toLowerCase().includes(q)) return true;
  if (report.reporterName.toLowerCase().includes(q)) return true;
  if ((report.location || '').toLowerCase().includes(q)) return true;
  if ((report.shift || '').toLowerCase().includes(q)) return true;
  if ((report.picRole || '').toLowerCase().includes(q)) return true;
  if ((report.jenjang || '').toLowerCase().includes(q)) return true;
  if (getCategoryDisplayLabel(report.category, report.customCategory).toLowerCase().includes(q)) {
    return true;
  }

  if (Array.isArray(report.entries)) {
    for (const entry of report.entries) {
      if ((entry.jenjang || '').toLowerCase().includes(q)) return true;
      const dormLabel = formatDormitoryTypesLabel(entry.dormitoryTypes, entry.dormitoryType);
      if (dormLabel.toLowerCase().includes(q)) return true;
      if (getCategoryDisplayLabel(entry.category, entry.customCategory).toLowerCase().includes(q)) {
        return true;
      }
      if ((entry.customCategory || '').toLowerCase().includes(q)) return true;
      if ((entry.incidentDescription || '').toLowerCase().includes(q)) return true;
      if (
        Array.isArray(entry.checklistAnswers) &&
        entry.checklistAnswers.some((ans) => (ans.description || '').toLowerCase().includes(q))
      ) {
        return true;
      }
      if (priorityLabels[entry.priority]?.label.toLowerCase().includes(q)) return true;
    }
  }

  return false;
}

const EXPLICIT_STAFF_ROLES = new Set<string>([
  'admin',
  'wali_asrama',
  'wali_asuh',
  'guru',
  'tenaga_keamanan',
  'keamanan',
]);

export function isKepalaSekolahReporter(
  report: Pick<ReportItem, 'userRole' | 'picRole'>
): boolean {
  const roleRaw = String(report.userRole || '').trim().toLowerCase();
  if (roleRaw === 'kepala_sekolah') {
    return true;
  }
  if (roleRaw && EXPLICIT_STAFF_ROLES.has(roleRaw)) {
    return false;
  }
  const picRoleRaw = String(report.picRole || '').trim().toLowerCase();
  return picRoleRaw.includes('kepala sekolah');
}

export function getUserJabatanDisplay(
  user?: Pick<UserProfile, 'jabatan' | 'role' | 'roleKey'> | null
): string {
  if (!user) return 'Staf / Petugas';
  const customJabatan = String(user.jabatan || '').trim();
  if (customJabatan) return customJabatan;
  if (user.roleKey && USER_ROLES[user.roleKey]?.label) {
    return USER_ROLES[user.roleKey].label;
  }
  return String(user.role || '').trim() || 'Staf / Petugas';
}

export function getReporterRoleDisplayLabel(
  report: Pick<ReportItem, 'userRole' | 'picRole' | 'reporterDept'>
): string {
  const picRole = String(report.picRole || '').trim();
  if (picRole.toLowerCase() === 'tim piket') {
    return 'Tim Piket';
  }
  if (isKepalaSekolahReporter(report)) {
    return 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang';
  }
  const roleRaw = String(report.userRole || '').trim().toLowerCase();
  if (roleRaw === 'admin') {
    if (picRole && picRole.toLowerCase() !== 'admin') {
      return picRole;
    }
    return 'Administrator Sistem';
  }
  if (picRole && !picRole.toLowerCase().includes('kepala sekolah')) {
    return picRole;
  }
  if (roleRaw === 'wali_asrama') return 'Wali Asrama';
  if (roleRaw === 'wali_asuh') return 'Wali Asuh';
  if (roleRaw === 'guru') return 'Guru';
  if (roleRaw === 'tenaga_keamanan' || roleRaw === 'keamanan') return 'Tenaga Keamanan';

  if (report.reporterDept && report.reporterDept.trim()) {
    return report.reporterDept.trim();
  }
  return 'Staf / Petugas';
}

export function getReportJabatanBadgeLabel(
  report: Pick<ReportItem, 'userRole' | 'picRole' | 'reporterDept'>
): string {
  const picRole = String(report.picRole || '').trim();
  if (picRole.toLowerCase() === 'tim piket') {
    return 'Tim Piket';
  }
  if (report.userRole && USER_ROLES[report.userRole]) {
    return USER_ROLES[report.userRole].label;
  }
  if (picRole) return picRole;
  return report.reporterDept || 'Sekolah Rakyat';
}

export function entryIsNihil(
  entry: Pick<ReportJenjangEntry, 'category' | 'priority'>
): boolean {
  return entry.category === 'nihil' || entry.priority === 'nihil';
}

export function isReportWhollyNihil(report: ReportItem): boolean {
  if (Array.isArray(report.entries) && report.entries.length > 0) {
    return report.entries.every((entry) => entryIsNihil(entry));
  }
  return report.category === 'nihil' || report.priority === 'nihil';
}

export interface DeleteReportActor {
  id?: string;
  roleKey?: UserRole | string;
  isActive?: boolean;
}

export interface DeleteReportPermissionResult {
  allowed: boolean;
  isOwner: boolean;
  reason?: string;
}

export function canDeleteReport(
  report: Pick<ReportItem, 'id' | 'status' | 'userId'> | null | undefined,
  actor: DeleteReportActor | null | undefined
): DeleteReportPermissionResult {
  if (!report) {
    return {
      allowed: false,
      isOwner: false,
      reason: 'Data laporan tidak ditemukan.',
    };
  }

  const actorId = String(actor?.id || '').trim();
  if (!actorId) {
    return {
      allowed: false,
      isOwner: false,
      reason: 'Sesi pengguna tidak valid untuk menghapus laporan.',
    };
  }

  if (actor?.isActive === false) {
    return {
      allowed: false,
      isOwner: false,
      reason: 'Akun pengguna tidak aktif sehingga tidak dapat menghapus laporan.',
    };
  }

  const normalizedRole = String(actor?.roleKey || 'guru').trim().toLowerCase();
  const isKepalaSekolah = normalizedRole === 'kepala_sekolah';
  const isOwner = Boolean(report.userId && report.userId === actorId);

  if (report.status !== 'selesai') {
    return {
      allowed: false,
      isOwner,
      reason:
        'Laporan yang belum berstatus Selesai tidak dapat dihapus. Hanya laporan berstatus Selesai yang boleh dihapus.',
    };
  }

  if (!isOwner && !isKepalaSekolah) {
    return {
      allowed: false,
      isOwner: false,
      reason:
        'Anda tidak berhak menghapus laporan milik pengguna lain. Hanya pemilik laporan atau Kepala Sekolah yang dapat menghapus laporan berstatus Selesai.',
    };
  }

  return {
    allowed: true,
    isOwner,
  };
}


