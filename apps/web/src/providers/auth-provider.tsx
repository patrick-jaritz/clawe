"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

interface AuthUser {
  email: string;
  name?: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  signIn: (email?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: true,
      isLoading: false,
      user: { email: "patrick@centaur.ai", name: "Patrick" },
      signIn: async () => {},
      signOut: async () => {},
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * Stub for ConvexProviderWithAuth compatibility.
 * Returns always-authenticated state with a no-op token fetcher.
 */
export const useConvexAuth = () => {
  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: true,
      fetchAccessToken: async (_args: { forceRefreshToken: boolean }) => null,
    }),
    [],
  );
};
