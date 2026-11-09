import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { UserProfile, UserRole, USER_ROLES } from '../types/report';
import { DEFAULT_ROLE_USERS, initialProfile } from '../data/initialData';
import { getSupabaseClient, testSupabaseConnection, SupabaseConnectionStatus } from '../lib/supabase';

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
        if (parsed.roleKey) return parsed;
      }
      return DEFAULT_ROLE_USERS.kepala_sekolah;
    } catch {
      return DEFAULT_ROLE_USERS.kepala_sekolah;
    }
  });

  const [allUsersList, setAllUsersList] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem('sibahar_all_users');
      if (saved) return JSON.parse(saved);
      return Object.values(DEFAULT_ROLE_USERS);
    } catch {
      return Object.values(DEFAULT_ROLE_USERS);
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

  // Periksa koneksi Supabase di awal
  useEffect(() => {
    checkSupabaseConnection();

    const client = getSupabaseClient();
    if (!client) return;

    // Listen to Supabase auth state change
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
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
          });
          setIsLoggedIn(true);
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
        setIsLoading(false);
        return { success: false, error: err.message || 'Gagal login ke Supabase' };
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
        users.map((u) => (u.id === prev.id ? updated : u))
      );
      return updated;
    });
  };

  const updateUserRoleByAdmin = (userId: string, newRole: UserRole) => {
    setAllUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            roleKey: newRole,
            role: USER_ROLES[newRole]?.label || newRole,
          };
        }
        return u;
      })
    );

    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({
        ...prev,
        roleKey: newRole,
        role: USER_ROLES[newRole]?.label || newRole,
      }));
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

    return newUser;
  };

  // 2. Ubah Data Pengguna (Nama, Jabatan/Role, NIP, Phone, dsb.) oleh Admin
  const updateUserByAdmin = (userId: string, updates: Partial<UserProfile>) => {
    setAllUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
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
    if (currentUser.id === userId) {
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
  };

 // 3. Hapus Pengguna oleh Admin
  const deleteUserByAdmin = async (userId: string): Promise<{ success: boolean; error?: string }> => {
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

    // TAMBAHKAN PERINTAH SUPABASE DI SINI
    const supabase = getSupabaseClient();
const { error: dbError } = await supabase
  .from('profiles')
  .delete()
  .eq('id', userId);

    if (dbError) {
      return { success: false, error: dbError.message };
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
