import { JenjangType, ReportItem, ReportPriority, ReportStatus } from '../types/report';
import {
  NEW_CATEGORY_OPTIONS,
  categoryLabels,
  entryIsNihil,
  getCategoryDisplayLabel,
  getReportJenjangBadgeList,
  isReportWhollyNihil,
  reportMatchesPriority,
} from './formatters';

export type StatsTimeframe = '30days' | 'all';

export interface PriorityEntryCounts {
  ringan: number;
  sedang: number;
  berat: number;
  nihil: number;
}

export interface CategoryDistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
  isLegacy: boolean;
  isNihil: boolean;
}

export interface WeeklyTrendDay {
  dateKey: string;
  dayName: string;
  shortLabel: string;
  dateLabel: string;
  count: number;
  heightPct: number;
}

export interface ReportStatisticsResult {
  timeframe: StatsTimeframe;
  totalMainReports: number;
  totalJenjangEntries: number;
  totalAnalyzedUnits: number;
  legacyReportsCount: number;
  jenjangCounts: Record<JenjangType, number>;
  countByStatus: Record<ReportStatus, number>;
  priorityEntryCounts: PriorityEntryCounts;
  nihilMainReportsCount: number;
  nihilEntriesCount: number;
  categoryDistribution: CategoryDistributionItem[];
  newCategoriesDistribution: CategoryDistributionItem[];
  legacyCategoriesDistribution: CategoryDistributionItem[];
  resolutionRate: number;
  weeklyTrend: WeeklyTrendDay[];
  totalInLast7Days: number;
  busiestDay: WeeklyTrendDay | null;
  urgentTickets: ReportItem[];
  totalUrgentCount: number;
}

export interface StaffRoleCounts {
  wali_asrama: number;
  wali_asuh: number;
  guru: number;
  keamanan: number;
  admin: number;
  kepala_sekolah: number;
}

const NEW_CATEGORY_KEY_SET = new Set<string>(NEW_CATEGORY_OPTIONS.map((opt) => opt.value));

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getReportDateKey(report: Pick<ReportItem, 'incidentDate' | 'createdAt'>): string | null {
  const candidates = [report.incidentDate, report.createdAt];
  for (const raw of candidates) {
    const str = String(raw || '').trim();
    if (!str) continue;
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return formatLocalDateKey(parsed);
    }
  }
  return null;
}

