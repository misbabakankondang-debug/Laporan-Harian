import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReportItem, UserRole } from '../types/report';

export const EXPECTED_SUPABASE_PROJECT_REF = 'ghpxnwlqpgbglpjgxeus';
export const EXPECTED_SUPABASE_URL = `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`;

const STORAGE_URL_KEY = 'sibahar_supabase_url';
const STORAGE_ANON_KEY = 'sibahar_supabase_key';
const SINGLETON_AUTH_STORAGE_KEY = 'sibahar-supabase-auth';

// Karakter tidak terlihat (zero-width, BOM, non-breaking space, control chars) yang sering terbawa saat copy-paste
const INVISIBLE_UNICODE_REGEX =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u00A0\u0000-\u001F\u007F-\u009F]/g;

export const stripInvisibleChars = (val: string): string => {
  return val.replace(INVISIBLE_UNICODE_REGEX, '');
};

// Membersihkan string kredensial dari karakter tersembunyi, spasi, dan tanda kutip yang tidak disengaja
export const cleanCredentialString = (val: string | null | undefined): string => {
  if (!val || typeof val !== 'string') return '';
  return stripInvisibleChars(val)
    .trim()
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .trim();
};

export const normalizeSupabaseUrl = (urlString: string | null | undefined): string => {
  const cleaned = cleanCredentialString(urlString);
  if (!cleaned) return '';
  return cleaned.replace(/\/+$/, '');
};

export const isPublishableApiKey = (keyString: string | null | undefined): boolean => {
  return cleanCredentialString(keyString).startsWith('sb_publishable_');
};

export const getEnvSupabaseUrl = (): string => {
  return normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
};

// Membaca dan memvalidasi kandidat API Key dari Environment Variables (anon key JWT maupun sb_publishable_)
export const getEnvSupabaseKey = (): string => {
  const candidates = [
    cleanCredentialString(import.meta.env.VITE_SUPABASE_ANON_KEY),
    cleanCredentialString(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  ];

  for (const candidate of candidates) {
    if (candidate && validateSupabaseKeyDetail(candidate).valid) {
      return candidate;
    }
  }

  return '';
};

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  hostname?: string;
  projectRef?: string;
  error?: string;
}

// Validasi format URL Supabase menggunakan parser standar URL, HTTPS, hostname, dan Project Reference resmi
export const validateSupabaseUrlDetail = (urlString: string | null | undefined): UrlValidationResult => {
  const normalized = normalizeSupabaseUrl(urlString);
  if (!normalized) {
    return { valid: false, normalizedUrl: '', error: 'URL Supabase belum diisi.' };
  }

  const lowerNormalized = normalized.toLowerCase();
  if (
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('[') ||
    normalized.includes(']') ||
    lowerNormalized.includes('your-project') ||
    lowerNormalized.includes('example.com') ||
    lowerNormalized.includes('xyzcompany')
  ) {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `URL Supabase masih berupa teks contoh. Gunakan ${EXPECTED_SUPABASE_URL}`,
    };
  }

  if (/[^\x20-\x7E]/.test(normalized)) {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `URL Supabase mengandung karakter non-ASCII / homoglyph tersembunyi. Ketik ulang secara bersih: ${EXPECTED_SUPABASE_URL}`,
    };
  }

  let urlObj: URL;
  try {
    urlObj = new URL(normalized);
  } catch {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `Format URL Supabase rusak/malformed. Gunakan ${EXPECTED_SUPABASE_URL}.`,
    };
  }

  if (urlObj.protocol !== 'https:') {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `Protokol URL Supabase wajib HTTPS (ditemukan ${urlObj.protocol}). Gunakan ${EXPECTED_SUPABASE_URL}`,
    };
  }

  if (urlObj.username || urlObj.password || urlObj.port) {
    return {
      valid: false,
      normalizedUrl: normalized,
      error: `URL Supabase tidak boleh mengandung kredensial atau port khusus. Gunakan ${EXPECTED_SUPABASE_URL}`,
    };
  }

  const hostname = urlObj.hostname.toLowerCase();
  if (hostname.startsWith('xn--') || hostname.includes('.xn--')) {
    return {
      valid: false,
      normalizedUrl: normalized,
      hostname,
      error: `Hostname URL mengandung karakter IDN/homoglyph (${hostname}). Gunakan ${EXPECTED_SUPABASE_URL}.`,
    };
  }

  if (!hostname.endsWith('.supabase.co')) {
    return {
      valid: false,
      normalizedUrl: normalized,
      hostname,
      error: `Hostname URL tidak valid (${hostname}). Harus berakhiran .supabase.co (${EXPECTED_SUPABASE_URL}).`,
    };
  }

  const projectRef = hostname.slice(0, -'.supabase.co'.length);
  const expectedHost = `${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`;
  if (projectRef !== EXPECTED_SUPABASE_PROJECT_REF || hostname !== expectedHost) {
    return {
      valid: false,
      normalizedUrl: normalized,
      hostname,
      projectRef,
      error: `Project Reference URL tidak sesuai (${hostname}). Aplikasi SIBAHAR harus terhubung ke ${EXPECTED_SUPABASE_URL}.`,
    };
  }

  if ((urlObj.pathname && urlObj.pathname !== '/') || urlObj.search || urlObj.hash) {
    return {
      valid: false,
      normalizedUrl: normalized,
      hostname,
      projectRef,
      error: `URL Supabase tidak boleh menyertakan path tambahan atau query (${urlObj.pathname}). Gunakan ${EXPECTED_SUPABASE_URL}.`,
    };
  }

  return {
    valid: true,
    normalizedUrl: urlObj.origin,
    hostname,
    projectRef,
  };
};

