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
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, pass: string, fullName: string, role: UserRole, nip?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateCurrentUserProfile: (profile: Partial<UserProfile>) => void;
  allUsersList: UserProfile[];
  updateUserRoleByAdmin: (userId: string, newRole: UserRole) => void;
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
        loginWithEmail,
        registerWithEmail,
        logout,
        updateCurrentUserProfile,
        allUsersList,
        updateUserRoleByAdmin,
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
