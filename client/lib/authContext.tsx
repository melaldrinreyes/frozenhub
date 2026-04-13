import {
  createContext,
  useContext,
  useState,
  useEffect,
  Fragment,
  ReactNode,
} from "react";
import { apiClient } from "./apiClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  refreshUser: () => Promise<AuthUser | null>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [disabledModalMessage, setDisabledModalMessage] = useState<string>("");

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

  useEffect(() => {
    const handleForcedLogout = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason?: string; status?: number }>;
      const reason = customEvent.detail?.reason || "Your account was signed out.";

      setUser(null);

      if (reason.toLowerCase().includes("disabled")) {
        setDisabledModalMessage(
          "Your account has been disabled. Please contact an administrator."
        );
      }
    };

    window.addEventListener("auth:forced-logout", handleForcedLogout as EventListener);
    return () => {
      window.removeEventListener("auth:forced-logout", handleForcedLogout as EventListener);
    };
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

  const refreshUser = async (): Promise<AuthUser | null> => {
    try {
      const response = await apiClient.getMe();
      setUser(response.user);
      return response.user;
    } catch {
      setUser(null);
      return null;
    }
  };

  return (
    <Fragment>
      <AuthContext.Provider
        value={{
          user,
          isLoading,
          login,
          signup,
          logout,
          refreshUser,
          isAuthenticated: !!user,
        }}
      >
        {children}
      </AuthContext.Provider>

      <AlertDialog
        open={Boolean(disabledModalMessage)}
        onOpenChange={(open) => {
          if (!open) setDisabledModalMessage("");
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">Account Disabled</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-700 leading-relaxed">
              {disabledModalMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => setDisabledModalMessage("")}
            >
              I Understand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Fragment>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
