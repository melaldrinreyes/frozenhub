import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Image as ImageIcon,
  Upload,
  X,
  Type,
  AlignLeft,
  Save,
  Eye,
  Users,
  Award,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminCMS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Fetch all hero page settings
  const { data: heroBannerData } = useQuery({
    queryKey: ["setting", "hero_banner"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("hero_banner");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: heroTitleData } = useQuery({
    queryKey: ["setting", "hero_title"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("hero_title");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: heroSubtitleData } = useQuery({
    queryKey: ["setting", "hero_subtitle"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("hero_subtitle");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: heroDescriptionData } = useQuery({
    queryKey: ["setting", "hero_description"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("hero_description");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  // About Us Settings
  const { data: aboutTitleData } = useQuery({
    queryKey: ["setting", "about_title"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("about_title");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: aboutDescriptionData } = useQuery({
    queryKey: ["setting", "about_description"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("about_description");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: aboutMissionData } = useQuery({
    queryKey: ["setting", "about_mission"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("about_mission");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: aboutValuesData } = useQuery({
    queryKey: ["setting", "about_values"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("about_values");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  // Footer Settings
  const { data: footerDescriptionData } = useQuery({
    queryKey: ["setting", "footer_description"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("footer_description");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: footerEmailData } = useQuery({
    queryKey: ["setting", "footer_email"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("footer_email");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: footerPhoneData } = useQuery({
    queryKey: ["setting", "footer_phone"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("footer_phone");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: footerAddressData } = useQuery({
    queryKey: ["setting", "footer_address"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("footer_address");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: footerCopyrightData } = useQuery({
    queryKey: ["setting", "footer_copyright"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("footer_copyright");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  // Company Branding Settings
  const { data: companyNameData } = useQuery({
    queryKey: ["setting", "company_name"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("company_name");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: companyLogoData } = useQuery({
    queryKey: ["setting", "company_logo"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("company_logo");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  // Featured Products Background Settings
  const { data: featuredBgTypeData } = useQuery({
    queryKey: ["setting", "featured_bg_type"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("featured_bg_type");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: featuredBgColorData } = useQuery({
    queryKey: ["setting", "featured_bg_color"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("featured_bg_color");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: featuredBgImageData} = useQuery({
    queryKey: ["setting", "featured_bg_image"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("featured_bg_image");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  // Promotional Banner Settings
  const { data: promoTitleData } = useQuery({
    queryKey: ["setting", "promo_title"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_title");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: promoSubtitleData } = useQuery({
    queryKey: ["setting", "promo_subtitle"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_subtitle");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: promoDescriptionData } = useQuery({
    queryKey: ["setting", "promo_description"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_description");
      } catch (error) {
        return { setting: null };
      }
    },
  });



  const { data: promoEnabledData } = useQuery({
    queryKey: ["setting", "promo_enabled"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_enabled");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  const { data: promoBgColorData } = useQuery({
    queryKey: ["setting", "promo_bg_color"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_bg_color");
      } catch (error) {
        return { setting: null };
      }
    },
  });

  // Form states
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroDescription, setHeroDescription] = useState("");
  
  // About Us form states
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutDescription, setAboutDescription] = useState("");
  const [aboutMission, setAboutMission] = useState("");
  const [aboutValues, setAboutValues] = useState("");
  
  // Footer form states
  const [footerDescription, setFooterDescription] = useState("");
  const [footerEmail, setFooterEmail] = useState("");
  const [footerPhone, setFooterPhone] = useState("");
  const [footerAddress, setFooterAddress] = useState("");
  const [footerCopyright, setFooterCopyright] = useState("");
  
  // Company Branding form states
  const [companyName, setCompanyName] = useState("");

  // Featured Products Background form states
  const [featuredBgType, setFeaturedBgType] = useState("color"); // 'color' or 'image'
  const [featuredBgColor, setFeaturedBgColor] = useState("#f9fafb"); // default gray-50
  const [selectedFeaturedBgFile, setSelectedFeaturedBgFile] = useState<File | null>(null);
  const [featuredBgPreview, setFeaturedBgPreview] = useState<string | null>(null);

  // Promotional Banner form states
  const [promoTitle, setPromoTitle] = useState("");
  const [promoSubtitle, setPromoSubtitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");

  const [promoEnabled, setPromoEnabled] = useState(true);
  const [promoBgColor, setPromoBgColor] = useState("#d97706"); // default gold-600

  // Initialize form with current values
  useState(() => {
    if (heroTitleData?.setting?.setting_value) {
      setHeroTitle(heroTitleData.setting.setting_value);
    }
    if (heroSubtitleData?.setting?.setting_value) {
      setHeroSubtitle(heroSubtitleData.setting.setting_value);
    }
    if (heroDescriptionData?.setting?.setting_value) {
      setHeroDescription(heroDescriptionData.setting.setting_value);
    }
    if (aboutTitleData?.setting?.setting_value) {
      setAboutTitle(aboutTitleData.setting.setting_value);
    }
    if (aboutDescriptionData?.setting?.setting_value) {
      setAboutDescription(aboutDescriptionData.setting.setting_value);
    }
    if (aboutMissionData?.setting?.setting_value) {
      setAboutMission(aboutMissionData.setting.setting_value);
    }
    if (aboutValuesData?.setting?.setting_value) {
      setAboutValues(aboutValuesData.setting.setting_value);
    }
    if (companyNameData?.setting?.setting_value) {
      setCompanyName(companyNameData.setting.setting_value);
    }
    if (featuredBgTypeData?.setting?.setting_value) {
      setFeaturedBgType(featuredBgTypeData.setting.setting_value);
    }
    if (featuredBgColorData?.setting?.setting_value) {
      setFeaturedBgColor(featuredBgColorData.setting.setting_value);
    }
    if (promoTitleData?.setting?.setting_value) {
      setPromoTitle(promoTitleData.setting.setting_value);
    }
    if (promoSubtitleData?.setting?.setting_value) {
      setPromoSubtitle(promoSubtitleData.setting.setting_value);
    }
    if (promoDescriptionData?.setting?.setting_value) {
      setPromoDescription(promoDescriptionData.setting.setting_value);
    }

    if (promoEnabledData?.setting?.setting_value !== undefined) {
      setPromoEnabled(promoEnabledData.setting.setting_value === "true" || promoEnabledData.setting.setting_value === true);
    }
    if (promoBgColorData?.setting?.setting_value) {
      setPromoBgColor(promoBgColorData.setting.setting_value);
    }
  });

  const currentBanner = heroBannerData?.setting?.setting_value;
  const currentLogo = companyLogoData?.setting?.setting_value;
  const currentFeaturedBgImage = featuredBgImageData?.setting?.setting_value;

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
        description: "Hero banner uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "hero_banner"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
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
      const currentBanner = heroBannerData?.setting?.setting_value;
      if (currentBanner) {
        await apiClient.deleteBanner(currentBanner);
        await apiClient.deleteSetting("hero_banner");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Hero banner removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "hero_banner"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploadResult = await apiClient.uploadBanner(file);
      await apiClient.updateSetting("company_logo", uploadResult.imagePath);
      return uploadResult;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company logo uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "company_logo"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
      setSelectedLogoFile(null);
      setLogoPreview(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete logo mutation
  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      const currentLogo = companyLogoData?.setting?.setting_value;
      if (currentLogo) {
        await apiClient.deleteBanner(currentLogo);
        await apiClient.deleteSetting("company_logo");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company logo removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "company_logo"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload featured background image mutation
  const uploadFeaturedBgMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploadResult = await apiClient.uploadBanner(file);
      await apiClient.updateSetting("featured_bg_image", uploadResult.imagePath);
      return uploadResult;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Featured Products background image uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "featured_bg_image"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
      setSelectedFeaturedBgFile(null);
      setFeaturedBgPreview(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete featured background image mutation
  const deleteFeaturedBgMutation = useMutation({
    mutationFn: async () => {
      const currentImage = featuredBgImageData?.setting?.setting_value;
      if (currentImage) {
        await apiClient.deleteBanner(currentImage);
        await apiClient.deleteSetting("featured_bg_image");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Featured Products background image removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", "featured_bg_image"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "all"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update text content mutation
  const updateTextMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      await apiClient.updateSetting(data.key, data.value);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: "Hero content updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["setting", variables.key] });
      queryClient.invalidateQueries({ queryKey: ["settings", "all"] }); // Invalidate customer home cache
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

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setSelectedLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = () => {
    if (selectedLogoFile) {
      uploadLogoMutation.mutate(selectedLogoFile);
    }
  };

  const handleSaveCompanyBranding = () => {
    const updates = [];
    
    if (companyName !== companyNameData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "company_name", value: companyName }));
    }

    if (updates.length > 0) {
      Promise.all(updates).then(() => {
        toast({
          title: "Success",
          description: "Company branding updated successfully",
        });
      });
    } else {
      toast({
        title: "No changes",
        description: "No content changes detected",
      });
    }
  };

  const handleFeaturedBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFeaturedBgFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFeaturedBgPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadFeaturedBg = () => {
    if (selectedFeaturedBgFile) {
      uploadFeaturedBgMutation.mutate(selectedFeaturedBgFile);
    }
  };

  const handleSaveFeaturedBackground = () => {
    const updates = [];
    
    if (featuredBgType !== featuredBgTypeData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "featured_bg_type", value: featuredBgType }));
    }
    if (featuredBgColor !== featuredBgColorData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "featured_bg_color", value: featuredBgColor }));
    }

    if (updates.length > 0) {
      Promise.all(updates).then(() => {
        toast({
          title: "Success",
          description: "Featured Products background updated successfully",
        });
      });
    } else {
      toast({
        title: "No changes",
        description: "No background changes detected",
      });
    }
  };

  const handleSaveTextContent = () => {
    const updates = [];
    
    if (heroTitle !== heroTitleData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "hero_title", value: heroTitle }));
    }
    if (heroSubtitle !== heroSubtitleData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "hero_subtitle", value: heroSubtitle }));
    }
    if (heroDescription !== heroDescriptionData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "hero_description", value: heroDescription }));
    }

    if (updates.length > 0) {
      Promise.all(updates);
    } else {
      toast({
        title: "No changes",
        description: "No content changes detected",
      });
    }
  };

  const handleSaveAboutUs = () => {
    const updates = [];
    
    if (aboutTitle !== aboutTitleData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "about_title", value: aboutTitle }));
    }
    if (aboutDescription !== aboutDescriptionData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "about_description", value: aboutDescription }));
    }
    if (aboutMission !== aboutMissionData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "about_mission", value: aboutMission }));
    }
    if (aboutValues !== aboutValuesData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "about_values", value: aboutValues }));
    }

    if (updates.length > 0) {
      Promise.all(updates).then(() => {
        toast({
          title: "Success",
          description: "About Us section updated successfully",
        });
      });
    } else {
      toast({
        title: "No changes",
        description: "No content changes detected",
      });
    }
  };

  const handleSaveFooter = () => {
    const updates = [];
    
    // Only update if value is not empty and different from current
    if (footerDescription && footerDescription !== footerDescriptionData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "footer_description", value: footerDescription }));
    }
    if (footerEmail && footerEmail !== footerEmailData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "footer_email", value: footerEmail }));
    }
    if (footerPhone && footerPhone !== footerPhoneData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "footer_phone", value: footerPhone }));
    }
    if (footerAddress && footerAddress !== footerAddressData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "footer_address", value: footerAddress }));
    }
    if (footerCopyright && footerCopyright !== footerCopyrightData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "footer_copyright", value: footerCopyright }));
    }

    if (updates.length > 0) {
      Promise.all(updates).then(() => {
        toast({
          title: "Success",
          description: "Footer settings updated successfully",
        });
        // Clear form fields after successful save
        setFooterDescription("");
        setFooterEmail("");
        setFooterPhone("");
        setFooterAddress("");
        setFooterCopyright("");
      });
    } else {
      toast({
        title: "No changes",
        description: "Please enter values to update footer settings",
      });
    }
  };

  const handleSavePromoContent = () => {
    const updates = [];
    
    if (promoTitle !== promoTitleData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "promo_title", value: promoTitle }));
    }
    if (promoSubtitle !== promoSubtitleData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "promo_subtitle", value: promoSubtitle }));
    }
    if (promoDescription !== promoDescriptionData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "promo_description", value: promoDescription }));
    }

    const promoEnabledStr = String(promoEnabled);
    if (promoEnabledStr !== promoEnabledData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "promo_enabled", value: promoEnabledStr }));
    }
    if (promoBgColor !== promoBgColorData?.setting?.setting_value) {
      updates.push(updateTextMutation.mutateAsync({ key: "promo_bg_color", value: promoBgColor }));
    }

    if (updates.length > 0) {
      Promise.all(updates).then(() => {
        toast({
          title: "Success",
          description: "Promotional banner updated successfully",
        });
      });
    } else {
      toast({
        title: "No changes",
        description: "No content changes detected",
      });
    }
  };

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Content Management
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Manage hero page content, images, and text
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => window.open("/", "_blank")}
              variant="outline"
              className="gap-2 text-sm sm:text-base"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview Landing Page</span>
              <span className="sm:hidden">Landing</span>
            </Button>
            <Button
              onClick={() => {
                // Open customer shop in new tab
                const url = window.location.origin + "/customer/shop";
                window.open(url, "_blank");
              }}
              variant="outline"
              className="gap-2 border-gold-500 text-gold-600 hover:bg-gold-50 text-sm sm:text-base"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Preview Customer View</span>
              <span className="sm:hidden">Customer</span>
            </Button>
          </div>
        </div>

        {/* Hero Banner Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-gold-500" />
              Hero Background Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Banner */}
            {currentBanner && (
              <div>
                <Label>Current Background</Label>
                <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={currentBanner}
                    alt="Current hero banner"
                    className="w-full h-48 sm:h-64 object-cover"
                  />
                </div>
              </div>
            )}

            {/* Preview Selected Banner */}
            {bannerPreview && (
              <div>
                <Label>Preview New Background</Label>
                <div className="mt-2 relative rounded-lg overflow-hidden border border-gold-300">
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    className="w-full h-48 sm:h-64 object-cover"
                  />
                </div>
              </div>
            )}

            {/* File Selection */}
            <div>
              <Label htmlFor="bannerFile">Select Background Image</Label>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <Input
                  id="bannerFile"
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFileChange}
                  disabled={uploadBannerMutation.isPending}
                  className="flex-1"
                />
                {selectedBannerFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedBannerFile(null);
                      setBannerPreview(null);
                    }}
                    className="self-start sm:self-auto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Recommended: 1920x600px or wider, max 10MB. Formats: JPG, PNG,
                WebP, GIF
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleUploadBanner}
                disabled={!selectedBannerFile || uploadBannerMutation.isPending}
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadBannerMutation.isPending
                  ? "Uploading..."
                  : "Upload Background"}
              </Button>
              {currentBanner && (
                <Button
                  variant="destructive"
                  onClick={() => deleteBannerMutation.mutate()}
                  disabled={deleteBannerMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {deleteBannerMutation.isPending
                    ? "Removing..."
                    : "Remove Background"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Hero Text Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-gold-500" />
              Hero Text Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hero Title */}
            <div className="space-y-2">
              <Label htmlFor="heroTitle">Hero Title</Label>
              <Input
                id="heroTitle"
                placeholder="e.g., Premium Frozen Foods"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-sm text-gray-500">
                Main heading displayed on the hero section (max 100 characters)
              </p>
            </div>

            {/* Hero Subtitle */}
            <div className="space-y-2">
              <Label htmlFor="heroSubtitle">Hero Subtitle/Highlight</Label>
              <Input
                id="heroSubtitle"
                placeholder="e.g., Premium"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                maxLength={50}
              />
              <p className="text-sm text-gray-500">
                Highlighted text (usually shown in gold/accent color, max 50
                characters)
              </p>
            </div>

            {/* Hero Description */}
            <div className="space-y-2">
              <Label htmlFor="heroDescription">Hero Description</Label>
              <Textarea
                id="heroDescription"
                placeholder="e.g., Quality frozen products delivered to your door. Browse our extensive catalog..."
                value={heroDescription}
                onChange={(e) => setHeroDescription(e.target.value)}
                rows={4}
                maxLength={300}
              />
              <p className="text-sm text-gray-500">
                Supporting text below the title (max 300 characters)
              </p>
            </div>

            {/* Save Button */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                onClick={handleSaveTextContent}
                disabled={updateTextMutation.isPending}
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTextMutation.isPending ? "Saving..." : "Save Text Content"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setHeroTitle(heroTitleData?.setting?.setting_value || "");
                  setHeroSubtitle(heroSubtitleData?.setting?.setting_value || "");
                  setHeroDescription(
                    heroDescriptionData?.setting?.setting_value || ""
                  );
                }}
                className="w-full sm:w-auto"
              >
                Reset to Current
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Company Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-gold-500" />
              Company Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="e.g., Batangas Premium Bongabong"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={50}
              />
              <p className="text-sm text-gray-500">
                Your company name displayed in header and footer (max 50 characters). Leave empty to hide.
              </p>
            </div>

            {/* Current Logo */}
            {currentLogo && (
              <div>
                <Label>Current Logo</Label>
                <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-200 p-4 bg-gray-50 flex justify-center">
                  <img
                    src={currentLogo}
                    alt="Current company logo"
                    className="h-12 sm:h-16 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Preview Selected Logo */}
            {logoPreview && (
              <div>
                <Label>Preview New Logo</Label>
                <div className="mt-2 relative rounded-lg overflow-hidden border border-gold-300 p-4 bg-gray-50 flex justify-center">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-12 sm:h-16 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Logo File Selection */}
            <div>
              <Label htmlFor="logoFile">Company Logo</Label>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <Input
                  id="logoFile"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  disabled={uploadLogoMutation.isPending}
                  className="flex-1"
                />
                {selectedLogoFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedLogoFile(null);
                      setLogoPreview(null);
                    }}
                    className="self-start sm:self-auto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Recommended: Square image (e.g., 200x200px), max 5MB. Formats: JPG, PNG, WebP, SVG
              </p>
            </div>

            {/* Logo Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleUploadLogo}
                disabled={!selectedLogoFile || uploadLogoMutation.isPending}
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadLogoMutation.isPending
                  ? "Uploading..."
                  : "Upload Logo"}
              </Button>
              {currentLogo && (
                <Button
                  variant="destructive"
                  onClick={() => deleteLogoMutation.mutate()}
                  disabled={deleteLogoMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {deleteLogoMutation.isPending
                    ? "Removing..."
                    : "Remove Logo"}
                </Button>
              )}
            </div>

            {/* Save Company Name */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button
                onClick={handleSaveCompanyBranding}
                disabled={updateTextMutation.isPending}
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTextMutation.isPending ? "Saving..." : "Save Company Name"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCompanyName(companyNameData?.setting?.setting_value || "");
                }}
                className="w-full sm:w-auto"
              >
                Reset to Current
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Featured Products Background */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-gold-500" />
              Featured Products Background
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Background Type Selection */}
            <div className="space-y-2">
              <Label>Background Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="featuredBgType"
                    id="featured-bg-color"
                    value="color"
                    checked={featuredBgType === "color"}
                    onChange={(e) => setFeaturedBgType(e.target.value)}
                    className="text-gold-500"
                  />
                  <span>Solid Color</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="featuredBgType"
                    id="featured-bg-image"
                    value="image"
                    checked={featuredBgType === "image"}
                    onChange={(e) => setFeaturedBgType(e.target.value)}
                    className="text-gold-500"
                  />
                  <span>Background Image</span>
                </label>
              </div>
            </div>

            {/* Color Picker (shown when type is 'color') */}
            {featuredBgType === "color" && (
              <div className="space-y-2">
                <Label htmlFor="featuredBgColor">Background Color</Label>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <Input
                    id="featuredBgColor"
                    type="color"
                    value={featuredBgColor}
                    onChange={(e) => setFeaturedBgColor(e.target.value)}
                    className="w-full sm:w-24 h-10"
                  />
                  <Input
                    type="text"
                    value={featuredBgColor}
                    onChange={(e) => setFeaturedBgColor(e.target.value)}
                    placeholder="#f9fafb"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs sm:text-sm text-gray-500">
                  Choose a background color for the Featured Products section
                </p>
              </div>
            )}

            {/* Background Image Upload (shown when type is 'image') */}
            {featuredBgType === "image" && (
              <>
                {/* Current Background Image */}
                {currentFeaturedBgImage && !featuredBgPreview && (
                  <div>
                    <Label>Current Background</Label>
                    <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-300">
                      <img
                        src={currentFeaturedBgImage}
                        alt="Current featured background"
                        className="w-full h-24 sm:h-32 object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Preview New Background */}
                {featuredBgPreview && (
                  <div>
                    <Label>Preview New Background</Label>
                    <div className="mt-2 relative rounded-lg overflow-hidden border border-gold-300">
                      <img
                        src={featuredBgPreview}
                        alt="Background preview"
                        className="w-full h-24 sm:h-32 object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* File Selection */}
                <div>
                  <Label htmlFor="featuredBgFile">Background Image</Label>
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <Input
                      id="featuredBgFile"
                      type="file"
                      accept="image/*"
                      onChange={handleFeaturedBgFileChange}
                      disabled={uploadFeaturedBgMutation.isPending}
                      className="flex-1"
                    />
                    {selectedFeaturedBgFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedFeaturedBgFile(null);
                          setFeaturedBgPreview(null);
                        }}
                        className="self-start sm:self-auto"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Upload a background image for the Featured Products section (max 10MB)
                  </p>
                </div>

                {/* Upload/Remove Buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleUploadFeaturedBg}
                    disabled={!selectedFeaturedBgFile || uploadFeaturedBgMutation.isPending}
                    className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadFeaturedBgMutation.isPending
                      ? "Uploading..."
                      : "Upload Background"}
                  </Button>
                  {currentFeaturedBgImage && (
                    <Button
                      variant="destructive"
                      onClick={() => deleteFeaturedBgMutation.mutate()}
                      disabled={deleteFeaturedBgMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {deleteFeaturedBgMutation.isPending
                        ? "Removing..."
                        : "Remove Background"}
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Save Settings */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button
                onClick={handleSaveFeaturedBackground}
                disabled={updateTextMutation.isPending}
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTextMutation.isPending ? "Saving..." : "Save Background Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFeaturedBgType(featuredBgTypeData?.setting?.setting_value || "color");
                  setFeaturedBgColor(featuredBgColorData?.setting?.setting_value || "#f9fafb");
                }}
                className="w-full sm:w-auto"
              >
                Reset to Current
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Promotional Banner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-gold-500" />
              Promotional Banner
            </CardTitle>
            <p className="text-sm text-gray-500">
              Customize the promotional banner displayed on your homepage
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className={`flex items-center justify-between p-4 border-2 rounded-lg transition-all ${
              promoEnabled 
                ? 'border-green-500 bg-green-50' 
                : 'border-red-500 bg-red-50'
            }`}>
              <div className="space-y-0.5">
                <Label htmlFor="promoEnabled" className="flex items-center gap-2">
                  <span>Display Banner</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    promoEnabled 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {promoEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </Label>
                <p className="text-sm text-gray-600">
                  {promoEnabled 
                    ? 'The promotional banner is currently visible on the homepage' 
                    : 'The promotional banner is currently hidden from the homepage'}
                </p>
              </div>
              <Switch
                id="promoEnabled"
                checked={promoEnabled}
                onCheckedChange={setPromoEnabled}
                className="data-[state=unchecked]:bg-red-400"
              />
            </div>

            {/* Background Color */}
            <div className="space-y-2">
              <Label htmlFor="promoBgColor">Background Color</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="color"
                  id="promoBgColor"
                  value={promoBgColor}
                  onChange={(e) => setPromoBgColor(e.target.value)}
                  className="w-full sm:w-20 h-10"
                />
                <Input
                  type="text"
                  placeholder="#d97706"
                  value={promoBgColor}
                  onChange={(e) => setPromoBgColor(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-xs sm:text-sm text-gray-500">
                Choose the gradient color for the banner background
              </p>
            </div>

            {/* Promo Subtitle (Badge Text) */}
            <div className="space-y-2">
              <Label htmlFor="promoSubtitle">Badge Text</Label>
              <Input
                id="promoSubtitle"
                placeholder="e.g., Limited Time Offer"
                value={promoSubtitle}
                onChange={(e) => setPromoSubtitle(e.target.value)}
                maxLength={50}
              />
              <p className="text-sm text-gray-500">
                Small text shown in the badge (max 50 characters)
              </p>
            </div>

            {/* Promo Title */}
            <div className="space-y-2">
              <Label htmlFor="promoTitle">Main Title</Label>
              <Input
                id="promoTitle"
                placeholder="e.g., Special Holiday Sale!"
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-sm text-gray-500">
                Main heading of the promotional banner (max 100 characters)
              </p>
            </div>

            {/* Promo Description */}
            <div className="space-y-2">
              <Label htmlFor="promoDescription">Description</Label>
              <Textarea
                id="promoDescription"
                placeholder="e.g., Get up to 30% OFF on selected frozen products. Stock up now for the holidays!"
                value={promoDescription}
                onChange={(e) => setPromoDescription(e.target.value)}
                maxLength={300}
                rows={4}
              />
              <p className="text-sm text-gray-500">
                Promotional message (max 300 characters). Use HTML tags like {'<span class="font-bold">text</span>'} for emphasis
              </p>
            </div>



            {/* Save Button */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button
                onClick={handleSavePromoContent}
                disabled={updateTextMutation.isPending}
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTextMutation.isPending ? "Saving..." : "Save Promotional Content"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPromoTitle(promoTitleData?.setting?.setting_value || "");
                  setPromoSubtitle(promoSubtitleData?.setting?.setting_value || "");
                  setPromoDescription(promoDescriptionData?.setting?.setting_value || "");
                  setPromoEnabled(promoEnabledData?.setting?.setting_value === "true" || promoEnabledData?.setting?.setting_value === true);
                  setPromoBgColor(promoBgColorData?.setting?.setting_value || "#d97706");
                }}
                className="w-full sm:w-auto"
              >
                Reset to Current
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* About Us Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold-500" />
              About Us Section
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* About Us Title */}
            <div className="space-y-2">
              <Label htmlFor="aboutTitle">Section Title</Label>
              <Input
                id="aboutTitle"
                placeholder="e.g., About Batangas Premium Bongabong"
                value={aboutTitle}
                onChange={(e) => setAboutTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-sm text-gray-500">
                Main heading for the About Us section (max 100 characters)
              </p>
            </div>

            {/* About Us Description */}
            <div className="space-y-2">
              <Label htmlFor="aboutDescription">Opening Description</Label>
              <Textarea
                id="aboutDescription"
                placeholder="e.g., At Batangas Premium Bongabong, we've been delivering premium quality frozen products..."
                value={aboutDescription}
                onChange={(e) => setAboutDescription(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-sm text-gray-500">
                Introduction text that appears first in the About Us section (max 500 characters)
              </p>
            </div>

            {/* Mission Statement */}
            <div className="space-y-2">
              <Label htmlFor="aboutMission">Mission Statement</Label>
              <Textarea
                id="aboutMission"
                placeholder="e.g., To provide the highest quality frozen goods to Filipino families..."
                value={aboutMission}
                onChange={(e) => setAboutMission(e.target.value)}
                rows={3}
                maxLength={300}
              />
              <p className="text-sm text-gray-500">
                Your company's mission statement (max 300 characters)
              </p>
            </div>

            {/* Values Statement */}
            <div className="space-y-2">
              <Label htmlFor="aboutValues">Core Values</Label>
              <Textarea
                id="aboutValues"
                placeholder="e.g., We believe in quality, freshness, and customer satisfaction..."
                value={aboutValues}
                onChange={(e) => setAboutValues(e.target.value)}
                rows={3}
                maxLength={300}
              />
              <p className="text-sm text-gray-500">
                Your company's core values (max 300 characters)
              </p>
            </div>

            {/* Save Button */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                onClick={handleSaveAboutUs}
                disabled={updateTextMutation.isPending}
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTextMutation.isPending ? "Saving..." : "Save About Us"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAboutTitle(aboutTitleData?.setting?.setting_value || "");
                  setAboutDescription(aboutDescriptionData?.setting?.setting_value || "");
                  setAboutMission(aboutMissionData?.setting?.setting_value || "");
                  setAboutValues(aboutValuesData?.setting?.setting_value || "");
                }}
                className="w-full sm:w-auto"
              >
                Reset to Current
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlignLeft className="h-5 w-5 text-gold-500" />
              Footer Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Description */}
            <div>
              <Label htmlFor="footer_description">Company Description</Label>
              {footerDescriptionData?.setting?.setting_value && (
                <p className="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded border">
                  <strong>Current:</strong> {footerDescriptionData.setting.setting_value}
                </p>
              )}
              <Textarea
                id="footer_description"
                placeholder={footerDescriptionData?.setting?.setting_value || "Premium quality frozen products delivered to Filipino families..."}
                className="mt-2"
                rows={3}
                value={footerDescription}
                onChange={(e) => setFooterDescription(e.target.value)}
                maxLength={200}
              />
              <p className="text-sm text-gray-500 mt-1">
                Brief description about your company shown in the footer (max 200 characters)
              </p>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Contact Information</h3>
              
              <div>
                <Label htmlFor="footer_email">Email Address</Label>
                {footerEmailData?.setting?.setting_value && (
                  <p className="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded border">
                    <strong>Current:</strong> {footerEmailData.setting.setting_value}
                  </p>
                )}
                <Input
                  id="footer_email"
                  type="email"
                  placeholder={footerEmailData?.setting?.setting_value || "info@batangaspremium.com"}
                  className="mt-2"
                  value={footerEmail}
                  onChange={(e) => setFooterEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="footer_phone">Phone Number</Label>
                {footerPhoneData?.setting?.setting_value && (
                  <p className="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded border">
                    <strong>Current:</strong> {footerPhoneData.setting.setting_value}
                  </p>
                )}
                <Input
                  id="footer_phone"
                  type="tel"
                  placeholder={footerPhoneData?.setting?.setting_value || "+63 912 345 6789"}
                  className="mt-2"
                  value={footerPhone}
                  onChange={(e) => setFooterPhone(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="footer_address">Physical Address</Label>
                {footerAddressData?.setting?.setting_value && (
                  <p className="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded border">
                    <strong>Current:</strong> {footerAddressData.setting.setting_value}
                  </p>
                )}
                <Input
                  id="footer_address"
                  placeholder={footerAddressData?.setting?.setting_value || "Batangas City, Philippines"}
                  className="mt-2"
                  value={footerAddress}
                  onChange={(e) => setFooterAddress(e.target.value)}
                />
              </div>
            </div>

            {/* Copyright Text */}
            <div>
              <Label htmlFor="footer_copyright">Copyright Text</Label>
              {footerCopyrightData?.setting?.setting_value && (
                <p className="text-sm text-gray-600 mt-1 p-2 bg-gray-50 rounded border">
                  <strong>Current:</strong> {footerCopyrightData.setting.setting_value}
                </p>
              )}
              <Input
                id="footer_copyright"
                placeholder={footerCopyrightData?.setting?.setting_value || "Batangas Premium Bongabong. All rights reserved."}
                className="mt-2"
                value={footerCopyright}
                onChange={(e) => setFooterCopyright(e.target.value)}
                maxLength={100}
              />
              <p className="text-sm text-gray-500 mt-1">
                Text shown at the bottom of the footer (year will be added automatically, max 100 characters)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                onClick={handleSaveFooter}
                disabled={updateTextMutation.isPending}
                className="w-full sm:w-auto bg-gold-500 hover:bg-gold-600 text-black"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTextMutation.isPending ? "Saving..." : "Save Footer Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFooterDescription(footerDescriptionData?.setting?.setting_value || "");
                  setFooterEmail(footerEmailData?.setting?.setting_value || "");
                  setFooterPhone(footerPhoneData?.setting?.setting_value || "");
                  setFooterAddress(footerAddressData?.setting?.setting_value || "");
                  setFooterCopyright(footerCopyrightData?.setting?.setting_value || "");
                }}
                className="w-full sm:w-auto"
              >
                Reset to Current
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <AlignLeft className="h-5 w-5" />
              CMS Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800 space-y-2">
            <p>
              <strong>Hero Background:</strong> Use high-quality images that
              represent your brand. Wide landscape images work best.
            </p>
            <p>
              <strong>Text Content:</strong> Keep titles short and impactful.
              Descriptions should be clear and concise.
            </p>
            <p>
              <strong>About Us:</strong> Share your company story, mission, and values. 
              Be authentic and emphasize what makes your business unique.
            </p>
            <p>
              <strong>Preview:</strong> Click "Preview Homepage" to see your
              changes live on the site.
            </p>
            <p>
              <strong>Best Practice:</strong> Update content during off-peak
              hours for minimal user disruption.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
