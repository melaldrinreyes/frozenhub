import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from Supabase
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error(sessionError?.message || "No session found");
        }

        // Exchange Supabase session for custom JWT
        const response = await fetch("/api/auth/supabase-callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: session.access_token,
            email: session.user.email,
            googleId: session.user.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to authenticate");
        }

        // Redirect based on user role
        if (user?.role === "admin") {
          navigate("/admin/dashboard");
        } else if (user?.role === "branch_admin") {
          navigate("/branch/dashboard");
        } else if (user?.role === "pos_operator") {
          navigate("/pos");
        } else if (user?.role === "customer") {
          navigate("/customer/shop");
        } else {
          navigate("/");
        }
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        setError(err.message || "Authentication failed");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    handleCallback();
  }, [navigate, user]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="space-y-6 text-center">
        {error ? (
          <>
            <div className="text-red-400 text-lg font-semibold">{error}</div>
            <p className="text-slate-400">Redirecting you back...</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-gold-500 border-t-gold-500 border-r-transparent animate-spin"></div>
            </div>
            <p className="text-slate-300">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}