export const isValidSupabaseUrl = (urlString: string | null | undefined): boolean => {
  return validateSupabaseUrlDetail(urlString).valid;
};

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
}

// Validasi Anon Key (JWT) atau Publishable Key (sb_publishable_), dan blokir Secret / Service Role Key
export const validateSupabaseKeyDetail = (keyString: string | null | undefined): KeyValidationResult => {
  const cleaned = cleanCredentialString(keyString);
  if (!cleaned) {
    return { valid: false, error: 'Anon Key / Publishable Key Supabase belum diisi.' };
  }

  const lower = cleaned.toLowerCase();
  if (
    /\s/.test(cleaned) ||
    cleaned.includes('<') ||
    cleaned.includes('>') ||
    cleaned.includes('[') ||
    cleaned.includes(']') ||
    lower.includes('your-anon-key') ||
    lower.includes('your-anon-publishable-key') ||
    lower.includes('your-publishable-key') ||
    lower.includes('placeholder') ||
    lower.includes('changeme') ||
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

  // Format baru sb_publishable_ bukan JWT, sehingga tidak boleh diparse sebagai JWT
  if (cleaned.startsWith('sb_publishable_')) {
    return { valid: true };
  }

  // Format JWT lama (eyJ...): wajib 3 segmen valid & role bukan service_role
  if (cleaned.startsWith('eyJ')) {
    const jwtParts = cleaned.split('.');
    if (jwtParts.length !== 3 || jwtParts.some((part) => !part)) {
      return {
        valid: false,
        error: 'Format JWT Anon Key Supabase tidak lengkap atau rusak.',
      };
    }

    try {
      const base64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = JSON.parse(atob(base64));
      if (!jsonPayload || typeof jsonPayload !== 'object') {
        return { valid: false, error: 'Payload JWT Anon Key Supabase tidak valid.' };
      }
      if (jsonPayload.role === 'service_role') {
        return {
          valid: false,
          error: 'Dilarang menggunakan JWT service_role key di frontend. Gunakan anon key atau publishable key.',
        };
      }
      if (jsonPayload.ref && jsonPayload.ref !== EXPECTED_SUPABASE_PROJECT_REF) {
        return {
          valid: false,
          error: `API Key bukan berasal dari project Supabase ${EXPECTED_SUPABASE_PROJECT_REF}.`,
        };
      }
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Payload JWT Anon Key Supabase tidak dapat didekode.',
      };
    }
  }

  return {
    valid: false,
    error: 'Format API Key tidak dikenali. Gunakan Anon Key (eyJ...) atau Publishable Key (sb_publishable_...).',
  };
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
  hasEnvConfig: boolean;
  envUrl: string;
  hasEnvKey: boolean;
  apiKeyPresent: boolean;
  apiKeyFormatValid: boolean;
  envError?: string;
  localConflictWarning?: string;
}

