import { useEffect, useMemo, useState } from "react";
import { CustomerLayout } from "@/components/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/authContext";
import { apiClient } from "@/lib/apiClient";
import { CalendarDays, KeyRound, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";

type ProfileAuthMethods = {
  googleLinked: boolean;
  passwordEnabled: boolean;
};

export default function CustomerProfile() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [authMethods, setAuthMethods] = useState<ProfileAuthMethods>({
    googleLinked: false,
    passwordEnabled: true,
  });

  useEffect(() => {
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await apiClient.getCustomerProfile();
        setName(response.user?.name || "");
        setPhone(response.user?.phone || "");
        setAuthMethods(response.authMethods || { googleLinked: false, passwordEnabled: true });
      } catch (error: any) {
        toast({
          title: "Failed to load profile",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [toast]);

  const memberSince = useMemo(() => {
    if (!user?.created_at) return "-";
    const date = new Date(user.created_at);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [user?.created_at]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) {
      toast({
        title: "Missing fields",
        description: "Name and phone are required.",
        variant: "destructive",
      });
      return;
    }

    setSavingProfile(true);
    try {
      await apiClient.updateCustomerProfile({
        name: name.trim(),
        phone: phone.trim(),
      });
      await refreshUser();
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authMethods.passwordEnabled) {
      toast({
        title: "Password unavailable",
        description: "This account uses Google sign-in.",
        variant: "destructive",
      });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing fields",
        description: "All password fields are required.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Weak password",
        description: "New password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Password change failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Profile Management</h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Manage your account details and security settings.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1 border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Account Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <UserRound className="h-4 w-4 mt-0.5 text-slate-500" />
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="font-medium text-slate-900 break-words">{user?.name || "-"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 text-slate-500" />
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-slate-900 break-all">{user?.email || "-"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-0.5 text-slate-500" />
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium text-slate-900">{phone || user?.phone || "-"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CalendarDays className="h-4 w-4 mt-0.5 text-slate-500" />
                <div>
                  <p className="text-slate-500">Member Since</p>
                  <p className="font-medium text-slate-900">{memberSince}</p>
                </div>
              </div>

              <div className="pt-1 flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200">
                  {user?.role || "customer"}
                </Badge>
                {authMethods.googleLinked && (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Google Linked
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="profile-email">Email Address</Label>
                      <Input id="profile-email" value={user?.email || ""} disabled className="bg-slate-50" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Full Name</Label>
                      <Input
                        id="profile-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        disabled={loadingProfile || savingProfile}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-phone">Phone Number</Label>
                      <Input
                        id="profile-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09xxxxxxxxx"
                        disabled={loadingProfile || savingProfile}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full sm:w-auto" disabled={loadingProfile || savingProfile}>
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <KeyRound className="h-4 w-4" /> Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                {authMethods.passwordEnabled ? (
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          disabled={savingPassword}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={savingPassword}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={savingPassword}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full sm:w-auto" disabled={savingPassword}>
                      {savingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                    <p className="font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Your account uses Google sign-in.
                    </p>
                    <p className="text-sm mt-1">
                      Password change is disabled for Google-linked accounts. Continue using Google to sign in.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
