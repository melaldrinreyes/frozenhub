import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { apiClient } from "./apiClient";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "branch_admin" | "pos_operator" | "customer" | "rider";
  branch_id: string | null;
  created_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  signup: (
    name: string,
    email: string,
    phone: string,
    password: string,
  ) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from session on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiClient.getMe();
        setUser(response.user);
      } catch (error) {
        // Not authenticated or session expired - this is expected and normal
        // Silently set user to null without logging
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<AuthUser | null> => {
    try {
      const response = await apiClient.login(email, password);
      setUser(response.user);
      return response.user;
    } catch (error) {
      console.error("Login error:", error);
      // Re-throw the error so the caller can handle it
      throw error;
    }
  };

  const signup = async (
    name: string,
    email: string,
    phone: string,
    password: string,
  ): Promise<AuthUser | null> => {
    try {
      const response = await apiClient.signup(name, email, phone, password);
      setUser(response.user);
      return response.user;
    } catch (error) {
      console.error("Signup error:", error);
      // Re-throw the error so the caller can handle it
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
