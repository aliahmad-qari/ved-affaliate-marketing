import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Partner,
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from '../types/auth.ts';
import {
  registerPartner,
  loginPartner,
  logoutPartner,
  getCurrentUser,
  getPartnerProfile,
  updatePartnerProfile,
  changePartnerPassword,
} from '../services/authApi.ts';

interface AuthContextType {
  partner: Partner | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session from backend cookie
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      setPartner(user);
    } catch {
      setPartner(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (input: LoginInput) => {
    const res = await loginPartner(input);
    setPartner(res.partner);
  };

  const register = async (input: RegisterInput) => {
    const res = await registerPartner(input);
    setPartner(res.partner);
  };

  const logout = async () => {
    try {
      await logoutPartner();
    } finally {
      setPartner(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const data = await getPartnerProfile();
      setPartner(data);
    } catch {
      // ignore
    }
  };

  const updateProfile = async (input: UpdateProfileInput) => {
    const updated = await updatePartnerProfile(input);
    setPartner(updated);
  };

  const changePassword = async (input: ChangePasswordInput) => {
    return await changePartnerPassword(input);
  };

  return (
    <AuthContext.Provider
      value={{
        partner,
        isAuthenticated: !!partner,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        updateProfile,
        changePassword,
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
