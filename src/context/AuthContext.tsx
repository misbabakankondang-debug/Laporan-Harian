import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { UserProfile, UserRole, USER_ROLES } from '../types/report';
import { DEFAULT_ROLE_USERS, CANONICAL_ROLE_USERS } from '../data/initialData';
import {
  getSupabaseClient,
  getSupabaseConfig,
  testSupabaseConnection,
  buildSupabaseRestHeaders,
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

export const normalizeUserRole = (role?: string | null): UserRole => {
  if (!role) return 'guru';
  const cleaned = String(role).trim();
  if (cleaned === 'keamanan') return 'tenaga_keamanan';
  if (cleaned in USER_ROLES) return cleaned as UserRole;
  return 'guru';
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

// Menggabungkan data authoritative dari Supabase `profiles` dengan state lokal:
// - Data Supabase selalu menjadi sumber utama (tidak pernah ditimpa cache lokal).
// - Record dengan UUID asli yang sudah hilang dari Supabase tidak dimunculkan ulang.
// - Dua atau lebih pengguna dengan role sama tetap menjadi entitas terpisah berdasarkan ID/email.
export const mergeRemoteProfilesWithLocal = (
  remoteRows: any[],
  localUsers: UserProfile[],
  deletedSet = getDeletedUsersSet()
): UserProfile[] => {
  const remoteProfiles = (remoteRows || [])
    .filter((rp) => rp && (rp.id || rp.email) && rp.is_active !== false)
    .map(mapDbProfileToUserProfile)
    .filter((u) => {
      const idLower = (u.id || '').toLowerCase();
      const emailLower = u.email.toLowerCase();
      return !deletedSet.has(idLower) && !deletedSet.has(emailLower);
    });

  if (remoteProfiles.length === 0) {
    return deduplicateUsersByIdentity(localUsers, deletedSet);
  }

  const remoteEmails = new Set(remoteProfiles.map((u) => u.email.toLowerCase()).filter(Boolean));
  const canonicalEmails = new Set(CANONICAL_ROLE_USERS.map((c) => c.email.toLowerCase()));

  // Pertahankan akun lokal non-UUID (misal akun bawaan/offline sebelum sync) yang tidak bentrok email dan tidak dihapus
  const preservedLocalOnly = localUsers
    .map(migrateSingleLegacyUser)
    .filter((u) => {
      const idLower = (u.id || '').toLowerCase();
      const emailLower = u.email.toLowerCase();
      if (deletedSet.has(idLower) || deletedSet.has(emailLower)) return false;
      if (remoteEmails.has(emailLower)) return false;
      // Jika user lokal memiliki UUID asli tetapi sudah tidak ada di Supabase remoteProfiles, berarti telah dihapus di DB
      if (isUuid(u.id)) return false;
      // Akun canonical bawaan (id: usr-...) atau akun lokal offline tetap tersedia jika tidak dihapus
      return canonicalEmails.has(emailLower) || (u.id || '').startsWith('local-');
    });

  return deduplicateUsersByIdentity([...remoteProfiles, ...preservedLocalOnly], deletedSet);
};

export interface UserMutationResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  partialAuthSuccess?: boolean;
  pendingAuthUserId?: string;
  pendingAuthAccessToken?: string;
  schemaMismatch?: boolean;
}

interface AuthContextType {
  currentUser: UserProfile;
  currentRole: UserRole;
  isLoggedIn: boolean;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  supabaseStatus: SupabaseConnectionStatus;
  checkSupabaseConnection: (customUrl?: string, customKey?: string) => Promise<SupabaseConnectionStatus>;
  refreshUsersFromSupabase: () => Promise<void>;
  loginWithRole: (role: UserRole) => void;
  loginWithUserProfile: (user: UserProfile) => void;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (
    email: string,
    pass: string,
    fullName: string,
    role: UserRole,
    nip?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
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
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('sibahar_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed.email || parsed.roleKey)) {
          return migrateSingleLegacyUser(parsed);
        }
      }
      return DEFAULT_ROLE_USERS.kepala_sekolah;
    } catch {
      return DEFAULT_ROLE_USERS.kepala_sekolah;
    }
  });

  const [allUsersList, setAllUsersList] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem('sibahar_all_users');
      const deletedSet = getDeletedUsersSet();
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return migrateUsersList(parsed, deletedSet);
        }
      }
      return deduplicateUsersByIdentity(CANONICAL_ROLE_USERS, deletedSet);
    } catch {
      return CANONICAL_ROLE_USERS;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => {
    allUsersListRef.current = allUsersList;
    try {
      localStorage.setItem('sibahar_all_users', JSON.stringify(allUsersList));
    } catch {}
  }, [allUsersList]);

  useEffect(() => {
    currentUserRef.current = currentUser;
    try {
      localStorage.setItem('sibahar_active_user', JSON.stringify(currentUser));
    } catch {}
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

  // Periksa koneksi Supabase di awal, sinkronkan daftar profil, dan dengarkan perubahan realtime
  useEffect(() => {
    checkSupabaseConnection();
    refreshUsersFromSupabase();

    const client = getSupabaseClient();
    if (!client) return;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        checkSupabaseConnection();
        refreshUsersFromSupabase();
      }

      if (session?.user) {
        try {
          const { data: profile } = await client
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setCurrentUser(mapDbProfileToUserProfile(profile));
            setIsLoggedIn(true);
          }
        } catch (fetchErr) {
          console.warn('Gagal memuat data profil dari Supabase (offline/network):', fetchErr);
        }
      }
    });

    const profilesChannel = client
      .channel('sibahar_profiles_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          refreshUsersFromSupabase();
        }
      )
      .subscribe();

    return () => {
      subscription?.unsubscribe();
      client.removeChannel(profilesChannel);
    };
  }, [checkSupabaseConnection, refreshUsersFromSupabase]);

  const loginWithRole = (role: UserRole) => {
    const normalized = normalizeUserRole(role);
    const user =
      allUsersListRef.current.find((u) => normalizeUserRole(u.roleKey) === normalized) ||
      DEFAULT_ROLE_USERS[normalized] ||
      DEFAULT_ROLE_USERS[role];
    if (user) {
      setCurrentUser(migrateSingleLegacyUser(user));
      setIsLoggedIn(true);
    }
  };

  const loginWithUserProfile = (user: UserProfile) => {
    setCurrentUser(migrateSingleLegacyUser(user));
    setIsLoggedIn(true);
  };

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const client = getSupabaseClient();
    const cleanedEmail = email.trim().toLowerCase();

    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanedEmail,
          password: pass,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          const { data: profile } = await client
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            const mapped = mapDbProfileToUserProfile(profile);
            setCurrentUser(mapped);
            setIsLoggedIn(true);
            refreshUsersFromSupabase();
            setIsLoading(false);
            return { success: true };
          }
        }
      } catch (err: any) {
        console.warn('Supabase login network warning:', err);
        const errMsg = String(err?.message || err);
        const isFetch = errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network');

        const matchOffline = Object.values(DEFAULT_ROLE_USERS).find(
          (u) => u.email.toLowerCase() === cleanedEmail
        );
        if (matchOffline) {
          setCurrentUser(matchOffline);
          setIsLoggedIn(true);
          setIsLoading(false);
          return { success: true };
        }

        setIsLoading(false);
        return {
          success: false,
          error: isFetch
            ? 'Koneksi jaringan ke Supabase gagal (Failed to fetch). Periksa koneksi internet atau gunakan tombol pilih akun cepat di bawah.'
            : errMsg || 'Gagal login ke Supabase',
        };
      }
    }

    const match = allUsersListRef.current.find((u) => u.email.toLowerCase() === cleanedEmail) ||
      Object.values(DEFAULT_ROLE_USERS).find((u) => u.email.toLowerCase() === cleanedEmail);

    if (match) {
      setCurrentUser(migrateSingleLegacyUser(match));
      setIsLoggedIn(true);
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return { success: false, error: 'Email atau kata sandi tidak cocok. Gunakan tombol pilih akun cepat di bawah.' };
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    fullName: string,
    role: UserRole,
    nip?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const client = getSupabaseClient();
    const normalizedRole = normalizeUserRole(role);
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedName = fullName.trim();
    const initials = computeAvatarInitials(cleanedName);

    if (client) {
      try {
        const { data, error } = await client.auth.signUp({
          email: cleanedEmail,
          password: pass,
          options: {
            data: {
              full_name: cleanedName,
              role: normalizedRole,
              nip: nip?.trim() || '-',
              department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
            },
          },
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          const profileRow = {
            id: data.user.id,
            full_name: cleanedName,
            email: cleanedEmail,
            role: normalizedRole,
            nip: nip?.trim() || '-',
            phone: '',
            department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
            avatar_initials: initials,
            is_active: true,
            updated_at: new Date().toISOString(),
          };

          const { error: profErr } = await client
            .from('profiles')
            .upsert(profileRow, { onConflict: 'id' });

          if (profErr) {
            console.warn('Supabase profile upsert after signUp warning:', profErr.message);
          }

          const newProfile: UserProfile = {
            id: data.user.id,
            name: cleanedName,
            email: cleanedEmail,
            nip: nip?.trim() || '-',
            phone: '',
            department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
            role: USER_ROLES[normalizedRole]?.label || normalizedRole,
            roleKey: normalizedRole,
            avatarInitials: initials,
            isActive: true,
          };
          setCurrentUser(newProfile);
          setAllUsersList((prev) => deduplicateUsersByIdentity([...prev, newProfile], getDeletedUsersSet()));
          setIsLoggedIn(true);
          setIsLoading(false);
          return { success: true };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message };
      }
    }

    const newProfile: UserProfile = {
      id: 'local-' + generateUuid(),
      name: cleanedName,
      email: cleanedEmail,
      nip: nip?.trim() || '-',
      phone: '',
      department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      role: USER_ROLES[normalizedRole]?.label || normalizedRole,
      roleKey: normalizedRole,
      avatarInitials: initials,
      isActive: true,
    };
    setCurrentUser(newProfile);
    setAllUsersList((prev) => deduplicateUsersByIdentity([...prev, newProfile], getDeletedUsersSet()));
    setIsLoggedIn(true);
    setIsLoading(false);
    return { success: true };
  };

  const logout = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setIsLoggedIn(false);
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

  // 1. Tambah Akun Pengguna Baru oleh Admin (wajib terkonfirmasi Supabase sebelum tampil sukses)
  const addNewUserByAdmin = async (userData: {
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
  }): Promise<UserMutationResult> => {
    const cleanedName = userData.name.trim();
    const cleanedEmail = userData.email.trim().toLowerCase();
    const normalizedRole = normalizeUserRole(userData.roleKey);
    const cleanedNip = userData.nip?.trim() || '-';
    const cleanedPhone = userData.phone?.trim() || '';
    const cleanedDept = userData.department?.trim() || 'Sekolah Rakyat Terintegerasi 1 Sumedang';
    const password = (userData.defaultPassword || 'Sibahar2026!').trim();
    const initials = computeAvatarInitials(cleanedName);
    const isContinuingProfile = Boolean(
      userData.continueProfileOnly && isUuid(userData.existingAuthUserId)
    );

    const isProfilesSchemaError = (msg: string): boolean => {
      const lower = msg.toLowerCase();
      return (
        lower.includes('schema cache') ||
        lower.includes('pgrst204') ||
        lower.includes('could not find the') ||
        (lower.includes('column') && lower.includes('profiles')) ||
        lower.includes('does not exist')
      );
    };

    if (!cleanedName || !cleanedEmail) {
      return { success: false, error: 'Nama lengkap dan alamat email wajib diisi.' };
    }

    if (!isContinuingProfile && password.length < 6) {
      return { success: false, error: 'Kata sandi awal minimal 6 karakter.' };
    }

    // Pastikan email belum dipakai pengguna lain agar tidak saling menimpa
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

    if (client && cfg.isConfigured) {
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

      let createdProfile: UserProfile | null = null;
      let shouldTryRestProfileOnly = false;
      let shouldTrySignupFallback = false;
      let apiErrorMsg = '';

      // Jalur utama: Vercel Serverless Function /api/admin-create-user (membuat auth.users + public.profiles secara atomik, atau melanjutkan profil UUID yang sudah ada)
      try {
        const apiRes = await globalThis.fetch('/api/admin-create-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
          body: JSON.stringify({
            email: cleanedEmail,
            password,
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
              : {}),
          }),
        });

        const apiBody = await apiRes.json().catch(() => ({}));

        if (apiRes.ok && apiBody?.user?.id) {
          createdProfile = mapDbProfileToUserProfile({
            id: apiBody.user.id,
            full_name: apiBody.user.full_name || cleanedName,
            email: apiBody.user.email || cleanedEmail,
            role: apiBody.user.role || normalizedRole,
            nip: apiBody.user.nip ?? cleanedNip,
            phone: apiBody.user.phone ?? cleanedPhone,
            department: apiBody.user.department ?? cleanedDept,
            avatar_initials: apiBody.user.avatar_initials || initials,
            is_active: apiBody.user.is_active !== false,
          });
        } else {
          apiErrorMsg = apiBody?.error || `HTTP ${apiRes.status}`;

          // Jika Auth sudah berhasil dibuat namun penyimpanan ke profiles gagal, JANGAN buat akun Auth baru!
          if (apiBody?.partialAuthSuccess && apiBody?.pendingAuthUserId) {
            return {
              success: false,
              error: apiErrorMsg,
              partialAuthSuccess: true,
              pendingAuthUserId: apiBody.pendingAuthUserId,
              schemaMismatch: Boolean(apiBody.schemaMismatch),
            };
          }

          const lowerErr = apiErrorMsg.toLowerCase();
          const isApiUnavailable =
            apiRes.status === 404 ||
            lowerErr.includes('service_role') ||
            lowerErr.includes('belum lengkap');

          if (isApiUnavailable) {
            if (isContinuingProfile) {
              shouldTryRestProfileOnly = true;
            } else {
              shouldTrySignupFallback = true;
            }
          } else {
            return { success: false, error: apiErrorMsg };
          }
        }
      } catch (netErr: any) {
        apiErrorMsg = netErr?.message || 'Gagal menghubungi endpoint /api/admin-create-user.';
        if (isContinuingProfile) {
          shouldTryRestProfileOnly = true;
        } else {
          shouldTrySignupFallback = true;
        }
      }

      const saveProfileViaRest = async (
        targetUuid: string,
        bearerToken: string
      ): Promise<UserMutationResult> => {
        const profilePayload = {
          id: targetUuid,
          full_name: cleanedName,
          email: cleanedEmail,
          role: normalizedRole,
          nip: cleanedNip,
          phone: cleanedPhone,
          department: cleanedDept,
          avatar_initials: initials,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        const restRes = await globalThis.fetch(`${cfg.url}/rest/v1/profiles`, {
          method: 'POST',
          headers: {
            ...buildSupabaseRestHeaders(cfg.key, bearerToken),
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(profilePayload),
        });

        const restData = await restRes.json().catch(() => null);
        if (!restRes.ok) {
          const errMsg =
            restData?.message ||
            restData?.details ||
            restData?.hint ||
            `HTTP ${restRes.status}`;
          const schemaMismatch = isProfilesSchemaError(errMsg);
          return {
            success: false,
            partialAuthSuccess: true,
            pendingAuthUserId: targetUuid,
            pendingAuthAccessToken: bearerToken,
            schemaMismatch,
            error: schemaMismatch
              ? `Akun Auth dibuat, namun gagal menyimpan ke tabel profiles karena skema database belum lengkap: ${errMsg}. Jalankan SQL migrasi kolom profiles di Supabase SQL Editor, lalu klik "Lanjutkan Simpan Profil".`
              : `Akun Auth dibuat, namun gagal menyimpan ke tabel profiles Supabase: ${errMsg}`,
          };
        }

        const savedRow = Array.isArray(restData) ? restData[0] : restData;
        return {
          success: true,
          user: mapDbProfileToUserProfile(savedRow || profilePayload),
        };
      };

      // Mode lanjutan khusus profil saja (tanpa memanggil /auth/v1/signup lagi!)
      if (!createdProfile && isContinuingProfile && shouldTryRestProfileOnly && userData.existingAuthUserId) {
        try {
          const restResult = await saveProfileViaRest(
            userData.existingAuthUserId,
            activeToken || userData.existingAuthToken || ''
          );
          if (!restResult.success) {
            return restResult;
          }
          createdProfile = restResult.user || null;
        } catch (restErr: any) {
          return {
            success: false,
            partialAuthSuccess: true,
            pendingAuthUserId: userData.existingAuthUserId,
            pendingAuthAccessToken: userData.existingAuthToken,
            error:
              restErr?.message ||
              apiErrorMsg ||
              'Gagal menyimpan profil lanjutan ke Supabase.',
          };
        }
      }

      // Jalur cadangan resmi Supabase: POST /auth/v1/signup (tanpa GoTrueClient kedua) + INSERT public.profiles
      if (!createdProfile && !isContinuingProfile && shouldTrySignupFallback) {
        try {
          const signupRes = await globalThis.fetch(`${cfg.url}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              ...buildSupabaseRestHeaders(cfg.key),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: cleanedEmail,
              password,
              data: {
                full_name: cleanedName,
                role: normalizedRole,
                nip: cleanedNip,
                department: cleanedDept,
              },
            }),
          });

          const signupData = await signupRes.json().catch(() => ({}));
          if (!signupRes.ok) {
            const signupErrMsg =
              signupData?.msg ||
              signupData?.error_description ||
              signupData?.message ||
              apiErrorMsg ||
              `Gagal membuat akun Auth di Supabase (HTTP ${signupRes.status}).`;

            const lowerSignupErr = `${signupData?.error_code || ''} ${signupErrMsg}`.toLowerCase();
            if (
              lowerSignupErr.includes('already') ||
              lowerSignupErr.includes('registered') ||
              lowerSignupErr.includes('exists')
            ) {
              // Jangan pernah membuat akun Auth baru untuk email yang sudah terdaftar; pulihkan sesi/UUID Auth bila hanya profil yang belum tersimpan
              try {
                const tokenRes = await globalThis.fetch(
                  `${cfg.url}/auth/v1/token?grant_type=password`,
                  {
                    method: 'POST',
                    headers: {
                      ...buildSupabaseRestHeaders(cfg.key),
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: cleanedEmail, password }),
                  }
                );
                const tokenData = await tokenRes.json().catch(() => ({}));
                const recoveredUuid = tokenData?.user?.id;
                const recoveredToken = tokenData?.access_token || '';
                if (tokenRes.ok && isUuid(recoveredUuid)) {
                  return {
                    success: false,
                    partialAuthSuccess: true,
                    pendingAuthUserId: recoveredUuid,
                    pendingAuthAccessToken: recoveredToken,
                    error: `Akun Auth untuk ${cleanedEmail} sudah dibuat sebelumnya (UUID: ${recoveredUuid}), namun belum tersimpan di tabel profiles. Klik "Lanjutkan Simpan Profil (Tanpa Buat Auth Baru)" setelah skema siap.`,
                  };
                }
              } catch {}
            }

            return {
              success: false,
              error: signupErrMsg,
            };
          }

          const newAuthUuid = signupData?.user?.id || signupData?.id;
          const signupToken = signupData?.access_token || '';

          if (!isUuid(newAuthUuid)) {
            return {
              success: false,
              error:
                'Supabase Auth tidak mengembalikan UUID pengguna yang valid. Pastikan SUPABASE_SERVICE_ROLE_KEY terpasang di Vercel.',
            };
          }

          // Gunakan token Admin aktif atau token user baru (memenuhi RLS: auth.uid() = id OR is_admin())
          const insertToken = activeToken || signupToken;
          const restResult = await saveProfileViaRest(newAuthUuid, insertToken);
          if (!restResult.success) {
            return restResult;
          }
          createdProfile = restResult.user || null;
        } catch (fallbackErr: any) {
          return {
            success: false,
            error: fallbackErr?.message || apiErrorMsg || 'Gagal menyimpan pengguna baru ke Supabase.',
          };
        }
      }

      if (!createdProfile) {
        return {
          success: false,
          error: apiErrorMsg || 'Gagal menyimpan pengguna baru ke Supabase.',
        };
      }

      removeFromDeletedUsersSet(cleanedEmail);
      setAllUsersList((prev) =>
        deduplicateUsersByIdentity([...prev, createdProfile!], getDeletedUsersSet())
      );
      return { success: true, user: createdProfile };
    }

    // Mode offline / lokal tanpa konfigurasi Supabase
    const localUser: UserProfile = {
      id: 'local-' + generateUuid(),
      name: cleanedName,
      email: cleanedEmail,
      nip: cleanedNip,
      phone: cleanedPhone,
      department: cleanedDept,
      role: USER_ROLES[normalizedRole]?.label || normalizedRole,
      roleKey: normalizedRole,
      avatarInitials: initials,
      isActive: true,
    };

    removeFromDeletedUsersSet(cleanedEmail);
    setAllUsersList((prev) =>
      deduplicateUsersByIdentity([...prev, localUser], getDeletedUsersSet())
    );
    return { success: true, user: localUser };
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
        currentRole: normalizeUserRole(currentUser.roleKey || 'kepala_sekolah'),
        isLoggedIn,
        isLoading,
        isSupabaseConnected,
        supabaseStatus,
        checkSupabaseConnection,
        refreshUsersFromSupabase,
        loginWithRole,
        loginWithUserProfile,
        loginWithEmail,
        registerWithEmail,
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
