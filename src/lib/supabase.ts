import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ReportItem, UserProfile, UserRole } from '../types/report';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  '';

// Membersihkan string kredensial dari spasi dan tanda kutip yang tidak disengaja
export const cleanCredentialString = (val: string | null | undefined): string => {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
};

// Validasi format URL Supabase agar tidak memicu error "Provided URL is malformed"
export const isValidSupabaseUrl = (urlString: string | null | undefined): boolean => {
  const cleaned = cleanCredentialString(urlString);
  if (!cleaned) return false;
  if (!cleaned.startsWith('https://') && !cleaned.startsWith('http://')) return false;
  
  // Jangan proses template placeholder yang masih mengandung kurung siku atau nama contoh
  if (
    cleaned.includes('<') || 
    cleaned.includes('>') || 
    cleaned.includes('[') || 
    cleaned.includes(']') ||
    cleaned.includes('your-project') ||
    cleaned.includes('example.com')
  ) {
    return false;
  }

  try {
    const urlObj = new URL(cleaned.endsWith('/') ? cleaned : `${cleaned}/`);
    return Boolean(urlObj.hostname && urlObj.hostname.includes('.'));
  } catch {
    return false;
  }
};

// Validasi Anon Key Supabase
export const isValidSupabaseKey = (keyString: string | null | undefined): boolean => {
  const cleaned = cleanCredentialString(keyString);
  if (!cleaned) return false;
  if (
    cleaned.includes('<') || 
    cleaned.includes('>') || 
    cleaned.includes('[') || 
    cleaned.includes(']') ||
    cleaned.includes('your-anon-key') ||
    cleaned.length < 25
  ) {
    return false;
  }
  return true;
};

// Periksa apakah kredensial Supabase sudah disetel via env atau localStorage
export const getSupabaseConfig = () => {
  let localUrl = '';
  let localKey = '';
  try {
    localUrl = cleanCredentialString(localStorage.getItem('sibahar_supabase_url'));
    localKey = cleanCredentialString(localStorage.getItem('sibahar_supabase_key'));
  } catch {
    // Ignore localStorage errors in restricted environments
  }

  // Jika di localStorage terdapat data placeholder atau URL rusak, bersihkan otomatis
  if (localUrl && !isValidSupabaseUrl(localUrl)) {
    try {
      localStorage.removeItem('sibahar_supabase_url');
    } catch {}
    localUrl = '';
  }
  if (localKey && !isValidSupabaseKey(localKey)) {
    try {
      localStorage.removeItem('sibahar_supabase_key');
    } catch {}
    localKey = '';
  }

  const cleanedEnvUrl = cleanCredentialString(envUrl);
  const cleanedEnvKey = cleanCredentialString(envAnonKey);

  const effectiveUrl = isValidSupabaseUrl(cleanedEnvUrl) 
    ? cleanedEnvUrl 
    : (isValidSupabaseUrl(localUrl) ? localUrl : '');

  const effectiveKey = isValidSupabaseKey(cleanedEnvKey) 
    ? cleanedEnvKey 
    : (isValidSupabaseKey(localKey) ? localKey : '');

  const isConfigured = Boolean(effectiveUrl && effectiveKey);

  return { url: effectiveUrl, key: effectiveKey, isConfigured };
};

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  connected: boolean;
  state: 'connected' | 'needs_schema' | 'auth_error' | 'network_error' | 'not_configured';
  message: string;
  tablesCreated: boolean;
  url?: string;
}