function dateKeyToUtcDayIndex(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function normalizePriorityBucket(priority?: ReportPriority | string): keyof PriorityEntryCounts {
  const raw = String(priority || '').trim().toLowerCase();
  if (raw === 'ringan' || raw === 'rendah') return 'ringan';
  if (raw === 'berat' || raw === 'tinggi') return 'berat';
  if (raw === 'nihil') return 'nihil';
  return 'sedang';
}

export function filterReportsByTimeframe(
  reports: ReportItem[],
  timeframe: StatsTimeframe,
  referenceDate: Date = new Date()
): ReportItem[] {
  if (timeframe === 'all') return reports;

  const refKey = formatLocalDateKey(referenceDate);
  const refDayIdx = dateKeyToUtcDayIndex(refKey);
  if (refDayIdx === null) return reports;

  const minDayIdx = refDayIdx - 29;
  const maxDayIdx = refDayIdx + 1;

  return reports.filter((r) => {
    const key = getReportDateKey(r);
    if (!key) return false;
    const dayIdx = dateKeyToUtcDayIndex(key);
    if (dayIdx === null) return false;
    return dayIdx >= minDayIdx && dayIdx <= maxDayIdx;
  });
}

export function computeReportStatistics(
  reports: ReportItem[],
  timeframe: StatsTimeframe = 'all',
  referenceDate: Date = new Date()
): ReportStatisticsResult {
  const scopedReports = filterReportsByTimeframe(reports, timeframe, referenceDate);
  const nonDraftReports = scopedReports.filter((r) => r.status !== 'draft');

  const countByStatus: Record<ReportStatus, number> = {
    draft: scopedReports.filter((r) => r.status === 'draft').length,
    menunggu: nonDraftReports.filter((r) => r.status === 'menunggu').length,
    diproses: nonDraftReports.filter((r) => r.status === 'diproses').length,
    selesai: nonDraftReports.filter((r) => r.status === 'selesai').length,
    ditolak: nonDraftReports.filter((r) => r.status === 'ditolak').length,
  };

  const totalMainReports = nonDraftReports.length;
  let totalJenjangEntries = 0;
  let totalAnalyzedUnits = 0;
  let legacyReportsCount = 0;

  const jenjangCounts: Record<JenjangType, number> = {
    SRD: 0,
    SRMP: 0,
    SRMA: 0,
  };

  const priorityEntryCounts: PriorityEntryCounts = {
    ringan: 0,
    sedang: 0,
    berat: 0,
    nihil: 0,
  };

  let nihilEntriesCount = 0;
  const categoryCountMap = new Map<string, number>();

  const addCategoryCount = (rawCategory?: string) => {
    const key = String(rawCategory || '').trim() || 'lainnya';
    categoryCountMap.set(key, (categoryCountMap.get(key) || 0) + 1);
  };

  for (const report of nonDraftReports) {
    const entries = Array.isArray(report.entries) ? report.entries : [];

    if (entries.length > 0) {
      totalJenjangEntries += entries.length;
      totalAnalyzedUnits += entries.length;

      for (const entry of entries) {
        if (entry.jenjang === 'SRD' || entry.jenjang === 'SRMP' || entry.jenjang === 'SRMA') {
          jenjangCounts[entry.jenjang] += 1;
        }

        const prioBucket = normalizePriorityBucket(entry.priority);
        priorityEntryCounts[prioBucket] += 1;

        if (entryIsNihil(entry)) {
          nihilEntriesCount += 1;
        }

        addCategoryCount(entry.category || report.category);
      }
    } else {
      legacyReportsCount += 1;
      totalAnalyzedUnits += 1;

      const legacyBadges = getReportJenjangBadgeList(report);
      for (const j of legacyBadges) {
        jenjangCounts[j] += 1;
      }

      const prioBucket = normalizePriorityBucket(report.priority);
      priorityEntryCounts[prioBucket] += 1;

      if (entryIsNihil({ category: report.category, priority: report.priority })) {
        nihilEntriesCount += 1;
      }

      addCategoryCount(report.category);
    }
  }

  const nihilMainReportsCount = nonDraftReports.filter((r) => isReportWhollyNihil(r)).length;

  const categoryDistribution: CategoryDistributionItem[] = Array.from(categoryCountMap.entries())
    .map(([key, count]) => {
      const isNew = NEW_CATEGORY_KEY_SET.has(key);
      const label = categoryLabels[key]?.label || getCategoryDisplayLabel(key);
      return {
        key,
        label,
        count,
        percentage: totalAnalyzedUnits > 0 ? Math.round((count / totalAnalyzedUnits) * 100) : 0,
        isLegacy: !isNew,
        isNihil: key === 'nihil',
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'id'));

  const newCategoriesDistribution: CategoryDistributionItem[] = NEW_CATEGORY_OPTIONS.map((opt) => {
    const count = categoryCountMap.get(opt.value) || 0;
    return {
      key: opt.value,
      label: opt.label,
      count,
      percentage: totalAnalyzedUnits > 0 ? Math.round((count / totalAnalyzedUnits) * 100) : 0,
      isLegacy: false,
      isNihil: opt.value === 'nihil',
    };
  });

  const legacyCategoriesDistribution: CategoryDistributionItem[] = categoryDistribution.filter(
    (item) => item.isLegacy
  );

  const denominator = totalMainReports - countByStatus.menunggu;
  const resolutionRate =
    totalMainReports > 0 && denominator > 0
      ? Math.round((countByStatus.selesai / denominator) * 100)
      : 0;

  // Tren 7 hari terakhir nyata berdasarkan incidentDate / createdAt dari seluruh non-draft pada window 7 hari
  const nonDraftAll = reports.filter((r) => r.status !== 'draft');
  const dayCountMap = new Map<string, number>();
  for (const report of nonDraftAll) {
    const dateKey = getReportDateKey(report);
    if (dateKey) {
      dayCountMap.set(dateKey, (dayCountMap.get(dateKey) || 0) + 1);
    }
  }

  const rawDays: Array<Omit<WeeklyTrendDay, 'heightPct'>> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() - offset
    );
    const dateKey = formatLocalDateKey(d);
    const dayName = DAY_NAMES_ID[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    rawDays.push({
      dateKey,
      dayName,
      shortLabel: dayName.slice(0, 3),
      dateLabel: `${dd}/${mm}`,
      count: dayCountMap.get(dateKey) || 0,
    });
  }

  const maxDayCount = rawDays.reduce((max, item) => Math.max(max, item.count), 0);
  const weeklyTrend: WeeklyTrendDay[] = rawDays.map((item) => ({
    ...item,
    heightPct:
      maxDayCount > 0 && item.count > 0
        ? Math.max(Math.round((item.count / maxDayCount) * 100), 12)
        : 0,
  }));

  const totalInLast7Days = weeklyTrend.reduce((sum, d) => sum + d.count, 0);
  const busiestDay =
    totalInLast7Days > 0
      ? weeklyTrend.reduce((best, curr) => (curr.count > best.count ? curr : best), weeklyTrend[0])
      : null;

  const allUrgent = nonDraftReports.filter(
    (r) => reportMatchesPriority(r, 'berat') && r.status !== 'selesai' && r.status !== 'ditolak'
  );

  return {
    timeframe,
    totalMainReports,
    totalJenjangEntries,
    totalAnalyzedUnits,
    legacyReportsCount,
    jenjangCounts,
    countByStatus,
    priorityEntryCounts,
    nihilMainReportsCount,
    nihilEntriesCount,
    categoryDistribution,
    newCategoriesDistribution,
    legacyCategoriesDistribution,
    resolutionRate,
    weeklyTrend,
    totalInLast7Days,
    busiestDay,
    urgentTickets: allUrgent.slice(0, 3),
    totalUrgentCount: allUrgent.length,
  };
}

export function countReportsByStaffRole(reports: ReportItem[]): StaffRoleCounts {
  const nonDraft = reports.filter((r) => r.status !== 'draft');
  return {
    wali_asrama: nonDraft.filter((r) => r.userRole === 'wali_asrama').length,
    wali_asuh: nonDraft.filter((r) => r.userRole === 'wali_asuh').length,
    guru: nonDraft.filter((r) => r.userRole === 'guru').length,
    keamanan: nonDraft.filter(
      (r) => r.userRole === 'tenaga_keamanan' || r.userRole === 'keamanan'
    ).length,
    admin: nonDraft.filter((r) => r.userRole === 'admin').length,
    kepala_sekolah: nonDraft.filter((r) => r.userRole === 'kepala_sekolah').length,
  };
}

export function matchesStaffRoleFilter(report: ReportItem, filterRole: string): boolean {
  if (!filterRole || filterRole === 'all') return true;
  if (filterRole === 'tenaga_keamanan' || filterRole === 'keamanan') {
    return report.userRole === 'tenaga_keamanan' || report.userRole === 'keamanan';
  }
  return report.userRole === filterRole;
}
