import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { UserProfile, UserRole, USER_ROLES } from '../types/report';
import {
  getSupabaseClient,
  getSupabaseConfig,
  testSupabaseConnection,
  SupabaseConnectionStatus,
} from '../lib/supabase';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (val?: string | null): boolean => {
  return Boolean(val && UUID_REGEX.test(val.trim()));
};

export const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const ALLOWED_APP_ROLES = new Set<string>([
  'admin',
  'wali_asrama',
  'wali_asuh',
  'guru',
  'tenaga_keamanan',
  'kepala_sekolah',
  'keamanan',
]);

export const isValidAppRole = (role?: string | null): boolean => {
  if (!role || typeof role !== 'string') return false;
  return ALLOWED_APP_ROLES.has(role.trim().toLowerCase());
};

export const normalizeUserRole = (role?: string | null): UserRole => {
  if (!role) return 'guru';
  const cleaned = String(role).trim().toLowerCase();
  if (cleaned === 'keamanan') return 'tenaga_keamanan';
  if (cleaned in USER_ROLES) return cleaned as UserRole;
  return 'guru';
};

export const EMPTY_UNAUTHENTICATED_USER: UserProfile = {
  id: '',
  name: '',
  nip: '',
  email: '',
  phone: '',
  department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
  role: '',
  roleKey: 'guru',
  avatarInitials: '',
  isActive: false,
};

export const computeAvatarInitials = (name?: string | null, fallback = 'SR'): string => {
  if (!name || typeof name !== 'string') return fallback;
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || fallback;
};

const getDeletedUsersSet = (): Set<string> => {
  try {
    const saved = localStorage.getItem('sibahar_deleted_users');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((s: string) => String(s).trim().toLowerCase()).filter(Boolean));
      }
    }
  } catch {}
  return new Set();
};

const addToDeletedUsersSet = (user: Pick<UserProfile, 'id' | 'email'>) => {
  try {
    const saved = localStorage.getItem('sibahar_deleted_users');
    const existing: string[] = saved ? JSON.parse(saved) : [];
    const next = Array.from(
      new Set([
        ...existing.map((s) => String(s).trim().toLowerCase()),
        ...(user.email ? [user.email.trim().toLowerCase()] : []),
        ...(user.id ? [user.id.trim().toLowerCase()] : []),
      ])
    ).filter(Boolean);
    localStorage.setItem('sibahar_deleted_users', JSON.stringify(next));
  } catch {}
};

const removeFromDeletedUsersSet = (email: string) => {
  try {
    const saved = localStorage.getItem('sibahar_deleted_users');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      const target = email.trim().toLowerCase();
      const filtered = parsed.filter((item: string) => String(item).trim().toLowerCase() !== target);
      localStorage.setItem('sibahar_deleted_users', JSON.stringify(filtered));
    }
  } catch {}
};

// Migrasi aman HANYA untuk record contoh lama yang secara eksplisit dikenali identitas lamanya.
// DILARANG keras menimpa nama, email, NIP, atau data pengguna lain berdasarkan roleKey!
const migrateSingleLegacyUser = (u: UserProfile): UserProfile => {
  const normalizedRole = normalizeUserRole(u.roleKey);
  const updated: UserProfile = {
    ...u,
    email: (u.email || '').trim().toLowerCase(),
    roleKey: normalizedRole,
    role: USER_ROLES[normalizedRole]?.label || u.role || normalizedRole,
    avatarInitials: u.avatarInitials || computeAvatarInitials(u.name),
    isActive: u.isActive !== false,
  };

  const lowerName = (updated.name || '').toLowerCase();
  const cleanNip = (updated.nip || '').replace(/\s+/g, '');

  // Hanya perbaiki data contoh lawas yang benar-benar dikenal namanya/NIP contohnya
  if (lowerName.includes('ahmad fauzi') || cleanNip.includes('19880415')) {
    updated.name = 'Igar Nurdiansah, S.Kom';
    updated.nip = '19940613 202622 1 001';
    updated.avatarInitials = 'IN';
    updated.roleKey = 'admin';
    updated.role = USER_ROLES.admin.label;
  } else if (lowerName.includes('cece enjang') && cleanNip.includes('19740512')) {
    updated.name = 'Cece Enjang Kartiwa, S.Pd.,MM';
    updated.nip = '19780706 200501 1 011';
    updated.avatarInitials = 'CK';
    updated.roleKey = 'kepala_sekolah';
    updated.role = USER_ROLES.kepala_sekolah.label;
  } else if (lowerName.includes('dedi mulyana')) {
    updated.name = 'Romi Apek Nugraha, S.Pd';
    updated.avatarInitials = 'RN';
    updated.roleKey = 'wali_asrama';
    updated.role = USER_ROLES.wali_asrama.label;
  } else if (lowerName.includes('siti rahmawati')) {
    updated.name = 'Iway Sri Wulan';
    updated.avatarInitials = 'IW';
    updated.roleKey = 'wali_asuh';
    updated.role = USER_ROLES.wali_asuh.label;
  } else if (lowerName.includes('bambang sudrajat')) {
    updated.name = 'Rizal Abdul Rosyid';
    updated.avatarInitials = 'RR';
    updated.roleKey = 'guru';
    updated.role = USER_ROLES.guru.label;
  } else if (lowerName.includes('agus supriyanto')) {
    updated.name = 'Riki';
    updated.avatarInitials = 'RK';
    updated.roleKey = 'tenaga_keamanan';
    updated.role = USER_ROLES.tenaga_keamanan.label;
  }

  return updated;
};