// Menguji koneksi secara interaktif dan mendeteksi apakah tabel database sudah dibuat
export const testSupabaseConnection = async (
  customUrl?: string,
  customKey?: string
): Promise<SupabaseConnectionStatus> => {
  const cfg = getSupabaseConfig();
  const url = cleanCredentialString(customUrl) || cfg.url;
  const key = cleanCredentialString(customKey) || cfg.key;

  if (!url || !key) {
    return {
      isConfigured: false,
      connected: false,
      state: 'not_configured',
      message: 'Kredensial Supabase (URL atau Anon Key) belum diisi.',
      tablesCreated: false,
    };
  }

  if (!isValidSupabaseUrl(url)) {
    return {
      isConfigured: false,
      connected: false,
      state: 'network_error',
      message: 'Format URL Supabase tidak valid. Pastikan diawali https:// dan diakhiri .supabase.co',
      tablesCreated: false,
      url,
    };
  }

  if (!isValidSupabaseKey(key)) {
    return {
      isConfigured: false,
      connected: false,
      state: 'auth_error',
      message: 'Format Anon Key Supabase tidak valid atau terlalu pendek.',
      tablesCreated: false,
      url,
    };
  }

  try {
    const testClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Cek validitas API key
    const { error: authError } = await testClient.auth.getSession();
    if (authError && authError.message.toLowerCase().includes('apikey')) {
      return {
        isConfigured: true,
        connected: false,
        state: 'auth_error',
        message: 'Kunci Anon Key tidak valid atau ditolak oleh server Supabase.',
        tablesCreated: false,
        url,
      };
    }

    // 2. Cek apakah tabel profiles dan reports sudah dibuat di database
    const { error: tableError } = await testClient.from('profiles').select('id').limit(1);

    if (tableError) {
      if (
        tableError.code === '42P01' || 
        tableError.message.includes('does not exist') ||
        tableError.message.includes('relation')
      ) {
        return {
          isConfigured: true,
          connected: true,
          state: 'needs_schema',
          message: 'Server Supabase terhubung! Namun tabel "profiles" & "reports" belum dibuat di database. Silakan salin SQL Schema dan jalankan di Supabase SQL Editor.',
          tablesCreated: false,
          url,
        };
      }
    }

    return {
      isConfigured: true,
      connected: true,
      state: 'connected',
      message: 'Supabase terhubung sempurna! Database dan tabel siap digunakan.',
      tablesCreated: true,
      url,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      connected: false,
      state: 'network_error',
      message: `Gagal terhubung ke Supabase: ${err?.message || 'Periksa koneksi internet atau status project Supabase Anda.'}`,
      tablesCreated: false,
      url,
    };
  }
};

let cachedClient: SupabaseClient | null = null;
let lastClientKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured || !url || !key) return null;

  const cacheKey = `${url}::${key}`;
  if (cachedClient && lastClientKey === cacheKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    lastClientKey = cacheKey;
    return cachedClient;
  } catch {
    cachedClient = null;
    lastClientKey = '';
    return null;
  }
};

// Helper: Unggah file ke Supabase Storage (Bucket: report-attachments)
export async function uploadAttachmentToStorage(
  file: File,
  reportId: string
): Promise<{ url: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { url: '', error: 'Supabase belum dikonfigurasi' };
  }

  try {
    const fileExt = file.name.split('.').pop();
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
/**
 * Safe Supabase Client Proxy:
 * Mencegah error "Invalid supabaseUrl: Provided URL is malformed" saat VITE_SUPABASE_URL kosong / belum disetel.
 * Proxy ini secara dinamis menggunakan klien Supabase aktif (dari env vars atau localStorage via getSupabaseClient()).
 * Jika Supabase belum terhubung, proxy mengembalikan penanganan aman (mock/no-op) sehingga seluruh UI aplikasi tetap dapat tampil lancar.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabaseClient();
    if (client) {
      const val = (client as any)[prop];
      if (typeof val === 'function') {
        return val.bind(client);
      }
      return val;
    }

    // Fallback aman ketika Supabase belum terhubung
    if (prop === 'rpc') {
      return async (_fn: string, _args?: any) => {
        return {
          data: null,
          error: {
            message: 'Supabase belum dikonfigurasi. Silakan isi URL dan Key di Pengaturan SIBAHAR.',
            code: 'NOT_CONFIGURED',
          },
        };
      };
    }

    if (prop === 'from') {
      return (_table: string) => {
        const queryBuilder: any = {
          select: () => queryBuilder,
          insert: () => queryBuilder,
          update: () => queryBuilder,
          upsert: () => queryBuilder,
          delete: () => queryBuilder,
          eq: () => queryBuilder,
          match: () => queryBuilder,
          order: () => queryBuilder,
          limit: () => queryBuilder,
          single: () => Promise.resolve({ data: null, error: { message: 'Supabase belum terkonfigurasi' } }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then: (onfulfilled?: (res: any) => any, onrejected?: (err: any) => any) => {
            const res = { data: [], error: null };
            return Promise.resolve(res).then(onfulfilled, onrejected);
          },
        };
        return queryBuilder;
      };
    }

    if (prop === 'auth') {
      return {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: null, error: { message: 'Supabase belum terkonfigurasi' } }),
        signUp: async () => ({ data: null, error: { message: 'Supabase belum terkonfigurasi' } }),
        signOut: async () => ({ error: null }),
      };
    }

    if (prop === 'channel') {
      return () => ({
        on: () => ({
          subscribe: () => ({}),
        }),
      });
    }

    return () => ({ data: null, error: null });
  },
});
