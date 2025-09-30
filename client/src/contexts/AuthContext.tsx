import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  username: string;
  credits: number;
  isUnlimited: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<{ user: User | null }>({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await apiRequest('POST', '/api/auth/login', { username, password });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Login failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await apiRequest('POST', '/api/auth/register', { username, password });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Registration failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout');
      const data = await response.json();
      if (!data.success) throw new Error('Logout failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const register = async (username: string, password: string) => {
    await registerMutation.mutateAsync({ username, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider value={{ user: data?.user || null, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