// Environment Variables hasil build Vite adalah sumber utama untuk produksi.
// Jika URL/Key Env tersedia tetapi invalid, JANGAN diam-diam beralih ke localStorage.
// localStorage hanya dipakai saat Env belum diatur (pengembangan lokal / pengujian manual).
export const getSupabaseConfig = (): SupabaseConfigResult => {
  const envUrlRaw = getEnvSupabaseUrl();
  const envAnonRaw = cleanCredentialString(import.meta.env.VITE_SUPABASE_ANON_KEY);
  const envPubRaw = cleanCredentialString(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const envKeyRaw = getEnvSupabaseKey();
  const hasAnyEnvKeyRaw = Boolean(envAnonRaw || envPubRaw);
  const hasAnyEnvUrlRaw = Boolean(envUrlRaw);
  const hasEnvConfig = hasAnyEnvUrlRaw || hasAnyEnvKeyRaw;

  const envUrlCheck = validateSupabaseUrlDetail(envUrlRaw);
  const envKeyCheck = validateSupabaseKeyDetail(envKeyRaw);

  let localUrl = '';
  let localKey = '';
  let localConflictWarning: string | undefined;

  try {
    localUrl = normalizeSupabaseUrl(localStorage.getItem(STORAGE_URL_KEY));
    localKey = cleanCredentialString(localStorage.getItem(STORAGE_ANON_KEY));
  } catch {
    // Abaikan error localStorage pada mode browser terbatas
  }

  // Audit & bersihkan konfigurasi localStorage lama/usang/konflik secara aman (jangan sentuh data laporan)
  if (localUrl) {
    const localUrlCheck = validateSupabaseUrlDetail(localUrl);
    if (!localUrlCheck.valid) {
      try {
        localStorage.removeItem(STORAGE_URL_KEY);
      } catch {}
      localUrl = '';
      localConflictWarning =
        'Konfigurasi URL Supabase lama/tidak valid di penyimpanan browser telah dibersihkan secara aman.';
    } else if (hasEnvConfig && envUrlCheck.valid && localUrlCheck.normalizedUrl !== envUrlCheck.normalizedUrl) {
      try {
        localStorage.removeItem(STORAGE_URL_KEY);
      } catch {}
      localUrl = '';
      localConflictWarning =
        'Konfigurasi URL di penyimpanan browser berbeda dengan Environment Variables produksi dan telah diabaikan/dibersihkan.';
    } else if (hasEnvConfig) {
      localUrl = localUrlCheck.normalizedUrl;
      if (!localConflictWarning && envUrlCheck.valid) {
        try {
          localStorage.removeItem(STORAGE_URL_KEY);
        } catch {}
      }
    } else {
      localUrl = localUrlCheck.normalizedUrl;
    }
  }

  if (localKey) {
    const localKeyCheck = validateSupabaseKeyDetail(localKey);
    if (!localKeyCheck.valid) {
      try {
        localStorage.removeItem(STORAGE_ANON_KEY);
      } catch {}
      localKey = '';
      localConflictWarning =
        localConflictWarning ||
        'API Key Supabase usang/tidak valid di penyimpanan browser telah dibersihkan secara aman.';
    } else if (hasEnvConfig && envKeyCheck.valid && localKey !== envKeyRaw) {
      try {
        localStorage.removeItem(STORAGE_ANON_KEY);
      } catch {}
      localKey = '';
      localConflictWarning =
        'API Key di penyimpanan browser berbeda dengan Environment Variables produksi dan telah diabaikan/dibersihkan.';
    } else if (hasEnvConfig && envKeyCheck.valid) {
      try {
        localStorage.removeItem(STORAGE_ANON_KEY);
      } catch {}
    }
  }

  let envError: string | undefined;
  if (hasAnyEnvUrlRaw && !envUrlCheck.valid) {
    envError = `VITE_SUPABASE_URL: ${envUrlCheck.error}`;
  } else if (!hasAnyEnvUrlRaw && hasAnyEnvKeyRaw) {
    envError = `VITE_SUPABASE_URL belum tersedia di Environment Variables Vercel. Wajib diatur ke ${EXPECTED_SUPABASE_URL}.`;
  } else if (hasAnyEnvUrlRaw && envUrlCheck.valid && !hasAnyEnvKeyRaw) {
    envError =
      'API Key Supabase (VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY) belum tersedia di Environment Variables Vercel.';
  } else if (hasAnyEnvKeyRaw && !envKeyCheck.valid) {
    const failedCandidate = envAnonRaw || envPubRaw;
    const failedCheck = validateSupabaseKeyDetail(failedCandidate);
    envError = `VITE_SUPABASE_PUBLISHABLE_KEY / ANON_KEY: ${failedCheck.error}`;
  }

  // Jika Vercel/Vite Environment Variables terpasang (valid ataupun bermasalah),
  // JANGAN diam-diam beralih ke localStorage agar produksi selalu transparan dan konsisten.
  if (hasEnvConfig) {
    const validUrl = envUrlCheck.valid ? envUrlCheck.normalizedUrl : '';
    const validKey = envKeyCheck.valid ? envKeyRaw : '';
    return {
      url: validUrl,
      key: validKey,
      isConfigured: Boolean(validUrl && validKey),
      source: 'env',
      hasEnvConfig: true,
      envUrl: envUrlRaw,
      hasEnvKey: envKeyCheck.valid,
      apiKeyPresent: hasAnyEnvKeyRaw,
      apiKeyFormatValid: envKeyCheck.valid,
      envError,
      localConflictWarning,
    };
  }

  // Fallback lokal (hanya jika Env Vite benar-benar kosong, mis. mode dev / pengujian manual)
  const hasLocalConfig = Boolean(localUrl && localKey);
  return {
    url: hasLocalConfig ? localUrl : localUrl || '',
    key: hasLocalConfig ? localKey : localKey || '',
    isConfigured: hasLocalConfig,
    source: hasLocalConfig || localUrl || localKey ? 'localStorage' : 'none',
    hasEnvConfig: false,
    envUrl: '',
    hasEnvKey: false,
    apiKeyPresent: Boolean(localKey),
    apiKeyFormatValid: Boolean(localKey && validateSupabaseKeyDetail(localKey).valid),
    envError,
    localConflictWarning,
  };
};

export type SupabaseConnectionState =
  | 'connected'
  | 'needs_schema'
  | 'permission_error'
  | 'auth_error'
  | 'network_error'
  | 'not_configured'
  | 'unknown_error';

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  connected: boolean;
  state: SupabaseConnectionState;
  gatewayConnected: boolean;
  apiKeyValid: boolean;
  apiKeyPresent?: boolean;
  apiKeyFormatValid?: boolean;
  databaseAccessible: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  message: string;
  testedAt: string;
  tablesCreated: boolean;
  url?: string;
  source?: SupabaseConfigResult['source'];
  localConflictWarning?: string;
}

