import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  NotificationItem,
  ReportItem,
  USER_ROLES,
  UserProfile,
  UserRole,
} from '../types/report';
import { formatDateTime } from '../utils/formatters';

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

// Membaca dan memvalidasi kandidat API Key dari Environment Variables (prioritas sb_publishable_, lalu anon key JWT)
export const getEnvSupabaseKey = (): string => {
  const candidates = [
    cleanCredentialString(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    cleanCredentialString(import.meta.env.VITE_SUPABASE_ANON_KEY),
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
    const failedCandidate = envPubRaw || envAnonRaw;
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
  | 'auth_required'
  | 'needs_schema'
  | 'permission_error'
  | 'auth_error'
  | 'network_error'
  | 'not_configured'
  | 'unknown_error';

export type AuthSessionDiagnosticStatus =
  | 'authenticated'
  | 'unauthenticated'
  | 'expired'
  | 'invalid';

export type DatabaseAccessDiagnosticStatus =
  | 'accessible'
  | 'requires_auth_session'
  | 'needs_schema'
  | 'permission_error'
  | 'auth_error'
  | 'unavailable';

export interface SupabaseDiagnosticDetails {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  httpStatus?: number | null;
  sbErrorCode?: string | null;
}

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  connected: boolean;
  state: SupabaseConnectionState;
  gatewayConnected: boolean;
  gatewayReachable: boolean;
  apiKeyValid: boolean;
  apiKeyAccepted: boolean;
  apiKeyPresent?: boolean;
  apiKeyFormatValid?: boolean;
  isUserAuthenticated: boolean;
  authSessionStatus: AuthSessionDiagnosticStatus;
  requiresAuthSession: boolean;
  databaseAccessStatus: DatabaseAccessDiagnosticStatus;
  databaseAccessible: boolean;
  httpStatus: number | null;
  errorCode: string | null;
  gatewayHttpStatus: number | null;
  databaseHttpStatus: number | null;
  gatewayErrorCode: string | null;
  databaseErrorCode: string | null;
  failedStage: 'config' | 'gateway' | 'auth' | 'database' | null;
  diagnosticDetails?: SupabaseDiagnosticDetails | null;
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
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  sbErrorCode?: string | null;
  status?: number | null;
  stage?: 'gateway' | 'auth' | 'database';
  gatewayConnected?: boolean;
  gatewayHttpStatus?: number | null;
  gatewayErrorCode?: string | null;
  apiKeyValid?: boolean;
  hasAuthSession?: boolean;
}

function sanitizeDiagnosticText(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  // Jangan pernah menyimpan token/key ke objek diagnostik
  return trimmed
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/gi, '[REDACTED_API_KEY]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
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
      gatewayReachable: true,
      apiKeyValid: true,
      apiKeyAccepted: true,
      isUserAuthenticated: true,
      authSessionStatus: 'authenticated',
      requiresAuthSession: false,
      databaseAccessStatus: 'accessible',
      databaseAccessible: true,
      httpStatus: 200,
      errorCode: null,
      gatewayHttpStatus: 200,
      databaseHttpStatus: 200,
      gatewayErrorCode: null,
      databaseErrorCode: null,
      failedStage: null,
      diagnosticDetails: {
        message: 'Gateway Auth Health, API Key, sesi autentikasi, dan akses SELECT profil sendiri merespons HTTP 200.',
        code: null,
        details: null,
        hint: null,
        httpStatus: 200,
        sbErrorCode: null,
      },
      message: 'Gateway, API Key, sesi autentikasi pengguna, dan akses profil Supabase berhasil.',
      testedAt,
      tablesCreated: true,
      url,
      source,
    };
  }

  const msg = sanitizeDiagnosticText(errorObj.message) || '';
  const details = sanitizeDiagnosticText(errorObj.details);
  const hint = sanitizeDiagnosticText(errorObj.hint);
  const sbErrorCode = sanitizeDiagnosticText(errorObj.sbErrorCode);
  const rawCode = sanitizeDiagnosticText(errorObj.code);
  const lower = `${msg} ${details || ''} ${hint || ''}`.toLowerCase();
  const code = sbErrorCode || rawCode || null;
  const codeUpper = (code || '').toUpperCase();
  const rawCodeUpper = (rawCode || '').toUpperCase();
  const sbUpper = (sbErrorCode || '').toUpperCase();
  const status = typeof errorObj.status === 'number' ? errorObj.status : null;
  const stage = errorObj.stage || 'database';
  const hasAuthSession = Boolean(errorObj.hasAuthSession);

  const gatewayHttpStatus =
    stage === 'gateway' ? status : errorObj.gatewayHttpStatus ?? (errorObj.gatewayConnected ? 200 : null);
  const databaseHttpStatus = stage === 'database' ? status : null;
  const gatewayErrorCode =
    stage === 'gateway' ? code || (status ? `HTTP_${status}` : 'GATEWAY_ERROR') : errorObj.gatewayErrorCode ?? null;

  const diagnosticDetails: SupabaseDiagnosticDetails = {
    message: msg || null,
    code: rawCode,
    details,
    hint,
    httpStatus: status,
    sbErrorCode,
  };

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
    const errCode = code || (status ? `HTTP_${status}` : 'NETWORK_ERROR');
    return {
      isConfigured: true,
      connected: false,
      state: 'network_error',
      gatewayConnected: false,
      gatewayReachable: false,
      apiKeyValid: false,
      apiKeyAccepted: false,
      isUserAuthenticated: hasAuthSession,
      authSessionStatus: hasAuthSession ? 'authenticated' : 'unauthenticated',
      requiresAuthSession: !hasAuthSession,
      databaseAccessStatus: 'unavailable',
      databaseAccessible: false,
      httpStatus: status,
      errorCode: errCode,
      gatewayHttpStatus,
      databaseHttpStatus,
      gatewayErrorCode: stage === 'gateway' ? errCode : gatewayErrorCode,
      databaseErrorCode: stage === 'database' ? errCode : null,
      failedStage: stage,
      diagnosticDetails,
      message: `Periksa jaringan, DNS, atau ketersediaan server Supabase (${url}).`,
      testedAt,
      tablesCreated: false,
      url,
      source,
    };
  }

  const isInvalidApiKey =
    sbUpper === 'UNAUTHORIZED_INVALID_API_KEY' ||
    sbUpper === 'UNAUTHORIZED_MISSING_API_KEY' ||
    rawCodeUpper === 'UNAUTHORIZED_INVALID_API_KEY' ||
    rawCodeUpper === 'UNAUTHORIZED_MISSING_API_KEY' ||
    lower.includes('invalid api key') ||
    lower.includes('no api key found') ||
    lower.includes('missing api key');

  const isInvalidJwt =
    rawCodeUpper === 'PGRST301' ||
    sbUpper === 'PGRST301' ||
    lower.includes('jwserror') ||
    lower.includes('invalid jwt') ||
    lower.includes('jwt expired') ||
    lower.includes('expected 3 parts in jwt');

  const isMissingCredentials =
    sbUpper === 'UNAUTHORIZED_MISSING_API_KEY' ||
    lower.includes('no api key found') ||
    lower.includes('missing credentials') ||
    lower.includes('missing authorization');

  const isPermissionOrRlsError =
    rawCodeUpper === '42501' ||
    sbUpper === '42501' ||
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('insufficient privilege') ||
    lower.includes('grant the required privileges');

  // 0. Jika Stage 1 lulus (Gateway & API Key valid) tetapi pemeriksaan tabel dijalankan tanpa sesi login
  // lalu menghasilkan 401 atau 42501: jangan anggap sebagai kegagalan koneksi Supabase!
  if (
    stage === 'database' &&
    errorObj.apiKeyValid === true &&
    !hasAuthSession &&
    !isInvalidApiKey &&
    (status === 401 || status === 403 || isPermissionOrRlsError || isInvalidJwt)
  ) {
    return {
      isConfigured: true,
      connected: false,
      state: 'auth_required',
      gatewayConnected: true,
      gatewayReachable: true,
      apiKeyValid: true,
      apiKeyAccepted: true,
      isUserAuthenticated: false,
      authSessionStatus: 'unauthenticated',
      requiresAuthSession: true,
      databaseAccessStatus: 'requires_auth_session',
      databaseAccessible: false,
      httpStatus: gatewayHttpStatus ?? 200,
      errorCode: null,
      gatewayHttpStatus: gatewayHttpStatus ?? 200,
      databaseHttpStatus: null,
      gatewayErrorCode: null,
      databaseErrorCode: null,
      failedStage: null,
      diagnosticDetails: {
        message: 'Gateway dan API Key aktif. Pemeriksaan akses tabel profiles membutuhkan sesi autentikasi pengguna.',
        code: null,
        details: null,
        hint: null,
        httpStatus: gatewayHttpStatus ?? 200,
        sbErrorCode: null,
      },
      message:
        'Gateway Supabase dan API Key aktif. Pemeriksaan akses tabel profiles membutuhkan sesi autentikasi pengguna (silakan login terlebih dahulu).',
      testedAt,
      tablesCreated: true,
      url,
      source,
    };
  }

  // 1. Cek skema / tabel belum tersedia (khusus tahap database)
  const isMissingTableError =
    stage === 'database' &&
    (rawCodeUpper === '42P01' ||
      rawCodeUpper === 'PGRST205' ||
      (status === 404 &&
        (lower.includes('could not find the table') ||
          lower.includes('does not exist') ||
          lower.includes('relation') ||
          lower.includes('schema cache') ||
          lower.includes('profiles'))));

  if (isMissingTableError) {
    const errCode = rawCode || sbErrorCode || 'PGRST205';
    return {
      isConfigured: true,
      connected: false,
      state: 'needs_schema',
      gatewayConnected: true,
      gatewayReachable: true,
      apiKeyValid: true,
      apiKeyAccepted: true,
      isUserAuthenticated: hasAuthSession,
      authSessionStatus: hasAuthSession ? 'authenticated' : 'unauthenticated',
      requiresAuthSession: !hasAuthSession,
      databaseAccessStatus: 'needs_schema',
      databaseAccessible: false,
      httpStatus: status ?? 404,
      errorCode: errCode,
      gatewayHttpStatus,
      databaseHttpStatus: status ?? 404,
      gatewayErrorCode: null,
      databaseErrorCode: errCode,
      failedStage: 'database',
      diagnosticDetails,
      message: 'Gateway dan API Key berhasil, tetapi tabel profiles belum ditemukan.',
      testedAt,
      tablesCreated: false,
      url,
      source,
    };
  }

  // 2. Endpoint tidak sesuai (404 tanpa indikasi tabel belum ada)
  if (status === 404) {
    const errCode = code || 'ENDPOINT_NOT_FOUND';
    return {
      isConfigured: true,
      connected: false,
      state: 'unknown_error',
      gatewayConnected: errorObj.gatewayConnected ?? (stage === 'database'),
      gatewayReachable: errorObj.gatewayConnected ?? (stage === 'database'),
      apiKeyValid: errorObj.apiKeyValid ?? false,
      apiKeyAccepted: errorObj.apiKeyValid ?? false,
      isUserAuthenticated: hasAuthSession,
      authSessionStatus: hasAuthSession ? 'authenticated' : 'unauthenticated',
      requiresAuthSession: !hasAuthSession,
      databaseAccessStatus: 'unavailable',
      databaseAccessible: false,
      httpStatus: 404,
      errorCode: errCode,
      gatewayHttpStatus,
      databaseHttpStatus,
      gatewayErrorCode: stage === 'gateway' ? errCode : null,
      databaseErrorCode: stage === 'database' ? errCode : null,
      failedStage: stage,
      diagnosticDetails,
      message:
        stage === 'gateway'
          ? 'Endpoint pemeriksaan Auth Health (/auth/v1/health) tidak ditemukan (HTTP 404).'
          : 'Endpoint REST tabel profiles tidak ditemukan atau belum terekspos (HTTP 404).',
      testedAt,
      tablesCreated: false,
      url,
      source,
    };
  }

  // 3. Cek penolakan izin database / RLS (42501 atau 403 saat sesi sudah terautentikasi)
  if (
    isPermissionOrRlsError ||
    (stage === 'database' && status === 403 && !isInvalidApiKey) ||
    (stage === 'gateway' && status === 403 && !isInvalidApiKey && !lower.includes('unauthorized'))
  ) {
    const errCode = rawCode || sbErrorCode || (status ? `HTTP_${status}` : '42501');
    return {
      isConfigured: true,
      connected: false,
      state: 'permission_error',
      gatewayConnected: errorObj.gatewayConnected ?? true,
      gatewayReachable: errorObj.gatewayConnected ?? true,
      apiKeyValid: errorObj.apiKeyValid ?? true,
      apiKeyAccepted: errorObj.apiKeyValid ?? true,
      isUserAuthenticated: hasAuthSession,
      authSessionStatus: hasAuthSession ? 'authenticated' : 'unauthenticated',
      requiresAuthSession: !hasAuthSession,
      databaseAccessStatus: 'permission_error',
      databaseAccessible: false,
      httpStatus: status ?? 403,
      errorCode: errCode,
      gatewayHttpStatus,
      databaseHttpStatus: stage === 'database' ? status ?? 403 : null,
      gatewayErrorCode: stage === 'gateway' ? errCode : null,
      databaseErrorCode: stage === 'database' ? errCode : null,
      failedStage: stage,
      diagnosticDetails,
      message: hasAuthSession
        ? 'Gateway, API Key, dan sesi login aktif, tetapi akses SELECT ke profil Anda dibatasi oleh izin database atau kebijakan RLS.'
        : 'API Key diterima, tetapi akses tabel profiles dibatasi untuk peran anonim.',
      testedAt,
      tablesCreated: true,
      url,
      source,
    };
  }

  // 4. Penolakan autentikasi / API Key / JWT (401, PGRST301, atau 403 Invalid API Key)
  if (
    isInvalidApiKey ||
    isInvalidJwt ||
    isMissingCredentials ||
    status === 401 ||
    (status === 403 && isInvalidApiKey) ||
    lower.includes('unauthorized')
  ) {
    const errCode = sbErrorCode || rawCode || (status ? `HTTP_${status}` : 'AUTH_ERROR');
    const stage1AlreadyAcceptedKey = stage === 'database' && errorObj.apiKeyValid === true && !isInvalidApiKey;
    const gatewayUp = errorObj.gatewayConnected ?? Boolean(status);
    const isExpired = lower.includes('expired');

    let friendlyMessage = 'Periksa API Key atau token autentikasi. Server Supabase menolak kredensial yang digunakan.';
    if (isInvalidApiKey) {
      friendlyMessage = isMissingCredentials
        ? 'Header apikey tidak ditemukan pada request Supabase.'
        : 'API Key ditolak oleh gateway Supabase (Invalid API Key). Periksa kecocokan VITE_SUPABASE_PUBLISHABLE_KEY.';
    } else if (stage1AlreadyAcceptedKey) {
      friendlyMessage = isExpired
        ? 'Gateway & API Key aktif, tetapi sesi login pengguna sudah kedaluwarsa. Silakan login ulang.'
        : 'Gateway & API Key aktif, tetapi token sesi pengguna ditolak (PGRST301 / HTTP 401). Silakan login ulang ke akun Supabase Anda.';
    } else if (isInvalidJwt) {
      friendlyMessage = 'Token JWT ditolak oleh PostgREST (Invalid JWT / PGRST301). Periksa sesi autentikasi pengguna.';
    }

    return {
      isConfigured: true,
      connected: false,
      state: 'auth_error',
      gatewayConnected: gatewayUp,
      gatewayReachable: gatewayUp,
      apiKeyValid: stage1AlreadyAcceptedKey,
      apiKeyAccepted: stage1AlreadyAcceptedKey,
      isUserAuthenticated: false,
      authSessionStatus: stage1AlreadyAcceptedKey ? (isExpired ? 'expired' : 'invalid') : 'unauthenticated',
      requiresAuthSession: stage1AlreadyAcceptedKey,
      databaseAccessStatus: 'auth_error',
      databaseAccessible: false,
      httpStatus: status ?? 401,
      errorCode: errCode,
      gatewayHttpStatus,
      databaseHttpStatus: stage === 'database' ? status ?? 401 : null,
      gatewayErrorCode: stage === 'gateway' ? errCode : null,
      databaseErrorCode: stage === 'database' ? errCode : null,
      failedStage: stage1AlreadyAcceptedKey ? 'auth' : stage,
      diagnosticDetails,
      message: friendlyMessage,
      testedAt,
      tablesCreated: stage1AlreadyAcceptedKey,
      url,
      source,
    };
  }

  // 5. Kesalahan lain yang tidak termasuk kategori di atas (mis. 500)
  const fallbackErrCode = code || (status ? `HTTP_${status}` : 'UNKNOWN_ERROR');
  return {
    isConfigured: true,
    connected: false,
    state: 'unknown_error',
    gatewayConnected: errorObj.gatewayConnected ?? Boolean(status),
    gatewayReachable: errorObj.gatewayConnected ?? Boolean(status),
    apiKeyValid: errorObj.apiKeyValid ?? false,
    apiKeyAccepted: errorObj.apiKeyValid ?? false,
    isUserAuthenticated: hasAuthSession,
    authSessionStatus: hasAuthSession ? 'authenticated' : 'unauthenticated',
    requiresAuthSession: !hasAuthSession,
    databaseAccessStatus: 'unavailable',
    databaseAccessible: false,
    httpStatus: status,
    errorCode: fallbackErrCode,
    gatewayHttpStatus,
    databaseHttpStatus: stage === 'database' ? status : null,
    gatewayErrorCode: stage === 'gateway' ? fallbackErrCode : null,
    databaseErrorCode: stage === 'database' ? fallbackErrCode : null,
    failedStage: stage,
    diagnosticDetails,
    message: msg || 'Terjadi kesalahan koneksi yang tidak dapat diklasifikasikan. Periksa informasi diagnostik.',
    testedAt,
    tablesCreated: false,
    url,
    source,
  };
}

