import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";

type UserRole = "admin" | "branch_admin" | "pos_operator" | "customer" | "rider";

interface GuestRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

function getRoleRedirect(role: UserRole) {
  const roleRoutes: Record<UserRole, string> = {
    admin: "/admin/dashboard",
    branch_admin: "/branch/dashboard",
    pos_operator: "/pos",
    customer: "/customer/shop",
    rider: "/rider/dashboard",
  };

  return roleRoutes[role] || "/";
}

export default function GuestRoute({ children, redirectTo }: GuestRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={redirectTo || getRoleRedirect(user.role)} replace />;
  }

  return <>{children}</>;
}