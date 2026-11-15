import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReportItem, UserRole } from '../types/report';

export const EXPECTED_SUPABASE_PROJECT_REF = 'ghpxnwlqpgbglpjgxeus';
export const EXPECTED_SUPABASE_URL = `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`;

const STORAGE_URL_KEY = 'sibahar_supabase_url';
const STORAGE_ANON_KEY = 'sibahar_supabase_key';
const SINGLETON_AUTH_STORAGE_KEY = 'sibahar-supabase-auth';

// Membersihkan string kredensial dari spasi dan tanda kutip yang tidak disengaja
export const cleanCredentialString = (val: string | null | undefined): string => {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
};

export const normalizeSupabaseUrl = (urlString: string | null | undefined): string => {
  const cleaned = cleanCredentialString(urlString);
  if (!cleaned) return '';
  return cleaned.replace(/\/+$/, '');
};

export const getEnvSupabaseUrl = (): string => {
  return normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
};

export const getEnvSupabaseKey = (): string => {
  return cleanCredentialString(
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      ''
  );
};

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
}

// Validasi format URL Supabase, hostname, dan Project Reference resmi SIBAHAR
export const validateSupabaseUrlDetail = (urlString: string | null | undefined): UrlValidationResult => {
  const normalized = normalizeSupabaseUrl(urlString);
  if (!normalized) {
    return { valid: false, normalizedUrl: '', error: 'URL Supabase belum diisi.' };
  }

  if (
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('[') ||
    normalized.includes(']') ||
    normalized.includes('your-project') ||
    normalized.includes('example.com') ||
    normalized.includes('xyzcompany')
  ) {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `URL Supabase masih berupa teks contoh. Gunakan ${EXPECTED_SUPABASE_URL}`,
    };
  }

  if (!normalized.startsWith('https://')) {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `Format URL Supabase tidak valid (wajib diawali https://). Gunakan ${EXPECTED_SUPABASE_URL}`,
    };
  }

  try {
    const urlObj = new URL(normalized);
    const hostname = urlObj.hostname.toLowerCase();

    if (!hostname.endsWith('.supabase.co')) {
      return {
        valid: false,
        normalizedUrl: normalized,
        error: `Hostname URL tidak valid (${hostname}). Harus berakhiran .supabase.co (${EXPECTED_SUPABASE_URL}).`,
      };
    }

    const expectedHost = `${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`;
    if (hostname !== expectedHost) {
      return {
        valid: false,
        normalizedUrl: normalized,
        error: `Project Reference URL tidak sesuai (${hostname}). Aplikasi SIBAHAR harus terhubung ke ${EXPECTED_SUPABASE_URL}.`,
      };
    }

    return {
      valid: true,
      normalizedUrl: `https://${expectedHost}`,
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `Format URL Supabase rusak/malformed. Gunakan ${EXPECTED_SUPABASE_URL}.`,
    };
  }
};

export const isValidSupabaseUrl = (urlString: string | null | undefined): boolean => {
  return validateSupabaseUrlDetail(urlString).valid;
};

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
}

// Validasi Anon Key / Publishable Key (dan cegah pemakaian Service Role Key di browser)
export const validateSupabaseKeyDetail = (keyString: string | null | undefined): KeyValidationResult => {
  const cleaned = cleanCredentialString(keyString);
  if (!cleaned) {
    return { valid: false, error: 'Anon Key / Publishable Key Supabase belum diisi.' };
  }

  if (
    cleaned.includes('<') ||
    cleaned.includes('>') ||
    cleaned.includes('[') ||
    cleaned.includes(']') ||
    cleaned.includes('your-anon-key') ||
    cleaned.includes('your-anon-publishable-key') ||
    cleaned.length < 25
  ) {
    return {
      valid: false,
      error: 'Format Anon / Publishable Key Supabase tidak valid atau masih berupa placeholder.',
    };
  }

  // Blokir secret key / service_role key di frontend
  if (cleaned.startsWith('sb_secret_')) {
    return {
      valid: false,
      error: 'Dilarang menggunakan Secret / Service Role Key di frontend. Gunakan Anon Key atau Publishable Key (sb_publishable_...).',
    };
  }

  const jwtParts = cleaned.split('.');
  if (jwtParts.length === 3 && cleaned.startsWith('eyJ')) {
    try {
      const base64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = JSON.parse(atob(base64));
      if (jsonPayload?.role === 'service_role') {
        return {
          valid: false,
          error: 'Dilarang menggunakan JWT service_role key di frontend. Gunakan anon key atau publishable key.',
        };
      }
      if (jsonPayload?.ref && jsonPayload.ref !== EXPECTED_SUPABASE_PROJECT_REF) {
        return {
          valid: false,
          error: `API Key bukan berasal dari project Supabase ${EXPECTED_SUPABASE_PROJECT_REF}.`,
        };
      }
    } catch {
      // Abaikan error parsing base64 parsial, lanjutkan validasi panjang
    }
  }

  return { valid: true };
};