async function parseSafeErrorBody(response: Response): Promise<{
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  sbErrorCode?: string | null;
}> {
  const sbErrorCode = sanitizeDiagnosticText(
    response.headers.get('sb-error-code') || response.headers.get('x-sb-error-code')
  );

  try {
    const text = await response.text();
    if (!text) return { sbErrorCode };
    try {
      const parsed = JSON.parse(text);
      return {
        message: sanitizeDiagnosticText(
          parsed?.message || parsed?.error_description || parsed?.error || response.statusText
        ),
        code: sanitizeDiagnosticText(parsed?.code ? String(parsed.code) : parsed?.error_code ? String(parsed.error_code) : null),
        details: sanitizeDiagnosticText(parsed?.details),
        hint: sanitizeDiagnosticText(parsed?.hint),
        sbErrorCode,
      };
    } catch {
      return {
        message: sanitizeDiagnosticText(text.slice(0, 220)),
        sbErrorCode,
      };
    }
  } catch {
    return { sbErrorCode };
  }
}

// Menguji koneksi nyata ke Supabase secara bertahap dan terpisah:
// Tahap 1: GET /auth/v1/health (menguji Gateway & Publishable/Anon Key via header apikey, tanpa Bearer)
// Tahap 2: Pemeriksaan Sesi Autentikasi Pengguna via getSession()
// Tahap 3: Jika sesi pengguna aktif, uji GET /rest/v1/profiles?id=eq.<user_id>&select=id,role,is_active&limit=1
//          mengirimkan Authorization: Bearer <user_access_token>. Jika belum login, jangan menganggap
//          tidak adanya akses anonim ke profiles sebagai kegagalan koneksi!
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

  // 1. Jika Env error sudah terdeteksi dan admin menguji konfigurasi Env
  if (isTestingEnvConfig && cfg.hasEnvConfig && cfg.envError) {
    const isUrlIssue = !validateSupabaseUrlDetail(cfg.envUrl).valid;
    const errCode = isUrlIssue ? 'INVALID_URL' : apiKeyPresent ? 'INVALID_KEY_FORMAT' : 'MISSING_API_KEY';
    return {
      isConfigured: Boolean(cfg.url && cfg.key),
      connected: false,
      state: isUrlIssue ? 'network_error' : 'auth_error',
      gatewayConnected: false,
      gatewayReachable: false,
      apiKeyValid: false,
      apiKeyAccepted: false,
      apiKeyPresent,
      apiKeyFormatValid,
      isUserAuthenticated: false,
      authSessionStatus: 'unauthenticated',
      requiresAuthSession: false,
      databaseAccessStatus: 'unavailable',
      databaseAccessible: false,
      httpStatus: null,
      errorCode: errCode,
      gatewayHttpStatus: null,
      databaseHttpStatus: null,
      gatewayErrorCode: null,
      databaseErrorCode: null,
      failedStage: 'config',
      diagnosticDetails: {
        message: cfg.envError,
        code: errCode,
        details: null,
        hint: null,
        httpStatus: null,
        sbErrorCode: null,
      },
      message: cfg.envError,
      testedAt,
      tablesCreated: false,
      url: cfg.envUrl || undefined,
      source: 'env',
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  if (!targetUrl && !targetKey) {
    const msg =
      cfg.envError ||
      'Belum terkonfigurasi: VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY belum tersedia.';
    return {
      isConfigured: false,
      connected: false,
      state: 'not_configured',
      gatewayConnected: false,
      gatewayReachable: false,
      apiKeyValid: false,
      apiKeyAccepted: false,
      apiKeyPresent: false,
      apiKeyFormatValid: false,
      isUserAuthenticated: false,
      authSessionStatus: 'unauthenticated',
      requiresAuthSession: false,
      databaseAccessStatus: 'unavailable',
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'NOT_CONFIGURED',
      gatewayHttpStatus: null,
      databaseHttpStatus: null,
      gatewayErrorCode: null,
      databaseErrorCode: null,
      failedStage: 'config',
      diagnosticDetails: {
        message: msg,
        code: 'NOT_CONFIGURED',
        details: null,
        hint: null,
        httpStatus: null,
        sbErrorCode: null,
      },
      message: msg,
      testedAt,
      tablesCreated: false,
      source: effectiveSource,
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  const urlCheck = validateSupabaseUrlDetail(targetUrl);
  if (!urlCheck.valid) {
    const msg = urlCheck.error || 'Format URL Supabase tidak valid.';
    return {
      isConfigured: Boolean(targetUrl && targetKey),
      connected: false,
      state: 'network_error',
      gatewayConnected: false,
      gatewayReachable: false,
      apiKeyValid: false,
      apiKeyAccepted: false,
      apiKeyPresent,
      apiKeyFormatValid,
      isUserAuthenticated: false,
      authSessionStatus: 'unauthenticated',
      requiresAuthSession: false,
      databaseAccessStatus: 'unavailable',
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'INVALID_URL',
      gatewayHttpStatus: null,
      databaseHttpStatus: null,
      gatewayErrorCode: null,
      databaseErrorCode: null,
      failedStage: 'config',
      diagnosticDetails: {
        message: msg,
        code: 'INVALID_URL',
        details: null,
        hint: null,
        httpStatus: null,
        sbErrorCode: null,
      },
      message: msg,
      testedAt,
      tablesCreated: false,
      url: targetUrl || undefined,
      source: effectiveSource,
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  if (!targetKey) {
    const msg =
      cfg.envError ||
      'API Key Supabase (VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY) belum tersedia.';
    return {
      isConfigured: false,
      connected: false,
      state: 'auth_error',
      gatewayConnected: false,
      gatewayReachable: false,
      apiKeyValid: false,
      apiKeyAccepted: false,
      apiKeyPresent: false,
      apiKeyFormatValid: false,
      isUserAuthenticated: false,
      authSessionStatus: 'unauthenticated',
      requiresAuthSession: false,
      databaseAccessStatus: 'unavailable',
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'MISSING_API_KEY',
      gatewayHttpStatus: null,
      databaseHttpStatus: null,
      gatewayErrorCode: null,
      databaseErrorCode: null,
      failedStage: 'config',
      diagnosticDetails: {
        message: msg,
        code: 'MISSING_API_KEY',
        details: null,
        hint: null,
        httpStatus: null,
        sbErrorCode: null,
      },
      message: msg,
      testedAt,
      tablesCreated: false,
      url: urlCheck.normalizedUrl,
      source: effectiveSource,
      localConflictWarning: cfg.localConflictWarning,
    };
  }

  if (!keyCheck.valid) {
    const msg = keyCheck.error || 'Format API Key Supabase tidak valid.';
    return {
      isConfigured: true,
      connected: false,
      state: 'auth_error',
      gatewayConnected: false,
      gatewayReachable: false,
      apiKeyValid: false,
      apiKeyAccepted: false,
      apiKeyPresent: true,
      apiKeyFormatValid: false,
      isUserAuthenticated: false,
      authSessionStatus: 'unauthenticated',
      requiresAuthSession: false,
      databaseAccessStatus: 'unavailable',
      databaseAccessible: false,
      httpStatus: null,
      errorCode: 'INVALID_KEY_FORMAT',
      gatewayHttpStatus: null,
      databaseHttpStatus: null,
      gatewayErrorCode: null,
      databaseErrorCode: null,
      failedStage: 'config',
      diagnosticDetails: {
        message: msg,
        code: 'INVALID_KEY_FORMAT',
        details: null,
        hint: null,
        httpStatus: null,
        sbErrorCode: null,
      },
      message: msg,
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

  const resolvedSource =
    isTestingEnvConfig && cfg.hasEnvConfig ? 'env' : matchesActiveConfig ? cfg.source : effectiveSource;

  let currentStage: 'gateway' | 'auth' | 'database' = 'gateway';
  let gatewayHttpStatus: number | null = null;
  let gatewayOk = false;
  let hasActiveSession = false;

  try {
    // =========================================================================
    // TAHAP 1: Pengujian Gateway & API Key menggunakan /auth/v1/health
    // Catatan: Endpoint /rest/v1/ (OpenAPI root) tidak kompatibel dengan sb_publishable_.
    // =========================================================================
    const gatewayHeaders = buildSupabaseRestHeaders(targetKey);
    const gatewayResponse = await globalThis.fetch(`${urlCheck.normalizedUrl}/auth/v1/health`, {
      method: 'GET',
      headers: gatewayHeaders,
    });

    gatewayHttpStatus = gatewayResponse.status;

    if (!gatewayResponse.ok) {
      const gatewayBody = await parseSafeErrorBody(gatewayResponse);
      return {
        ...interpretRestError(
          {
            message: gatewayBody.message || gatewayResponse.statusText || `HTTP ${gatewayResponse.status}`,
            code: gatewayBody.code,
            details: gatewayBody.details,
            hint: gatewayBody.hint,
            sbErrorCode: gatewayBody.sbErrorCode,
            status: gatewayResponse.status,
            stage: 'gateway',
            gatewayConnected: gatewayResponse.status < 502,
            gatewayHttpStatus: gatewayResponse.status,
            apiKeyValid: false,
            hasAuthSession: false,
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

    gatewayOk = true;
    currentStage = 'auth';

    // =========================================================================
    // TAHAP 2: Pemeriksaan Sesi Autentikasi Pengguna Supabase
    // Tabel profiles diamankan (anon tidak memiliki GRANT SELECT); query profiles
    // HANYA dijalankan apabila terdapat sesi pengguna aktif dengan Bearer access token.
    // =========================================================================
    let activeSessionToken: string | null = null;
    let activeUserId: string | null = null;

    const client = getSupabaseClient();
    if (client && (!hasCustomInput || urlCheck.normalizedUrl === (cfg.url || EXPECTED_SUPABASE_URL))) {
      try {
        const { data: sessionData } = await client.auth.getSession();
        let currentSession = sessionData?.session || null;

        // Jika token hampir/sudah kedaluwarsa dan ada refresh token, coba perbarui sesi sekali
        if (currentSession?.expires_at && currentSession.expires_at * 1000 <= Date.now() + 10_000) {
          try {
            const { data: refreshedData } = await client.auth.refreshSession();
            if (refreshedData?.session?.access_token) {
              currentSession = refreshedData.session;
            }
          } catch {}
        }

        activeSessionToken = currentSession?.access_token || null;
        activeUserId = currentSession?.user?.id || null;
      } catch {
        activeSessionToken = null;
        activeUserId = null;
      }
    }

    // Jika pengguna belum login ke Supabase Auth, hentikan di sini dengan status informatif (BUKAN error koneksi!)
    if (!activeSessionToken || !activeUserId) {
      return {
        isConfigured: true,
        connected: false,
        state: 'auth_required',
        gatewayConnected: true,
        gatewayReachable: true,
        apiKeyValid: true,
        apiKeyAccepted: true,
        apiKeyPresent: true,
        apiKeyFormatValid: true,
        isUserAuthenticated: false,
        authSessionStatus: 'unauthenticated',
        requiresAuthSession: true,
        databaseAccessStatus: 'requires_auth_session',
        databaseAccessible: false,
        httpStatus: gatewayHttpStatus,
        errorCode: null,
        gatewayHttpStatus,
        databaseHttpStatus: null,
        gatewayErrorCode: null,
        databaseErrorCode: null,
        failedStage: null,
        diagnosticDetails: {
          message:
            'Gateway Auth Health dan API Key aktif. Pemeriksaan akses tabel profiles membutuhkan sesi autentikasi pengguna.',
          code: null,
          details: null,
          hint: null,
          httpStatus: gatewayHttpStatus,
          sbErrorCode: null,
        },
        message:
          'Gateway Supabase dan API Key aktif (HTTP 200). Pemeriksaan akses tabel profiles membutuhkan sesi login pengguna Supabase.',
        testedAt,
        tablesCreated: true,
        url: urlCheck.normalizedUrl,
        source: resolvedSource,
        localConflictWarning: cfg.localConflictWarning,
      };
    }

    hasActiveSession = true;
    currentStage = 'database';

    // =========================================================================
    // TAHAP 3: Pengujian Akses SELECT Profil Sendiri Sesuai RLS
    // Endpoint: /rest/v1/profiles?id=eq.<auth.uid()>&select=id,role,is_active&limit=1
    // Header: apikey: [PUBLISHABLE KEY] + Authorization: Bearer [USER ACCESS TOKEN]
    // =========================================================================
    const queryUrl = `${urlCheck.normalizedUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(
      activeUserId
    )}&select=id,role,is_active&limit=1`;

    let dbResponse = await globalThis.fetch(queryUrl, {
      method: 'GET',
      headers: buildSupabaseRestHeaders(targetKey, activeSessionToken),
    });

    // Jika token baru saja expired di server, coba refresh sekali lalu ulangi
    if (dbResponse.status === 401 && client) {
      try {
        const { data: refreshedData } = await client.auth.refreshSession();
        const refreshedToken = refreshedData?.session?.access_token || null;
        if (refreshedToken && refreshedToken !== activeSessionToken) {
          activeSessionToken = refreshedToken;
          dbResponse = await globalThis.fetch(queryUrl, {
            method: 'GET',
            headers: buildSupabaseRestHeaders(targetKey, activeSessionToken),
          });
        }
      } catch {}
    }

    if (dbResponse.ok) {
      const rows = await dbResponse.json().catch(() => null);
      const hasOwnRow = Array.isArray(rows) ? rows.length > 0 : Boolean(rows);
      const baseSuccess = interpretRestError(null, urlCheck.normalizedUrl, resolvedSource, testedAt);
      return {
        ...baseSuccess,
        gatewayHttpStatus,
        databaseHttpStatus: dbResponse.status,
        apiKeyPresent: true,
        apiKeyFormatValid: true,
        message: hasOwnRow
          ? 'Gateway, API Key, sesi autentikasi pengguna, dan akses SELECT profil sendiri berhasil (HTTP 200).'
          : 'Gateway, API Key, sesi autentikasi, dan izin SELECT tabel profiles berhasil (HTTP 200), namun baris profil untuk akun ini belum ditemukan.',
        localConflictWarning: cfg.localConflictWarning,
      };
    }

    const dbBody = await parseSafeErrorBody(dbResponse);
    return {
      ...interpretRestError(
        {
          message: dbBody.message || dbResponse.statusText || `HTTP ${dbResponse.status}`,
          code: dbBody.code,
          details: dbBody.details,
          hint: dbBody.hint,
          sbErrorCode: dbBody.sbErrorCode,
          status: dbResponse.status,
          stage: 'database',
          gatewayConnected: true,
          gatewayHttpStatus,
          gatewayErrorCode: null,
          apiKeyValid: true,
          hasAuthSession: true,
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
          stage: currentStage,
          gatewayConnected: gatewayOk,
          gatewayHttpStatus,
          apiKeyValid: gatewayOk,
          hasAuthSession: hasActiveSession,
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const normalizeReportUserRole = (role?: string | null): UserRole => {
  const raw = String(role || 'guru').trim().toLowerCase();
  if (raw === 'keamanan') return 'tenaga_keamanan';
  if (
    raw === 'admin' ||
    raw === 'wali_asrama' ||
    raw === 'wali_asuh' ||
    raw === 'guru' ||
    raw === 'tenaga_keamanan' ||
    raw === 'kepala_sekolah'
  ) {
    return raw;
  }
  return 'guru';
};

// Pembentuk ID primer laporan yang unik secara global (UUID v4) agar tidak pernah bentrok antar pengguna
export const generateUniqueReportId = (prefix?: 'draft'): string => {
  let uuid = '';
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      uuid = globalThis.crypto.randomUUID();
    } else if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {}

  if (!uuid) {
    const rand = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    uuid = `${rand()}${rand()}-${rand()}-4${rand().slice(1)}-8${rand().slice(1)}-${rand()}${rand()}${rand()}`;
  }

  return prefix === 'draft' ? `draft-${uuid}` : uuid;
};

export const mapDbNotificationToNotificationItem = (row: any): NotificationItem => {
  const recipientRole = row?.recipient_role
    ? normalizeReportUserRole(row.recipient_role)
    : undefined;
  return {
    id: String(row?.id || ''),
    title: row?.title || 'Pemberitahuan SIBAHAR',
    message: row?.message || '',
    time: row?.created_at ? formatDateTime(String(row.created_at)) : 'Baru saja',
    read: Boolean(row?.is_read ?? row?.read ?? false),
    type: row?.report_id ? 'new_report' : row?.type || 'system',
    reportId: row?.report_id ? String(row.report_id) : undefined,
    recipientId: row?.recipient_id ? String(row.recipient_id) : undefined,
    recipientRole,
  };
};

export const isNotificationVisibleToUser = (
  notif: NotificationItem,
  currentUserId?: string,
  currentRole?: UserRole
): boolean => {
  if (notif.recipientId) {
    return Boolean(currentUserId && notif.recipientId === currentUserId);
  }
  if (notif.recipientRole) {
    return Boolean(
      currentRole &&
        normalizeReportUserRole(notif.recipientRole) === normalizeReportUserRole(currentRole)
    );
  }
  return true;
};

export async function fetchNotificationsFromSupabase(
  client: any,
  currentUserId?: string,
  currentRole?: UserRole
): Promise<{ notifications: NotificationItem[]; error?: string }> {
  if (!client) {
    return { notifications: [], error: 'Klien Supabase tidak tersedia.' };
  }

  try {
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return { notifications: [], error: error.message || 'Gagal memuat notifikasi.' };
    }

    const mapped = (Array.isArray(data) ? data : [])
      .map(mapDbNotificationToNotificationItem)
      .filter((n) => n.id && isNotificationVisibleToUser(n, currentUserId, currentRole));

    return { notifications: mapped };
  } catch (err: any) {
    return {
      notifications: [],
      error: err?.message || 'Gagal memuat notifikasi dari Supabase.',
    };
  }
}

export async function markNotificationsReadInSupabase(
  client: any,
  notificationIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: false, error: 'Klien Supabase tidak tersedia.' };
  }

  const validDbIds = notificationIds.filter((id) => UUID_PATTERN.test(String(id)));
  if (validDbIds.length === 0) {
    return { success: true };
  }

  try {
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .in('id', validDbIds);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal memperbarui status notifikasi.' };
  }
}

export interface SubmitReportResult {
  success: boolean;
  report?: ReportItem;
  error?: string;
}

const formatSupabaseReportError = (
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
  fallbackAction: string
): string => {
  if (!err) return `Gagal ${fallbackAction}.`;
  const code = String(err.code || '').toUpperCase();
  const msg = String(err.message || '');
  const lower = msg.toLowerCase();

  if (
    code === '42501' ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  ) {
    return `Akses ditolak oleh kebijakan keamanan database (RLS/izin peran) saat ${fallbackAction}. Pastikan akun Anda aktif dan login dengan sesi yang valid.`;
  }
  if (code === '23505' || lower.includes('duplicate key')) {
    return `Terjadi bentrokan ID laporan di database (duplicate key). Silakan kirim ulang laporan.`;
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return `Koneksi ke server Supabase terputus saat ${fallbackAction}. Periksa jaringan internet Anda dan coba lagi.`;
  }
  return msg || `Gagal ${fallbackAction} ke database Supabase.`;
};

export async function submitReportToSupabase(
  client: any,
  newReportData: Omit<ReportItem, 'id' | 'createdAt' | 'logs'>,
  currentUser: UserProfile
): Promise<SubmitReportResult> {
  if (!client) {
    return {
      success: false,
      error: 'Koneksi Supabase belum tersedia. Laporan tidak dapat dikirim sebelum terhubung ke database.',
    };
  }

  if (!currentUser?.id || !UUID_PATTERN.test(currentUser.id)) {
    return {
      success: false,
      error: 'Sesi pengguna Supabase tidak valid. Silakan login ulang sebelum mengirim laporan.',
    };
  }

  try {
    if (typeof client.auth?.getSession === 'function') {
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      if (sessionErr || !sessionData?.session?.access_token) {
        return {
          success: false,
          error: 'Sesi autentikasi Supabase telah berakhir. Silakan login ulang.',
        };
      }
    }
  } catch {
    return {
      success: false,
      error: 'Gagal memverifikasi sesi autentikasi Supabase sebelum menyimpan laporan.',
    };
  }

  const now = new Date();
  const reportId = generateUniqueReportId();
  const normalizedRole = normalizeReportUserRole(currentUser.roleKey);
  const timeFormatted =
    now.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) +
    ' ' +
    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const newReport: ReportItem = {
    ...newReportData,
    id: reportId,
    userId: currentUser.id,
    userRole: normalizedRole,
    createdAt: now.toISOString(),
    logs: [
      {
        id: `log-${generateUniqueReportId().slice(0, 8)}`,
        timestamp: timeFormatted,
        actor: currentUser.name,
        action: 'Laporan Dibuat',
        note: `Laporan berhasil diajukan oleh ${currentUser.name} (${USER_ROLES[normalizedRole]?.label || currentUser.role}) ke antrean sistem SIBAHAR.`,
      },
    ],
  };

  try {
    const dbPayload = mapReportItemToDbRow(newReport, currentUser.id, normalizedRole);
    const { data, error } = await client
      .from('reports')
      .insert(dbPayload)
      .select('*')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: formatSupabaseReportError(error, 'menyimpan laporan'),
      };
    }

    return {
      success: true,
      report: mapDbReportToReportItem(data),
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseReportError(err, 'menyimpan laporan'),
    };
  }
}

export interface FetchNotificationReportResult {
  success: boolean;
  report?: ReportItem;
  fromDatabase?: boolean;
  error?: string;
}

export async function resolveReportForNotification(
  client: any,
  localReports: ReportItem[],
  reportId: string
): Promise<FetchNotificationReportResult> {
  const cleanedId = String(reportId || '').trim();
  if (!cleanedId) {
    return {
      success: false,
      error: 'Notifikasi ini tidak memiliki ID laporan yang valid.',
    };
  }

  const localMatch = localReports.find((r) => r.id === cleanedId);
  if (localMatch) {
    return {
      success: true,
      report: localMatch,
      fromDatabase: false,
    };
  }

  if (!client) {
    return {
      success: false,
      error: 'Koneksi Supabase tidak tersedia untuk mengambil detail laporan.',
    };
  }

  try {
    const { data, error } = await client
      .from('reports')
      .select('*')
      .eq('id', cleanedId)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: formatSupabaseReportError(error, `membuka laporan (${cleanedId})`),
      };
    }

    if (!data) {
      return {
        success: false,
        error: `Laporan dengan ID ${cleanedId} tidak ditemukan di database atau Anda tidak memiliki hak akses untuk melihatnya.`,
      };
    }

    return {
      success: true,
      report: mapDbReportToReportItem(data),
      fromDatabase: true,
    };
  } catch (err: any) {
    return {
      success: false,
      error: formatSupabaseReportError(err, `membuka laporan (${cleanedId})`),
    };
  }
}