// Deduplikasi ketat berbasis identitas unik (id utama, lalu email), TIDAK pernah berdasarkan roleKey!
export const deduplicateUsersByIdentity = (
  users: UserProfile[],
  deletedSet: Set<string>
): UserProfile[] => {
  const byId = new Map<string, UserProfile>();
  const emailToKey = new Map<string, string>();
  const orderedKeys: string[] = [];

  for (const rawUser of users) {
    const u = migrateSingleLegacyUser(rawUser);
    const idLower = (u.id || '').trim().toLowerCase();
    const emailLower = (u.email || '').trim().toLowerCase();

    if (!idLower && !emailLower) continue;
    if ((idLower && deletedSet.has(idLower)) || (emailLower && deletedSet.has(emailLower))) {
      continue;
    }

    const existingKeyById = idLower && byId.has(idLower) ? idLower : undefined;
    const existingKeyByEmail = emailLower ? emailToKey.get(emailLower) : undefined;
    const matchedKey = existingKeyById || existingKeyByEmail;

    if (matchedKey) {
      const existing = byId.get(matchedKey)!;
      // Jika record baru memiliki UUID Supabase asli, utamakan record Supabase agar tidak tertimpa cache lama
      const preferIncoming = isUuid(u.id) && !isUuid(existing.id);
      const merged: UserProfile = preferIncoming
        ? { ...existing, ...u }
        : {
            ...u,
            ...existing,
            // Pastikan nama/data terbaru tetap terjaga bila ID sama
            ...(u.id && existing.id && u.id === existing.id ? u : {}),
          };

      const nextKey = (merged.id || emailLower).toLowerCase();
      if (nextKey !== matchedKey) {
        byId.delete(matchedKey);
        const idx = orderedKeys.indexOf(matchedKey);
        if (idx >= 0) orderedKeys[idx] = nextKey;
      }
      byId.set(nextKey, merged);
      if (emailLower) emailToKey.set(emailLower, nextKey);
    } else {
      const key = idLower || emailLower;
      byId.set(key, u);
      if (emailLower) emailToKey.set(emailLower, key);
      orderedKeys.push(key);
    }
  }

  return orderedKeys.map((k) => byId.get(k)!).filter(Boolean);
};

// Migrasi daftar pengguna dari cache lokal tanpa menambahkan ulang akun canonical berdasarkan roleKey
export const migrateUsersList = (users: UserProfile[], deletedSet = getDeletedUsersSet()): UserProfile[] => {
  return deduplicateUsersByIdentity(users, deletedSet);
};

export const mapDbProfileToUserProfile = (rp: any): UserProfile => {
  const normalizedRole = normalizeUserRole(rp.role);
  const fullName = rp.full_name || rp.name || rp.email || 'Pengguna SIBAHAR';
  return {
    id: rp.id,
    name: fullName,
    email: String(rp.email || '').trim().toLowerCase(),
    nip: rp.nip || '',
    phone: rp.phone || '',
    department: rp.department || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
    role: USER_ROLES[normalizedRole]?.label || rp.role || normalizedRole,
    roleKey: normalizedRole,
    avatarInitials: rp.avatar_initials || computeAvatarInitials(fullName),
    avatarUrl: rp.avatar_url || undefined,
    isActive: rp.is_active !== false,
  };
};

// Menggabungkan data authoritative dari Supabase `profiles`:
// - Data Supabase selalu menjadi sumber utama dan tidak pernah mengembalikan akun statis bawaan.
// - Dua atau lebih pengguna dengan role sama tetap menjadi entitas terpisah berdasarkan ID/email.
export const mergeRemoteProfilesWithLocal = (
  remoteRows: any[],
  _localUsers: UserProfile[],
  deletedSet = getDeletedUsersSet()
): UserProfile[] => {
  const remoteProfiles = (remoteRows || [])
    .filter((rp) => rp && rp.id && rp.is_active === true && isValidAppRole(rp.role))
    .map(mapDbProfileToUserProfile)
    .filter((u) => {
      const idLower = (u.id || '').toLowerCase();
      const emailLower = u.email.toLowerCase();
      return !deletedSet.has(idLower) && !deletedSet.has(emailLower);
    });

  return deduplicateUsersByIdentity(remoteProfiles, deletedSet);
};

export interface ProfileSessionVerificationResult {
  ok: boolean;
  user?: UserProfile;
  reason?: 'no_session' | 'missing_profile' | 'id_mismatch' | 'inactive' | 'invalid_role' | 'db_error';
  error?: string;
}