// Validasi Anon / Publishable Key Supabase
export const isValidSupabaseKey = (keyString: string | null | undefined): boolean => {
  return validateSupabaseKeyDetail(keyString).valid;
};

export interface SupabaseConfigResult {
  url: string;
  key: string;
  isConfigured: boolean;
  source: 'env' | 'localStorage' | 'mixed' | 'none';
  envError?: string;
}

// Environment Variables (Vercel/Vite) adalah sumber utama; localStorage hanya fallback & dibersihkan bila usang/invalid
export const getSupabaseConfig = (): SupabaseConfigResult => {
  const envUrlRaw = getEnvSupabaseUrl();
  const envKeyRaw = getEnvSupabaseKey();

  const envUrlCheck = validateSupabaseUrlDetail(envUrlRaw);
  const envKeyCheck = validateSupabaseKeyDetail(envKeyRaw);

  let localUrl = '';
  let localKey = '';
  try {
    localUrl = normalizeSupabaseUrl(localStorage.getItem(STORAGE_URL_KEY));
    localKey = cleanCredentialString(localStorage.getItem(STORAGE_ANON_KEY));
  } catch {
    // Ignore localStorage errors in restricted environments
  }

  // Jika localStorage menyimpan URL lama / tidak cocok project reference / rusak -> hapus key URL tersebut saja (jangan sentuh data laporan)
  if (localUrl) {
    const localUrlCheck = validateSupabaseUrlDetail(localUrl);
    if (!localUrlCheck.valid || (envUrlCheck.valid && localUrlCheck.normalizedUrl !== envUrlCheck.normalizedUrl)) {
      try {
        localStorage.removeItem(STORAGE_URL_KEY);
      } catch {}
      localUrl = '';
    } else {
      localUrl = localUrlCheck.normalizedUrl;
    }
  }

  if (localKey) {
    const localKeyCheck = validateSupabaseKeyDetail(localKey);
    if (!localKeyCheck.valid || (envKeyCheck.valid && localKey !== envKeyRaw)) {
      try {
        localStorage.removeItem(STORAGE_ANON_KEY);
      } catch {}
      localKey = '';
    }
  }

  const effectiveUrl = envUrlCheck.valid ? envUrlCheck.normalizedUrl : localUrl;
  const effectiveKey = envKeyCheck.valid ? envKeyRaw : localKey;

  let source: SupabaseConfigResult['source'] = 'none';
  if (envUrlCheck.valid && envKeyCheck.valid) {
    source = 'env';
  } else if (effectiveUrl && effectiveKey) {
    source = envUrlCheck.valid || envKeyCheck.valid ? 'mixed' : 'localStorage';
  }

  let envError: string | undefined;
  if (envUrlRaw && !envUrlCheck.valid) {
    envError = `VITE_SUPABASE_URL: ${envUrlCheck.error}`;
  } else if (envKeyRaw && !envKeyCheck.valid) {
    envError = `VITE_SUPABASE_ANON_KEY / PUBLISHABLE_KEY: ${envKeyCheck.error}`;
  }

  return {
    url: effectiveUrl,
    key: effectiveKey,
    isConfigured: Boolean(effectiveUrl && effectiveKey),
    source,
    envError,
  };
};

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  connected: boolean;
  state: 'connected' | 'needs_schema' | 'auth_error' | 'network_error' | 'not_configured';
  message: string;
  tablesCreated: boolean;
  url?: string;
  source?: SupabaseConfigResult['source'];
}

// Satu-satunya instance Supabase Client (Singleton) di seluruh browser context
let singletonClient: SupabaseClient | null = null;
let singletonCacheKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !url || !key) {
    return null;
  }

  const cacheKey = `${url}::${key}`;
  if (singletonClient && singletonCacheKey === cacheKey) {
    return singletonClient;
  }

  if (singletonClient) {
    try {
      singletonClient.removeAllChannels();
    } catch {}
  }

  try {
    // SATU-SATUNYA pemanggilan createClient() di sisi frontend untuk mencegah Multiple GoTrueClient
    singletonClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: SINGLETON_AUTH_STORAGE_KEY,
      },
    });
    singletonCacheKey = cacheKey;
    return singletonClient;
  } catch (err: any) {
    console.warn('Gagal menginisialisasi Supabase Client:', err?.message || err);
    singletonClient = null;
    singletonCacheKey = '';
    return null;
  }
};

