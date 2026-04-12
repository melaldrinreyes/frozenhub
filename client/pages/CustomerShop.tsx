import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { CustomerLayout } from "@/components/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DiscountBadge, SaleBanner } from "@/components/DiscountBadge";
import { getDiscountedPrice, getDiscountAmount, formatPromoDate, getPromoCountdown, getPromoStatus, formatPromoDescription, formatDiscountDisplay } from "@/lib/discountUtils";
import { getTimeRemaining, formatDate } from "@/lib/dateUtils";
import { confirmLogout } from "@/lib/logout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Snowflake,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  Home,
  Package,
  Settings,
  Search,
  Star,
  Plus,
  Minus,
  ShoppingCart,
  Heart,
  Store,
  Filter,
  SlidersHorizontal,
  Grid3x3,
  List,
  TrendingUp,
  Zap,
  Trash2,
  Award,
  Clock,
  Share2,
  Eye,
  ArrowUpDown,
  Download,
  Filter as FilterIcon,
  Grid,
  User,
} from "lucide-react";
import { paginateItems } from "@/lib/dataManager";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { ProductDetailsDialog } from "@/components/ProductDetailsDialog";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  image: string;
  active: boolean;
  created_at: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  promo?: {
    id: string;
    name: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_discount?: number | null;
  } | null;
}

