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

  const envAnonRaw = cleanCredentialString(import.meta.env.VITE_SUPABASE_ANON_KEY);
  const envPubRaw = cleanCredentialString(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const envKeyCandidateRaw = envKeyRaw || envAnonRaw || envPubRaw;

  let envError: string | undefined;
  if (envUrlRaw && !envUrlCheck.valid) {
    envError = `VITE_SUPABASE_URL: ${envUrlCheck.error}`;
  } else if (envKeyCandidateRaw && !envKeyCheck.valid) {
    const failedCheck = validateSupabaseKeyDetail(envKeyCandidateRaw);
    envError = `VITE_SUPABASE_ANON_KEY / PUBLISHABLE_KEY: ${failedCheck.error}`;
  }

  return {
    url: effectiveUrl,
    key: effectiveKey,
    isConfigured: Boolean(effectiveUrl && effectiveKey),
    source,
    envError,
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
  databaseAccessible: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  message: string;
  testedAt: string;
  tablesCreated: boolean;
  url?: string;
  source?: SupabaseConfigResult['source'];
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

  const hasCustomInput = Boolean(rawCustomUrl || rawCustomKey);
  const targetUrl = hasCustomInput ? rawCustomUrl : cfg.url;
  const targetKey = hasCustomInput ? rawCustomKey : cfg.key;
  const effectiveSource: SupabaseConfigResult['source'] = hasCustomInput ? 'localStorage' : cfg.source;

  if (!targetUrl || !targetKey) {
    return {
      isConfigured: false,
      connected: false,
      state: 'not_configured',
      gatewayConnected: false,
      apiKeyValid: false,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'NOT_CONFIGURED',
      message:
        cfg.envError ||
        'Belum terkonfigurasi: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY belum tersedia.',
      testedAt,
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
      gatewayConnected: false,
      apiKeyValid: false,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'INVALID_URL',
      message: urlCheck.error || 'Format URL Supabase tidak valid.',
      testedAt,
      tablesCreated: false,
      url: targetUrl,
      source: effectiveSource,
    };
  }

  const keyCheck = validateSupabaseKeyDetail(targetKey);
  if (!keyCheck.valid) {
    return {
      isConfigured: false,
      connected: false,
      state: 'auth_error',
      gatewayConnected: false,
      apiKeyValid: false,
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'INVALID_KEY_FORMAT',
      message: keyCheck.error || 'Format API Key Supabase tidak valid.',
      testedAt,
      tablesCreated: false,
      url: urlCheck.normalizedUrl,
      source: effectiveSource,
    };
  }

  const matchesActiveConfig =
    cfg.isConfigured &&
    urlCheck.normalizedUrl === cfg.url &&
    targetKey === cfg.key;

  const resolvedSource = matchesActiveConfig || !hasCustomInput ? cfg.source : 'localStorage';

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
      return interpretRestError(
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
      );
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
          databaseAccessible: false,
          httpStatus: null,
          errorCode: 'CLIENT_INIT_FAILED',
          message: 'Gateway & API Key aktif, namun singleton Supabase client gagal diinisialisasi.',
          testedAt,
          tablesCreated: false,
          url: urlCheck.normalizedUrl,
          source: resolvedSource,
        };
      }

      const { error: tableError, status } = await client
        .from('profiles')
        .select('id')
        .limit(1);

      if (!tableError) {
        return interpretRestError(null, urlCheck.normalizedUrl, resolvedSource, testedAt);
      }

      return interpretRestError(
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
      );
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
      return interpretRestError(null, urlCheck.normalizedUrl, 'localStorage', testedAt);
    }

    const dbBody = await parseSafeErrorBody(dbResponse);
    return interpretRestError(
      {
        message: dbBody.message || dbResponse.statusText || `HTTP ${dbResponse.status}`,
        code: dbBody.code,
        status: dbResponse.status,
        stage: 'database',
        gatewayConnected: true,
        apiKeyValid: true,
      },
      urlCheck.normalizedUrl,
      'localStorage',
      testedAt
    );
  } catch (err: any) {
    return interpretRestError(
      {
        message: err?.message || 'Failed to fetch',
        code: 'NETWORK_ERROR',
        status: null,
        stage: 'gateway',
      },
      urlCheck.normalizedUrl,
      resolvedSource,
      testedAt
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