function interpretRestError(
  errorObj: { message?: string; code?: string; status?: number } | null,
  url: string,
  source: SupabaseConfigResult['source']
): SupabaseConnectionStatus {
  if (!errorObj) {
    return {
      isConfigured: true,
      connected: true,
      state: 'connected',
      message: `Terhubung ke Supabase (${url}). Database dan tabel siap digunakan.`,
      tablesCreated: true,
      url,
      source,
    };
  }

  const msg = String(errorObj.message || '');
  const lower = msg.toLowerCase();
  const code = String(errorObj.code || '');
  const status = errorObj.status;

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('err_name_not_resolved') ||
    lower.includes('load failed') ||
    lower.includes('fetch')
  ) {
    return {
      isConfigured: true,
      connected: false,
      state: 'network_error',
      message: `Gagal menjangkau server Supabase (${url}). Periksa koneksi internet, pastikan project Supabase (${EXPECTED_SUPABASE_PROJECT_REF}) tidak dalam status Paused, dan pastikan deployment Vercel sudah di-redeploy.`,
      tablesCreated: false,
      url,
      source,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('invalid api key') ||
    lower.includes('apikey') ||
    lower.includes('jwt') ||
    lower.includes('unauthorized')
  ) {
    return {
      isConfigured: true,
      connected: false,
      state: 'auth_error',
      message: 'API Key Supabase (VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY) tidak valid atau ditolak oleh server Supabase.',
      tablesCreated: false,
      url,
      source,
    };
  }

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    status === 404 ||
    lower.includes('does not exist') ||
    lower.includes('could not find the table') ||
    lower.includes('relation')
  ) {
    return {
      isConfigured: true,
      connected: false,
      state: 'needs_schema',
      message: 'Server Supabase merespons dan API Key valid, namun tabel "profiles" / "reports" belum tersedia di database.',
      tablesCreated: false,
      url,
      source,
    };
  }

  return {
    isConfigured: true,
    connected: false,
    state: 'network_error',
    message: `Gagal terhubung ke Supabase: ${msg || 'Respon server tidak dikenali.'}`,
    tablesCreated: false,
    url,
    source,
  };
}

