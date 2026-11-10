import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { UserProfile, UserRole, USER_ROLES } from '../types/report';
import { DEFAULT_ROLE_USERS, CANONICAL_ROLE_USERS, initialProfile } from '../data/initialData';
import { getSupabaseClient, testSupabaseConnection, SupabaseConnectionStatus } from '../lib/supabase';

// Helper migrasi untuk memperbarui nama lama di cache browser ke nama resmi terbaru & pastikan tenaga keamanan hanya 1
const migrateUsersList = (users: UserProfile[]): UserProfile[] => {
  const result: UserProfile[] = [];
  const seenRoles = new Set<string>();
  const seenEmails = new Set<string>();

  users.forEach((u) => {
    const updated = { ...u };
    // 1. Admin: Ahmad Fauzi -> Igar Nurdiansah, S.Kom
    if (updated.roleKey === 'admin' || updated.name.includes('Ahmad Fauzi') || updated.email.includes('admin@srt1sumedang')) {
      updated.name = 'Igar Nurdiansah, S.Kom';
      updated.avatarInitials = 'IN';
      updated.roleKey = 'admin';
    } 
    // 2. Wali Asrama: H. Dedi Mulyana -> Romi Apek Nugraha, S.Pd
    else if (updated.roleKey === 'wali_asrama' || updated.name.includes('Dedi Mulyana')) {
      updated.name = 'Romi Apek Nugraha, S.Pd';
      updated.avatarInitials = 'RN';
      updated.roleKey = 'wali_asrama';
    } 
    // 3. Wali Asuh: Siti Rahmawati -> Iway Sri Wulan
    else if (updated.roleKey === 'wali_asuh' || updated.name.includes('Siti Rahmawati')) {
      updated.name = 'Iway Sri Wulan';
      updated.avatarInitials = 'IW';
      updated.roleKey = 'wali_asuh';
    } 
    // 4. Guru: Drs. Bambang Sudrajat -> Rizal Abdul Rosyid
    else if (updated.roleKey === 'guru' || updated.name.includes('Bambang Sudrajat')) {
      updated.name = 'Rizal Abdul Rosyid';
      updated.avatarInitials = 'RR';
      updated.roleKey = 'guru';
    } 
    // 5 & 6. Tenaga Keamanan: Agus Supriyanto -> Riki (Hanya 1 tenaga keamanan)
    else if (updated.roleKey === 'tenaga_keamanan' || (updated.roleKey as string) === 'keamanan' || updated.name.includes('Agus')) {
      if (seenRoles.has('tenaga_keamanan')) {
        // Abaikan duplikasi tenaga keamanan
        return;
      }
      updated.name = 'Riki';
      updated.roleKey = 'tenaga_keamanan';
      updated.role = 'Tenaga Keamanan';
      updated.avatarInitials = 'RK';
    }

    const emailKey = updated.email.toLowerCase();
    if (!seenEmails.has(emailKey)) {
      seenEmails.add(emailKey);
      if (updated.roleKey) seenRoles.add(updated.roleKey);
      result.push(updated);
    }
  });

  // Pastikan seluruh 6 peran canonical selalu tersedia
  CANONICAL_ROLE_USERS.forEach((can) => {
    if (!result.some((r) => r.roleKey === can.roleKey)) {
      result.push(can);
    }
  });

  return result;
};

