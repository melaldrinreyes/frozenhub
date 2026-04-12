import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiscountBadge, PriceDisplay, SaleBanner } from "@/components/DiscountBadge";
import {
  Snowflake,
  ShoppingCart,
  Star,
  Shield,
  Clock,
  ChevronRight,
  Package,
  Store,
  Users,
  Target,
  Award,
  Heart,
  Home,
  Grid,
  Info,
  ChevronLeft,
} from "lucide-react";
import LoginModal from "@/components/LoginModal";
import { apiClient } from "@/lib/apiClient";
import useEmblaCarousel from "embla-carousel-react";
import { formatPromoDate, getPromoCountdown, getPromoStatus, formatPromoDescription, formatDiscountDisplay } from "@/lib/discountUtils";
import { getTimeRemaining, formatDate } from "@/lib/dateUtils";

// Helper function to adjust color brightness
const adjustBrightness = (hex: string, percent: number) => {
  // Remove # if present
  const color = hex.replace('#', '');
  
  // Convert to RGB
  const num = parseInt(color, 16);
  const r = (num >> 16) + percent;
  const g = ((num >> 8) & 0x00FF) + percent;
  const b = (num & 0x0000FF) + percent;
  
  // Ensure values are within 0-255
  const newR = Math.max(0, Math.min(255, r));
  const newG = Math.max(0, Math.min(255, g));
  const newB = Math.max(0, Math.min(255, b));
  
  // Convert back to hex
  return `#${((newR << 16) | (newG << 8) | newB).toString(16).padStart(6, '0')}`;
};

