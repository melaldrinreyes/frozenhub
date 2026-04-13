// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { apiClient } from "@/lib/apiClient";
import { Snowflake } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const progressTicker = window.setInterval(() => {
      setElapsedMs((previous) => previous + 700);
    }, 700);

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

        // Exchange Supabase session for app session + JWT token.
        await apiClient.exchangeSupabaseSession(session.access_token);

        // Refresh app auth state before entering protected customer routes.
        let signedInUser = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          signedInUser = await refreshUser();
          if (signedInUser) break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (!signedInUser) {
          throw new Error("Login is taking longer than expected. Please try again.");
        }

        navigate("/customer/shop", { replace: true });
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        setError(err.message || "Authentication failed");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    handleCallback();

    return () => {
      window.clearInterval(progressTicker);
    };
  }, [navigate, refreshUser]);

  const loadingSteps = ["Verifying Google account", "Creating secure session", "Preparing your dashboard"];
  const activeStepIndex = Math.min(Math.floor(elapsedMs / 2000), loadingSteps.length - 1);
  const progressWidthClass =
    activeStepIndex >= 2 ? "w-full" : activeStepIndex === 1 ? "w-2/3" : "w-1/3";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black px-4 py-8">
      <div className="pointer-events-none absolute -left-24 top-10 h-52 w-52 rounded-full bg-gold-500/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-52 w-52 rounded-full bg-gold-400/10 blur-3xl" />

      <div className="w-full max-w-md rounded-3xl border border-gold-500/25 bg-black/80 p-7 text-center shadow-2xl backdrop-blur-xl">
        {error ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-400/50 bg-red-500/15 text-xl text-red-300">
              !
            </div>
            <div className="text-xl font-semibold text-red-300">Sign-in failed</div>
            <p className="text-sm text-red-100/90">{error}</p>
            <p className="text-sm text-gray-300">Redirecting you back...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-2 text-gold-300">
              <Snowflake className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.18em] text-gold-300/90">FrozenHub</span>
            </div>

            <div className="mx-auto inline-flex items-center justify-center">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-gold-300/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-gold-400 border-r-gold-200" />
                <div className="absolute inset-2 rounded-full bg-black/70" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-gold-100">Completing sign in</h1>
              <p className="text-sm text-gray-300">{loadingSteps[activeStepIndex]}...</p>
            </div>

            <div className="space-y-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-gold-300 via-gold-400 to-gold-300 transition-all duration-500 ${progressWidthClass}`}
                />
              </div>

              <div className="flex items-center justify-center gap-2">
                {loadingSteps.map((_, index) => (
                  <span
                    key={index}
                    className={`h-2 w-2 rounded-full transition-all duration-300 ${
                      index <= activeStepIndex ? "bg-gold-300" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>

            {elapsedMs > 9000 && (
              <button
                type="button"
                onClick={() => navigate("/customer/shop", { replace: true })}
                className="inline-flex items-center justify-center rounded-full border border-gold-300/40 bg-gold-500/10 px-4 py-2 text-sm font-medium text-gold-200 transition hover:border-gold-200 hover:bg-gold-500/20 hover:text-gold-100"
              >
                Continue manually
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