export default function CustomerShop() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<string>("name");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [showWishlist, setShowWishlist] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [initialProductRetryCount, setInitialProductRetryCount] = useState(0);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("customerCart");
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        // Convert flat format from localStorage to nested CartItem format
        const formattedCart = parsedCart.map((item: any) => {
          if (item.product) {
            // Already in correct nested format
            return item;
          } else {
            // Flat format - convert to nested
            return {
              product: {
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                category: item.category,
                sku: item.sku,
                description: item.description || "",
                cost: item.cost || 0,
                active: true,
                created_at: new Date().toISOString(),
              },
              quantity: item.quantity,
            };
          }
        });
        setCart(formattedCart);
      } catch (error) {
        console.error("Error loading cart:", error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (cart.length > 0 || localStorage.getItem("customerCart")) {
      // Save in flat format for compatibility with CustomerCart page
      const flatCart = cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        image: item.product.image,
        category: item.product.category,
        sku: item.product.sku,
        promo: item.promo || null,
      }));
      console.log("Saving cart to localStorage:", flatCart);
      localStorage.setItem("customerCart", JSON.stringify(flatCart));
      
      // Dispatch custom event to notify other components about cart update
      window.dispatchEvent(new Event("cartUpdated"));
    }
  }, [cart]);

  // Fetch products from API
  const { data: productsResponse, isLoading, error, refetch: refetchProducts, isFetching } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await apiClient.getProducts();
      console.log("📦 API Response:", response);
      return response.products.filter((p: Product) => p.active);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Every 5 minutes
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
  });

  // Ensure products is always an array
  const products = Array.isArray(productsResponse) ? productsResponse : [];

  // Debug: Check products data
  useEffect(() => {
    if (error) {
      console.error("❌ Error fetching products:", error);
    }
    console.log("🛒 CustomerShop - Products Data:", {
      isLoading,
      error: error?.message,
      responseType: typeof productsResponse,
      isArray: Array.isArray(productsResponse),
      productsLength: products.length,
      firstProduct: products[0],
    });
  }, [productsResponse, isLoading, products, error]);

  // Some first-load sessions receive an initial empty product list while backend warm-up completes.
  // Trigger a couple of short retries automatically so users don't need to refresh manually.
  useEffect(() => {
    if (isLoading || isFetching || error) return;
    if (products.length > 0) {
      if (initialProductRetryCount !== 0) {
        setInitialProductRetryCount(0);
      }
      return;
    }
    if (initialProductRetryCount >= 2) return;

    const timeoutId = window.setTimeout(() => {
      setInitialProductRetryCount((count) => count + 1);
      refetchProducts();
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [isLoading, isFetching, error, products.length, initialProductRetryCount, refetchProducts]);

  // Fetch active promos
  const { data: promosData } = useQuery({
    queryKey: ["activePromos"],
    queryFn: () => apiClient.getActivePromos(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Every 2 minutes
    refetchOnWindowFocus: true,
  });

  const activePromos = promosData?.promos || [];

  // Helper function to get promo for a product
  const getProductPromo = (productId: string) => {
    return activePromos.find((promo: any) => 
      promo.product_ids?.includes(productId)
    );
  };

  // Helper functions using centralized discount utilities
  const getProductDiscountedPrice = (product: Product) => {
    const promo = getProductPromo(product.id);
    const currentSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const potentialSubtotal = currentSubtotal + product.price;
    return getDiscountedPrice(product.price, promo, potentialSubtotal);
  };

  const getProductDiscountAmount = (product: Product) => {
    const promo = getProductPromo(product.id);
    const currentSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const potentialSubtotal = currentSubtotal + product.price;
    return getDiscountAmount(product.price, promo, potentialSubtotal);
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Price range filter
    filtered = filtered.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // Sort products
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "name":
          return a.name.localeCompare(b.name);
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [products, searchTerm, selectedCategory, sortBy, priceRange]);

  const { items: paginatedProducts, totalPages } = paginateItems(
    filteredProducts,
    currentPage,
    12,
  );

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;
    await logout();
    navigate("/");
  };

  const addToCart = (product: Product) => {
    console.log("Adding to cart:", product);
    const promo = getProductPromo(product.id);
    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, promo }
            : item,
        ),
      );
      toast({
        title: "Updated cart",
        description: `Increased quantity of ${product.name}`,
      });
    } else {
      setCart([...cart, { product, quantity: 1, promo }]);
      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart`,
      });
    }
    console.log("Cart after adding:", cart);
  };

  const toggleWishlist = (productId: string) => {
    if (wishlist.includes(productId)) {
      setWishlist(wishlist.filter((id) => id !== productId));
      toast({
        title: "Removed from wishlist",
        description: "Item removed from your wishlist",
      });
    } else {
      setWishlist([...wishlist, productId]);
      toast({
        title: "Added to wishlist",
        description: "Item added to your wishlist",
      });
    }
  };

  const quickAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product);
  };

  const clearCart = () => {
    setCart([]);
    toast({
      title: "Cart cleared",
      description: "All items have been removed from your cart",
    });
  };

  const toggleCompare = (productId: string) => {
    if (compareList.includes(productId)) {
      setCompareList(compareList.filter((id) => id !== productId));
      toast({
        title: "Removed from comparison",
        description: "Product removed from comparison list",
      });
    } else if (compareList.length >= 4) {
      toast({
        title: "Maximum reached",
        description: "You can only compare up to 4 products",
        variant: "destructive",
      });
    } else {
      setCompareList([...compareList, productId]);
      toast({
        title: "Added to comparison",
        description: "Product added to comparison list",
      });
    }
  };

  const viewProduct = (productId: string) => {
    if (!recentlyViewed.includes(productId)) {
      setRecentlyViewed([productId, ...recentlyViewed.slice(0, 9)]);
    }
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setShowDetailsDialog(true);
    }
  };

  const shareProduct = (product: Product) => {
    if (navigator.share) {
      navigator
        .share({
          title: product.name,
          text: `Check out ${product.name} - ₱${parseFloat(product.price.toString()).toFixed(2)}`,
          url: window.location.href,
        })
        .then(() => {
          toast({
            title: "Shared successfully",
            description: "Product link shared",
          });
        })
        .catch(() => {
          copyToClipboard(product);
        });
    } else {
      copyToClipboard(product);
    }
  };

  const copyToClipboard = (product: Product) => {
    const text = `${product.name} - ₱${parseFloat(product.price.toString()).toFixed(2)} - ${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: "Product details copied to clipboard",
      });
    });
  };

  const bulkAddToCart = (productIds: string[]) => {
    const productsToAdd = products.filter((p) =>
      productIds.includes(p.id)
    );
    productsToAdd.forEach((product) => {
      const existingItem = cart.find((item) => item.product.id === product.id);
      if (!existingItem) {
        setCart((prev) => [...prev, { product, quantity: 1 }]);
      }
    });
    toast({
      title: "Items added to cart",
      description: `${productsToAdd.length} items added from wishlist`,
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(
        cart.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item,
        ),
      );
    }
  };

  return (
    <CustomerLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Active Promos Banner */}
        {activePromos.length > 0 && (
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 py-4 md:py-6 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Promo Title */}
              <div className="flex items-center justify-center gap-3 mb-3">
                <Award className="w-6 h-6 md:w-8 md:h-8 text-white animate-pulse" />
                <h3 className="text-xl md:text-2xl font-bold text-white">
                  {activePromos[0].name}
                </h3>
              </div>

              {/* Discount Display */}
              <div className="text-center mb-4">
                <span className="text-3xl md:text-4xl font-black text-white">
                  {activePromos[0].discount_type === 'percentage' 
                    ? `${activePromos[0].discount_value}% OFF` 
                    : `₱${activePromos[0].discount_value} OFF`}
                </span>
                {activePromos[0].min_purchase && activePromos[0].min_purchase > 0 && (
                  <p className="text-sm text-white/90 mt-2">
                    Minimum Purchase: ₱{Number(activePromos[0].min_purchase).toFixed(0)}
                  </p>
                )}
              </div>

              {/* Date Display - PROMINENTLY */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 bg-white/10 backdrop-blur-sm rounded-lg py-3 px-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-white" />
                  <div className="text-left">
                    <p className="text-xs text-white/80 uppercase tracking-wide">Valid From</p>
                    <p className="text-base md:text-lg font-bold text-white">
                      {activePromos[0].start_date ? new Date(activePromos[0].start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="hidden md:block w-px h-12 bg-white/30"></div>
                <div className="block md:hidden w-full h-px bg-white/30"></div>
                
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-white" />
                  <div className="text-left">
                    <p className="text-xs text-white/80 uppercase tracking-wide">Until</p>
                    <p className="text-base md:text-lg font-bold text-white">
                      {activePromos[0].end_date ? new Date(activePromos[0].end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="hidden md:block w-px h-12 bg-white/30"></div>
                <div className="block md:hidden w-full h-px bg-white/30"></div>
                
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-white" />
                  <div className="text-left">
                    <p className="text-xs text-white/80 uppercase tracking-wide">Time Left</p>
                    <p className="text-base md:text-lg font-bold text-white">
                      {getTimeRemaining(activePromos[0].end_date).formatted}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section with Search */}
        <div className="bg-gradient-to-r from-gold-500 via-yellow-500 to-gold-500 rounded-xl md:rounded-2xl p-4 md:p-8 mb-6 md:mb-8 shadow-xl">
          <div className="max-w-2xl">
            <h2 className="text-xl md:text-3xl font-bold text-black mb-1 md:mb-2">
              Discover Premium Products
            </h2>
            <p className="text-sm md:text-base text-black/70 mb-4 md:mb-6">
              Quality items at the best prices. Shop now and save!
            </p>
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 md:w-5 h-4 md:h-5 text-gray-500" />
              <Input
                type="text"
                placeholder="Search for products..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 md:pl-12 pr-3 md:pr-4 py-4 md:py-6 text-base md:text-lg bg-white border-none shadow-lg rounded-lg md:rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl md:text-3xl font-bold text-blue-600">{filteredProducts.length}</p>
                  <p className="text-xs md:text-sm text-blue-600/70 mt-0.5 md:mt-1">Products</p>
                </div>
                <div className="p-2 md:p-3 bg-blue-500 rounded-lg md:rounded-xl">
                  <Package className="w-4 md:w-6 h-4 md:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl md:text-3xl font-bold text-green-600">{cart.length}</p>
                  <p className="text-xs md:text-sm text-green-600/70 mt-0.5 md:mt-1">In Cart</p>
                </div>
                <div className="p-2 md:p-3 bg-green-500 rounded-lg md:rounded-xl">
                  <ShoppingCart className="w-4 md:w-6 h-4 md:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl md:text-3xl font-bold text-pink-600">{wishlist.length}</p>
                  <p className="text-xs md:text-sm text-pink-600/70 mt-0.5 md:mt-1">Wishlist</p>
                </div>
                <div className="p-2 md:p-3 bg-pink-500 rounded-lg md:rounded-xl">
                  <Heart className="w-4 md:w-6 h-4 md:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gold-50 to-yellow-100 border-gold-200 hover:shadow-lg transition-shadow">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg md:text-2xl font-bold text-gold-600">
                    ₱{(() => {
                      const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
                      const discount = cart.reduce((sum, item) => {
                        if (!item.promo) return sum;
                        return sum + (getDiscountAmount(item.product.price, item.promo, subtotal) * item.quantity);
                      }, 0);
                      return Math.max(0, subtotal - discount).toFixed(2);
                    })()}
                  </p>
                  <p className="text-xs md:text-sm text-gold-600/70 mt-0.5 md:mt-1">Total</p>
                </div>
                <div className="p-2 md:p-3 bg-gold-500 rounded-lg md:rounded-xl">
                  <TrendingUp className="w-4 md:w-6 h-4 md:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Sidebar - Filters & Cart (Hidden on mobile, shown in sheet) */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
            {/* Filters Card */}
            <Card className="shadow-lg border-gold-500/20">
              <CardHeader className="bg-gradient-to-r from-gold-500/10 to-yellow-500/10 border-b border-gold-500/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FilterIcon className="w-5 h-5 text-gold-500" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Category Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Category
                  </label>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setSelectedCategory("");
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all font-medium ${
                        selectedCategory === ""
                          ? "bg-gradient-to-r from-gold-500 to-yellow-500 text-black shadow-md scale-[1.02]"
                          : "bg-white text-slate-700 hover:bg-gold-50 border-2 border-slate-200 hover:border-gold-300"
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCurrentPage(1);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all font-medium ${
                          selectedCategory === cat
                            ? "bg-gradient-to-r from-gold-500 to-yellow-500 text-black shadow-md scale-[1.02]"
                            : "bg-white text-slate-700 hover:bg-gold-50 border-2 border-slate-200 hover:border-gold-300"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price Range Filter */}
                <div className="space-y-3 pt-6 border-t-2 border-slate-100">
                  <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Price Range
                  </label>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gold-50 to-yellow-50 rounded-lg">
                      <span className="text-sm font-semibold text-gold-700">₱{priceRange[0]}</span>
                      <span className="text-slate-400">—</span>
                      <span className="text-sm font-semibold text-gold-700">₱{priceRange[1]}</span>
                    </div>
                    <div className="space-y-3 px-2">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Minimum</label>
                        <Input
                          type="range"
                          min="0"
                          max="10000"
                          step="100"
                          value={priceRange[0]}
                          onChange={(e) => {
                            const newMin = parseInt(e.target.value);
                            setPriceRange([
                              Math.min(newMin, priceRange[1] - 100),
                              priceRange[1],
                            ]);
                            setCurrentPage(1);
                          }}
                          className="w-full accent-gold-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block">Maximum</label>
                        <Input
                          type="range"
                          min="0"
                          max="10000"
                          step="100"
                          value={priceRange[1]}
                          onChange={(e) => {
                            const newMax = parseInt(e.target.value);
                            setPriceRange([
                              priceRange[0],
                              Math.max(newMax, priceRange[0] + 100),
                            ]);
                            setCurrentPage(1);
                          }}
                          className="w-full accent-gold-500"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPriceRange([0, 10000]);
                        setCurrentPage(1);
                      }}
                      className="w-full border-gold-300 text-gold-600 hover:bg-gold-50"
                    >
                      Reset Range
                    </Button>
                  </div>
                </div>

                {/* Clear All Filters */}
                <Button
                  variant="default"
                  onClick={() => {
                    setSelectedCategory("");
                    setPriceRange([0, 10000]);
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All Filters
                </Button>
              </CardContent>
            </Card>

            {/* Wishlist Card */}
            {showWishlist && (
              <Card className="lg:sticky lg:top-24">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Wishlist</span>
                    {wishlist.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const wishlistedProducts = products
                            .filter((p) => wishlist.includes(p.id))
                            .map((p) => p.id);
                          bulkAddToCart(wishlistedProducts);
                        }}
                      >
                        Add All to Cart
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {wishlist.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">
                      Your wishlist is empty
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {products
                        .filter((p) => wishlist.includes(p.id))
                        .map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg group"
                          >
                            <div className="w-10 h-10 bg-slate-200 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-slate-900 truncate">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-600">
                                ₱{parseFloat(product.price.toString()).toFixed(2)}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => addToCart(product)}
                                className="p-1 hover:bg-slate-200 rounded"
                                title="Add to cart"
                              >
                                <ShoppingCart className="w-4 h-4 text-blue-600" />
                              </button>
                              <button
                                onClick={() => toggleWishlist(product.id)}
                                className="p-1 hover:bg-slate-200 rounded"
                                title="Remove"
                              >
                                <X className="w-4 h-4 text-slate-600" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
            {/* Toolbar */}
            <Card className="shadow-md border-gold-500/20">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                    {/* Mobile Filter Button */}
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="lg:hidden flex items-center gap-2 border-gold-300 text-gold-600 hover:bg-gold-50"
                        >
                          <FilterIcon className="w-4 h-4" />
                          <span className="text-sm">Filters</span>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-[300px] overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle className="flex items-center gap-2">
                            <FilterIcon className="w-5 h-5 text-gold-500" />
                            Filters
                          </SheetTitle>
                        </SheetHeader>
                        <div className="space-y-6 mt-6">
                          {/* Category Filter */}
                          <div className="space-y-3">
                            <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                              Category
                            </label>
                            <div className="space-y-2">
                              <button
                                onClick={() => {
                                  setSelectedCategory("");
                                  setCurrentPage(1);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all font-medium ${
                                  selectedCategory === ""
                                    ? "bg-gradient-to-r from-gold-500 to-yellow-500 text-black shadow-md"
                                    : "bg-white text-slate-700 hover:bg-gold-50 border-2 border-slate-200"
                                }`}
                              >
                                All Categories
                              </button>
                              {categories.map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => {
                                    setSelectedCategory(cat);
                                    setCurrentPage(1);
                                  }}
                                  className={`w-full text-left px-4 py-3 rounded-lg transition-all font-medium ${
                                    selectedCategory === cat
                                      ? "bg-gradient-to-r from-gold-500 to-yellow-500 text-black shadow-md"
                                      : "bg-white text-slate-700 hover:bg-gold-50 border-2 border-slate-200"
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Price Range Filter */}
                          <div className="space-y-3 pt-6 border-t-2 border-slate-100">
                            <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                              Price Range
                            </label>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gold-50 to-yellow-50 rounded-lg">
                                <span className="text-sm font-semibold text-gold-700">₱{priceRange[0]}</span>
                                <span className="text-slate-400">—</span>
                                <span className="text-sm font-semibold text-gold-700">₱{priceRange[1]}</span>
                              </div>
                              <div className="space-y-3 px-2">
                                <div>
                                  <label className="text-xs text-slate-600 mb-1 block">Minimum</label>
                                  <Input
                                    type="range"
                                    min="0"
                                    max="10000"
                                    step="100"
                                    value={priceRange[0]}
                                    onChange={(e) => {
                                      const newMin = parseInt(e.target.value);
                                      setPriceRange([
                                        Math.min(newMin, priceRange[1] - 100),
                                        priceRange[1],
                                      ]);
                                      setCurrentPage(1);
                                    }}
                                    className="w-full accent-gold-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-600 mb-1 block">Maximum</label>
                                  <Input
                                    type="range"
                                    min="0"
                                    max="10000"
                                    step="100"
                                    value={priceRange[1]}
                                    onChange={(e) => {
                                      const newMax = parseInt(e.target.value);
                                      setPriceRange([
                                        priceRange[0],
                                        Math.max(newMax, priceRange[0] + 100),
                                      ]);
                                      setCurrentPage(1);
                                    }}
                                    className="w-full accent-gold-500"
                                  />
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPriceRange([0, 10000]);
                                  setCurrentPage(1);
                                }}
                                className="w-full border-gold-300 text-gold-600 hover:bg-gold-50"
                              >
                                Reset Range
                              </Button>
                            </div>
                          </div>

                          {/* Clear All Filters */}
                          <Button
                            variant="default"
                            onClick={() => {
                              setSelectedCategory("");
                              setPriceRange([0, 10000]);
                              setSearchTerm("");
                              setCurrentPage(1);
                            }}
                            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Clear All Filters
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] border-gold-300 focus:border-gold-500">
                        <SlidersHorizontal className="w-4 h-4 mr-2 text-gold-500" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="price-asc">Price: Low to High</SelectItem>
                        <SelectItem value="price-desc">Price: High to Low</SelectItem>
                        <SelectItem value="newest">Newest First</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="hidden md:flex gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                      <Button
                        size="sm"
                        variant={viewMode === "grid" ? "default" : "ghost"}
                        onClick={() => setViewMode("grid")}
                        className={`h-9 w-9 p-0 ${viewMode === "grid" ? "bg-gold-500 text-black hover:bg-gold-600 shadow-sm" : "text-slate-600 hover:bg-white"}`}
                      >
                        <Grid3x3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={viewMode === "list" ? "default" : "ghost"}
                        onClick={() => setViewMode("list")}
                        className={`h-9 w-9 p-0 ${viewMode === "list" ? "bg-gold-500 text-black hover:bg-gold-600 shadow-sm" : "text-slate-600 hover:bg-white"}`}
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs md:text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{filteredProducts.length}</span>
                    <span>products</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Display */}
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">
                Loading products...
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No products found
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {paginatedProducts.map((product) => {
                  const promo = getProductPromo(product.id);
                  const hasPromo = !!promo;
                  const discountedPrice = hasPromo ? getProductDiscountedPrice(product) : product.price;
                  const discountAmount = hasPromo ? getProductDiscountAmount(product) : 0;
                  
                  return (
                    <Card
                      key={product.id}
                      className="group hover:shadow-xl transition-all overflow-hidden flex flex-col relative"
                    >
                      {/* Action Buttons */}
                      <div className="absolute top-2 md:top-3 right-2 md:right-3 z-10 flex flex-col gap-1 md:gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(product.id);
                          }}
                          type="button"
                          aria-label={wishlist.includes(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                          title={wishlist.includes(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                          className="p-1.5 md:p-2 bg-white rounded-full shadow-md hover:bg-pink-50 transition-colors"
                        >
                          <Heart
                            className={`w-3 md:w-4 h-3 md:h-4 ${
                              wishlist.includes(product.id)
                                ? "fill-pink-500 text-pink-500"
                                : "text-slate-400"
                            }`}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            shareProduct(product);
                          }}
                          type="button"
                          aria-label="Share product"
                          title="Share product"
                          className="p-1.5 md:p-2 bg-white rounded-full shadow-md hover:bg-blue-50 transition-colors hidden md:block"
                        >
                          <Share2 className="w-3 md:w-4 h-3 md:h-4 text-slate-400 hover:text-blue-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompare(product.id);
                          }}
                          type="button"
                          aria-label={compareList.includes(product.id) ? "Remove from comparison" : "Add to comparison"}
                          title={compareList.includes(product.id) ? "Remove from comparison" : "Add to comparison"}
                          className={`p-1.5 md:p-2 bg-white rounded-full shadow-md transition-colors hidden md:block ${
                            compareList.includes(product.id)
                              ? "bg-orange-50"
                              : "hover:bg-orange-50"
                          }`}
                        >
                          <ArrowUpDown
                            className={`w-3 md:w-4 h-3 md:h-4 ${
                              compareList.includes(product.id)
                                ? "text-orange-600"
                                : "text-slate-400"
                            }`}
                          />
                        </button>
                      </div>

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

                      <div className="aspect-square bg-slate-100 flex items-center justify-center relative overflow-hidden">
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
                        
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <Package className="w-16 h-16 text-slate-400" />
                        )}
                      </div>

                    <CardContent className="p-2 md:p-4 pt-3 md:pt-4 flex-1 flex flex-col">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-1 md:gap-2">
                          <p className="font-semibold text-xs md:text-sm text-slate-900 line-clamp-2">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-0.5 md:gap-1 text-[10px] md:text-xs shrink-0">
                            <Star className="w-2.5 md:w-3 h-2.5 md:h-3 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold">4.5</span>
                          </div>
                        </div>
                        <p className="text-[10px] md:text-xs text-slate-600 mt-0.5 md:mt-1">
                          {product.category}
                        </p>
                        <p className="text-[10px] md:text-xs text-slate-500 mt-1 md:mt-2 line-clamp-2 hidden md:block">
                          {product.description}
                        </p>
                      </div>

                      <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-slate-200">
                        <div className="flex items-baseline gap-1 md:gap-2">
                          {hasPromo ? (
                            <>
                              <p className="text-sm md:text-lg font-bold text-red-600">
                                ₱{parseFloat(discountedPrice.toString()).toFixed(2)}
                              </p>
                              <p className="text-xs md:text-sm text-slate-400 line-through">
                                ₱{parseFloat(product.price.toString()).toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm md:text-lg font-bold text-gold-500">
                              ₱{parseFloat(product.price.toString()).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => addToCart(product)}
                          size="sm"
                          className="w-full mt-2 md:mt-3 bg-gold-500 hover:bg-gold-600 text-black font-semibold flex items-center justify-center gap-1 md:gap-2 h-8 md:h-9 text-xs md:text-sm"
                        >
                          <ShoppingCart className="w-3 md:w-4 h-3 md:h-4" />
                          <span className="hidden sm:inline">Add to Cart</span>
                          <span className="sm:hidden">Add</span>
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewProduct(product.id);
                          }}
                          size="sm"
                          variant="outline"
                          className="w-full mt-1.5 md:mt-2 flex items-center justify-center gap-1 md:gap-2 h-8 md:h-9 text-xs md:text-sm"
                        >
                          <Eye className="w-3 md:w-4 h-3 md:h-4" />
                          <span className="hidden sm:inline">View Details</span>
                          <span className="sm:hidden">View</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            ) : (
              // List View
              <div className="space-y-4">
                {paginatedProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="hover:shadow-lg transition-all overflow-hidden"
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-32 h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden rounded-lg shrink-0">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-12 h-12 text-slate-400" />
                          )}
                          {product.cost && product.price < product.cost && (
                            <Badge className="absolute top-2 left-2 bg-red-500">
                              Sale
                            </Badge>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg text-slate-900">
                                {product.name}
                              </h3>
                              <p className="text-sm text-slate-600">
                                {product.category}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className="w-3 h-3 fill-yellow-400 text-yellow-400"
                                  />
                                ))}
                                <span className="text-xs text-slate-500 ml-1">
                                  (128 reviews)
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleWishlist(product.id);
                                }}
                                type="button"
                                aria-label={wishlist.includes(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                                title={wishlist.includes(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Heart
                                  className={`w-5 h-5 ${
                                    wishlist.includes(product.id)
                                      ? "fill-pink-500 text-pink-500"
                                      : "text-slate-400"
                                  }`}
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  shareProduct(product);
                                }}
                                type="button"
                                aria-label="Share product"
                                title="Share product"
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Share2 className="w-5 h-5 text-slate-400" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCompare(product.id);
                                }}
                                type="button"
                                aria-label={compareList.includes(product.id) ? "Remove from comparison" : "Add to comparison"}
                                title={compareList.includes(product.id) ? "Remove from comparison" : "Add to comparison"}
                                className={`p-2 hover:bg-slate-100 rounded-lg transition-colors ${
                                  compareList.includes(product.id)
                                    ? "bg-orange-50"
                                    : ""
                                }`}
                              >
                                <ArrowUpDown
                                  className={`w-5 h-5 ${
                                    compareList.includes(product.id)
                                      ? "text-orange-600"
                                      : "text-slate-400"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                            {product.description}
                          </p>

                          <div className="mt-auto pt-4 flex items-center justify-between">
                            <div>
                              <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-bold text-primary">
                                  ₱
                                  {parseFloat(product.price.toString()).toFixed(
                                    2
                                  )}
                                </p>
                                {product.cost && product.price < product.cost && (
                                  <p className="text-sm text-slate-400 line-through">
                                    ₱
                                    {parseFloat(product.cost.toString()).toFixed(
                                      2
                                    )}
                                  </p>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                SKU: {product.sku}
                              </p>
                            </div>
                            <Button
                              onClick={(e) => quickAddToCart(product, e)}
                              size="lg"
                              className="bg-primary hover:bg-primary/90 flex items-center gap-2"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Add to Cart
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4">
                <p className="text-xs md:text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex-1 sm:flex-none"
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="flex-1 sm:flex-none"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Recently Viewed Section */}
            {recentlyViewed.length > 0 && (
              <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-200">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-3 md:mb-4">
                  Recently Viewed
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                  {products
                    .filter((p) => recentlyViewed.includes(p.id))
                    .slice(0, 5)
                    .map((product) => (
                      <Card
                        key={product.id}
                        className="group hover:shadow-lg transition-all overflow-hidden cursor-pointer"
                        onClick={() => viewProduct(product.id)}
                      >
                        <div className="aspect-square bg-slate-100 flex items-center justify-center relative overflow-hidden">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                          ) : (
                            <Package className="w-12 h-12 text-slate-400" />
                          )}
                        </div>
                        <CardContent className="p-3">
                          <p className="font-semibold text-sm text-slate-900 line-clamp-1">
                            {product.name}
                          </p>
                          <p className="text-sm font-bold text-gold-500 mt-1">
                            ₱{parseFloat(product.price.toString()).toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Compare Products Section */}
            {compareList.length > 0 && (
              <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-base md:text-xl font-bold text-slate-900">
                    Compare Products ({compareList.length}/4)
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompareList([])}
                    className="text-xs md:text-sm"
                  >
                    Clear All
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <div className="inline-flex gap-4 pb-4">
                    {products
                      .filter((p) => compareList.includes(p.id))
                      .map((product) => (
                        <Card
                          key={product.id}
                          className="w-64 flex-shrink-0 relative"
                        >
                          <button
                            onClick={() => toggleCompare(product.id)}
                            type="button"
                            aria-label="Remove from comparison"
                            title="Remove from comparison"
                            className="absolute top-2 right-2 z-10 p-1 bg-white rounded-full shadow-md hover:bg-red-50"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                          <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-16 h-16 text-slate-400" />
                            )}
                          </div>
                          <CardContent className="p-4 space-y-2">
                            <h4 className="font-semibold text-slate-900 line-clamp-2">
                              {product.name}
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Category:</span>
                                <span className="font-medium">
                                  {product.category}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">Price:</span>
                                <span className="font-bold text-primary">
                                  ₱
                                  {parseFloat(product.price.toString()).toFixed(
                                    2
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">SKU:</span>
                                <span className="font-mono text-xs">
                                  {product.sku}
                                </span>
                              </div>
                            </div>
                            <Button
                              onClick={() => addToCart(product)}
                              size="sm"
                              className="w-full mt-3"
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Add to Cart
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Details Dialog */}
      <ProductDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        product={selectedProduct}
      />
      </div>
    </CustomerLayout>
  );
}