export default function Index() {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState("home");
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const promoSectionRef = useRef<HTMLElement | null>(null);
  const featuredSectionRef = useRef<HTMLElement | null>(null);

  // Embla Carousel for Hero/Promo
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: 'start',
    containScroll: 'trimSnaps',
  });

  // Embla Carousel for Products
  const [emblaProductsRef, emblaProductsApi] = useEmblaCarousel({ 
    loop: false, 
    align: 'start',
    containScroll: 'trimSnaps',
    slidesToScroll: 1,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollProductsPrev = useCallback(() => {
    if (emblaProductsApi) emblaProductsApi.scrollPrev();
  }, [emblaProductsApi]);

  const scrollProductsNext = useCallback(() => {
    if (emblaProductsApi) emblaProductsApi.scrollNext();
  }, [emblaProductsApi]);

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
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch hero text content
  const { data: heroTitleData } = useQuery({
    queryKey: ["setting", "hero_title"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("hero_title");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch About Us content
  const { data: aboutTitleData } = useQuery({
    queryKey: ["setting", "about_title"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("about_title");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch Company Branding
  const { data: companyNameData } = useQuery({
    queryKey: ["setting", "company_name"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("company_name");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: featuredBgTypeData } = useQuery({
    queryKey: ["setting", "featured_bg_type"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("featured_bg_type");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: featuredBgImageData } = useQuery({
    queryKey: ["setting", "featured_bg_image"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("featured_bg_image");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: promoButton1TextData } = useQuery({
    queryKey: ["setting", "promo_button1_text"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_button1_text");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: promoButton1LinkData } = useQuery({
    queryKey: ["setting", "promo_button1_link"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_button1_link");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: promoButton2TextData } = useQuery({
    queryKey: ["setting", "promo_button2_text"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_button2_text");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: promoButton2LinkData } = useQuery({
    queryKey: ["setting", "promo_button2_link"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("promo_button2_link");
      } catch (error) {
        return { setting: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
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
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const heroBanner = bannerData?.setting?.setting_value;
  const heroTitle = heroTitleData?.setting?.setting_value || "Frozen Foods";
  const heroSubtitle = heroSubtitleData?.setting?.setting_value || "Premium";
  const heroDescription = heroDescriptionData?.setting?.setting_value || 
    "Quality frozen products delivered to your door. Browse our extensive catalog of meats, seafood, vegetables, and ready-to-eat meals.";

  // Company Branding
  const companyName = companyNameData?.setting?.setting_value || "Batangas Premium Bongabong";
  const companyLogo = companyLogoData?.setting?.setting_value;

  // About Us content with defaults
  const aboutTitle = aboutTitleData?.setting?.setting_value || `About ${companyName}`;
  const aboutDescription = aboutDescriptionData?.setting?.setting_value || 
    `At ${companyName}, we've been delivering premium quality frozen products to Filipino families and businesses since our establishment. Our commitment to excellence and customer satisfaction has made us a trusted name in the frozen foods industry.`;
  const aboutMission = aboutMissionData?.setting?.setting_value || 
    "To provide the highest quality frozen goods while ensuring food safety, sustainability, and exceptional customer service across all our branch locations.";
  const aboutValues = aboutValuesData?.setting?.setting_value || 
    "We believe in quality, freshness, and customer satisfaction. Every product meets our strict standards before reaching your table.";

  // Featured Products Background
  const featuredBgType = featuredBgTypeData?.setting?.setting_value || "color";
  const featuredBgColor = featuredBgColorData?.setting?.setting_value || "#f9fafb"; // default gray-50
  const featuredBgImage = featuredBgImageData?.setting?.setting_value;

  // Promotional Banner content with defaults
  const promoTitle = promoTitleData?.setting?.setting_value || "Special Holiday Sale!";
  const promoSubtitle = promoSubtitleData?.setting?.setting_value || "Limited Time Offer";
  const promoDescription = promoDescriptionData?.setting?.setting_value || 
    "Get up to 30% OFF on selected frozen products. Stock up now for the holidays!";
  const promoButton1Text = promoButton1TextData?.setting?.setting_value || "Shop Now";
  const promoButton1Link = promoButton1LinkData?.setting?.setting_value || "#products";
  const promoButton2Text = promoButton2TextData?.setting?.setting_value || "View Deals";
  const promoButton2Link = promoButton2LinkData?.setting?.setting_value || "#products";
  const promoEnabled = promoEnabledData?.setting?.setting_value === "true" || promoEnabledData?.setting?.setting_value === true || promoEnabledData?.setting?.setting_value === undefined;
  const promoBgColor = promoBgColorData?.setting?.setting_value || "#d97706"; // default gold-600

  useEffect(() => {
    if (!heroSectionRef.current) return;

    if (heroBanner) {
      heroSectionRef.current.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url(${heroBanner})`;
      heroSectionRef.current.style.backgroundSize = "cover";
      heroSectionRef.current.style.backgroundPosition = "center";
      heroSectionRef.current.style.backgroundRepeat = "no-repeat";
    } else {
      heroSectionRef.current.style.backgroundImage = "";
      heroSectionRef.current.style.backgroundSize = "";
      heroSectionRef.current.style.backgroundPosition = "";
      heroSectionRef.current.style.backgroundRepeat = "";
    }
  }, [heroBanner]);

  useEffect(() => {
    if (!promoSectionRef.current || !promoEnabled) return;
    promoSectionRef.current.style.background = `linear-gradient(to right, ${promoBgColor}, ${adjustBrightness(promoBgColor, 20)}, ${promoBgColor})`;
  }, [promoBgColor, promoEnabled]);

  useEffect(() => {
    if (!featuredSectionRef.current) return;

    if (featuredBgType === "image" && featuredBgImage) {
      featuredSectionRef.current.style.backgroundImage = `url(${featuredBgImage})`;
      featuredSectionRef.current.style.backgroundSize = "cover";
      featuredSectionRef.current.style.backgroundPosition = "center";
      featuredSectionRef.current.style.backgroundRepeat = "no-repeat";
      featuredSectionRef.current.style.backgroundColor = "";
    } else {
      featuredSectionRef.current.style.backgroundImage = "";
      featuredSectionRef.current.style.backgroundSize = "";
      featuredSectionRef.current.style.backgroundPosition = "";
      featuredSectionRef.current.style.backgroundRepeat = "";
      featuredSectionRef.current.style.backgroundColor = featuredBgColor;
    }
  }, [featuredBgType, featuredBgImage, featuredBgColor]);

  // Fetch featured products
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.getProducts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Every 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch system stats for dynamic counts
  const { data: systemStatsData } = useQuery({
    queryKey: ["systemStats"],
    queryFn: () => apiClient.getSystemStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Every 5 minutes
    refetchOnWindowFocus: false,
  });

  const systemStats = {
    totalProducts: systemStatsData?.stats?.products?.total || 0,
    totalBranches: systemStatsData?.stats?.branches?.total || 0,
  };
  const products = productsData?.products || [];
  
  // Get unique products (remove duplicates by ID)
  const uniqueProducts = products.filter((p: any, index: number, self: any[]) => 
    index === self.findIndex((t: any) => t.id === p.id)
  );
  const featuredProducts = uniqueProducts.filter((p: any) => p.active).slice(0, 8);

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.getCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000, // Every 10 minutes  
    refetchOnWindowFocus: false,
  });

  const categories = categoriesData?.categories?.filter((c: any) => c.active) || [];

  // Fetch active promos for promotional banner
  const { data: activePromosData } = useQuery({
    queryKey: ["activePromos"],
    queryFn: () => apiClient.getActivePromos(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Every 2 minutes
    refetchOnWindowFocus: false,
  });

  const activePromos = (activePromosData?.promos || []).filter(promo => 
    promo.discount_value && promo.discount_value > 0
  );

  // Barcode scanner states
  const [barcode, setBarcode] = useState(""); // State to store the scanned barcode
  const [productDetails, setProductDetails] = useState(null); // State to store fetched product details

  // Function to handle barcode input
  const handleBarcodeInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const scannedBarcode = event.target.value;
    setBarcode(scannedBarcode);

    if (scannedBarcode) {
      try {
        const response = await apiClient.getProductByBarcode(scannedBarcode);
        setProductDetails(response.product);
      } catch (error) {
        console.error("Error fetching product details:", error);
        setProductDetails(null);
      }
    }
  };

  // Render product details if available
  const renderProductDetails = () => {
    if (!productDetails) return null;

    return (
      <div className="product-details">
        <h3>Product Name: {productDetails.name}</h3>
        <p>Price: ${productDetails.price}</p>
        <p>Description: {productDetails.description}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gold-500/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 object-contain" />
              ) : (
                <Store className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 text-gold-400" />
              )}
              {companyName && (
                <span className="text-xs sm:text-base md:text-lg lg:text-xl font-bold text-gold-400 leading-tight">{companyName}</span>
              )}
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#products" className="text-gray-300 hover:text-gold-400 transition-colors text-sm font-medium">
                Products
              </a>
              <a href="#categories" className="text-gray-300 hover:text-gold-400 transition-colors text-sm font-medium">
                Categories
              </a>
              <a href="#about" className="text-gray-300 hover:text-gold-400 transition-colors text-sm font-medium">
                About
              </a>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                onClick={() => setShowLoginModal(true)}
                size="sm"
                className="bg-gold-500 hover:bg-gold-600 text-black font-medium px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                <span>Login</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        ref={heroSectionRef}
        className="relative py-12 sm:py-16 md:py-20 overflow-hidden"
      >
        {!heroBanner && (
          <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold">
              <span className="text-white">{heroSubtitle} </span>
              <span className="text-gold-400">{heroTitle}</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-100 max-w-2xl mx-auto px-4">
              {heroDescription}
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 pt-4 px-4">
              <Button
                size="lg"
                className="bg-gold-500 hover:bg-gold-600 text-black font-semibold w-full sm:w-auto"
                onClick={() => {
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Shop Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-gold-500/50 text-gold-400 hover:bg-gold-500/10 bg-black/30 w-full sm:w-auto"
                onClick={() => setShowLoginModal(true)}
              >
                Sign In to Order
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Promotional Banner Section */}
      {promoEnabled && (
        <section 
          ref={promoSectionRef}
          id="promo-banner" 
          className="py-8 sm:py-12 md:py-16 relative overflow-hidden"
        >
          {/* Decorative Elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 sm:w-64 sm:h-64 bg-white rounded-full -translate-x-16 sm:-translate-x-32 -translate-y-16 sm:-translate-y-32"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 sm:w-96 sm:h-96 bg-white rounded-full translate-x-16 sm:translate-x-32 translate-y-16 sm:translate-y-32"></div>
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center">
              {activePromos.length > 0 ? (
                <>
                  {/* Active Promo Display */}
                  {(() => {
                    const promo = activePromos[0]; // Show the best promo (highest discount)
                    const discountDisplay = formatDiscountDisplay(promo);
                    const safeDescription = formatPromoDescription(promo, discountDisplay);
                    

                    
                    return (
                      <>
                        {/* Promo Status Badge */}
                        <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-sm px-4 py-1.5 sm:px-6 sm:py-2 rounded-full mb-4 sm:mb-6">
                          <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          <span className="text-sm sm:text-base text-white font-semibold">
                            {getPromoCountdown(promo.end_date)}
                          </span>
                        </div>

                        {/* Promo Dates - Mobile Responsive */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-4 sm:mb-6 px-4">
                          <div className="flex items-center gap-1 text-white/80 text-xs sm:text-sm">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Valid:</span>
                            <span className="font-medium">
                              {promo.start_date ? new Date(promo.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                          <div className="hidden sm:block text-white/60">•</div>
                          <div className="flex items-center gap-1 text-white/80 text-xs sm:text-sm">
                            <span className="hidden sm:inline">Until:</span>
                            <span className="font-medium">
                              {promo.end_date ? new Date(promo.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </span>
                          </div>
                        </div>
                        
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 px-4">
                          {promo.name}
                        </h2>
                        
                        <div className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-3 sm:mb-4 drop-shadow-lg">
                          {discountDisplay}
                        </div>
                        
                        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
                          {safeDescription || `Get ${discountDisplay} on ${promo.product_count || 0} selected product${(promo.product_count || 0) !== 1 ? 's' : ''}`}
                          {promo.min_purchase && promo.min_purchase > 0 && ` with minimum purchase of ₱${Number(promo.min_purchase).toFixed(2)}`}
                          {promo.max_discount && promo.max_discount > 0 && promo.discount_type === 'percentage' && ` (Max discount: ₱${Number(promo.max_discount).toFixed(2)})`}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 px-4">
                          <Button
                            size="lg"
                            className="bg-black hover:bg-gray-900 text-white font-semibold text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto"
                            onClick={() => {
                              document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                          >
                            Shop Promo
                            <ChevronRight className="w-5 h-5 ml-2" />
                          </Button>
                          {activePromos.length > 1 && (
                            <Button
                              size="lg"
                              variant="outline"
                              className="border-white/30 text-white hover:bg-white/10 bg-black/20 backdrop-blur-sm font-semibold text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 w-full sm:w-auto"
                              onClick={() => {
                                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                            >
                              View All {activePromos.length} Promos
                            </Button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  {/* Fallback to CMS Content */}
                  <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-sm px-4 py-1.5 sm:px-6 sm:py-2 rounded-full mb-4 sm:mb-6">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    <span className="text-sm sm:text-base text-white font-semibold">{promoSubtitle}</span>
                  </div>
                  
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-4 px-4">
                    {promoTitle}
                  </h2>
                  
                  <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto whitespace-pre-line">
                    {promoDescription}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 px-4">
                    {promoButton1Text && (
                      <Button
                        size="lg"
                        className="bg-black hover:bg-gray-900 text-white font-semibold text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto"
                        onClick={() => {
                          if (promoButton1Link.startsWith('http')) {
                            window.open(promoButton1Link, '_blank');
                          } else if (promoButton1Link.startsWith('#')) {
                            document.getElementById(promoButton1Link.slice(1))?.scrollIntoView({ behavior: 'smooth' });
                          } else {
                            window.location.href = promoButton1Link;
                          }
                        }}
                      >
                        {promoButton1Text}
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                    )}
                    {promoButton2Text && (
                      <Button
                        size="lg"
                        variant="outline"
                        className="border-2 border-white text-white hover:bg-white hover:text-black font-semibold text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 bg-transparent w-full sm:w-auto"
                        onClick={() => {
                          if (promoButton2Link.startsWith('http')) {
                            window.open(promoButton2Link, '_blank');
                          } else if (promoButton2Link.startsWith('#')) {
                            document.getElementById(promoButton2Link.slice(1))?.scrollIntoView({ behavior: 'smooth' });
                          } else {
                            window.location.href = promoButton2Link;
                          }
                        }}
                      >
                        {promoButton2Text}
                      </Button>
                    )}
                  </div>
                </>
              )}
              
              {/* Countdown or Additional Info */}
              <div className="mt-6 sm:mt-8 flex items-center justify-center gap-4 sm:gap-6 text-white px-4">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold">{systemStats?.totalProducts || 0}</div>
                  <div className="text-xs sm:text-sm text-white/80">Products</div>
                </div>
                <div className="h-8 sm:h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold">{systemStats?.totalBranches || 0}</div>
                  <div className="text-xs sm:text-sm text-white/80">Branches</div>
                </div>
                <div className="h-8 sm:h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold">24/7</div>
                  <div className="text-xs sm:text-sm text-white/80">Support</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Products Section */}
      <section 
        ref={featuredSectionRef}
        id="products" 
        className="py-12 sm:py-16 md:py-20 relative"
      >
        {/* Optional overlay for image backgrounds to improve text readability */}
        {featuredBgType === "image" && featuredBgImage && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        )}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-12 gap-4">
            <div>
              <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 ${featuredBgType === "image" && featuredBgImage ? "text-white" : "text-gray-900"}`}>
                Featured Products
              </h2>
              <p className={`text-sm sm:text-base ${featuredBgType === "image" && featuredBgImage ? "text-gray-200" : "text-gray-600"}`}>
                Our best-selling frozen foods
              </p>
            </div>
            <Button
              variant="outline"
              className={`hidden md:flex items-center gap-2 ${
                featuredBgType === "image" && featuredBgImage 
                  ? "border-gold-400 text-gold-400 hover:bg-gold-400/10 bg-black/30" 
                  : "border-gold-500 text-gold-600 hover:bg-gold-50"
              }`}
              onClick={() => navigate("/customer/shop")}
            >
              View All
            </Button>
          </div>

          {featuredProducts.length > 0 ? (
            <>
              {/* Products Carousel - All Devices */}
              <div className="relative">
                <div className="overflow-hidden" ref={emblaProductsRef}>
                  <div className="flex gap-4 md:gap-6">
                    {featuredProducts.map((product: any) => {
                      const hasPromo = product.promo_id && 
                        product.discount_amount != null && 
                        Number(product.discount_amount) > 0;
                      
                      return (
                      <div
                        key={product.id}
                        className="flex-[0_0_85%] sm:flex-[0_0_45%] lg:flex-[0_0_23%] min-w-0"
                      >
                        <div
                          className="group bg-white rounded-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer border border-transparent hover:border-gold-400 h-full"
                          onClick={() => setShowLoginModal(true)}
                        >
                          {/* Product Image */}
                          <div className="relative aspect-square bg-black overflow-hidden">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gold-400/30" />
                              </div>
                            )}
                            
                            {/* Sale Banner - Top */}
                            {hasPromo && (
                              <div className="absolute top-0 left-0 right-0 z-20">
                                <SaleBanner
                                  promoName={product.promo_name}
                                  discountPercentage={product.discount_percentage}
                                  discountAmount={product.discount_amount}
                                  size="md"
                                  position="top"
                                />
                              </div>
                            )}
                            
                            {/* Discount Badge - Floating */}
                            {hasPromo && (
                              <DiscountBadge
                                discountPercentage={product.discount_percentage}
                                discountAmount={product.discount_amount}
                                promoName={product.promo_name}
                                size="md"
                                variant="floating"
                                animated={true}
                              />
                            )}
                            
                            {/* Stock Badge */}
                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                              <Badge className="bg-green-500 text-white hover:bg-green-500 shadow-lg text-xs">
                                In Stock
                              </Badge>
                            </div>
                          </div>

                          {/* Product Info */}
                          <div className="p-4 sm:p-5 bg-white">
                            <p className="text-xs text-gold-600 font-medium mb-1 uppercase tracking-wide">{product.category}</p>
                            <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 sm:mb-3 text-base sm:text-lg group-hover:text-gold-600 transition-colors">
                              {product.name}
                            </h3>

                            {/* Rating */}
                            <div className="flex items-center gap-1 mb-3 sm:mb-4">
                              {[...Array(5)].map((_, i) => (
                                <Star key={`star-${product.id}-${i}`} className="w-3 h-3 sm:w-4 sm:h-4 fill-gold-400 text-gold-400" />
                              ))}
                              <span className="text-xs sm:text-sm text-gray-500 ml-1 font-medium">(128)</span>
                            </div>

                            {/* Price Display */}
                            <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-200">
                              <PriceDisplay
                                originalPrice={parseFloat(product.price)}
                                finalPrice={hasPromo ? parseFloat(product.final_price) : undefined}
                                discountAmount={hasPromo ? product.discount_amount : 0}
                                size="md"
                                layout="vertical"
                                showSavings={true}
                              />
                              <Button
                                size="sm"
                                className="bg-black hover:bg-gold-600 text-white transition-all duration-300 shadow-md hover:shadow-lg h-8 w-8 sm:h-9 sm:w-9 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Added to cart');
                                }}
                              >
                                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <button
                  onClick={scrollProductsPrev}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 sm:p-3 transition-all z-10 hover:scale-110"
                  aria-label="Previous products"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
                </button>
                <button
                  onClick={scrollProductsNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 sm:p-3 transition-all z-10 hover:scale-110"
                  aria-label="Next products"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 sm:py-16 bg-white/90 rounded-xl backdrop-blur-sm">
              <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gold-400/50 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                No Products Available Yet
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6 px-4">
                Our catalog is being prepared. Check back soon!
              </p>
              <Button
                onClick={() => setShowLoginModal(true)}
                className="bg-gold-500 hover:bg-gold-600 text-black font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto mx-4 sm:mx-0"
              >
                Sign In to Add Products
              </Button>
            </div>
          )}

          <div className="text-center mt-6 sm:mt-8 md:hidden">
            <Button
              variant="outline"
              className="w-full sm:w-auto border-gold-500 text-gold-600 hover:bg-gold-50"
              onClick={() => navigate("/customer/shop")}
            >
              View All Products
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="about" className="py-12 sm:py-16 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Why Choose {companyName}?
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Your trusted partner for quality frozen foods
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: Shield,
                title: "Quality Assured",
                description: "100% fresh guarantee or your money back",
              },
              {
                icon: Clock,
                title: "Fast Service",
                description: "Quick order processing and preparation",
              },
              {
                icon: Star,
                title: "Best Prices",
                description: "Competitive wholesale and retail rates",
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gold-100 mb-4">
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-gold-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-base sm:text-lg">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-block px-3 py-1.5 sm:px-4 sm:py-2 bg-gold-100 rounded-full mb-4 sm:mb-6">
                <span className="text-gold-600 font-semibold text-xs sm:text-sm">ABOUT {companyName.toUpperCase()}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">
                {aboutTitle}
              </h2>
              <p className="text-base sm:text-lg text-gray-600 mb-6">
                {aboutDescription}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gold-100 flex items-center justify-center">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 text-gold-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Quality Certified</h4>
                    <p className="text-xs sm:text-sm text-gray-600">FDA approved and HACCP certified</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gold-100 flex items-center justify-center">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-gold-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">10,000+ Customers</h4>
                    <p className="text-xs sm:text-sm text-gray-600">Trusted by businesses nationwide</p>
                  </div>
                </div>
              </div>
              <Button 
                className="bg-gold-500 hover:bg-gold-600 text-white w-full sm:w-auto"
                onClick={() => setShowLoginModal(true)}
              >
                Get Started Today
              </Button>
            </div>

            {/* Right Content - Stats & Values */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gradient-to-br from-gold-50 to-amber-50 rounded-2xl p-6 sm:p-8 border border-gold-200">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Our Mission & Values</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gold-500 flex items-center justify-center">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Mission</h4>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {aboutMission}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gold-500 flex items-center justify-center">
                      <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Values</h4>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {aboutValues}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gold-500 flex items-center justify-center">
                      <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Integrity</h4>
                      <p className="text-xs sm:text-sm text-gray-600">
                        Transparent operations and honest business practices
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-gray-50 rounded-xl p-4 sm:p-6 text-center border border-gray-200">
                  <div className="text-2xl sm:text-3xl font-bold text-gold-600 mb-1">{systemStats?.totalProducts || 0}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Products</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 sm:p-6 text-center border border-gray-200">
                  <div className="text-2xl sm:text-3xl font-bold text-gold-600 mb-1">{systemStats?.totalBranches || 0}</div>
                  <div className="text-xs sm:text-sm text-gray-600">Branches</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 sm:p-6 text-center border border-gray-200">
                  <div className="text-2xl sm:text-3xl font-bold text-gold-600 mb-1">24/7</div>
                  <div className="text-xs sm:text-sm text-gray-600">Support</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-12 border-t border-gold-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {companyLogo ? (
                  <img src={companyLogo} alt={companyName} className="h-20 w-20 object-contain" />
                ) : (
                  <Store className="w-16 h-16 text-gold-400" />
                )}
                {companyName && (
                  <span className="text-xl font-bold text-gold-400">{companyName}</span>
                )}
              </div>
              <p className="text-sm">
                Your trusted partner for premium frozen foods. Quality products delivered with care.
              </p>
            </div>

            {/* Shop */}
            <div>
              <h3 className="font-semibold text-white mb-4">Shop</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#products" className="hover:text-gold-400 transition-colors">Products</a></li>
                <li><a href="#categories" className="hover:text-gold-400 transition-colors">Categories</a></li>
                <li><a href="#" className="hover:text-gold-400 transition-colors">New Arrivals</a></li>
                <li><a href="#" className="hover:text-gold-400 transition-colors">Best Sellers</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-semibold text-white mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-gold-400 transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-gold-400 transition-colors">FAQs</a></li>
                <li><a href="#" className="hover:text-gold-400 transition-colors">Returns</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-gold-400 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-gold-400 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-gold-400 transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2025 {companyName}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {/* Barcode Scanner Section - For testing and demo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 sm:p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
          <input
            type="text"
            placeholder="Scan barcode here"
            value={barcode}
            onChange={handleBarcodeInput}
            className="barcode-input flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500"
          />
          <Button
            onClick={async () => {
              if (barcode) {
                try {
                  const response = await apiClient.getProductByBarcode(barcode);
                  // support different response shapes: { product: ... } or { data: ... }
                  const product = (response as any).product ?? (response as any).data ?? null;
                  setProductDetails(product);
                } catch (error) {
                  console.error("Error fetching product details:", error);
                  setProductDetails(null);
                }
              }
            }}
            className="bg-gold-500 hover:bg-gold-600 text-black font-semibold px-4 py-2 rounded-lg shadow-md"
          >
            Search Product
          </Button>
        </div>

        {/* Render Product Details Below Scanner */}
        {productDetails && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{productDetails.name}</h3>
            <p className="text-sm text-gray-600 mb-1">Price: <span className="font-semibold text-gray-900">₱{productDetails.price}</span></p>
            <p className="text-sm text-gray-600 mb-1">Description: {productDetails.description}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className="bg-green-500 text-white text-xs rounded-full px-3 py-1">
                In Stock
              </Badge>
              {productDetails.discount_amount > 0 && (
                <Badge className="bg-red-500 text-white text-xs rounded-full px-3 py-1">
                  Discount: {productDetails.discount_amount}%
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




