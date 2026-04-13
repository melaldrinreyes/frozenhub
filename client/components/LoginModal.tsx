import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { signInWithGoogle } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, LogIn, UserPlus, AlertCircle } from "lucide-react";

interface LoginModalProps {
  onClose: () => void;
}


export default function LoginModal({ onClose }: LoginModalProps) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  // Sign-in form
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  // Sign-up form
  const [signUpData, setSignUpData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const errorMessage = err?.message || "Google sign-in failed. Please try again.";
      setError(errorMessage);
      console.error("Google sign-in error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(signInData.email, signInData.password);
      if (user) {
        // Redirect based on role
        if (user.role === "admin") {
          navigate("/admin/dashboard");
        } else if (user.role === "branch_admin") {
          navigate("/branch/dashboard");
        } else if (user.role === "pos_operator") {
          navigate("/pos");
        } else if (user.role === "customer") {
          navigate("/customer/shop");
        } else if (user.role === "rider") {
          navigate("/rider/dashboard");
        }
        onClose();
      }
    } catch (err: any) {
      // Display the actual error message from the server
      const errorMessage = err?.message || "An error occurred. Please try again.";
      setError(errorMessage);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (signUpData.password !== signUpData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (signUpData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const user = await signup(
        signUpData.name,
        signUpData.email,
        signUpData.phone,
        signUpData.password,
      );
      if (user) {
        navigate("/customer/shop");
        onClose();
      }
    } catch (err: any) {
      // Display the actual error message from the server
      const errorMessage = err?.message || "An error occurred. Please try again.";
      setError(errorMessage);
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
          <div>
            <CardTitle className="text-2xl">
              {tab === "signin" ? "Sign In" : "Create Account"}
            </CardTitle>
          </div>
          <button
            onClick={onClose}
            aria-label="Close login modal"
            title="Close"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => {
                setTab("signin");
                setError("");
              }}
              className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${
                tab === "signin"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              Sign In
            </button>
            <button
              onClick={() => {
                setTab("signup");
                setError("");
              }}
              className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${
                tab === "signup"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Sign Up
            </button>
          </div>

          <div className="text-xs uppercase text-slate-500 text-center">Continue with email</div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 justify-center gap-3 border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white text-slate-800 shadow-sm hover:shadow-md hover:border-slate-300 hover:from-slate-50 hover:to-slate-100 transition-all duration-200"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-6.9 0-.6-.1-1.1-.2-1.7H12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.5 0 4.7-.8 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.7-1.7-5.4-4l-3.2 2.5C4.9 19.8 8.2 22 12 22z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.6 14.2c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L3.4 7.7C2.8 8.9 2.5 10 2.5 12s.3 3.1.9 4.3l3.2-2.1z"
                  />
                  <path
                    fill="#4285F4"
                    d="M12 5.8c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.7 2.8 14.5 2 12 2 8.2 2 4.9 4.2 3.4 7.7l3.2 2.5c.7-2.3 2.9-4 5.4-4z"
                  />
                </svg>
              </span>
              <span className="font-semibold tracking-wide">
                {loading ? "Redirecting to Google..." : "Sign in with Google"}
              </span>
            </Button>
            <p className="text-xs text-center text-slate-500">
              Secure Google login. A customer account will be created automatically if needed.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Sign In Form */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Username or Email</Label>
                <Input
                  id="signin-email"
                  type="text"
                  placeholder="Enter username or email"
                  value={signInData.email}
                  onChange={(e) =>
                    setSignInData({ ...signInData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={signInData.password}
                  onChange={(e) =>
                    setSignInData({ ...signInData, password: e.target.value })
                  }
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gold-500 hover:bg-gold-600 text-black font-medium shadow-md hover:shadow-lg transition-all duration-200"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          {/* Sign Up Form */}
          {tab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Your full name"
                  value={signUpData.name}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={signUpData.email}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, email: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  placeholder="Your phone number"
                  value={signUpData.phone}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, phone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signUpData.password}
                  onChange={(e) =>
                    setSignUpData({ ...signUpData, password: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm Password</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={signUpData.confirmPassword}
                  onChange={(e) =>
                    setSignUpData({
                      ...signUpData,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gold-500 hover:bg-gold-600 text-black font-medium shadow-md hover:shadow-lg transition-all duration-200"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
