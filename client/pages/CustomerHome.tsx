import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { CustomerLayout } from "@/components/CustomerLayout";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiscountBadge, SaleBanner } from "@/components/DiscountBadge";
import { getDiscountedPrice, getDiscountAmount, formatPromoDate, getPromoCountdown, getPromoStatus, formatPromoDescription, formatDiscountDisplay } from "@/lib/discountUtils";
import { getTimeRemaining, formatDate } from "@/lib/dateUtils";
import useEmblaCarousel from "embla-carousel-react";
import {
  Snowflake,
  ShoppingBag,
  Home,
  ShoppingCart,
  Heart,
  LogOut,
  Package,
  Star,
  ChevronRight,
  ChevronLeft,
  Award,
  Store,
  Clock,
} from "lucide-react";

// Helper function to adjust color brightness
const adjustBrightness = (hex: string, percent: number) => {
  const color = hex.replace('#', '');
  const num = parseInt(color, 16);
  const r = (num >> 16) + percent;
  const g = ((num >> 8) & 0x00FF) + percent;
  const b = (num & 0x0000FF) + percent;
  const newR = Math.max(0, Math.min(255, r));
  const newG = Math.max(0, Math.min(255, g));
  const newB = Math.max(0, Math.min(255, b));
  return `#${((newR << 16) | (newG << 8) | newB).toString(16).padStart(6, '0')}`;
};