export const verifySupabaseProfileSession = async (
  client: any,
  session: any
): Promise<ProfileSessionVerificationResult> => {
  const authUserId = session?.user?.id ? String(session.user.id).trim() : '';
  const accessToken = session?.access_token ? String(session.access_token).trim() : '';

  if (!client || !authUserId || !accessToken) {
    return {
      ok: false,
      reason: 'no_session',
      error: 'Sesi autentikasi Supabase tidak valid.',
    };
  }

  try {
    const { data: profile, error: profileErr } = await client
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    if (profileErr) {
      return {
        ok: false,
        reason: 'db_error',
        error: `Gagal memverifikasi profil pengguna di Supabase: ${profileErr.message}`,
      };
    }

    if (!profile) {
      await client.auth.signOut().catch(() => {});
      return {
        ok: false,
        reason: 'missing_profile',
        error: 'Profil pengguna belum terdaftar pada database SIBAHAR. Hubungi Administrator.',
      };
    }

    if (String(profile.id || '').trim().toLowerCase() !== authUserId.toLowerCase()) {
      await client.auth.signOut().catch(() => {});
      return {
        ok: false,
        reason: 'id_mismatch',
        error: 'Identitas profil tidak cocok dengan sesi autentikasi Supabase.',
      };
    }

    if (profile.is_active !== true) {
      await client.auth.signOut().catch(() => {});
      return {
        ok: false,
        reason: 'inactive',
        error: 'Akun Anda berstatus nonaktif. Hubungi Administrator SIBAHAR.',
      };
    }

    if (!isValidAppRole(profile.role)) {
      await client.auth.signOut().catch(() => {});
      return {
        ok: false,
        reason: 'invalid_role',
        error: 'Role akun tidak valid pada sistem SIBAHAR. Hubungi Administrator.',
      };
    }

    return {
      ok: true,
      user: mapDbProfileToUserProfile(profile),
    };
  } catch (err: any) {
    return {
      ok: false,
      reason: 'db_error',
      error: err?.message || 'Gagal memverifikasi profil pengguna ke Supabase.',
    };
  }
};

export interface AuthExecutionResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

export const restoreSupabaseSession = async (client: any): Promise<AuthExecutionResult> => {
  if (!client) {
    return { success: false };
  }
  try {
    const { data: sessionData, error: sessionErr } = await client.auth.getSession();
    if (sessionErr || !sessionData?.session?.access_token || !sessionData?.session?.user?.id) {
      return { success: false };
    }
    const verification = await verifySupabaseProfileSession(client, sessionData.session);
    if (verification.ok && verification.user) {
      return { success: true, user: verification.user };
    }
    return { success: false, error: verification.error };
  } catch {
    return { success: false };
  }
};

export const authenticateWithSupabaseEmail = async (
  client: any,
  email: string,
  pass: string
): Promise<AuthExecutionResult> => {
  const cleanedEmail = email.trim().toLowerCase();
  if (!cleanedEmail || !pass) {
    return { success: false, error: 'Email dan kata sandi wajib diisi.' };
  }
  if (!client) {
    return {
      success: false,
      error: 'Konfigurasi Supabase belum tersedia. Aplikasi tidak dapat melakukan autentikasi.',
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanedEmail,
      password: pass,
    });

    if (error) {
      const rawMsg = String(error.message || '');
      const lower = rawMsg.toLowerCase();
      const friendlyMsg =
        lower.includes('invalid login credentials')
          ? 'Email atau kata sandi tidak valid.'
          : lower.includes('email not confirmed')
          ? 'Email akun belum dikonfirmasi. Hubungi Administrator SIBAHAR.'
          : lower.includes('failed to fetch') || lower.includes('network')
          ? 'Gagal terhubung ke server autentikasi Supabase. Periksa koneksi internet Anda.'
          : rawMsg || 'Autentikasi Supabase ditolak.';
      return { success: false, error: friendlyMsg };
    }

    if (!data?.session || !data?.user?.id) {
      await client.auth.signOut().catch(() => {});
      return { success: false, error: 'Sesi autentikasi Supabase tidak valid.' };
    }

    const verification = await verifySupabaseProfileSession(client, data.session);
    if (!verification.ok || !verification.user) {
      return {
        success: false,
        error: verification.error || 'Profil pengguna tidak valid atau berstatus nonaktif.',
      };
    }

    return { success: true, user: verification.user };
  } catch (err: any) {
    const errMsg = String(err?.message || err || '');
    const isFetch = errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network');
    return {
      success: false,
      error: isFetch
        ? 'Gagal menghubungi server autentikasi Supabase. Periksa koneksi internet Anda.'
        : errMsg || 'Terjadi kesalahan saat melakukan login ke Supabase.',
    };
  }
};

export interface UserMutationResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  partialAuthSuccess?: boolean;
  pendingAuthUserId?: string;
  schemaMismatch?: boolean;
}

export interface AdminCreateUserRequestPayload {
  email: string;
  password?: string;
  fullName: string;
  role: UserRole;
  nip: string;
  department: string;
  phone: string;
  continueProfileOnly?: boolean;
  existingAuthUserId?: string;
}

