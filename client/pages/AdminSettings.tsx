import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import ChangePassword from "@/components/ChangePassword";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Save,
  Database,
  Shield,
  CheckCircle,
  Image as ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  
  // Fetch hero banner setting
  const { data: bannerData } = useQuery({
    queryKey: ["setting", "hero_banner"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("hero_banner");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  // Upload banner mutation
  const uploadBannerMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploadResult = await apiClient.uploadBanner(file);
      await apiClient.updateSetting("hero_banner", uploadResult.imagePath);
      return uploadResult;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Banner uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "hero_banner"] });
      setSelectedBannerFile(null);
      setBannerPreview(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete banner mutation
  const deleteBannerMutation = useMutation({
    mutationFn: async () => {
      const currentBanner = bannerData?.setting?.setting_value;
      if (currentBanner) {
        await apiClient.deleteBanner(currentBanner);
        await apiClient.deleteSetting("hero_banner");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Banner removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "hero_banner"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      setSelectedBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadBanner = () => {
    if (selectedBannerFile) {
      uploadBannerMutation.mutate(selectedBannerFile);
    }
  };

  const currentBanner = bannerData?.setting?.setting_value;

  // Fetch all admin settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["adminSettings"],
    queryFn: async () => {
      try {
        const response = await apiClient.getSettingsByKeys([
          "company_name",
          "company_email",
          "company_phone",
          "company_address",
          "tax_rate",
          "low_stock_threshold",
        ]);
        return response;
      } catch (error) {
        return {};
      }
    },
  });

  const [settings, setSettings] = useState({
    companyName: "",
    companyEmail: "",
    phone: "",
    address: "",
    taxRate: 12,
    lowStockThreshold: 50,
  });

  // Update settings when data loads
  useEffect(() => {
    if (settingsData) {
      setSettings({
        companyName: settingsData.company_name?.setting_value || "Batangas Premium Bongabong",
        companyEmail: settingsData.company_email?.setting_value || "admin@batangaspremium.com",
        phone: settingsData.company_phone?.setting_value || "+63-123-456-7890",
        address: settingsData.company_address?.setting_value || "Batangas City, Philippines",
        taxRate: parseFloat(settingsData.tax_rate?.setting_value) || 12,
        lowStockThreshold: parseInt(settingsData.low_stock_threshold?.setting_value) || 50,
      });
    }
  }, [settingsData]);

  const [savedMessage, setSavedMessage] = useState(false);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "company_name", value: settings.companyName },
        { key: "company_email", value: settings.companyEmail },
        { key: "company_phone", value: settings.phone },
        { key: "company_address", value: settings.address },
        { key: "tax_rate", value: settings.taxRate.toString() },
        { key: "low_stock_threshold", value: settings.lowStockThreshold.toString() },
      ];

      for (const update of updates) {
        await apiClient.updateSetting(update.key, update.value);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["adminSettings"] });
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate();
  };

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-600 mt-2">
            Configure global system settings and preferences
          </p>
        </div>

        {/* Success Message */}
        {savedMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">
              Settings saved successfully
            </p>
          </div>
        )}

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  value={settings.companyName}
                  onChange={(e) =>
                    setSettings({ ...settings, companyName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Company Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.companyEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, companyEmail: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={settings.phone}
                  onChange={(e) =>
                    setSettings({ ...settings, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={settings.address}
                  onChange={(e) =>
                    setSettings({ ...settings, address: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hero Banner Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Hero Banner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Banner */}
            {currentBanner && (
              <div>
                <Label>Current Banner</Label>
                <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={currentBanner}
                    alt="Current hero banner"
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}

            {/* Preview Selected Banner */}
            {bannerPreview && (
              <div>
                <Label>Preview</Label>
                <div className="mt-2 relative rounded-lg overflow-hidden border border-blue-300">
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    className="w-full h-48 object-cover"
                  />
                </div>
              </div>
            )}

            {/* File Selection */}
            <div>
              <Label htmlFor="bannerFile">Select Banner Image</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="bannerFile"
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFileChange}
                  disabled={uploadBannerMutation.isPending}
                />
                {selectedBannerFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedBannerFile(null);
                      setBannerPreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Recommended: 1920x600px, max 10MB. Formats: JPG, PNG, WebP, GIF
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUploadBanner}
                disabled={!selectedBannerFile || uploadBannerMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadBannerMutation.isPending ? "Uploading..." : "Upload Banner"}
              </Button>
              {currentBanner && (
                <Button
                  variant="destructive"
                  onClick={() => deleteBannerMutation.mutate()}
                  disabled={deleteBannerMutation.isPending}
                >
                  {deleteBannerMutation.isPending ? "Deleting..." : "Remove Banner"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Business Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Business Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax">Tax Rate (%)</Label>
                <Input
                  id="tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.taxRate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      taxRate: parseFloat(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-slate-500">
                  Philippine VAT is 12%
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="threshold">Low Stock Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  value={settings.lowStockThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      lowStockThreshold: parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-slate-500">
                  Alert when stock falls below this number
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-600 uppercase font-semibold">
                  System Version
                </p>
                <p className="text-lg font-semibold text-slate-900">v2.1.0</p>
              </div>

              <div>
                <p className="text-xs text-slate-600 uppercase font-semibold">
                  Database
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  MySQL (frozenhub_pos)
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600 uppercase font-semibold">
                  Status
                </p>
                <p className="text-lg font-semibold text-green-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                  Operational
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600 uppercase font-semibold">
                  Environment
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {process.env.NODE_ENV === "production" ? "Production" : "Development"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600 uppercase font-semibold">
                  Last Update
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {new Date().toLocaleDateString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600 uppercase font-semibold">
                  Storage Used
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  <span className="text-sm text-slate-600">Loading...</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <ChangePassword />

        {/* Save Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleSaveSettings}
            disabled={saveSettingsMutation.isPending || isLoading}
            className="bg-primary hover:bg-primary/90 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>

          <Button variant="outline" disabled={saveSettingsMutation.isPending}>
            Reset to Default
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}