export default function CustomerHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Embla Carousel for mobile
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false, 
    align: 'start',
    containScroll: 'trimSnaps',
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Update countdown every minute for real-time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  // Fetch all CMS settings in one call
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings", "all"],
    queryFn: () => apiClient.getSettingsByKeys([
      "hero_banner",
      "hero_title",
      "hero_subtitle",
      "hero_description",
      "about_title",
      "about_description",
      "about_mission",
      "about_values",
      "company_name",
      "company_logo",
      "featured_bg_type",
      "featured_bg_color",
      "featured_bg_image",
      "promo_enabled",
      "promo_title",
      "promo_subtitle",
      "promo_description",
      "promo_bg_color",
      "promo_button1_text",
      "promo_button1_link",
      "promo_button2_text",
      "promo_button2_link",
      "footer_description",
      "footer_email",
      "footer_phone",
      "footer_address",
      "footer_copyright",
    ]),
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Fetch featured products with promos
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.getProducts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Every 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch active promos
  const { data: promosData } = useQuery({
    queryKey: ["activePromos"],
    queryFn: () => apiClient.getActivePromos(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Every 2 minutes
    refetchOnWindowFocus: false,
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await fetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
  });

  // Fetch system stats
  const { data: systemStatsData } = useQuery({
    queryKey: ["systemStats"],
    queryFn: () => apiClient.getSystemStats(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000, // Every 10 minutes
    refetchOnWindowFocus: false,
  });

  const products = productsData?.products || [];
  const activePromos = (promosData?.promos || []).filter(promo => 
    promo.discount_value && promo.discount_value > 0
  );
  const branches = branchesData?.branches || [];
  const systemStats = systemStatsData?.stats;
  
  // Get unique featured products (remove duplicates by ID)
  const uniqueProducts = products.filter((p: any, index: number, self: any[]) => 
    index === self.findIndex((t: any) => t.id === p.id)
  );
  const featuredProducts = uniqueProducts.filter((p: any) => p.active).slice(0, 8);

  // Helper function to get promo for a product
  const getProductPromo = (productId: number) => {
    return activePromos.find((promo: any) => 
      promo.product_ids?.includes(productId.toString())
    );
  };

  // Helper functions using centralized discount utilities
  const getProductDiscountedPrice = (product: any) => {
    const promo = getProductPromo(product.id);
    return getDiscountedPrice(product.price, promo);
  };

  const getProductDiscountAmount = (product: any) => {
    const promo = getProductPromo(product.id);
    return getDiscountAmount(product.price, promo);
  };

  // Show loading state
  if (settingsLoading || productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // CMS values with fallbacks - Extract string values safely
  const banner = settingsData?.hero_banner?.setting_value || "/placeholder.svg";
  const heroTitle = settingsData?.hero_title?.setting_value || "Premium Frozen Foods";
  const heroSubtitle = settingsData?.hero_subtitle?.setting_value || "Quality You Can Trust";
  const heroDescription =
    settingsData?.hero_description?.setting_value ||
    "Quality frozen products delivered to your door. Browse our extensive catalog of meats, seafood, vegetables, and ready-to-eat meals.";
  
  const companyName = settingsData?.company_name?.setting_value || "Batangas Premium Bongabong";
  const companyLogo = settingsData?.company_logo?.setting_value || null;
  
  const aboutTitle = settingsData?.about_title?.setting_value || `About ${companyName}`;
  const aboutDescription =
    settingsData?.about_description?.setting_value ||
    `At ${companyName}, we've been delivering premium quality frozen products to Filipino families and businesses since our establishment. Our commitment to excellence and customer satisfaction has made us a trusted name in the frozen foods industry.`;
  const aboutMission =
    settingsData?.about_mission?.setting_value ||
    "To provide the highest quality frozen products while maintaining exceptional service and competitive pricing.";
  const aboutValues =
    settingsData?.about_values?.setting_value ||
    "Quality, Trust, Service, Innovation";
  const featuredBgType = settingsData?.featured_bg_type?.setting_value || "color";
  const featuredBgColor = settingsData?.featured_bg_color?.setting_value || "#ffffff";
  const featuredBgImage = settingsData?.featured_bg_image?.setting_value || null;

  // Promotional Banner Settings
  const promoEnabled = settingsData?.promo_enabled?.setting_value === "true" || 
    settingsData?.promo_enabled?.setting_value === true || 
    settingsData?.promo_enabled?.setting_value === undefined;
  const promoTitle = settingsData?.promo_title?.setting_value || "Special Promotion!";
  const promoSubtitle = settingsData?.promo_subtitle?.setting_value || "Limited Time Offer";
  const promoDescription = settingsData?.promo_description?.setting_value || 
    "Grab yours now!";
  const promoBgColor = settingsData?.promo_bg_color?.setting_value || "#d97706";
  const promoButton1Text = settingsData?.promo_button1_text?.setting_value || "Shop Now";
  const promoButton1Link = settingsData?.promo_button1_link?.setting_value || "#products";
  const promoButton2Text = settingsData?.promo_button2_text?.setting_value || "View Deals";
  const promoButton2Link = settingsData?.promo_button2_link?.setting_value || "#products";

  // Footer settings - Extract string values safely
  const footerDescription = settingsData?.footer_description?.setting_value || "Premium quality frozen products delivered to Filipino families and businesses since our establishment.";
  const footerEmail = settingsData?.footer_email?.setting_value || "";
  const footerPhone = settingsData?.footer_phone?.setting_value || "";
  const footerAddress = settingsData?.footer_address?.setting_value || "";
  const footerCopyright = settingsData?.footer_copyright?.setting_value || "Batangas Premium Bongabong. All rights reserved.";

  // System stats - Extract safe values to avoid rendering objects
  const totalProductsText = systemStats?.products?.total ? `${systemStats.products.total}+` : `${products.length}+`;
  const totalBranchesText = systemStats?.branches?.total ? `${systemStats.branches.total}+` : `${branches.length}+`;
  const supportText = systemStats?.support || "24/7";


  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <CustomerLayout>
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section
        className="relative h-[500px] sm:h-[600px] flex items-center justify-center"
        style={{
          backgroundImage: `url(${banner})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4 sm:mb-6">
            {heroTitle}
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gold-400 mb-4 sm:mb-6 font-semibold">
            {heroSubtitle}
          </p>
          <p className="text-base sm:text-lg md:text-xl text-gray-200 mb-6 sm:mb-8 max-w-2xl mx-auto">
            {heroDescription}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold shadow-lg shadow-gold-500/50 text-base sm:text-lg px-6 sm:px-8"
              onClick={() => navigate("/customer/shop")}
            >
              Shop Now
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-gold-400 text-gold-400 hover:bg-gold-400/10 text-base sm:text-lg px-6 sm:px-8"
              onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Promotional Banner Section */}
      {promoEnabled && (
        <section 
          id="promo-banner" 
          className="py-8 sm:py-12 md:py-16 relative overflow-hidden"
          style={{
            background: `linear-gradient(to right, ${promoBgColor}, ${adjustBrightness(promoBgColor, 20)}, ${promoBgColor})`
          }}
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
                    const promo = activePromos[0]; // Show the best promo
                    const discountDisplay = formatDiscountDisplay(promo);
                    const safeDescription = formatPromoDescription(promo, discountDisplay);
                    
                    const timeRemaining = getTimeRemaining(promo.end_date);
                    const promoStatus = getPromoStatus(promo.start_date, promo.end_date);
                    const startDate = formatDate(promo.start_date);
                    const endDate = formatDate(promo.end_date);
                    
                    return (
                      <>
                        {/* Promo Status Badge */}
                        <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-sm px-4 py-1.5 sm:px-6 sm:py-2 rounded-full mb-4 sm:mb-6">
                          <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          <span className="text-sm sm:text-base text-white font-semibold">
                            {timeRemaining.isExpired ? 'Expired' : timeRemaining.formatted + ' left'}
                          </span>
                        </div>

                        {/* Promo Dates - Mobile Responsive */}
                        <div className="flex flex-col items-center justify-center gap-2 mb-4 sm:mb-6">
                          {/* Countdown Display */}
                          <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                            <div className="flex items-center gap-2 text-white">
                              <Clock className="w-4 h-4" />
                              <span className="font-bold text-sm">
                                {getPromoCountdown(promo.end_date)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Date Range Display */}
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 text-white/80 text-xs">
                            <div className="flex items-center gap-1">
                              <span>Valid: {promo.start_date ? new Date(promo.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                            </div>
                            <div className="hidden sm:block text-white/60">•</div>
                            <div className="flex items-center gap-1">
                              <span>Until: {promo.end_date ? new Date(promo.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                            </div>
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
                          {promo.min_purchase && Number(promo.min_purchase) > 0 && ` with minimum purchase of ₱${Number(promo.min_purchase).toFixed(2)}`}
                          {promo.max_discount && Number(promo.max_discount) > 0 && promo.discount_type === 'percentage' && ` (Max discount: ₱${Number(promo.max_discount).toFixed(2)})`}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 px-4">
                          <Button
                            size="lg"
                            className="bg-black hover:bg-gray-900 text-white font-semibold text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto"
                            onClick={() => navigate("/customer/shop")}
                          >
                            Shop Promo
                            <ChevronRight className="w-5 h-5 ml-2" />
                          </Button>
                          {activePromos.length > 1 && (
                            <Button
                              size="lg"
                              variant="outline"
                              className="border-white/30 text-white hover:bg-white/10 bg-black/20 backdrop-blur-sm font-semibold text-base sm:text-lg px-6 py-5 sm:px-8 sm:py-6 w-full sm:w-auto"
                              onClick={() => navigate("/customer/shop")}
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
                  
                  <p className="text-base sm:text-lg md:text-xl text-white/90 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
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
                            navigate(promoButton1Link);
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
                            navigate(promoButton2Link);
                          }
                        }}
                      >
                        {promoButton2Text}
                      </Button>
                    )}
                  </div>
                </>
              )}
              
              {/* Stats Display */}
              <div className="mt-6 sm:mt-8 flex items-center justify-center gap-4 sm:gap-6 md:gap-8 text-white px-4">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                    {totalProductsText}
                  </div>
                  <div className="text-xs sm:text-sm text-white/90 font-medium">Quality Products</div>
                </div>
                <div className="h-8 sm:h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                    {totalBranchesText}
                  </div>
                  <div className="text-xs sm:text-sm text-white/90 font-medium">Store Locations</div>
                </div>
                <div className="h-8 sm:h-12 w-px bg-white/30"></div>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                    {supportText}
                  </div>
                  <div className="text-xs sm:text-sm text-white/90 font-medium">Customer Service</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Products Section */}
      <section
        id="products"
        className="py-12 sm:py-16 md:py-20 relative"
        style={
          featuredBgType === "image" && featuredBgImage
            ? {
                backgroundImage: `url(${featuredBgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : { backgroundColor: featuredBgColor }
        }
      >
        {featuredBgType === "image" && featuredBgImage && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-12 gap-4">
            <div>
              <h2
                className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 ${
                  featuredBgType === "image" && featuredBgImage ? "text-white" : "text-gray-900"
                }`}
              >
                Featured Products
              </h2>
              <p
                className={`text-sm sm:text-base ${
                  featuredBgType === "image" && featuredBgImage ? "text-gray-200" : "text-gray-600"
                }`}
              >
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
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {featuredProducts.length > 0 ? (
            <>
              {/* Desktop Grid - Hidden on mobile, shown on tablet and up */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {featuredProducts.map((product: any) => {
                  const promo = getProductPromo(product.id);
                  const hasPromo = !!promo;
                  const discountedPrice = hasPromo ? getProductDiscountedPrice(product) : product.price;
                  const discountAmount = hasPromo ? getProductDiscountAmount(product) : 0;
                  
                  return (
                    <div
                      key={product.id}
                      className="group bg-white rounded-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer border border-transparent hover:border-gold-400"
                      onClick={() => navigate("/customer/shop")}
                    >
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
                        
                        {/* Sale Banner */}
                        {hasPromo && (
                          <div className="absolute top-0 left-0 right-0 z-20">
                            <SaleBanner
                              promoName={promo.name}
                              discountPercentage={promo.discount_type === 'percentage' ? promo.discount_value : undefined}
                              discountAmount={promo.discount_type === 'fixed' ? promo.discount_value : undefined}
                              size="md"
                              position="top"
                            />
                          </div>
                        )}
                        
                        {/* Discount Badge */}
                        {hasPromo && (
                          <DiscountBadge
                            discountPercentage={promo.discount_type === 'percentage' ? promo.discount_value : undefined}
                            discountAmount={promo.discount_type === 'fixed' ? promo.discount_value : undefined}
                            originalPrice={product.price}
                            finalPrice={discountedPrice}
                            promoName={promo.name}
                            size="md"
                            variant="corner"
                            showPromoName={false}
                            animated={true}
                          />
                        )}
                        
                        <Badge className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-gold-500 text-white hover:bg-gold-500 shadow-lg text-xs">
                          In Stock
                        </Badge>
                      </div>

                      <div className="p-4 sm:p-5 bg-white">
                        <p className="text-xs text-gold-600 font-medium mb-1 uppercase tracking-wide">
                          {product.category}
                        </p>
                        <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 sm:mb-3 text-base sm:text-lg group-hover:text-gold-600 transition-colors">
                          {product.name}
                        </h3>

                        <div className="flex items-center gap-1 mb-3 sm:mb-4">
                          {[...Array(5)].map((_, i) => (
                            <Star key={`desktop-star-${product.id}-${i}`} className="w-3 h-3 sm:w-4 sm:h-4 fill-gold-400 text-gold-400" />
                          ))}
                          <span className="text-xs sm:text-sm text-gray-500 ml-1 font-medium">(128)</span>
                        </div>

                        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-200">
                          <div>
                            {hasPromo ? (
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-400 line-through">
                                  ₱{parseFloat(product.price).toFixed(2)}
                                </span>
                                <span className="text-xl sm:text-2xl font-bold text-red-600">
                                  ₱{parseFloat(discountedPrice).toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <div className="text-xl sm:text-2xl font-bold text-gold-600">
                                ₱{parseFloat(product.price).toFixed(2)}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="bg-black hover:bg-gold-600 text-white transition-all duration-300 shadow-md hover:shadow-lg h-8 w-8 sm:h-9 sm:w-9 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/customer/shop");
                            }}
                          >
                            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Carousel - Only shown on mobile, hidden on tablet and up */}
              <div className="block sm:hidden relative">
                <div className="overflow-hidden" ref={emblaRef}>
                  <div className="flex gap-2">
                    {featuredProducts.map((product: any) => {
                      const promo = getProductPromo(product.id);
                      const hasPromo = !!promo;
                      const discountedPrice = hasPromo ? getProductDiscountedPrice(product) : product.price;
                      const discountAmount = hasPromo ? getProductDiscountAmount(product) : 0;
                      
                      return (
                        <div key={`mobile-${product.id}`} className="flex-[0_0_55%] min-w-0">
                          <div
                            className="group bg-white rounded-lg overflow-hidden shadow-md cursor-pointer border border-transparent"
                            onClick={() => navigate("/customer/shop")}
                          >
                            <div className="relative aspect-square bg-black overflow-hidden">
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                                  <Package className="w-8 h-8 text-gold-400/30" />
                                </div>
                              )}
                              
                              {/* Sale Banner - Compact */}
                              {hasPromo && (
                                <div className="absolute top-0 left-0 right-0 z-20">
                                  <SaleBanner
                                    promoName={promo.name}
                                    discountPercentage={promo.discount_type === 'percentage' ? promo.discount_value : undefined}
                                    discountAmount={promo.discount_type === 'fixed' ? promo.discount_value : undefined}
                                    size="sm"
                                    position="top"
                                  />
                                </div>
                              )}
                              
                              {/* Discount Badge */}
                              {hasPromo && (
                                <DiscountBadge
                                  discountPercentage={promo.discount_type === 'percentage' ? promo.discount_value : undefined}
                                  discountAmount={promo.discount_type === 'fixed' ? promo.discount_value : undefined}
                                  originalPrice={product.price}
                                  finalPrice={discountedPrice}
                                  promoName={promo.name}
                                  size="sm"
                                  variant="corner"
                                  showPromoName={false}
                                  animated={true}
                                />
                              )}
                              
                              <Badge className="absolute top-1 right-1 bg-gold-500 text-white hover:bg-gold-500 shadow-md text-[9px] px-1 py-0">
                                Stock
                              </Badge>
                            </div>

                            <div className="p-2 bg-white">
                              <p className="text-[9px] text-gold-600 font-medium mb-0.5 uppercase tracking-wide truncate">
                                {product.category}
                              </p>
                              <h3 className="font-bold text-gray-900 line-clamp-2 mb-1 text-[11px] leading-tight">
                                {product.name}
                              </h3>

                              <div className="flex items-center gap-0.5 mb-1.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={`mobile-star-${product.id}-${i}`} className="w-2 h-2 fill-gold-400 text-gold-400" />
                                ))}
                                <span className="text-[9px] text-gray-500 ml-0.5">(128)</span>
                              </div>

                              <div className="flex items-center justify-between pt-1.5 border-t border-gray-200">
                                <div>
                                  {hasPromo ? (
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-gray-400 line-through">
                                        ₱{parseFloat(product.price).toFixed(0)}
                                      </span>
                                      <span className="text-xs font-bold text-red-600">
                                        ₱{parseFloat(discountedPrice).toFixed(0)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-xs font-bold text-gold-600">
                                      ₱{parseFloat(product.price).toFixed(0)}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  className="bg-black hover:bg-gold-600 text-white transition-all duration-300 shadow-sm h-5 w-5 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("/customer/shop");
                                  }}
                                >
                                  <ShoppingCart className="w-2.5 h-2.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Carousel Navigation */}
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black text-white p-2 rounded-full shadow-lg z-10"
                  onClick={scrollPrev}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black text-white p-2 rounded-full shadow-lg z-10"
                  onClick={scrollNext}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 text-lg">No products available at the moment</p>
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              {aboutTitle}
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto">{aboutDescription}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-gradient-to-br from-gold-50 to-white p-6 sm:p-8 rounded-xl border border-gold-200 shadow-lg">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Our Mission</h3>
              <p className="text-sm sm:text-base text-gray-700">{aboutMission}</p>
            </div>

            <div className="bg-gradient-to-br from-black to-gray-900 p-6 sm:p-8 rounded-xl shadow-lg">
              <h3 className="text-xl sm:text-2xl font-bold text-gold-400 mb-3 sm:mb-4">Our Values</h3>
              <p className="text-sm sm:text-base text-gray-300">{aboutValues}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-12 pb-20 md:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Company Info */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Store className="w-6 h-6 text-gold-400" />
                <h3 className="text-xl font-bold text-gold-400">
                  {companyName}
                </h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                {footerDescription}
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold text-gold-400 mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="text-gray-400 hover:text-gold-400 transition-colors text-sm"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/customer/shop")}
                    className="text-gray-400 hover:text-gold-400 transition-colors text-sm"
                  >
                    Shop
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/customer/orders")}
                    className="text-gray-400 hover:text-gold-400 transition-colors text-sm"
                  >
                    My Orders
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/customer/cart")}
                    className="text-gray-400 hover:text-gold-400 transition-colors text-sm"
                  >
                    Cart
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-lg font-semibold text-gold-400 mb-4">Contact Us</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                {footerEmail ? (
                  <li>Email: {footerEmail}</li>
                ) : (
                  <li>Email: info@batangaspremium.com</li>
                )}
                {footerPhone ? (
                  <li>Phone: {footerPhone}</li>
                ) : (
                  <li>Phone: +63 912 345 6789</li>
                )}
                {footerAddress ? (
                  <li>Address: {footerAddress}</li>
                ) : (
                  <li>Address: Batangas City, Philippines</li>
                )}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} {footerCopyright}</p>
          </div>
        </div>
      </footer>
    </div>
    </CustomerLayout>
  );
}