export const executeAdminCreateUserApi = async (
  fetchFn: typeof globalThis.fetch,
  activeToken: string,
  payload: AdminCreateUserRequestPayload
): Promise<UserMutationResult> => {
  if (!activeToken) {
    return {
      success: false,
      error: 'Sesi login Supabase tidak ditemukan atau sudah berakhir. Silakan login ulang sebagai Administrator.',
      ...(payload.continueProfileOnly && payload.existingAuthUserId
        ? { partialAuthSuccess: true, pendingAuthUserId: payload.existingAuthUserId }
        : {}),
    };
  }

  try {
    const apiRes = await fetchFn('/api/admin-create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify(payload),
    });

    const apiBody = await apiRes.json().catch(() => ({}));

    if (apiRes.ok && apiBody?.user?.id) {
      return {
        success: true,
        user: mapDbProfileToUserProfile({
          id: apiBody.user.id,
          full_name: apiBody.user.full_name || payload.fullName,
          email: apiBody.user.email || payload.email,
          role: apiBody.user.role || payload.role,
          nip: apiBody.user.nip ?? payload.nip,
          phone: apiBody.user.phone ?? payload.phone,
          department: apiBody.user.department ?? payload.department,
          avatar_initials: apiBody.user.avatar_initials || computeAvatarInitials(payload.fullName),
          is_active: apiBody.user.is_active !== false,
        }),
      };
    }

    const apiErrorMsg = apiBody?.error || `Permintaan backend gagal (HTTP ${apiRes.status}).`;

    // Pertahankan UUID Auth yang sudah terbentuk apabila penyimpanan profil gagal atau Auth sudah ada sebelumnya
    if (apiBody?.partialAuthSuccess && apiBody?.pendingAuthUserId) {
      return {
        success: false,
        error: apiErrorMsg,
        partialAuthSuccess: true,
        pendingAuthUserId: apiBody.pendingAuthUserId,
        schemaMismatch: Boolean(apiBody.schemaMismatch),
      };
    }

    if (payload.continueProfileOnly && payload.existingAuthUserId && apiRes.status >= 500) {
      return {
        success: false,
        error: apiErrorMsg,
        partialAuthSuccess: true,
        pendingAuthUserId: payload.existingAuthUserId,
      };
    }

    return { success: false, error: apiErrorMsg };
  } catch (netErr: any) {
    return {
      success: false,
      error:
        netErr?.message ||
        'Gagal menghubungi backend /api/admin-create-user. Pastikan aplikasi berjalan melalui server Vercel atau backend API aktif.',
      ...(payload.continueProfileOnly && payload.existingAuthUserId
        ? { partialAuthSuccess: true, pendingAuthUserId: payload.existingAuthUserId }
        : {}),
    };
  }
};