interface AuthContextType {
  currentUser: UserProfile;
  currentRole: UserRole;
  isLoggedIn: boolean;
  isLoading: boolean;
  isSupabaseConnected: boolean;
  supabaseStatus: SupabaseConnectionStatus;
  checkSupabaseConnection: (customUrl?: string, customKey?: string) => Promise<SupabaseConnectionStatus>;
  loginWithRole: (role: UserRole) => void;
  loginWithUserProfile: (user: UserProfile) => void;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, pass: string, fullName: string, role: UserRole, nip?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateCurrentUserProfile: (profile: Partial<UserProfile>) => void;
  allUsersList: UserProfile[];
  updateUserRoleByAdmin: (userId: string, newRole: UserRole) => void;
  addNewUserByAdmin: (user: { name: string; email: string; roleKey: UserRole; nip?: string; department?: string; phone?: string; defaultPassword?: string }) => UserProfile;
  updateUserByAdmin: (userId: string, updates: Partial<UserProfile>) => void;
  deleteUserByAdmin: (userId: string) => { success: boolean; error?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('sibahar_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.roleKey) {
          // Migrasi nama jika di cache lokal masih menggunakan nama contoh lama
          if (parsed.roleKey === 'admin' && (parsed.name?.includes('Ahmad Fauzi') || parsed.email?.includes('admin@srt1sumedang'))) {
            return DEFAULT_ROLE_USERS.admin;
          }
          if (parsed.roleKey === 'wali_asrama' && parsed.name?.includes('Dedi Mulyana')) {
            return DEFAULT_ROLE_USERS.wali_asrama;
          }
          if (parsed.roleKey === 'wali_asuh' && parsed.name?.includes('Siti Rahmawati')) {
            return DEFAULT_ROLE_USERS.wali_asuh;
          }
          if (parsed.roleKey === 'guru' && parsed.name?.includes('Bambang Sudrajat')) {
            return DEFAULT_ROLE_USERS.guru;
          }
          if ((parsed.roleKey === 'tenaga_keamanan' || parsed.roleKey === 'keamanan') && parsed.name?.includes('Agus')) {
            return DEFAULT_ROLE_USERS.tenaga_keamanan;
          }
          return parsed;
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return migrateUsersList(parsed);
        }
      }
      return CANONICAL_ROLE_USERS;
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
    message: 'Kredensial Supabase belum diatur.',
    tablesCreated: false,
  });

  const isSupabaseConnected = supabaseStatus.connected;

  useEffect(() => {
    localStorage.setItem('sibahar_active_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('sibahar_all_users', JSON.stringify(allUsersList));
  }, [allUsersList]);

  // Fungsi pengujian koneksi Supabase yang dapat dipicu manual dari Settings
  const checkSupabaseConnection = useCallback(async (customUrl?: string, customKey?: string) => {
    const status = await testSupabaseConnection(customUrl, customKey);
    setSupabaseStatus(status);
    return status;
  }, []);

  // Periksa koneksi Supabase di awal dan sinkronkan daftar profil
  useEffect(() => {
    checkSupabaseConnection();

    const client = getSupabaseClient();
    if (!client) return;

    // Muat daftar profil dari tabel profiles Supabase untuk menjaga konsistensi database terpusat
    client
      .from('profiles')
      .select('*')
      .then(
        ({ data: remoteProfiles, error }) => {
          if (!error && remoteProfiles && remoteProfiles.length > 0) {
            setAllUsersList((prev) => {
              const merged = [...prev];
              remoteProfiles.forEach((rp: any) => {
                const idx = merged.findIndex(
                  (u) => u.id === rp.id || u.email.toLowerCase() === rp.email?.toLowerCase()
                );
                const mappedUser: UserProfile = {
                  id: rp.id,
                  name: rp.full_name,
                  email: rp.email,
                  nip: rp.nip || '',
                  phone: rp.phone || '',
                  department: rp.department || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
                  role: USER_ROLES[rp.role as UserRole]?.label || rp.role,
                  roleKey: rp.role as UserRole,
                  avatarInitials: rp.avatar_initials || 'SR',
                  avatarUrl: rp.avatar_url || undefined,
                };
                if (idx >= 0) {
                  merged[idx] = { ...merged[idx], ...mappedUser };
                } else {
                  merged.push(mappedUser);
                }
              });
              return migrateUsersList(merged);
            });
          }
        },
        (err: any) => console.warn('Supabase fetch profiles warning:', err?.message || err)
      );

    // Listen to Supabase auth state change
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          // Fetch profile
          const { data: profile } = await client
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setCurrentUser({
              id: profile.id,
              name: profile.full_name,
              email: profile.email,
              nip: profile.nip || '',
              phone: profile.phone || '',
              department: profile.department || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
              role: USER_ROLES[profile.role as UserRole]?.label || profile.role,
              roleKey: profile.role as UserRole,
              avatarInitials: profile.avatar_initials || 'SR',
              avatarUrl: profile.avatar_url || undefined,
            });
            setIsLoggedIn(true);
          }
        } catch (fetchErr) {
          console.warn('Gagal memuat data profil dari Supabase (offline/network):', fetchErr);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [checkSupabaseConnection]);

  // Quick switch role (Demo & Quick testing for 6 roles)
  const loginWithRole = (role: UserRole) => {
    const user = DEFAULT_ROLE_USERS[role];
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
    }
  };

  const loginWithUserProfile = (user: UserProfile) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const client = getSupabaseClient();

    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: email.trim(),
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
            setCurrentUser({
              id: profile.id,
              name: profile.full_name,
              email: profile.email,
              nip: profile.nip || '',
              phone: profile.phone || '',
              department: profile.department || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
              role: USER_ROLES[profile.role as UserRole]?.label || profile.role,
              roleKey: profile.role as UserRole,
              avatarInitials: profile.avatar_initials || 'SR',
            });
            setIsLoggedIn(true);
            setIsLoading(false);
            return { success: true };
          }
        }
      } catch (err: any) {
        console.warn('Supabase login network warning:', err);
        const errMsg = String(err?.message || err);
        const isFetch = errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network');

        // Jika jaringan terputus namun email cocok dengan akun peran default bawaan, tetap izinkan login
        const matchOffline = Object.values(DEFAULT_ROLE_USERS).find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase()
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
            : errMsg || 'Gagal login ke Supabase' 
        };
      }
    }

    // Fallback: check matching default role accounts
    const match = Object.values(DEFAULT_ROLE_USERS).find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (match) {
      setCurrentUser(match);
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

    if (client) {
      try {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password: pass,
          options: {
            data: {
              full_name: fullName.trim(),
              role,
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
          const newProfile: UserProfile = {
            id: data.user.id,
            name: fullName.trim(),
            email: email.trim(),
            nip: nip?.trim() || '-',
            phone: '',
            department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
            role: USER_ROLES[role]?.label || role,
            roleKey: role,
            avatarInitials: fullName.slice(0, 2).toUpperCase(),
          };
          setCurrentUser(newProfile);
          setAllUsersList((prev) => [...prev, newProfile]);
          setIsLoggedIn(true);
          setIsLoading(false);
          return { success: true };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message };
      }
    }

    // Local registration
    const newProfile: UserProfile = {
      id: 'usr-' + Date.now(),
      name: fullName.trim(),
      email: email.trim(),
      nip: nip?.trim() || '-',
      phone: '',
      department: 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      role: USER_ROLES[role]?.label || role,
      roleKey: role,
      avatarInitials: fullName.slice(0, 2).toUpperCase(),
    };
    setCurrentUser(newProfile);
    setAllUsersList((prev) => [...prev, newProfile]);
    setIsLoggedIn(true);
    setIsLoading(false);
    return { success: true };
  };

  const logout = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    // Switch to guest/unauthenticated or keep clean
    setIsLoggedIn(false);
  };

  const updateCurrentUserProfile = (updates: Partial<UserProfile>) => {
    setCurrentUser((prev) => {
      const updated = { ...prev, ...updates };
      setAllUsersList((users) =>
        users.map((u) => (u.id === prev.id || u.email === prev.email ? updated : u))
      );

      // Sinkronisasi otomatis ke Supabase database jika terhubung
      const client = getSupabaseClient();
      if (client) {
        const payload: any = {
          updated_at: new Date().toISOString(),
        };
        if (updated.name) payload.full_name = updated.name.trim();
        if (updated.nip !== undefined) payload.nip = updated.nip;
        if (updated.phone !== undefined) payload.phone = updated.phone;
        if (updated.department !== undefined) payload.department = updated.department;
        if (updated.avatarUrl !== undefined) payload.avatar_url = updated.avatarUrl;
        if (updated.avatarInitials) payload.avatar_initials = updated.avatarInitials;

        client
          .from('profiles')
          .update(payload)
          .match({ email: updated.email })
          .then(
            ({ error }) => {
              if (error) console.warn('Supabase sync updateCurrentUserProfile warning:', error.message);
            },
            (err: any) => console.warn('Supabase updateCurrentUserProfile network warning:', err?.message || err)
          );
      }

      return updated;
    });
  };

  const updateUserRoleByAdmin = (userId: string, newRole: UserRole) => {
    let targetEmail = '';
    setAllUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId || u.email === userId) {
          targetEmail = u.email;
          return {
            ...u,
            roleKey: newRole,
            role: USER_ROLES[newRole]?.label || newRole,
          };
        }
        return u;
      })
    );

    if (currentUser.id === userId || currentUser.email === userId) {
      setCurrentUser((prev) => ({
        ...prev,
        roleKey: newRole,
        role: USER_ROLES[newRole]?.label || newRole,
      }));
    }

    const client = getSupabaseClient();
    if (client && targetEmail) {
      client
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .match({ email: targetEmail })
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase sync updateUserRoleByAdmin warning:', error.message);
          },
          (err: any) => console.warn('Supabase updateUserRoleByAdmin network warning:', err?.message || err)
        );
    }
  };

  // 1. Tambah Akun Pengguna Baru oleh Admin
  const addNewUserByAdmin = (userData: { 
    name: string; 
    email: string; 
    roleKey: UserRole; 
    nip?: string; 
    department?: string; 
    phone?: string; 
    defaultPassword?: string 
  }): UserProfile => {
    const initials = userData.name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SR';

    const newUser: UserProfile = {
      id: 'usr-' + userData.roleKey + '-' + Date.now(),
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      nip: userData.nip?.trim() || '-',
      phone: userData.phone?.trim() || '',
      department: userData.department?.trim() || 'Sekolah Rakyat Terintegerasi 1 Sumedang',
      role: USER_ROLES[userData.roleKey]?.label || userData.roleKey,
      roleKey: userData.roleKey,
      avatarInitials: initials,
    };

    setAllUsersList((prev) => {
      // Periksa apakah email sudah ada
      const existing = prev.find((u) => u.email.toLowerCase() === newUser.email.toLowerCase());
      if (existing) {
        return prev.map((u) => (u.id === existing.id ? { ...u, ...newUser, id: existing.id } : u));
      }
      return [...prev, newUser];
    });

    // Sinkronisasi langsung ke Supabase
    const client = getSupabaseClient();
    if (client) {
      client
        .from('profiles')
        .upsert(
          {
            full_name: newUser.name,
            email: newUser.email,
            role: newUser.roleKey,
            nip: newUser.nip,
            phone: newUser.phone,
            department: newUser.department,
            avatar_initials: newUser.avatarInitials,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase sync addNewUserByAdmin warning:', error.message);
          },
          (err: any) => console.warn('Supabase addNewUserByAdmin network warning:', err?.message || err)
        );
    }

    return newUser;
  };

  // 2. Ubah Data Pengguna (Nama, Jabatan/Role, NIP, Phone, dsb.) oleh Admin
  const updateUserByAdmin = (userId: string, updates: Partial<UserProfile>) => {
    let targetEmail = '';

    setAllUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId || u.email === userId) {
          targetEmail = u.email;
          const roleKey = updates.roleKey || u.roleKey;
          const roleLabel = updates.role || (updates.roleKey ? USER_ROLES[updates.roleKey]?.label : u.role);
          const name = updates.name !== undefined ? updates.name.trim() : u.name;
          const initials = name
            .split(' ')
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || u.avatarInitials;

          return {
            ...u,
            ...updates,
            name,
            roleKey,
            role: roleLabel,
            avatarInitials: initials,
          };
        }
        return u;
      })
    );

    // Jika yang diubah adalah akun admin yang sedang login
    if (currentUser.id === userId || currentUser.email === userId) {
      setCurrentUser((prev) => {
        const roleKey = updates.roleKey || prev.roleKey;
        const roleLabel = updates.role || (updates.roleKey ? USER_ROLES[updates.roleKey]?.label : prev.role);
        const name = updates.name !== undefined ? updates.name.trim() : prev.name;
        const initials = name
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || prev.avatarInitials;

        return {
          ...prev,
          ...updates,
          name,
          roleKey,
          role: roleLabel,
          avatarInitials: initials,
        };
      });
    }

    // Sinkronisasi otomatis ke Supabase database
    const client = getSupabaseClient();
    if (client && targetEmail) {
      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name) payload.full_name = updates.name.trim();
      if (updates.roleKey) payload.role = updates.roleKey;
      if (updates.nip !== undefined) payload.nip = updates.nip;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.department !== undefined) payload.department = updates.department;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

      client
        .from('profiles')
        .update(payload)
        .match({ email: targetEmail })
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase sync updateUserByAdmin warning:', error.message);
          },
          (err: any) => console.warn('Supabase updateUserByAdmin network warning:', err?.message || err)
        );
    }
  };

  // 3. Hapus Pengguna oleh Admin
  const deleteUserByAdmin = (userId: string): { success: boolean; error?: string } => {
    if (currentUser.id === userId) {
      return { success: false, error: 'Tidak dapat menghapus akun yang sedang Anda gunakan saat ini.' };
    }

    const targetUser = allUsersList.find((u) => u.id === userId);
    if (!targetUser) {
      return { success: false, error: 'Pengguna tidak ditemukan.' };
    }

    // Pastikan tidak menghapus seluruh admin jika hanya ada 1 admin
    const adminCount = allUsersList.filter((u) => u.roleKey === 'admin').length;
    if (targetUser.roleKey === 'admin' && adminCount <= 1) {
      return { success: false, error: 'Sistem harus memiliki minimal satu akun Administrator.' };
    }

    // Sinkronisasi hapus ke Supabase jika terhubung
    const client = getSupabaseClient();
    if (client) {
      client
        .from('profiles')
        .delete()
        .eq('id', userId)
        .then(
          ({ error }) => {
            if (error) console.warn('Supabase profile delete warning:', error.message);
          },
          (err: any) => console.warn('Supabase profile delete network warning:', err?.message || err)
        );
    }

    setAllUsersList((prev) => prev.filter((u) => u.id !== userId));
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole: currentUser.roleKey || 'kepala_sekolah',
        isLoggedIn,
        isLoading,
        isSupabaseConnected,
        supabaseStatus,
        checkSupabaseConnection,
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
