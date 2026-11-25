import { AttachmentFile, ReportItem, AppSettings, UserProfile } from '../types/report';
import {
  priorityLabels,
  formatDateOnly,
  formatDateTime,
  formatFileSize,
  formatReportTicketNumber,
  formatDormitoryTypesLabel,
  getCategoryDisplayLabel,
  entryHasYesFindings,
  reportHasYesFindings,
  normalizeChecklistAnswers,
  isKepalaSekolahReporter,
  getReporterRoleDisplayLabel,
  isImageAttachmentFile,
  MAX_CHECKLIST_EVIDENCE_PHOTOS,
} from './formatters';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SAFE_RASTER_DATA_IMAGE_REGEX =
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i;

export function sanitizeImageUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    return null;
  }

  if (trimmed.toLowerCase().startsWith('data:')) {
    const compactDataUrl = trimmed.replace(/\s+/g, '');
    if (SAFE_RASTER_DATA_IMAGE_REGEX.test(compactDataUrl)) {
      return compactDataUrl;
    }
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildPrintReportHtml(
  report: ReportItem,
  appSettings?: AppSettings,
  userProfile?: UserProfile,
  resolvedStorageUrls?: Record<string, string>
): string {
  const resolveAttImageUrl = (att: AttachmentFile): string | null => {
    if (!isImageAttachmentFile(att)) return null;
    const raw = att.storagePath
      ? resolvedStorageUrls?.[att.storagePath] || ''
      : att.url || att.dataUrl;
    return sanitizeImageUrl(raw);
  };
  const prio = priorityLabels[report.priority] || priorityLabels.sedang;
  const printDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const defaultKopLogo =
    'https://vectorez.biz.id/wp-content/uploads/2024/05/Logo-Kementerian-Sosial-Kemensos-Republik-Indonesia@0.5x.png';
  const customKopLogo = appSettings?.kopLogoUrl?.trim();
  const safeKopLogoSrc = customKopLogo
    ? sanitizeImageUrl(customKopLogo)
    : sanitizeImageUrl(defaultKopLogo);
  const kopAddress =
    appSettings?.kopAddress ||
    'Desa Kebon Cau, Kecamatan Ujung Jaya Kabupaten Sumedang Kode Pos 45383';

  const entries = Array.isArray(report.entries) ? report.entries : [];
  const hasEntries = entries.length > 0;
  const hasYesFindings = reportHasYesFindings(report);

  const kemensosLogoSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="76" height="76" style="display:block;">
      <defs>
        <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FCD34D"/>
          <stop offset="80%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#D97706"/>
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#FFFFFF" stroke="#0D9488" stroke-width="2.5"/>
      <circle cx="50" cy="50" r="44" fill="#F0FDF4" stroke="#D97706" stroke-width="1.2" stroke-dasharray="2,2"/>
      <path d="M50 14 C42 28, 26 34, 22 52 C26 50, 32 50, 36 53 C30 58, 25 66, 27 76 C33 72, 40 71, 46 74 C47 67, 49 59, 50 50 C51 59, 53 67, 54 74 C60 71, 67 72, 73 76 C75 66, 70 58, 64 53 C68 50, 74 50, 78 52 C74 34, 58 28, 50 14 Z" fill="url(#sunGrad)" stroke="#B45309" stroke-width="1"/>
      <circle cx="50" cy="46" r="10" fill="#DC2626" stroke="#991B1B" stroke-width="1.2"/>
      <circle cx="50" cy="46" r="5" fill="#FFFFFF"/>
      <path d="M30 68 C38 62, 62 62, 70 68 C64 64, 36 64, 30 68 Z" fill="#0D9488"/>
      <path d="M26 80 C38 75, 62 75, 74 80 C65 77, 35 77, 26 80 Z" fill="#0D9488"/>
    </svg>
  `;

  const logoHtml = safeKopLogoSrc
    ? `<img data-has-svg-fallback="true" src="${escapeHtml(safeKopLogoSrc)}" alt="Logo Kementerian Sosial RI" style="max-height: 85px; max-width: 90px; object-fit: contain; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><div style="display:none;">${kemensosLogoSvg}</div>`
    : `<div>${kemensosLogoSvg}</div>`;

  let attachmentsHtml = '';
  if (report.attachments && report.attachments.length > 0) {
    const images = report.attachments.slice(0, 2);
    attachmentsHtml = `
      <div style="margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background-color: #f8fafc; page-break-inside: avoid; break-inside: avoid;">
        <div style="font-size: 10pt; font-weight: bold; color: #0f172a; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
          KOLOM DOKUMENTASI BUKTI FOTO &amp; LAMPIRAN (${images.length} Berkas)
        </div>
        <div style="display: flex; gap: 14px; flex-wrap: wrap;">
          ${images
            .map((att, idx) => {
              const safeAttUrl = resolveAttImageUrl(att);
              return `
            <div style="flex: 1; min-width: 240px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background-color: #ffffff; text-align: center;">
              ${
                safeAttUrl
                  ? `
                <img src="${escapeHtml(safeAttUrl)}" alt="Bukti ${idx + 1}" style="max-height: 220px; max-width: 100%; object-fit: contain; border-radius: 4px; margin-bottom: 6px; display: inline-block;" />
              `
                  : isImageAttachmentFile(att)
                  ? `
                <div style="padding: 24px; font-size: 9pt; color: #64748b;">[Foto tidak tersedia: ${escapeHtml(att.name)}]</div>
              `
                  : `
                <div style="padding: 24px; font-size: 9pt; color: #64748b;">[Berkas Dokumen: ${escapeHtml(att.name)}]</div>
              `
              }
              <div style="font-size: 8.5pt; font-weight: 500; color: #334155; border-top: 1px solid #f1f5f9; padding-top: 4px; display: flex; justify-content: space-between;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(att.name)}</span>
                <span style="color: #94a3b8; font-family: monospace;">(${escapeHtml(formatFileSize(att.size))})</span>
              </div>
            </div>
          `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  const isKepalaSekolahReport = isKepalaSekolahReporter(report);
  const reporterRoleLabel = getReporterRoleDisplayLabel(report);

  const chiefName =
    report.reporterName ||
    (userProfile?.roleKey === 'kepala_sekolah' && userProfile?.name ? userProfile.name : '') ||
    'Kepala Sekolah';
  const chiefRole =
    userProfile?.roleKey === 'kepala_sekolah' && userProfile?.role
      ? userProfile.role
      : report.picRole || 'Kepala Sekolah Rakyat Terintegerasi 1 Sumedang';
  const resolvedChiefNipRaw =
    report.reporterNip ||
    (userProfile?.roleKey === 'kepala_sekolah' && userProfile?.nip ? userProfile.nip : '');
  const chiefNip = resolvedChiefNipRaw ? `NIP. ${resolvedChiefNipRaw}` : '';

  const safeSignatureUrl = sanitizeImageUrl(report.reporterSignature);

  const reporterSignSpaceHtml = safeSignatureUrl
    ? `<div class="sign-space" style="height: 60px; display: flex; align-items: center; justify-content: center;"><img src="${escapeHtml(safeSignatureUrl)}" alt="Ttd Pembuat Laporan" style="max-height: 55px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block;" /></div>`
    : report.status === 'selesai'
    ? `<div class="sign-space" style="height: 60px; display: flex; align-items: center; justify-content: center; font-style: italic; font-weight: bold; font-size: 13pt; color: #000000; letter-spacing: 1px;">( Ttd )</div>`
    : `<div class="sign-space" style="height: 60px;"></div>`;

  const chiefSignSpaceHtml = safeSignatureUrl
    ? `<div class="sign-space" style="height: 60px; display: flex; align-items: center; justify-content: center;"><img src="${escapeHtml(safeSignatureUrl)}" alt="Ttd Kepala Sekolah" style="max-height: 55px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block;" /></div>`
    : report.status === 'selesai'
    ? `<div class="sign-space" style="height: 60px; display: flex; align-items: center; justify-content: center; font-style: italic; font-weight: bold; font-size: 13pt; color: #000000; letter-spacing: 1px;">( Ttd )</div>`
    : `<div class="sign-space" style="height: 60px;"></div>`;

  const displayTicketNumber = formatReportTicketNumber(report);
  const summaryCategoryDisplay = getCategoryDisplayLabel(report.category, report.customCategory);
  const jenjangSummaryText = hasEntries
    ? entries.map((e) => e.jenjang).filter(Boolean).join(', ')
    : report.jenjang || '';

  // Blok Ringkasan Jenjang & Jenis Asrama (ditempatkan tepat setelah tabel info judul laporan)
  const jenjangSummaryHtml = hasEntries
    ? `
      <div class="jenjang-summary-box">
        <div class="section-heading">Ringkasan Jenjang &amp; Jenis Asrama (${entries.length} Jenjang)</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th style="width: 32px; text-align: center;">No</th>
              <th style="width: 72px;">Jenjang</th>
              <th style="width: 120px;">Jenis Asrama</th>
              <th>Kategori</th>
              <th style="width: 160px;">Tingkat Risiko</th>
              <th style="width: 120px;">Mode</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map((entry, idx) => {
                const entryPrio = priorityLabels[entry.priority] || priorityLabels.sedang;
                const entryYes = entryHasYesFindings(entry);
                const entryDormLabel = formatDormitoryTypesLabel(
                  entry.dormitoryTypes,
                  entry.dormitoryType
                );
                const modeLabel =
                  entry.mode === 'checklist'
                    ? `Checklist (${entryYes ? 'Ada Ya' : 'Semua Tidak'})`
                    : 'Kejadian Lainnya';
                return `
                  <tr>
                    <td style="text-align: center; font-family: monospace;">${idx + 1}</td>
                    <td><strong>${escapeHtml(entry.jenjang || '-')}</strong></td>
                    <td>${escapeHtml(entryDormLabel || '-')}</td>
                    <td>${escapeHtml(getCategoryDisplayLabel(entry.category, entry.customCategory))}</td>
                    <td>${escapeHtml(entryPrio.label)}</td>
                    <td>${escapeHtml(modeLabel)}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      ${
        hasYesFindings
          ? `
        <div class="alert-yes-box justify-prose">
          <strong>PERHATIAN PIMPINAN:</strong> Terdapat jawaban <strong>&ldquo;Ya&rdquo;</strong> pada pemeriksaan checklist kondisi sekolah/asrama yang memerlukan pencermatan dan tindak lanjut.
        </div>
      `
          : ''
      }
    `
    : '';

  // Blok Konten Utama: Per-Entri Jenjang (berurutan & terisolasi) ATAU Deskripsi Klasik (laporan lama)
  const entriesOrLegacyBodyHtml = hasEntries
    ? entries
        .map((entry, idx) => {
          const entryPrio = priorityLabels[entry.priority] || priorityLabels.sedang;
          const entryCatLabel = getCategoryDisplayLabel(entry.category, entry.customCategory);
          const entryYes = entryHasYesFindings(entry);
          const entryDormLabel = formatDormitoryTypesLabel(
            entry.dormitoryTypes,
            entry.dormitoryType
          );

          const checklistRows =
            entry.mode === 'checklist' ? normalizeChecklistAnswers(entry.checklistAnswers) : [];
          const hasPerQuestionDescriptions = checklistRows.some(
            (r) => r.answer === 'ya' && Boolean(String(r.description || '').trim())
          );

          const checklistSectionHtml =
            entry.mode === 'checklist'
              ? `
                <div class="checklist-box">
                  <div class="checklist-box-header">
                    CHECKLIST KONDISI SEKOLAH / ASRAMA &mdash; JENJANG ${escapeHtml(entry.jenjang || '-')}
                  </div>
                  ${checklistRows
                    .map((row) => {
                      const isYes = row.answer === 'ya';
                      const rowDesc = String(row.description || '').trim();
                      const rowPhotos =
                        isYes && Array.isArray(row.attachments)
                          ? row.attachments.slice(0, MAX_CHECKLIST_EVIDENCE_PHOTOS)
                          : [];
                      const validRowPhotos = rowPhotos
                        .map((att) => ({
                          att,
                          safeUrl: resolveAttImageUrl(att),
                        }))
                        .filter((item): item is { att: typeof rowPhotos[number]; safeUrl: string } =>
                          Boolean(item.safeUrl)
                        );

                      const badgeClass = isYes
                        ? 'badge-ya'
                        : row.answer === 'tidak'
                        ? 'badge-tidak'
                        : 'badge-empty';
                      const ansText = isYes ? 'YA' : row.answer === 'tidak' ? 'TIDAK' : '-';
                      return `
                        <div class="checklist-item ${isYes ? 'checklist-item-ya' : ''}">
                          <div class="checklist-item-top">
                            <div class="checklist-item-question justify-prose">
                              <span style="font-family: monospace; font-weight: bold; color: #475569;">${row.questionIndex}.</span>
                              <strong>Pertanyaan:</strong> ${escapeHtml(row.question)}
                            </div>
                            <div class="checklist-item-answer">
                              <span style="color: #475569;">Jawaban:</span>
                              <span class="${badgeClass}">${ansText}</span>
                            </div>
                          </div>
                          ${
                            isYes && rowDesc
                              ? `
                            <div class="checklist-item-desc">
                              <div class="checklist-item-desc-label">Deskripsi kondisi:</div>
                              <div class="checklist-item-desc-text justify-prose">${escapeHtml(rowDesc)}</div>
                            </div>
                          `
                              : ''
                          }
                          ${
                            isYes && validRowPhotos.length > 0
                              ? `
                            <div class="checklist-item-evidence">
                              <div class="checklist-item-evidence-label">Eviden / Dokumentasi Foto (Pertanyaan No. ${row.questionIndex}):</div>
                              <div class="checklist-item-evidence-grid">
                                ${validRowPhotos
                                  .map(
                                    ({ att, safeUrl }, pIdx) => `
                                  <div class="checklist-item-photo-card">
                                    <img
                                      src="${escapeHtml(safeUrl)}"
                                      alt="Eviden No.${row.questionIndex} Foto ${pIdx + 1}"
                                      class="checklist-item-photo-img"
                                    />
                                    <div class="checklist-item-photo-caption">
                                      Foto ${pIdx + 1}: ${escapeHtml(att.name)}
                                    </div>
                                  </div>
                                `
                                  )
                                  .join('')}
                              </div>
                            </div>
                          `
                              : ''
                          }
                        </div>
                      `;
                    })
                    .join('')}
                </div>
                ${
                  entryYes &&
                  !hasPerQuestionDescriptions &&
                  Boolean(String(entry.incidentDescription || '').trim())
                    ? `
                  <div class="desc-box desc-box-alert">
                    <div class="desc-header">
                      Deskripsi Kejadian &mdash; Jenjang ${escapeHtml(entry.jenjang || '-')} (Catatan Laporan Sebelum Pembaruan Per-Pertanyaan)
                    </div>
                    <div class="desc-content justify-prose">${escapeHtml(entry.incidentDescription || '-')}</div>
                  </div>
                `
                    : !entryYes
                      ? `
                  <div class="desc-box">
                    <div class="desc-header">
                      Keterangan Hasil Checklist &mdash; Jenjang ${escapeHtml(entry.jenjang || '-')}
                    </div>
                    <div class="desc-content justify-prose">Seluruh kondisi yang diperiksa dalam checklist dinyatakan Tidak ditemukan.</div>
                  </div>
                `
                      : ''
                }
              `
              : `
                <div class="desc-box">
                  <div class="desc-header">
                    Deskripsi Kejadian — Jenjang ${escapeHtml(entry.jenjang || '-')} (Laporan Kejadian Lainnya)
                  </div>
                  <div class="desc-content justify-prose">${escapeHtml(entry.incidentDescription || '-')}</div>
                </div>
              `;

          return `
            <div class="entry-section">
              <div class="entry-header ${entryYes ? 'entry-header-alert' : ''}">
                <span>BAGIAN ${idx + 1}: JENJANG ${escapeHtml(entry.jenjang || '-')} &mdash; ${escapeHtml(entryDormLabel || '-')}</span>
                <span class="entry-header-tag">${
                  entry.mode === 'checklist'
                    ? entryYes
                      ? 'Checklist: Ada Temuan Ya'
                      : 'Checklist: Semua Tidak'
                    : 'Laporan Kejadian Lainnya'
                }</span>
              </div>
              <table class="info-table" style="margin-top: 0; margin-bottom: 10px;">
                <tr>
                  <td class="label">Jenjang</td>
                  <td class="value"><strong>${escapeHtml(entry.jenjang || '-')}</strong></td>
                </tr>
                <tr>
                  <td class="label">Jenis Asrama</td>
                  <td class="value">${escapeHtml(entryDormLabel || '-')}</td>
                </tr>
                <tr>
                  <td class="label">Kategori Laporan</td>
                  <td class="value">${escapeHtml(entryCatLabel)}</td>
                </tr>
                <tr>
                  <td class="label">Tingkat Risiko / Prioritas</td>
                  <td class="value">${escapeHtml(entryPrio.label)}</td>
                </tr>
                <tr>
                  <td class="label">Mode Deskripsi</td>
                  <td class="value">${
                    entry.mode === 'checklist'
                      ? 'Checklist Kondisi Sekolah/Asrama'
                      : 'Laporan Kejadian Lainnya'
                  }</td>
                </tr>
              </table>
              ${checklistSectionHtml}
            </div>
          `;
        })
        .join('')
    : `
      <div class="desc-box">
        <div class="desc-header">Uraian Kronologi / Deskripsi Kejadian</div>
        <div class="desc-content justify-prose">${escapeHtml(report.description || 'Nihil')}</div>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan_SIBAHAR_${escapeHtml(displayTicketNumber.replace(/\//g, '_'))}</title>
  <style>
    @page {
      size: legal portrait;
      margin: 1.5cm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 10pt;
      line-height: 1.45;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
    }
    .justify-prose {
      text-align: justify;
      text-justify: inter-word;
    }
    .kop-wrapper {
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .kop-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .kop-logo {
      width: 85px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .kop-text {
      flex: 1;
      text-align: center;
      padding-right: 20px;
    }
    .kop-text h2 {
      font-size: 12.5pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.5px;
      color: #000000;
    }
    .kop-text h3 {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 2px 0 0 0;
      color: #000000;
    }
    .kop-text .app-sub {
      font-size: 9pt;
      font-weight: 600;
      color: #047857;
      margin-top: 3px;
    }
    .kop-text .address {
      font-size: 8pt;
      color: #475569;
      margin-top: 2px;
      line-height: 1.3;
    }
    .kop-divider-double {
      margin-top: 8px;
      border-top: 2.5px solid #000000;
      border-bottom: 1px solid #000000;
      height: 4px;
    }
    .recipient-box {
      margin-top: 10px;
      margin-bottom: 10px;
      font-size: 9.5pt;
      line-height: 1.4;
      text-align: left;
    }
    .recipient-title {
      color: #475569;
      font-size: 9pt;
    }
    .recipient-name {
      font-weight: bold;
      color: #000000;
      font-size: 10pt;
    }
    .doc-title {
      text-align: center;
      margin: 12px 0 14px 0;
    }
    .doc-title h1 {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      text-decoration: underline;
      margin: 0;
      color: #000000;
      letter-spacing: 0.5px;
    }
    .doc-title .doc-num {
      font-size: 9.5pt;
      color: #334155;
      margin-top: 3px;
      font-family: monospace;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 14px;
      font-size: 9pt;
    }
    .info-table td {
      padding: 5px 8px;
      vertical-align: top;
      border: 1px solid #cbd5e1;
    }
    .info-table td.label {
      width: 28%;
      background-color: #f8fafc;
      font-weight: 600;
      color: #334155;
    }
    .info-table td.value {
      width: 72%;
      color: #0f172a;
    }
    .jenjang-summary-box {
      margin-top: 12px;
      margin-bottom: 12px;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-heading {
      background-color: #ecfdf5;
      color: #064e3b;
      padding: 6px 10px;
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1px solid #a7f3d0;
    }
    .summary-table, .checklist-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    .summary-table th, .summary-table td,
    .checklist-table th, .checklist-table td {
      padding: 5px 7px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
      text-align: left;
    }
    .summary-table thead th, .checklist-table thead th {
      background-color: #f8fafc;
      font-weight: bold;
      color: #334155;
    }
    .checklist-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .checklist-table tr.row-ya {
      background-color: #fffbeb;
    }
    .badge-ya {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 4px;
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
      font-weight: bold;
      font-size: 8pt;
    }
    .badge-tidak {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 4px;
      background-color: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
      font-weight: bold;
      font-size: 8pt;
    }
    .badge-empty {
      color: #64748b;
      font-size: 8pt;
    }
    .checklist-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      margin-top: 6px;
      background-color: #ffffff;
    }
    .checklist-box-header {
      background-color: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      padding: 6px 10px;
      font-size: 8.5pt;
      font-weight: bold;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .checklist-item {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .checklist-item:last-child {
      border-bottom: none;
    }
    .checklist-item-ya {
      background-color: #fffbeb;
    }
    .checklist-item-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      font-size: 8.5pt;
      line-height: 1.45;
      color: #0f172a;
    }
    .checklist-item-question {
      flex: 1;
    }
    .checklist-item-answer {
      flex-shrink: 0;
      white-space: nowrap;
      font-size: 8pt;
    }
    .checklist-item-desc {
      margin-top: 6px;
      margin-left: 16px;
      padding: 6px 9px;
      background-color: #ffffff;
      border: 1px solid #fcd34d;
      border-radius: 4px;
    }
    .checklist-item-desc-label {
      font-size: 8pt;
      font-weight: bold;
      color: #78350f;
      margin-bottom: 2px;
    }
    .checklist-item-desc-text {
      font-size: 8.8pt;
      color: #1e293b;
      white-space: pre-wrap;
      line-height: 1.45;
    }
    .checklist-item-evidence {
      margin-top: 7px;
      margin-left: 16px;
      padding: 6px 8px;
      background-color: #ffffff;
      border: 1px solid #fcd34d;
      border-radius: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .checklist-item-evidence-label {
      font-size: 8pt;
      font-weight: bold;
      color: #78350f;
      margin-bottom: 5px;
    }
    .checklist-item-evidence-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: flex-start;
    }
    .checklist-item-photo-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px;
      background-color: #f8fafc;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .checklist-item-photo-img {
      display: block;
      width: 6.5cm;
      max-width: 100%;
      height: auto;
      max-height: 8cm;
      object-fit: contain;
      border-radius: 3px;
      margin: 0 auto;
    }
    .checklist-item-photo-caption {
      font-size: 7.5pt;
      color: #475569;
      margin-top: 3px;
      max-width: 6.5cm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .alert-yes-box {
      margin-top: 8px;
      margin-bottom: 12px;
      padding: 8px 10px;
      border: 1px solid #f59e0b;
      background-color: #fffbeb;
      color: #78350f;
      border-radius: 6px;
      font-size: 8.8pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .entry-section {
      margin-top: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      background-color: #ffffff;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: bold;
      color: #0f172a;
      margin-bottom: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .entry-header-alert {
      background-color: #fef3c7;
      border-color: #f59e0b;
      color: #78350f;
    }
    .entry-header-tag {
      font-size: 8pt;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
    }
    .desc-box {
      margin-top: 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background-color: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .desc-box-alert {
      border-color: #f59e0b;
      background-color: #fffdf5;
    }
    .desc-header {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #000000;
      margin-bottom: 6px;
      letter-spacing: 0.4px;
    }
    .desc-content {
      font-size: 9.5pt;
      color: #1e293b;
      white-space: pre-wrap;
      line-height: 1.55;
      text-align: justify;
      text-justify: inter-word;
    }
    .signature-grid {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
      font-size: 9pt;
    }
    .signature-col {
      width: 45%;
      text-align: center;
    }
    .sign-space {
      height: 60px;
    }
    .sign-name {
      font-weight: bold;
      text-decoration: underline;
      color: #000000;
    }
    .sign-nip {
      font-size: 8.5pt;
      font-family: monospace;
      color: #475569;
      margin-top: 2px;
    }
    .print-actions {
      text-align: center;
      margin-bottom: 20px;
      padding: 12px;
      background: #f1f5f9;
      border-radius: 8px;
    }
    .btn-print {
      background-color: #059669;
      color: #ffffff;
      padding: 10px 20px;
      font-size: 10pt;
      font-weight: bold;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .print-status-bar {
      display: none;
      margin-bottom: 18px;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #f59e0b;
      background-color: #fffbeb;
      color: #78350f;
      font-size: 9pt;
    }
    .print-status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .print-status-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .btn-reload-imgs {
      background-color: #ffffff;
      color: #92400e;
      border: 1px solid #d97706;
      padding: 6px 12px;
      font-size: 8.5pt;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-reload-imgs:hover {
      background-color: #fef3c7;
    }
    .btn-print-skip-pending {
      background-color: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 7px 12px;
      font-size: 8.5pt;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-print-skip-pending:hover {
      background-color: #4338ca;
    }
    @media print {
      body {
        padding: 0;
      }
      .print-actions,
      .print-status-bar,
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- Action bar on screen only -->
    <div class="print-actions">
      <button class="btn-print" onclick="window.print()">
        Cetak / Simpan PDF (Ukuran Kertas Legal)
      </button>
      <span style="margin-left: 14px; font-size: 8.5pt; color: #64748b;">
        Format Resmi Kop Surat Kementerian Sosial RI - Sekolah Rakyat Terintegerasi 1 Sumedang
      </span>
    </div>

    <div id="pdf-image-status-bar" class="print-status-bar" role="status" aria-live="polite">
      <div class="print-status-row">
        <div id="pdf-image-status-text">
          Memeriksa pemuatan gambar dokumen...
        </div>
        <div class="print-status-actions">
          <button type="button" id="btn-reload-pending-images" class="btn-reload-imgs">
            Muat Ulang Gambar
          </button>
          <button type="button" id="btn-print-without-pending" class="btn-print-skip-pending">
            Cetak Tanpa Gambar yang Masih Tertunda
          </button>
        </div>
      </div>
    </div>

    <!-- KOP SURAT KEMENSOS -->
    <div class="kop-wrapper">
      <div class="kop-inner">
        <div class="kop-logo">
          ${logoHtml}
        </div>
        <div class="kop-text">
          <h2>Kementerian Sosial Republik Indonesia</h2>
          <h3>Sekolah Rakyat Terintegerasi 1 Sumedang</h3>
          <div class="app-sub">Sistem Informasi Berita Aktual Harian (SIBAHAR)</div>
          <div class="address">${escapeHtml(kopAddress)}</div>
        </div>
      </div>
      <div class="kop-divider-double"></div>
    </div>

    <!-- TUJUAN SURAT / KEPADA -->
    <div class="recipient-box">
      <div class="recipient-title">Kepada :</div>
      ${
        isKepalaSekolahReport
          ? `
        <div class="recipient-name">Yth. Menteri Sosial Republik Indonesia</div>
        <div>di Jakarta</div>
      `
          : `
        <div class="recipient-name">Yth. Kepala Sekolah Rakyat Terintegerasi 1 Sumedang</div>
        <div>di Sumedang</div>
      `
      }
    </div>

    <!-- JUDUL LAPORAN & NOMOR -->
    <div class="doc-title">
      <h1>Laporan Berita Aktual Harian</h1>
      <div class="doc-num">Nomor: <strong>${escapeHtml(displayTicketNumber)}</strong></div>
    </div>

    <!-- TABEL DATA LAPORAN -->
    <table class="info-table">
      ${
        jenjangSummaryText
          ? `
      <tr>
        <td class="label">Jenjang</td>
        <td class="value"><strong>${escapeHtml(jenjangSummaryText)}</strong></td>
      </tr>
      `
          : ''
      }
      <tr>
        <td class="label">Judul Laporan</td>
        <td class="value"><strong>${escapeHtml(report.title)}</strong></td>
      </tr>
      <tr>
        <td class="label">Kategori Laporan</td>
        <td class="value">${escapeHtml(summaryCategoryDisplay)}</td>
      </tr>
      <tr>
        <td class="label">Tingkat Prioritas</td>
        <td class="value">${escapeHtml(prio.label)}</td>
      </tr>
      <tr>
        <td class="label">Tanggal Kejadian</td>
        <td class="value">${escapeHtml(formatDateOnly(report.incidentDate))}</td>
      </tr>
      <tr>
        <td class="label">Waktu Registrasi Sistem</td>
        <td class="value">${escapeHtml(formatDateTime(report.createdAt))}</td>
      </tr>
      <tr>
        <td class="label">Lokasi / Area Kejadian</td>
        <td class="value">${escapeHtml(report.location || 'Lingkungan Sekolah Rakyat Terintegerasi 1 Sumedang')}</td>
      </tr>
      <tr>
        <td class="label">Pelapor</td>
        <td class="value">
          <div style="font-weight: bold; font-size: 10pt; color: #000000;">${escapeHtml(report.reporterName)}</div>
          <div style="font-size: 8.5pt; color: #334155; margin-top: 2px;">${escapeHtml(reporterRoleLabel)}${report.reporterNip ? ` &middot; NIP. ${escapeHtml(report.reporterNip)}` : ''}</div>
        </td>
      </tr>
    </table>

    <!-- RINGKASAN JENJANG & JENIS ASRAMA -->
    ${jenjangSummaryHtml}

    <!-- RINCIAN PER JENJANG ATAU URAIAN KRONOLOGI KLASIK -->
    ${entriesOrLegacyBodyHtml}

    <!-- KOLOM BUKTI FOTO (JIKA ADA) -->
    ${attachmentsHtml}

    <!-- LEMBAR PENGESAHAN TANDA TANGAN (SEBELAH KANAN) -->
    <div class="signature-grid" style="display: flex; justify-content: flex-end;">
      <div class="signature-col" style="width: 48%; margin-left: auto;">
        <div>Sumedang, ${escapeHtml(printDate)}</div>
        <div style="font-size: 8.5pt; color: #475569; margin-top: 2px;">${escapeHtml(isKepalaSekolahReport ? chiefRole : reporterRoleLabel)}</div>
        ${isKepalaSekolahReport ? chiefSignSpaceHtml : reporterSignSpaceHtml}
        <div class="sign-name">${escapeHtml(isKepalaSekolahReport ? chiefName : report.reporterName)}</div>
        <div class="sign-nip">${escapeHtml(isKepalaSekolahReport ? chiefNip : report.reporterNip ? `NIP. ${report.reporterNip}` : '')}</div>
      </div>
    </div>

  </div>

  <script>
    (function() {
      var DECODE_GUARD_MS = 1500;
      var STATUS_SHOW_DELAY_MS = 1000;
      var currentRunId = 0;
      var manualPrinted = false;
      var statusShowTimer = null;

      function getImages() {
        return Array.prototype.slice.call(document.images || []);
      }

      function rememberOriginalSources(imgs) {
        imgs.forEach(function(img) {
          if (!img.getAttribute('data-orig-src')) {
            var srcAttr = img.getAttribute('src') || '';
            if (srcAttr) {
              img.setAttribute('data-orig-src', srcAttr);
            }
          }
        });
      }

      function isReadyStateLoaded(img) {
        return img.getAttribute('data-load-state') === 'loaded' || (img.complete && img.naturalWidth > 0);
      }

      function updateStatusBanner(imgs) {
        var bar = document.getElementById('pdf-image-status-bar');
        var textEl = document.getElementById('pdf-image-status-text');
        if (!bar || !textEl) return;

        var pending = 0;
        var errored = 0;
        imgs.forEach(function(img) {
          var state = img.getAttribute('data-load-state');
          if (state === 'loaded') return;
          if (state === 'error') {
            if (!img.hasAttribute('data-has-svg-fallback')) {
              errored += 1;
            }
            return;
          }
          pending += 1;
        });

        if (pending === 0 && errored === 0) {
          bar.style.display = 'none';
          return;
        }

        var parts = [];
        if (pending > 0) parts.push(pending + ' gambar masih dalam proses muat');
        if (errored > 0) parts.push(errored + ' gambar gagal dimuat');
        textEl.innerHTML =
          '<strong>Status Pemuatan Gambar:</strong> ' +
          parts.join(' &middot; ') +
          '. Pencetakan otomatis ditahan agar foto tidak hilang. Anda dapat menunggu, memuat ulang gambar, atau mencetak manual tanpa gambar yang tertunda.';
        bar.style.display = 'block';
      }

      function waitForImage(img, onSettled) {
        return new Promise(function(resolve) {
          var settled = false;
          function done(status) {
            if (settled) return;
            settled = true;
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            img.setAttribute('data-load-state', status);
            if (typeof onSettled === 'function') {
              onSettled(img, status);
            }
            resolve({ img: img, status: status });
          }

          function onLoad() {
            if (typeof img.decode === 'function' && img.naturalWidth > 0) {
              var decodeFinished = false;
              var decodeGuard = setTimeout(function() {
                if (!decodeFinished) {
                  decodeFinished = true;
                  done('loaded');
                }
              }, DECODE_GUARD_MS);

              try {
                Promise.resolve(img.decode()).then(
                  function() {
                    if (!decodeFinished) {
                      decodeFinished = true;
                      clearTimeout(decodeGuard);
                      done('loaded');
                    }
                  },
                  function() {
                    if (!decodeFinished) {
                      decodeFinished = true;
                      clearTimeout(decodeGuard);
                      done('loaded');
                    }
                  }
                );
              } catch (e) {
                if (!decodeFinished) {
                  decodeFinished = true;
                  clearTimeout(decodeGuard);
                  done('loaded');
                }
              }
            } else {
              done('loaded');
            }
          }

          function onError() {
            done('error');
          }

          img.addEventListener('load', onLoad, { once: true });
          img.addEventListener('error', onError, { once: true });

          // Periksa kembali img.complete setelah listener load/error terpasang
          if (img.complete) {
            if (img.naturalWidth > 0) {
              onLoad();
            } else {
              onError();
            }
          }
        });
      }

      function startImageMonitoring() {
        if (manualPrinted) return;
        currentRunId += 1;
        var runId = currentRunId;

        if (statusShowTimer) {
          clearTimeout(statusShowTimer);
          statusShowTimer = null;
        }

        var imgs = getImages();
        rememberOriginalSources(imgs);

        if (imgs.length === 0) {
          setTimeout(function() {
            if (!manualPrinted && runId === currentRunId) {
              window.print();
            }
          }, 120);
          return;
        }

        statusShowTimer = setTimeout(function() {
          if (!manualPrinted && runId === currentRunId) {
            updateStatusBanner(getImages());
          }
        }, STATUS_SHOW_DELAY_MS);

        Promise.all(
          imgs.map(function(img) {
            return waitForImage(img, function() {
              if (!manualPrinted && runId === currentRunId) {
                var bar = document.getElementById('pdf-image-status-bar');
                if (bar && bar.style.display === 'block') {
                  updateStatusBanner(getImages());
                }
              }
            });
          })
        ).then(function(results) {
          if (manualPrinted || runId !== currentRunId) return;
          if (statusShowTimer) {
            clearTimeout(statusShowTimer);
            statusShowTimer = null;
          }

          var hasFailedEvidence = results.some(function(r) {
            return r.status === 'error' && !r.img.hasAttribute('data-has-svg-fallback');
          });

          if (hasFailedEvidence) {
            updateStatusBanner(getImages());
            return;
          }

          var bar = document.getElementById('pdf-image-status-bar');
          if (bar) bar.style.display = 'none';

          setTimeout(function() {
            if (!manualPrinted && runId === currentRunId) {
              window.print();
            }
          }, 150);
        });
      }

      function handleReloadPendingImages() {
        if (manualPrinted) return;
        var imgs = getImages();
        rememberOriginalSources(imgs);

        var targets = imgs.filter(function(img) {
          return !isReadyStateLoaded(img);
        });

        if (targets.length === 0) {
          startImageMonitoring();
          return;
        }

        targets.forEach(function(img) {
          var origSrc = img.getAttribute('data-orig-src') || '';
          img.removeAttribute('data-load-state');
          if (img.hasAttribute('data-has-svg-fallback')) {
            img.style.display = 'block';
            if (img.nextElementSibling) {
              img.nextElementSibling.style.display = 'none';
            }
          }
          if (origSrc) {
            img.removeAttribute('src');
            setTimeout(function() {
              img.setAttribute('src', origSrc);
            }, 30);
          }
        });

        setTimeout(function() {
          startImageMonitoring();
        }, 45);
      }

      function handleManualPrintWithoutPending() {
        manualPrinted = true;
        currentRunId += 1;
        if (statusShowTimer) {
          clearTimeout(statusShowTimer);
          statusShowTimer = null;
        }

        var imgs = getImages();
        imgs.forEach(function(img) {
          if (isReadyStateLoaded(img)) {
            return;
          }
          img.style.display = 'none';
          if (img.hasAttribute('data-has-svg-fallback')) {
            if (img.nextElementSibling) {
              img.nextElementSibling.style.display = 'block';
            }
            return;
          }
          var parent = img.parentElement;
          if (parent && !parent.querySelector('[data-pending-placeholder="true"]')) {
            var note = document.createElement('div');
            note.setAttribute('data-pending-placeholder', 'true');
            note.style.padding = '14px 8px';
            note.style.fontSize = '8.5pt';
            note.style.color = '#64748b';
            note.style.fontStyle = 'italic';
            note.textContent = '[Gambar belum selesai dimuat: ' + (img.alt || 'Lampiran Foto') + ']';
            img.insertAdjacentElement('afterend', note);
          }
        });

        var bar = document.getElementById('pdf-image-status-bar');
        if (bar) bar.style.display = 'none';

        setTimeout(function() {
          window.print();
        }, 50);
      }

      function bindControlsAndStart() {
        var reloadBtn = document.getElementById('btn-reload-pending-images');
        if (reloadBtn) {
          reloadBtn.addEventListener('click', handleReloadPendingImages);
        }
        var printSkipBtn = document.getElementById('btn-print-without-pending');
        if (printSkipBtn) {
          printSkipBtn.addEventListener('click', handleManualPrintWithoutPending);
        }
        startImageMonitoring();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindControlsAndStart, { once: true });
      } else {
        bindControlsAndStart();
      }
    })();
  </script>
</body>
</html>`;
}

export interface OpenPrintPdfResult {
  opened: boolean;
  blocked: boolean;
}

export function openPendingPrintTab(): Window | null {
  const pendingWin = window.open('', '_blank');
  if (!pendingWin) {
    return null;
  }

  const loadingHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sedang menyiapkan PDF SIBAHAR...</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 28px 32px;
      text-align: center;
      box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
      max-width: 380px;
      width: 100%;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 14px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h1 {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 6px;
      color: #0f172a;
    }
    p {
      font-size: 12.5px;
      color: #475569;
      margin: 0;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Sedang menyiapkan PDF SIBAHAR...</h1>
    <p>Memverifikasi tautan foto aman sebelum menyusun dokumen cetak laporan.</p>
  </div>
</body>
</html>`;

  try {
    pendingWin.document.open();
    pendingWin.document.write(loadingHtml);
    pendingWin.document.close();
  } catch {
    // Biarkan tab tetap terbuka untuk diisi setelah Signed URL selesai
  }

  return pendingWin;
}

export function populatePrintPdfTab(
  targetWindow: Window,
  report: ReportItem,
  appSettings?: AppSettings,
  userProfile?: UserProfile,
  resolvedStorageUrls?: Record<string, string>
): boolean {
  if (!targetWindow || targetWindow.closed) {
    return false;
  }

  const html = buildPrintReportHtml(report, appSettings, userProfile, resolvedStorageUrls);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    targetWindow.location.replace(blobUrl);
    targetWindow.focus();
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 60_000);
    return true;
  } catch {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
    try {
      targetWindow.document.open();
      targetWindow.document.write(html);
      targetWindow.document.close();
      targetWindow.focus();
      return true;
    } catch {
      return false;
    }
  }
}

export function openPrintPdfTab(
  report: ReportItem,
  appSettings?: AppSettings,
  userProfile?: UserProfile,
  resolvedStorageUrls?: Record<string, string>
): OpenPrintPdfResult {
  const html = buildPrintReportHtml(report, appSettings, userProfile, resolvedStorageUrls);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, '_blank');
  if (!printWindow) {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
    return { opened: false, blocked: true };
  }
  setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }, 60_000);
  return { opened: true, blocked: false };
}
