import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Lock, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type UserRole = "admin" | "branch_admin" | "pos_operator" | "customer" | "rider";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
  requireAuth?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  redirectTo = "/",
  requireAuth = true,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  // Track unauthorized access attempts
  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role as UserRole)) {
      console.warn(`Unauthorized access attempt to ${location.pathname} by user ${user.email} with role ${user.role}`);
      
      toast({
        title: "Access Denied",
        description: `You don't have permission to access this page.`,
        variant: "destructive",
      });
    }
  }, [user, isLoading, allowedRoles, location.pathname, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to home with return URL
  if (!user && requireAuth) {
    return <Navigate to={`${redirectTo}?returnUrl=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Authenticated but not authorized
  if (user && !allowedRoles.includes(user.role as UserRole)) {
    // Redirect to appropriate dashboard based on role
    const roleDashboards: Record<string, string> = {
      admin: "/admin/dashboard",
      branch_admin: "/branch/dashboard",
      pos_operator: "/pos",
      customer: "/customer/home",
      rider: "/rider/dashboard",
    };

    const userDashboard = roleDashboards[user.role] || "/";

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-12">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="p-4 bg-red-100 rounded-full">
                  <Shield className="w-12 h-12 text-red-600" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
                  <Lock className="w-6 h-6" />
                  Access Denied
                </h2>
                <p className="text-slate-600 mt-2">
                  Your account does not have permission to access this page.
                </p>
              </div>

              <div className="bg-slate-100 rounded-lg p-4 text-left text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-700">
                      <span className="font-semibold">Your Role:</span>{" "}
                      <span className="text-blue-600">
                        {user.role === "admin"
                          ? "System Administrator"
                          : user.role === "branch_admin"
                            ? "Branch Administrator"
                            : user.role === "pos_operator"
                              ? "POS Operator"
                              : user.role === "rider"
                                ? "Rider"
                                : "Customer"}
                      </span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-700">
                      <span className="font-semibold">Required Roles:</span>{" "}
                      <span className="text-red-600">
                        {allowedRoles
                          .map((role) =>
                            role === "admin"
                              ? "System Administrator"
                              : role === "branch_admin"
                                ? "Branch Administrator"
                                : role === "pos_operator"
                                  ? "POS Operator"
                                  : role === "rider"
                                    ? "Rider"
                                    : "Customer",
                          )
                          .join(", ")}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={userDashboard}
                  className="flex-1 px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors text-center"
                >
                  Go to Dashboard
                </a>
                <a
                  href={redirectTo}
                  className="flex-1 px-6 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors text-center"
                >
                  Return Home
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authorized - render children
  return <>{children}</>;
}