interface AuthContextType {
  currentUser: UserProfile;
  currentRole: UserRole;
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  isLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  isSupabaseConnected: boolean;
  supabaseStatus: SupabaseConnectionStatus;
  checkSupabaseConnection: (customUrl?: string, customKey?: string) => Promise<SupabaseConnectionStatus>;
  refreshUsersFromSupabase: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateCurrentUserProfile: (profile: Partial<UserProfile>) => void;
  allUsersList: UserProfile[];
  updateUserRoleByAdmin: (userId: string, newRole: UserRole) => Promise<UserMutationResult>;
  addNewUserByAdmin: (user: {
    name: string;
    email: string;
    roleKey: UserRole;
    nip?: string;
    department?: string;
    phone?: string;
    defaultPassword?: string;
    existingAuthUserId?: string;
    existingAuthToken?: string;
    continueProfileOnly?: boolean;
  }) => Promise<UserMutationResult>;
  updateUserByAdmin: (userId: string, updates: Partial<UserProfile>) => Promise<UserMutationResult>;
  deleteUserByAdmin: (userId: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(EMPTY_UNAUTHENTICATED_USER);
  const [allUsersList, setAllUsersList] = useState<UserProfile[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConnectionStatus>({
    isConfigured: false,
    connected: false,
    state: 'not_configured',
    gatewayConnected: false,
    gatewayReachable: false,
    apiKeyValid: false,
    apiKeyAccepted: false,
    isUserAuthenticated: false,
    authSessionStatus: 'unauthenticated',
    requiresAuthSession: false,
    databaseAccessStatus: 'unavailable',
    databaseAccessible: false,
    httpStatus: null,
    errorCode: null,
    gatewayHttpStatus: null,
    databaseHttpStatus: null,
    gatewayErrorCode: null,
    databaseErrorCode: null,
    failedStage: null,
    diagnosticDetails: null,
    message: 'Memeriksa konfigurasi dan koneksi Supabase...',
    testedAt: '',
    tablesCreated: false,
  });

  const isSupabaseConnected = supabaseStatus.connected;
  const inFlightCheckRef = useRef<Promise<SupabaseConnectionStatus> | null>(null);
  const allUsersListRef = useRef<UserProfile[]>(allUsersList);
  const currentUserRef = useRef<UserProfile>(currentUser);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  useEffect(() => {
    allUsersListRef.current = allUsersList;
  }, [allUsersList]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const checkSupabaseConnection = useCallback(async (customUrl?: string, customKey?: string) => {
    const isDefaultCheck = customUrl === undefined && customKey === undefined;
    if (isDefaultCheck && inFlightCheckRef.current) {
      return inFlightCheckRef.current;
    }

    const promise = testSupabaseConnection(customUrl, customKey)
      .then((status) => {
        setSupabaseStatus(status);
        return status;
      })
      .finally(() => {
        if (isDefaultCheck) {
          inFlightCheckRef.current = null;
        }
      });

    if (isDefaultCheck) {
      inFlightCheckRef.current = promise;
    }

    return promise;
  }, []);

  // Muat seluruh data profil dari Supabase `profiles` (hanya bila sesi pengguna Supabase aktif, sesuai RLS & GRANT authenticated)
  const refreshUsersFromSupabase = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session?.access_token) {
        return;
      }

      const { data: remoteProfiles, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase fetch profiles warning:', error.message);
        return;
      }

      if (Array.isArray(remoteProfiles)) {
        const deletedSet = getDeletedUsersSet();
        setAllUsersList((prev) => mergeRemoteProfilesWithLocal(remoteProfiles, prev, deletedSet));

        // Sinkronkan currentUser jika profil terbarunya ada di Supabase
        const active = currentUserRef.current;
        const matchedRemote = remoteProfiles.find(
          (rp: any) =>
            (active.id && rp.id === active.id) ||
            (active.email && rp.email && String(rp.email).toLowerCase() === active.email.toLowerCase())
        );
        if (matchedRemote) {
          const mappedActive = mapDbProfileToUserProfile(matchedRemote);
          setCurrentUser(mappedActive);
        }
      }
    } catch (err: any) {
      console.warn('Supabase fetch profiles warning:', err?.message || err);
    }
  }, []);

  // Verifikasi sesi Supabase Auth saat aplikasi dimuat & dengarkan perubahan sesi
  useEffect(() => {
    let isMounted = true;

    try {
      localStorage.removeItem('sibahar_active_user');
      localStorage.removeItem('sibahar_all_users');
    } catch {}

    const client = getSupabaseClient();

    const clearToLoggedOut = (errMessage: string | null = null) => {
      if (!isMounted) return;
      setCurrentUser(EMPTY_UNAUTHENTICATED_USER);
      setAllUsersList([]);
      setIsLoggedIn(false);
      setAuthError(errMessage);
      try {
        localStorage.removeItem('sibahar_active_user');
        localStorage.removeItem('sibahar_all_users');
      } catch {}
    };

    const initializeAuthSession = async () => {
      void checkSupabaseConnection();

      if (!client) {
        clearToLoggedOut(null);
        if (isMounted) setIsAuthLoading(false);
        return;
      }

      try {
        const result = await restoreSupabaseSession(client);
        if (!isMounted) return;

        if (result.success && result.user) {
          setCurrentUser(result.user);
          setIsLoggedIn(true);
          setAuthError(null);
          void refreshUsersFromSupabase();
        } else {
          clearToLoggedOut(result.error || null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void initializeAuthSession();

    if (!client) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session?.user?.id || !session?.access_token) {
        clearToLoggedOut(null);
        void checkSupabaseConnection();
        return;
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'INITIAL_SESSION'
      ) {
        const verification = await verifySupabaseProfileSession(client, session);
        if (!isMounted) return;

        if (verification.ok && verification.user) {
          setCurrentUser(verification.user);
          setIsLoggedIn(true);
          setAuthError(null);
          void checkSupabaseConnection();
          void refreshUsersFromSupabase();
        } else {
          clearToLoggedOut(verification.error || null);
          void checkSupabaseConnection();
        }
      }
    });

    const profilesChannel = client
      .channel('sibahar_profiles_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          void refreshUsersFromSupabase();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      client.removeChannel(profilesChannel);
    };
  }, [checkSupabaseConnection, refreshUsersFromSupabase]);

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const client = getSupabaseClient();
      const result = await authenticateWithSupabaseEmail(client, email, pass);

      if (!result.success || !result.user) {
        const msg = result.error || 'Email atau kata sandi tidak valid.';
        setIsLoggedIn(false);
        setCurrentUser(EMPTY_UNAUTHENTICATED_USER);
        setAllUsersList([]);
        setAuthError(msg);
        return { success: false, error: msg };
      }

      setCurrentUser(result.user);
      setIsLoggedIn(true);
      setAuthError(null);
      void checkSupabaseConnection();
      void refreshUsersFromSupabase();
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const client = getSupabaseClient();
    setIsLoggedIn(false);
    setCurrentUser(EMPTY_UNAUTHENTICATED_USER);
    setAllUsersList([]);
    setAuthError(null);
    try {
      localStorage.removeItem('sibahar_active_user');
      localStorage.removeItem('sibahar_all_users');
    } catch {}
    if (client) {
      await client.auth.signOut().catch(() => {});
    }
    void checkSupabaseConnection();
  };

  const updateCurrentUserProfile = (updates: Partial<UserProfile>) => {
    const prevUser = currentUserRef.current;
    const normalizedRole = normalizeUserRole(updates.roleKey || prevUser.roleKey);
    const updatedName = updates.name !== undefined ? updates.name.trim() : prevUser.name;
    const updatedInitials =
      updates.avatarInitials ||
      (updates.name !== undefined ? computeAvatarInitials(updatedName, prevUser.avatarInitials) : prevUser.avatarInitials);

    const updated: UserProfile = {
      ...prevUser,
      ...updates,
      name: updatedName,
      roleKey: normalizedRole,
      role: updates.role || USER_ROLES[normalizedRole]?.label || prevUser.role,
      avatarInitials: updatedInitials,
    };

    setCurrentUser(updated);
    setAllUsersList((users) =>
      users.map((u) => {
        const matchById = Boolean(prevUser.id && u.id && u.id === prevUser.id);
        const matchByEmail = Boolean(prevUser.email && u.email.toLowerCase() === prevUser.email.toLowerCase());
        return matchById || matchByEmail ? { ...u, ...updated } : u;
      })
    );

    const client = getSupabaseClient();
    if (client) {
      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      if (updated.name) payload.full_name = updated.name;
      if (updated.nip !== undefined) payload.nip = updated.nip;
      if (updated.phone !== undefined) payload.phone = updated.phone;
      if (updated.department !== undefined) payload.department = updated.department;
      if (updated.avatarUrl !== undefined) payload.avatar_url = updated.avatarUrl;
      if (updated.avatarInitials) payload.avatar_initials = updated.avatarInitials;

      const query = isUuid(updated.id)
        ? client.from('profiles').update(payload).eq('id', updated.id!)
        : client.from('profiles').update(payload).eq('email', updated.email.toLowerCase());

      query.then(
        ({ error }) => {
          if (error) console.warn('Supabase sync updateCurrentUserProfile warning:', error.message);
        },
        (err: any) => console.warn('Supabase updateCurrentUserProfile network warning:', err?.message || err)
      );
    }
  };

  // 1. Tambah Akun Pengguna Baru oleh Admin (wajib melalui backend Vercel /api/admin-create-user dengan Service Role Key)
  const addNewUserByAdmin = async (userData: {
    name: string;
    email: string;
    roleKey: UserRole;
    nip?: string;
    department?: string;
    phone?: string;
    defaultPassword?: string;
    existingAuthUserId?: string;
    continueProfileOnly?: boolean;
  }): Promise<UserMutationResult> => {
    const cleanedName = userData.name.trim();
    const cleanedEmail = userData.email.trim().toLowerCase();
    const normalizedRole = normalizeUserRole(userData.roleKey);
    const cleanedNip = userData.nip?.trim() || '-';
    const cleanedPhone = userData.phone?.trim() || '';
    const cleanedDept = userData.department?.trim() || 'Sekolah Rakyat Terintegerasi 1 Sumedang';
    const password = (userData.defaultPassword || 'Sibahar2026!').trim();
    const isContinuingProfile = Boolean(
      userData.continueProfileOnly && isUuid(userData.existingAuthUserId)
    );

    if (!cleanedName || !cleanedEmail) {
      return { success: false, error: 'Nama lengkap dan alamat email wajib diisi.' };
    }

    if (!isContinuingProfile && password.length < 6) {
      return { success: false, error: 'Kata sandi awal minimal 6 karakter.' };
    }

    // Pastikan email belum dipakai pengguna lain di tabel profiles agar tidak saling menimpa
    if (!isContinuingProfile) {
      const duplicateUser = allUsersListRef.current.find(
        (u) => u.email.trim().toLowerCase() === cleanedEmail
      );
      if (duplicateUser) {
        return {
          success: false,
          error: `Email ${cleanedEmail} sudah digunakan oleh ${duplicateUser.name}. Gunakan email unik untuk pengguna baru.`,
        };
      }
    }

    const client = getSupabaseClient();
    const cfg = getSupabaseConfig();

    if (!client || !cfg.isConfigured) {
      return {
        success: false,
        error: 'Konfigurasi Supabase belum aktif. Pembuatan pengguna wajib terhubung ke Supabase.',
      };
    }

    if (!isContinuingProfile) {
      try {
        const { data: existingRemoteProfile } = await client
          .from('profiles')
          .select('id, email')
          .eq('email', cleanedEmail)
          .maybeSingle();

        if (existingRemoteProfile?.id) {
          return {
            success: false,
            error: `Email ${cleanedEmail} sudah terdaftar pada tabel profiles di Supabase. Gunakan email unik.`,
          };
        }
      } catch {}
    }

    let activeToken = '';
    try {
      const { data: sessionData } = await client.auth.getSession();
      activeToken = sessionData?.session?.access_token || '';
    } catch {}

    const apiPayload: AdminCreateUserRequestPayload = {
      email: cleanedEmail,
      fullName: cleanedName,
      role: normalizedRole,
      nip: cleanedNip,
      department: cleanedDept,
      phone: cleanedPhone,
      ...(isContinuingProfile
        ? {
            continueProfileOnly: true,
            existingAuthUserId: userData.existingAuthUserId,
          }
        : {
            password,
          }),
    };

    const result = await executeAdminCreateUserApi(
      globalThis.fetch.bind(globalThis),
      activeToken,
      apiPayload
    );

    if (!result.success || !result.user) {
      return result;
    }

    removeFromDeletedUsersSet(cleanedEmail);
    setAllUsersList((prev) =>
      deduplicateUsersByIdentity([...prev, result.user!], getDeletedUsersSet())
    );
    void refreshUsersFromSupabase();
    return { success: true, user: result.user };
  };

  // 2. Ubah Data Pengguna oleh Admin (identifikasi ketat per ID/email, menunggu konfirmasi Supabase)
  const updateUserByAdmin = async (
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<UserMutationResult> => {
    const targetUser = allUsersListRef.current.find(
      (u) =>
        (u.id && u.id === userId) ||
        (u.email && u.email.toLowerCase() === userId.trim().toLowerCase())
    );

    if (!targetUser) {
      return { success: false, error: 'Data pengguna tidak ditemukan.' };
    }

    const nextRoleKey = updates.roleKey ? normalizeUserRole(updates.roleKey) : normalizeUserRole(targetUser.roleKey);
    const nextRoleLabel = USER_ROLES[nextRoleKey]?.label || updates.role || targetUser.role;
    const nextName = updates.name !== undefined ? updates.name.trim() : targetUser.name;
    const nextInitials =
      updates.avatarInitials ||
      (updates.name !== undefined
        ? computeAvatarInitials(nextName, targetUser.avatarInitials)
        : targetUser.avatarInitials);
    const nextNip = updates.nip !== undefined ? updates.nip.trim() : targetUser.nip;
    const nextPhone = updates.phone !== undefined ? updates.phone.trim() : targetUser.phone;
    const nextDept = updates.department !== undefined ? updates.department.trim() : targetUser.department;
    const nextActive = updates.isActive !== undefined ? updates.isActive : targetUser.isActive !== false;

    let updatedUser: UserProfile = {
      ...targetUser,
      ...updates,
      name: nextName,
      nip: nextNip,
      phone: nextPhone,
      department: nextDept,
      roleKey: nextRoleKey,
      role: nextRoleLabel,
      avatarInitials: nextInitials,
      isActive: nextActive,
    };

    const client = getSupabaseClient();
    if (client) {
      try {
        let targetUuid = isUuid(targetUser.id) ? targetUser.id! : '';
        if (!targetUuid && targetUser.email) {
          const { data: existingRow, error: lookupErr } = await client
            .from('profiles')
            .select('id')
            .eq('email', targetUser.email.toLowerCase())
            .maybeSingle();

          if (lookupErr) {
            return { success: false, error: `Gagal memeriksa profil di Supabase: ${lookupErr.message}` };
          }
          if (existingRow?.id) {
            targetUuid = existingRow.id;
          }
        }

        if (targetUuid) {
          const payload: Record<string, any> = {
            full_name: nextName,
            role: nextRoleKey,
            nip: nextNip || '-',
            phone: nextPhone || '',
            department: nextDept || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
            avatar_initials: nextInitials,
            is_active: nextActive,
            updated_at: new Date().toISOString(),
          };
          if (updates.avatarUrl !== undefined) {
            payload.avatar_url = updates.avatarUrl;
          }

          const { data: updatedRow, error: updateErr } = await client
            .from('profiles')
            .update(payload)
            .eq('id', targetUuid)
            .select('*')
            .maybeSingle();

          if (updateErr) {
            return { success: false, error: `Gagal memperbarui profil di Supabase: ${updateErr.message}` };
          }

          if (!updatedRow) {
            return {
              success: false,
              error:
                'Pembaruan profil di Supabase tidak tersimpan (ditolak kebijakan RLS atau data tidak ditemukan). Pastikan Anda login sebagai Administrator Supabase.',
            };
          }

          updatedUser = mapDbProfileToUserProfile(updatedRow);

          // Sinkronkan pembaruan nama/NIP/unit ke laporan milik pengguna ini saja (berdasarkan user_id)
          if (updates.name !== undefined || updates.nip !== undefined || updates.department !== undefined) {
            const repPayload: Record<string, any> = { updated_at: new Date().toISOString() };
            if (updates.name !== undefined) {
              repPayload.reporter_name = nextName;
              repPayload.pic_name = nextName;
            }
            if (updates.nip !== undefined) {
              repPayload.reporter_nip = nextNip || '-';
              repPayload.pic_nip = nextNip || '-';
            }
            if (updates.department !== undefined) {
              repPayload.reporter_dept = nextDept;
            }
            await client.from('reports').update(repPayload).eq('user_id', targetUuid);
          }
        } else if (!String(targetUser.id || '').startsWith('usr-')) {
          return {
            success: false,
            error:
              'Pengguna belum memiliki record di tabel profiles Supabase (UUID tidak ditemukan).',
          };
        }
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Terjadi kesalahan jaringan saat memperbarui pengguna ke Supabase.',
        };
      }
    }

    // Perbarui state lokal HANYA untuk pengguna yang dipilih (cocokkan ID unik atau email persis)
    setAllUsersList((prev) =>
      prev.map((u) => {
        const sameId = Boolean(targetUser.id && u.id && u.id === targetUser.id);
        const sameEmail = Boolean(targetUser.email && u.email.toLowerCase() === targetUser.email.toLowerCase());
        return sameId || sameEmail ? updatedUser : u;
      })
    );

    const active = currentUserRef.current;
    if (
      (active.id && targetUser.id && active.id === targetUser.id) ||
      active.email.toLowerCase() === targetUser.email.toLowerCase()
    ) {
      setCurrentUser(updatedUser);
    }

    return { success: true, user: updatedUser };
  };

  const updateUserRoleByAdmin = async (
    userId: string,
    newRole: UserRole
  ): Promise<UserMutationResult> => {
    const normalizedRole = normalizeUserRole(newRole);
    return updateUserByAdmin(userId, {
      roleKey: normalizedRole,
      role: USER_ROLES[normalizedRole]?.label || normalizedRole,
    });
  };

  // 3. Hapus Pengguna oleh Admin (menunggu konfirmasi Supabase sebelum menghapus dari UI/state)
  const deleteUserByAdmin = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    const targetUser = allUsersListRef.current.find(
      (u) =>
        (u.id && u.id === userId) ||
        (u.email && u.email.toLowerCase() === userId.trim().toLowerCase())
    );
    if (!targetUser) {
      return { success: false, error: 'Pengguna tidak ditemukan.' };
    }

    const active = currentUserRef.current;
    if (
      (active.id && targetUser.id && active.id === targetUser.id) ||
      active.email.toLowerCase() === targetUser.email.toLowerCase()
    ) {
      return { success: false, error: 'Tidak dapat menghapus akun yang sedang Anda gunakan saat ini.' };
    }

    const adminCount = allUsersListRef.current.filter((u) => normalizeUserRole(u.roleKey) === 'admin').length;
    if (normalizeUserRole(targetUser.roleKey) === 'admin' && adminCount <= 1) {
      return { success: false, error: 'Sistem harus memiliki minimal satu akun Administrator.' };
    }

    const client = getSupabaseClient();
    if (client) {
      let resolvedUuid = isUuid(targetUser.id) ? targetUser.id! : '';

      try {
        if (!resolvedUuid && targetUser.email) {
          const { data: foundProfile, error: lookupErr } = await client
            .from('profiles')
            .select('id')
            .eq('email', targetUser.email.toLowerCase())
            .maybeSingle();

          if (lookupErr) {
            return {
              success: false,
              error: `Gagal memeriksa pengguna di Supabase: ${lookupErr.message}`,
            };
          }
          if (foundProfile?.id) {
            resolvedUuid = foundProfile.id;
          }
        }

        if (resolvedUuid || !String(targetUser.id || '').startsWith('usr-')) {
          const rpcTarget = resolvedUuid || targetUser.email;
          let confirmedDeleted = false;
          let lastError = '';

          // 1) Panggil RPC delete_user_profile untuk menghapus auth.users + public.profiles secara permanen
          const { data: rpcData, error: rpcError } = await client.rpc('delete_user_profile', {
            target_id: rpcTarget,
          });

          if (!rpcError && rpcData && (rpcData as any).success === true) {
            confirmedDeleted = true;
          } else {
            const rpcMsg =
              rpcError?.message ||
              ((rpcData as any)?.error ? String((rpcData as any).error) : '');

            const lowerRpc = rpcMsg.toLowerCase();
            if (
              lowerRpc.includes('akses ditolak') ||
              lowerRpc.includes('tidak terotentikasi') ||
              lowerRpc.includes('administrator')
            ) {
              return { success: false, error: rpcMsg };
            }
            lastError = rpcMsg;
          }

          // 2) Fallback delete langsung pada public.profiles apabila RPC tidak tersedia atau hanya ada di profiles
          if (!confirmedDeleted) {
            if (resolvedUuid) {
              const { data: delRows, error: delByIdErr } = await client
                .from('profiles')
                .delete()
                .eq('id', resolvedUuid)
                .select('id');

              if (delByIdErr) {
                return {
                  success: false,
                  error: delByIdErr.message || lastError || 'Gagal menghapus pengguna dari Supabase.',
                };
              }
              if (delRows && delRows.length > 0) {
                confirmedDeleted = true;
              }
            } else if (targetUser.email) {
              const { data: delRows, error: delByEmailErr } = await client
                .from('profiles')
                .delete()
                .eq('email', targetUser.email.toLowerCase())
                .select('id');

              if (delByEmailErr) {
                return {
                  success: false,
                  error: delByEmailErr.message || lastError || 'Gagal menghapus pengguna dari Supabase.',
                };
              }
              if (delRows && delRows.length > 0) {
                confirmedDeleted = true;
              }
            }
          }

          // Jika record memang ada di Supabase (memiliki UUID) tetapi gagal terhapus karena RLS, kembalikan error nyata
          if (!confirmedDeleted && resolvedUuid) {
            return {
              success: false,
              error:
                lastError ||
                'Penghapusan pengguna di Supabase tidak berhasil (kemungkinan ditolak kebijakan RLS). Pastikan Anda login sebagai Administrator Supabase.',
            };
          }
        }
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Gagal menghubungi server Supabase saat menghapus pengguna.',
        };
      }
    }

    // Catat ke daftar terhapus dan hapus HANYA pengguna target dari state lokal
    addToDeletedUsersSet(targetUser);
    setAllUsersList((prev) =>
      prev.filter((u) => {
        const matchId = Boolean(targetUser.id && u.id && u.id === targetUser.id);
        const matchEmail = Boolean(
          targetUser.email && u.email.toLowerCase() === targetUser.email.toLowerCase()
        );
        return !matchId && !matchEmail;
      })
    );

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole: normalizeUserRole(currentUser.roleKey || 'guru'),
        isLoggedIn,
        isAuthLoading,
        isLoading,
        authError,
        clearAuthError,
        isSupabaseConnected,
        supabaseStatus,
        checkSupabaseConnection,
        refreshUsersFromSupabase,
        loginWithEmail,
        logout,
        updateCurrentUserProfile,
        allUsersList,
        updateUserRoleByAdmin,
        addNewUserByAdmin,
        updateUserByAdmin,
        deleteUserByAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