// Pembungkus fetch aman untuk SDK @supabase/supabase-js v2.119.0:
// Mencegah sb_publishable_ terkirim sebagai Authorization: Bearer saat belum ada sesi JWT pengguna,
// sambil menjaga Authorization: Bearer <user_jwt> milik sesi aktif dan perilaku JWT anon key lama.
const createPublishableSafeFetch = (apiKey: string): typeof fetch => {
  const isPublishable = isPublishableApiKey(apiKey);
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );

    if (!headers.has('apikey')) {
      headers.set('apikey', apiKey);
    }

    if (isPublishable) {
      const authHeader = headers.get('Authorization');
      if (authHeader) {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch && bearerMatch[1].trim() === apiKey) {
          headers.delete('Authorization');
        }
      }
    }

    return globalThis.fetch(input, {
      ...init,
      headers,
    });
  };
};

// Pembentuk header REST manual yang aman untuk sb_publishable_ maupun JWT anon key
export const buildSupabaseRestHeaders = (
  apiKey: string,
  accessToken?: string | null
): Record<string, string> => {
  const headers: Record<string, string> = {
    apikey: apiKey,
    Accept: 'application/json',
  };

  const cleanedToken = cleanCredentialString(accessToken);
  if (cleanedToken && cleanedToken !== apiKey) {
    headers.Authorization = `Bearer ${cleanedToken}`;
  } else if (!isPublishableApiKey(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
};

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
      global: {
        fetch: createPublishableSafeFetch(key),
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

export interface RestErrorInput {
  message?: string;
  code?: string | null;
  status?: number | null;
  stage?: 'gateway' | 'database';
  gatewayConnected?: boolean;
  apiKeyValid?: boolean;
}

export function interpretRestError(
  errorObj: RestErrorInput | null,
  url: string,
  source: SupabaseConfigResult['source'],
  testedAt = new Date().toISOString()
): SupabaseConnectionStatus {
  if (!errorObj) {
    return {
      isConfigured: true,
      connected: true,
      state: 'connected',
      gatewayConnected: true,
      apiKeyValid: true,
      databaseAccessible: true,
      httpStatus: 200,
      errorCode: null,
      message: 'Gateway, API Key, dan akses database berhasil.',
      testedAt,
      tablesCreated: true,
      url,
      source,
    };
  }

  const msg = String(errorObj.message || '').trim();
  const lower = msg.toLowerCase();
  const code = errorObj.code ? String(errorObj.code).trim() : null;
  const codeUpper = (code || '').toUpperCase();
  const status = typeof errorObj.status === 'number' ? errorObj.status : null;
  const stage = errorObj.stage || 'database';

  const isNetworkFailure =
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('err_name_not_resolved') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    status === 502 ||
    status === 503 ||
    status === 504;

  if (isNetworkFailure) {
    return {
      isConfigured: true,
      connected: false,
      state: 'network_error',
      gatewayConnected: false,
      apiKeyValid: false,
      databaseAccessible: false,
      httpStatus: status,
      errorCode: code || (status ? `HTTP_${status}` : 'NETWORK_ERROR'),
      message: `Periksa jaringan, DNS, atau ketersediaan server Supabase (${url}).`,
      testedAt,
      tablesCreated: false,
      url,
      source,
    };
  }

  const isApiKeyOrJwtRejection =
    codeUpper === 'PGRST301' ||
    codeUpper === 'UNAUTHORIZED_INVALID_API_KEY' ||
    codeUpper === 'UNAUTHORIZED_MISSING_API_KEY' ||
    lower.includes('invalid api key') ||
    lower.includes('no api key') ||
    lower.includes('missing api key') ||
    lower.includes('jwserror') ||
    lower.includes('invalid jwt') ||
    lower.includes('jwt expired') ||
    lower.includes('expected 3 parts in jwt');

  const isPermissionOrRlsError =
    codeUpper === '42501' ||
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('insufficient privilege');

  // 1. Cek skema / tabel belum tersedia (khusus tahap database, tidak menyamaratakan seluruh 404)
  const isMissingTableError =
    stage === 'database' &&
    (codeUpper === '42P01' ||
      codeUpper === 'PGRST205' ||
      (status === 404 &&
        (lower.includes('could not find the table') ||
          lower.includes('does not exist') ||
          lower.includes('relation') ||
          lower.includes('schema cache') ||
          lower.includes('profiles'))));

  if (isMissingTableError) {
    return {
      isConfigured: true,
      connected: false,
      state: 'needs_schema',
      gatewayConnected: true,
      apiKeyValid: true,
      databaseAccessible: false,
      httpStatus: status ?? 404,
      errorCode: code || 'PGRST205',
      message: 'Gateway dan API Key berhasil, tetapi tabel profiles belum ditemukan.',
      testedAt,
      tablesCreated: false,
      url,
      source,
    };
  }

  // 2. Cek penolakan izin database / RLS (42501 / 403 non-auth) sebelum menyimpulkan auth_error
  if (
    isPermissionOrRlsError ||
    (stage === 'database' && status === 403 && !isApiKeyOrJwtRejection) ||
    (stage === 'gateway' && status === 403 && !isApiKeyOrJwtRejection && !lower.includes('unauthorized'))
  ) {
    return {
      isConfigured: true,
      connected: false,
      state: 'permission_error',
      gatewayConnected: errorObj.gatewayConnected ?? true,
      apiKeyValid: errorObj.apiKeyValid ?? true,
      databaseAccessible: false,
      httpStatus: status ?? 403,
      errorCode: code || (status ? `HTTP_${status}` : '42501'),
      message: 'API Key diterima, tetapi akses tabel profiles dibatasi oleh izin database atau RLS.',
      testedAt,
      tablesCreated: true,
      url,
      source,
    };
  }

  // 3. Penolakan autentikasi / API Key / JWT (401, PGRST301, atau 403 terkait API Key)
  if (
    isApiKeyOrJwtRejection ||
    status === 401 ||
    (status === 403 && isApiKeyOrJwtRejection) ||
    lower.includes('unauthorized')
  ) {
    return {
      isConfigured: true,
      connected: false,
      state: 'auth_error',
      gatewayConnected: errorObj.gatewayConnected ?? Boolean(status),
      apiKeyValid: false,
      databaseAccessible: false,
      httpStatus: status ?? 401,
      errorCode: code || (status ? `HTTP_${status}` : 'AUTH_ERROR'),
      message:
        codeUpper === 'PGRST301'
          ? 'Token JWT atau header Bearer ditolak oleh PostgREST (PGRST301). Periksa API Key atau sesi autentikasi.'
          : 'Periksa API Key atau token autentikasi. Server Supabase menolak kredensial yang digunakan.',
      testedAt,
      tablesCreated: false,
      url,
      source,
    };
  }

  // 4. Kesalahan lain yang tidak termasuk kategori di atas (mis. 404 bukan tabel, 500, dsb.)
  return {
    isConfigured: true,
    connected: false,
    state: 'unknown_error',
    gatewayConnected: errorObj.gatewayConnected ?? Boolean(status),
    apiKeyValid: errorObj.apiKeyValid ?? false,
    databaseAccessible: false,
    httpStatus: status,
    errorCode: code || (status ? `HTTP_${status}` : 'UNKNOWN_ERROR'),
    message: msg || 'Terjadi kesalahan koneksi yang tidak dapat diklasifikasikan. Periksa informasi diagnostik.',
    testedAt,
    tablesCreated: false,
    url,
    source,
  };
}

async function parseSafeErrorBody(response: Response): Promise<{ message?: string; code?: string | null }> {
  try {
    const text = await response.text();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      return {
        message: parsed?.message || parsed?.error_description || parsed?.hint || parsed?.error,
        code: parsed?.code || parsed?.error_code || null,
      };
    } catch {
      return { message: text.slice(0, 200) };
    }
  } catch {
    return {};
  }
}

// Menguji koneksi nyata ke Supabase dalam 2 tahap (Gateway+API Key -> Tabel+Izin Database)
// Menggunakan metode GET saja dan hanya 1 singleton client.
export const testSupabaseConnection = async (
  customUrl?: string,
  customKey?: string
): Promise<SupabaseConnectionStatus> => {
  const testedAt = new Date().toISOString();
  const cfg = getSupabaseConfig();
  const rawCustomUrl = normalizeSupabaseUrl(customUrl);
  const rawCustomKey = cleanCredentialString(customKey);

  const hasCustomInput = customUrl !== undefined || customKey !== undefined;
  const envUrlRaw = getEnvSupabaseUrl();
  const envKeyRaw = getEnvSupabaseKey();

  // Tentukan apakah pengujian memakai konfigurasi Vercel Env atau input manual browser yang berbeda
  const customMatchesEnvUrl = !rawCustomUrl ? !envUrlRaw : Boolean(envUrlRaw && rawCustomUrl === envUrlRaw);
  const customMatchesEnvKey = !rawCustomKey ? !envKeyRaw : Boolean(envKeyRaw && rawCustomKey === envKeyRaw);
  const isTestingEnvConfig =
    !hasCustomInput || (cfg.hasEnvConfig && customMatchesEnvUrl && customMatchesEnvKey);

  const targetUrl = isTestingEnvConfig ? (cfg.url || cfg.envUrl) : rawCustomUrl;
  const targetKey = isTestingEnvConfig ? cfg.key : rawCustomKey;

  let effectiveSource: SupabaseConfigResult['source'] = cfg.source;
  if (hasCustomInput && !isTestingEnvConfig) {
    if (cfg.hasEnvConfig && (customMatchesEnvUrl || customMatchesEnvKey)) {
      effectiveSource = 'mixed';
    } else {
      effectiveSource = 'localStorage';
    }
  } else if (isTestingEnvConfig && cfg.hasEnvConfig) {
    effectiveSource = 'env';
  }

  const keyCheck = validateSupabaseKeyDetail(targetKey);
  const apiKeyPresent = Boolean(targetKey) || (isTestingEnvConfig && cfg.apiKeyPresent);
  const apiKeyFormatValid = Boolean(targetKey && keyCheck.valid);

  // 1. Jika Env error sudah terdeteksi dan admin menguji konfigurasi Env (tidak menimpa dengan input valid baru)
  if (isTestingEnvConfig && cfg.hasEnvConfig && cfg.envError) {
    const isUrlIssue = !validateSupabaseUrlDetail(cfg.envUrl).valid;
    return {
      isConfigured: Boolean(cfg.url && cfg.key),
      connected: false,
      state: isUrlIssue ? 'network_error' : 'auth_error',
      gatewayConnected: false,
      apiKeyValid: false,
      apiKeyPresent,
      apiKeyFormatValid,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: isUrlIssue ? 'INVALID_URL' : apiKeyPresent ? 'INVALID_KEY_FORMAT' : 'MISSING_API_KEY',
      message: cfg.envError,
      testedAt,
      tablesCreated: false,
      url: cfg.envUrl || undefined,
      source: 'env',
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  if (!targetUrl && !targetKey) {
    return {
      isConfigured: false,
      connected: false,
      state: 'not_configured',
      gatewayConnected: false,
      apiKeyValid: false,
      apiKeyPresent: false,
      apiKeyFormatValid: false,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'NOT_CONFIGURED',
      message:
        cfg.envError ||
        'Belum terkonfigurasi: VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY belum tersedia.',
      testedAt,
      tablesCreated: false,
      source: effectiveSource,
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  const urlCheck = validateSupabaseUrlDetail(targetUrl);
  if (!urlCheck.valid) {
    return {
      isConfigured: Boolean(targetUrl && targetKey),
      connected: false,
      state: 'network_error',
      gatewayConnected: false,
      apiKeyValid: false,
      apiKeyPresent,
      apiKeyFormatValid,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'INVALID_URL',
      message: urlCheck.error || 'Format URL Supabase tidak valid.',
      testedAt,
      tablesCreated: false,
      url: targetUrl || undefined,
      source: effectiveSource,
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  if (!targetKey) {
    return {
      isConfigured: false,
      connected: false,
      state: 'auth_error',
      gatewayConnected: false,
      apiKeyValid: false,
      apiKeyPresent: false,
      apiKeyFormatValid: false,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'MISSING_API_KEY',
      message:
        cfg.envError ||
        'API Key Supabase (VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY) belum tersedia.',
      testedAt,
      tablesCreated: false,
      url: urlCheck.normalizedUrl,
      source: effectiveSource,
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  if (!keyCheck.valid) {
    return {
      isConfigured: true,
      connected: false,
      state: 'auth_error',
      gatewayConnected: false,
      apiKeyValid: false,
      apiKeyPresent: true,
      apiKeyFormatValid: false,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'INVALID_KEY_FORMAT',
      message: keyCheck.error || 'Format API Key Supabase tidak valid.',
      testedAt,
      tablesCreated: false,
      url: urlCheck.normalizedUrl,
      source: effectiveSource,
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  const matchesActiveConfig =
    cfg.isConfigured &&
    urlCheck.normalizedUrl === cfg.url &&
    targetKey === cfg.key;

  const resolvedSource = isTestingEnvConfig && cfg.hasEnvConfig ? 'env' : matchesActiveConfig ? cfg.source : effectiveSource;

  try {
    // =========================================================================
    // TAHAP 1: Pengujian Gateway & API Key (/rest/v1/)
    // Untuk sb_publishable_, hanya mengirim header apikey (tanpa Bearer).
    // =========================================================================
    const gatewayHeaders = buildSupabaseRestHeaders(targetKey);
    const gatewayResponse = await globalThis.fetch(`${urlCheck.normalizedUrl}/rest/v1/`, {
      method: 'GET',
      headers: gatewayHeaders,
    });

    if (!gatewayResponse.ok) {
      const gatewayBody = await parseSafeErrorBody(gatewayResponse);
      return {
        ...interpretRestError(
          {
            message: gatewayBody.message || gatewayResponse.statusText || `HTTP ${gatewayResponse.status}`,
            code: gatewayBody.code,
            status: gatewayResponse.status,
            stage: 'gateway',
            gatewayConnected: gatewayResponse.status < 502,
            apiKeyValid: false,
          },
          urlCheck.normalizedUrl,
          resolvedSource,
          testedAt
        ),
        apiKeyPresent: true,
        apiKeyFormatValid: true,
        localConflictWarning: cfg.localConflictWarning,
      };
    }

    // =========================================================================
    // TAHAP 2: Pengujian Tabel & Izin Database (/rest/v1/profiles?select=id&limit=1)
    // =========================================================================
    if (matchesActiveConfig || !hasCustomInput) {
      const client = getSupabaseClient();
      if (!client) {
        return {
          isConfigured: false,
          connected: false,
          state: 'unknown_error',
          gatewayConnected: true,
          apiKeyValid: true,
          apiKeyPresent: true,
          apiKeyFormatValid: true,
          databaseAccessible: false,
          httpStatus: null,
          errorCode: 'CLIENT_INIT_FAILED',
          message: 'Gateway & API Key aktif, namun singleton Supabase client gagal diinisialisasi.',
          testedAt,
          tablesCreated: false,
          url: urlCheck.normalizedUrl,
          source: resolvedSource,
          localConflictWarning: cfg.localConflictWarning,
        };
      }

      const { error: tableError, status } = await client
        .from('profiles')
        .select('id')
        .limit(1);

      if (!tableError) {
        return {
          ...interpretRestError(null, urlCheck.normalizedUrl, resolvedSource, testedAt),
          apiKeyPresent: true,
          apiKeyFormatValid: true,
          localConflictWarning: cfg.localConflictWarning,
        };
      }

      return {
        ...interpretRestError(
          {
            message: tableError.message,
            code: tableError.code,
            status,
            stage: 'database',
            gatewayConnected: true,
            apiKeyValid: true,
          },
          urlCheck.normalizedUrl,
          resolvedSource,
          testedAt
        ),
        apiKeyPresent: true,
        apiKeyFormatValid: true,
        localConflictWarning: cfg.localConflictWarning,
      };
    }

    // Jika Admin menguji kredensial sementara di form Pengaturan sebelum disimpan,
    // gunakan fetch REST read-only dengan header aman tanpa membuat createClient() kedua.
    const dbResponse = await globalThis.fetch(
      `${urlCheck.normalizedUrl}/rest/v1/profiles?select=id&limit=1`,
      {
        method: 'GET',
        headers: buildSupabaseRestHeaders(targetKey),
      }
    );

    if (dbResponse.ok) {
      return {
        ...interpretRestError(null, urlCheck.normalizedUrl, resolvedSource, testedAt),
        apiKeyPresent: true,
        apiKeyFormatValid: true,
        localConflictWarning: cfg.localConflictWarning,
      };
    }

    const dbBody = await parseSafeErrorBody(dbResponse);
    return {
      ...interpretRestError(
        {
          message: dbBody.message || dbResponse.statusText || `HTTP ${dbResponse.status}`,
          code: dbBody.code,
          status: dbResponse.status,
          stage: 'database',
          gatewayConnected: true,
          apiKeyValid: true,
        },
        urlCheck.normalizedUrl,
        resolvedSource,
        testedAt
      ),
      apiKeyPresent: true,
      apiKeyFormatValid: true,
      localConflictWarning: cfg.localConflictWarning,
    };
  } catch (err: any) {
    return {
      ...interpretRestError(
        {
          message: err?.message || 'Failed to fetch',
          code: 'NETWORK_ERROR',
          status: null,
          stage: 'gateway',
        },
        urlCheck.normalizedUrl,
        resolvedSource,
        testedAt
      ),
      apiKeyPresent: true,
      apiKeyFormatValid: true,
      localConflictWarning: cfg.localConflictWarning,
    };
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