// Menguji koneksi nyata ke Supabase menggunakan singleton client (tanpa pernah membuat instance createClient baru)
export const testSupabaseConnection = async (
  customUrl?: string,
  customKey?: string
): Promise<SupabaseConnectionStatus> => {
  const cfg = getSupabaseConfig();
  const rawCustomUrl = normalizeSupabaseUrl(customUrl);
  const rawCustomKey = cleanCredentialString(customKey);

  const hasCustomInput = Boolean(rawCustomUrl || rawCustomKey);
  const targetUrl = hasCustomInput ? rawCustomUrl : cfg.url;
  const targetKey = hasCustomInput ? rawCustomKey : cfg.key;

  if (!targetUrl || !targetKey) {
    return {
      isConfigured: false,
      connected: false,
      state: 'not_configured',
      message:
        cfg.envError ||
        'Belum terhubung: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY belum diatur.',
      tablesCreated: false,
      source: cfg.source,
    };
  }

  const urlCheck = validateSupabaseUrlDetail(targetUrl);
  if (!urlCheck.valid) {
    return {
      isConfigured: false,
      connected: false,
      state: 'network_error',
      message: urlCheck.error || 'Format URL Supabase tidak valid.',
      tablesCreated: false,
      url: targetUrl,
      source: cfg.source,
    };
  }

  const keyCheck = validateSupabaseKeyDetail(targetKey);
  if (!keyCheck.valid) {
    return {
      isConfigured: false,
      connected: false,
      state: 'auth_error',
      message: keyCheck.error || 'Format API Key Supabase tidak valid.',
      tablesCreated: false,
      url: urlCheck.normalizedUrl,
      source: cfg.source,
    };
  }

  const matchesActiveConfig =
    cfg.isConfigured &&
    urlCheck.normalizedUrl === cfg.url &&
    targetKey === cfg.key;

  try {
    if (matchesActiveConfig || !hasCustomInput) {
      // Gunakan singleton client yang sama persis dengan seluruh aplikasi & Realtime
      const client = getSupabaseClient();
      if (!client) {
        return {
          isConfigured: false,
          connected: false,
          state: 'not_configured',
          message: 'Client Supabase gagal diinisialisasi. Periksa konfigurasi Environment Variables.',
          tablesCreated: false,
          source: cfg.source,
        };
      }

      const { error: tableError, status } = await client
        .from('profiles')
        .select('id')
        .limit(1);

      return interpretRestError(
        tableError ? { message: tableError.message, code: tableError.code, status } : null,
        urlCheck.normalizedUrl,
        cfg.source
      );
    }

    // Jika Admin mengetes input sementara di form Pengaturan sebelum disimpan,
    // gunakan fetch REST langsung agar TIDAK membuat instance GoTrueClient kedua.
    const response = await fetch(`${urlCheck.normalizedUrl}/rest/v1/profiles?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      return interpretRestError(null, urlCheck.normalizedUrl, 'localStorage');
    }

    let bodyErr: any = {};
    try {
      bodyErr = await response.json();
    } catch {}

    return interpretRestError(
      {
        message: bodyErr?.message || response.statusText || `HTTP ${response.status}`,
        code: bodyErr?.code,
        status: response.status,
      },
      urlCheck.normalizedUrl,
      'localStorage'
    );
  } catch (err: any) {
    return interpretRestError(
      { message: err?.message || 'Failed to fetch' },
      urlCheck.normalizedUrl,
      cfg.source
    );
  }
};

// Helper: Unggah file ke Supabase Storage (Bucket: report-attachments)
export async function uploadAttachmentToStorage(
  file: File,
  reportId: string
): Promise<{ url: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { url: '', error: 'Supabase belum terhubung atau belum dikonfigurasi.' };
  }

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `reports/${reportId}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await client.storage
      .from('report-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Gagal upload ke Supabase Storage, menggunakan base64:', uploadError.message);
      return { url: '', error: uploadError.message };
    }

    const { data: publicUrlData } = client.storage
      .from('report-attachments')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl };
  } catch (err: any) {
    return { url: '', error: err.message || 'Error saat upload file' };
  }
}

// Konversi format DB Supabase ke ReportItem di UI
export const mapDbReportToReportItem = (row: any): ReportItem => {
  return {
    id: row.id,
    userId: row.user_id,
    userRole: row.user_role as UserRole,
    title: row.title,
    category: row.category,
    priority: row.priority,
    location: row.location || '',
    incidentDate: row.incident_date,
    createdAt: row.created_at,
    description: row.description,
    status: row.status,
    reporterName: row.reporter_name,
    reporterEmail: row.reporter_email || '',
    reporterDept: row.reporter_dept || '',
    reporterNip: row.reporter_nip || '',
    picName: row.pic_name,
    picRole: row.pic_role,
    picNip: row.pic_nip,
    assignedTo: row.assigned_to,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    logs: Array.isArray(row.logs) ? row.logs : [],
    reporterSignature: row.reporter_signature || '',
  };
};

// Konversi ReportItem ke format tabel `reports` Supabase
export const mapReportItemToDbRow = (item: ReportItem, userId: string, userRole: UserRole) => {
  return {
    id: item.id,
    user_id: userId,
    user_role: userRole,
    title: item.title,
    category: item.category,
    priority: item.priority,
    description: item.description,
    incident_date: item.incidentDate,
    location: item.location || '',
    status: item.status,
    reporter_name: item.reporterName,
    reporter_email: item.reporterEmail || '',
    reporter_dept: item.reporterDept || '',
    reporter_nip: item.reporterNip || '',
    pic_name: item.picName || '',
    pic_role: item.picRole || '',
    pic_nip: item.picNip || '',
    assigned_to: item.assignedTo || '',
    attachments: item.attachments || [],
    logs: item.logs || [],
    reporter_signature: item.reporterSignature || null,
    updated_at: new Date().toISOString(),
  };
};

// Helper: Catat riwayat ke tabel audit_logs
export async function logAuditEvent(params: {
  userId?: string;
  userRole?: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType?: string;
  resourceType?: string;
  entityId?: string;
  resourceId?: string;
  details?: any;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('audit_logs').insert({
      user_id: params.userId || null,
      user_role: params.userRole || null,
      user_name: params.userName || params.userEmail || null,
      action: params.action,
      entity_type: params.entityType || params.resourceType || 'general',
      entity_id: params.entityId || params.resourceId || 'unknown',
      details: params.details || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Gagal mencatat audit log ke Supabase:', err);
  }
}
