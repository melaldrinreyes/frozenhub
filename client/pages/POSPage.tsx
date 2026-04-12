import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/authContext";
import { confirmLogout } from "@/lib/logout";
import Receipt from "@/components/Receipt";
import { useBranchName } from "@/hooks/useBranchName";
import {
  Snowflake,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  LogOut,
  Search,
  Clock,
  Tag,
  Package,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getDiscountedPrice, getDiscountAmount } from "@/lib/discountUtils";

const JWT_TOKEN_KEY = "frozenhub_jwt_token";

function withAuth(init: RequestInit = {}): RequestInit {
  const token = typeof window !== "undefined" ? localStorage.getItem(JWT_TOKEN_KEY) : null;
  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  };
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  stock: number;
  promo?: any;
  discountAmount: number;
  finalPrice: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  active: boolean;
  promo?: any;
}

export default function POSPage() {
  // All state and ref declarations at the top
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = React.useRef<HTMLInputElement>(null);
  const scanTimeoutRef = React.useRef<number | null>(null);
  // Alternative global scanner capture (keyboard-emulating scanners)
  const scanGlobalBufferRef = React.useRef<string>("");
  const lastKeyTimeRef = React.useRef<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showGcashForm, setShowGcashForm] = useState(false);
  const [gcashReference, setGcashReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  // Scan-to-Pay barcode states
  const [payBarcode, setPayBarcode] = useState("");
  const [payBarcodeError, setPayBarcodeError] = useState("");
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false);
  const [multiMatchProducts, setMultiMatchProducts] = useState<Product[] | null>(null);
  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  // ...other state declarations...
  // Focus barcode input on mount and after every scan
  useEffect(() => {
    if (barcodeInputRef.current && typeof barcodeInputRef.current.focus === 'function') {
      barcodeInputRef.current.focus();
    }
  }, [cart]);

  // Cleanup any pending scan timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        window.clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, []);

  // Global keydown listener to capture scanner input (alternative to hidden input).
  // Detects fast sequences of keys and treats them as scanner input. Ignores normal typing (slower).
  React.useEffect(() => {
    const THRESHOLD_MS = 100; // max interval between keystrokes to consider as scanner

    const onKeyDown = (e: KeyboardEvent) => {
      // ignore modifier keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

      const now = Date.now();
      const last = lastKeyTimeRef.current;

      // If time since last key is large, reset buffer
      if (!last || now - last > THRESHOLD_MS) {
        scanGlobalBufferRef.current = '';
      }

      lastKeyTimeRef.current = now;

      // If focused element is an interactive input other than our hidden scanner input, don't capture
      const active = document.activeElement as HTMLElement | null;
      const isUserTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true') && active !== barcodeInputRef.current;
      if (isUserTyping) return; // let user type normally

      // Handle Enter -> process buffer
      if (e.key === 'Enter') {
        const code = scanGlobalBufferRef.current.trim();
        if (code) {
          console.log('🔔 Global scanner captured code (Enter):', code);
          processScannedCode(code);
        }
        scanGlobalBufferRef.current = '';
        lastKeyTimeRef.current = null;
        return;
      }

      // Append single character to buffer (ignore unprintable keys)
      if (e.key.length === 1) {
        scanGlobalBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Process a scanned barcode code (product or payment)
  const processScannedCode = async (rawCode: string) => {
    const code = rawCode.trim();
    console.log("🔍 processScannedCode -> Scanned Barcode:", code);
    console.log("🛒 processScannedCode -> Current Cart State:", cart);
    // clear visible input
    setBarcodeInput("");
    // focus back to hidden input
    barcodeInputRef.current?.focus();

    if (!code) {
      console.warn("⚠️ processScannedCode -> No barcode entered.");
      return;
    }

    // Check if barcode matches any product in the full product list (not just those with inventory)
    const matchedProducts = products.filter((p: any) => {
      const pb = p.barcode ?? p.barcode_number ?? p.upc ?? "";
      try {
        return String(pb).trim() === String(code).trim();
      } catch {
        return false;
      }
    });
    if (matchedProducts.length === 1) {
      const foundProduct = matchedProducts[0];
      // Now check if this product has inventory in the branch
      const inv = inventory.find((i: any) => i.product_id === foundProduct.id);
      if (inv && inv.quantity > 0) {
        // Add to cart with stock info
        addToCart({ ...foundProduct, stock: inv.quantity });
        toast({ title: "Added to cart", description: foundProduct.name });
      } else {
        toast({ title: "Out of Stock", description: foundProduct.name, variant: "destructive" });
      }
      return;
    } else if (matchedProducts.length > 1) {
      // Multiple products share this barcode (or similar codes). Show selection UI.
      setMultiMatchProducts(matchedProducts.map(p => {
        const inv = inventory.find((i: any) => i.product_id === p.id);
        return { ...p, stock: inv ? inv.quantity : 0 };
      }));
      return;
    }


    // Check if barcode matches a payment/transaction
    if (code.startsWith("PAY-")) {
      if (cart.length === 0) {
        console.warn("⚠️ processScannedCode -> Cart is empty. Cannot process payment.");
        toast({ title: "Cart is empty", description: "Scan products first.", variant: "destructive" });
        return;
      }

      // Instead of auto-processing, open the payment modal and pre-fill the barcode
      setPayBarcode(code);
      setShowPayment(true);
      setTimeout(() => {
        const payInput = document.getElementById("pay-barcode") as HTMLInputElement | null;
        payInput?.focus();
      }, 100);
      return;
    }

    // If not a product or payment barcode
    console.warn("❓ processScannedCode -> Unknown Barcode:", code);
    // Fallback: try server-side products fetch to see if DB has this barcode (helps when client cache not ready)
    try {
      const branchId = user?.branch_id;
      if (!branchId) throw new Error("No branch ID");
      const resp = await fetch(`/api/products?branchId=${branchId}`, withAuth());
      if (resp.ok) {
        const data = await resp.json();
        const serverProducts = data.products || [];
        const matched = serverProducts.find((p: any) => {
          const pb = p.barcode ?? p.barcode_number ?? p.upc ?? "";
          try { return String(pb).trim() === String(code).trim(); } catch { return false; }
        });
        if (matched) {
          toast({ title: 'Product Found', description: matched.name });
          return;
        }
      }
    } catch (err) {
      console.warn('Error checking server products for barcode fallback', err);
    }

    toast({ title: "Unknown barcode", description: code, variant: "destructive" });
  };

  // Add from multi-match modal
  const addFromMulti = (product: Product) => {
    addToCart(product);
    toast({ title: `Added: ${product.name}` });
    setMultiMatchProducts(null);
    // refocus input
    barcodeInputRef.current?.focus();
  };

  const addAllFromMulti = () => {
    if (!multiMatchProducts) return;
    multiMatchProducts.forEach(p => addToCart(p));
    toast({ title: `Added ${multiMatchProducts.length} items` });
    setMultiMatchProducts(null);
    barcodeInputRef.current?.focus();
  };

  // onChange handler: update buffer and start short timeout for scanner input
  const onBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcodeInput(value);

    // clear any existing timeout
    if (scanTimeoutRef.current) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    // If scanner sends all characters quickly, process after short idle (120ms)
    scanTimeoutRef.current = window.setTimeout(() => {
      scanTimeoutRef.current = null;
      if (value && value.length > 0) {
        processScannedCode(value);
      }
    }, 120);
  };

  // onKeyDown handler: process immediately on Enter
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (scanTimeoutRef.current) {
        window.clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      const current = barcodeInputRef.current?.value ?? barcodeInput;
      if (current) processScannedCode(current);
    }
  };

  const { user, logout } = useAuth();
  const branchName = useBranchName(user?.branch_id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();


  // Redirect non-POS operators
  useEffect(() => {
    if (user && !["admin", "branch_admin", "pos_operator"].includes(user.role)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the POS system",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, navigate, toast]);

  // Fetch all products with inventory
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", "pos", user?.branch_id],
    queryFn: async () => {
      const branchId = user?.branch_id;
      if (!branchId) throw new Error("No branch ID");
      const response = await fetch(`/api/products?branchId=${branchId}`, withAuth());
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: !!user?.branch_id,
  });

  // Fetch active promos
  const { data: promosData } = useQuery({
    queryKey: ["activePromos"],
    queryFn: async () => {
      const response = await fetch("/api/promos/active", withAuth());
      if (!response.ok) throw new Error("Failed to fetch promos");
      return response.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  // Fetch inventory for current branch
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory", user?.branch_id],
    queryFn: async () => {
      const response = await fetch(`/api/inventory?branchId=${user?.branch_id}`, withAuth());
      if (!response.ok) throw new Error("Failed to fetch inventory");
      return response.json();
    },
    enabled: !!user?.branch_id,
  });

  const { data: salesHistoryData } = useQuery({
    queryKey: ["sales", "pos-history", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return { sales: [] };
      const response = await fetch(`/api/sales?branchId=${user.branch_id}&page=1&limit=10`, withAuth());
      if (!response.ok) {
        throw new Error("Failed to fetch sales history");
      }
      return response.json();
    },
    enabled: !!user?.branch_id,
    refetchInterval: 30 * 1000,
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const response = await fetch("/api/sales", withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      }));
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create sale");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      
      // Prepare receipt data
      const saleDate = new Date();
      const receiptInfo = {
        saleId: data.saleId,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          discountAmount: item.discountAmount,
          finalPrice: item.finalPrice,
        })),
        subtotal,
        totalDiscount,
        total,
        paymentMethod: paymentMethod || "cash",
        gcashReference: paymentMethod === "gcash" ? gcashReference : undefined,
        date: saleDate,
        operator: user?.name || "POS Operator",
        branchName: branchName || "",
      };
      setReceiptData(receiptInfo);
      setShowReceipt(true);
      
      toast({
        title: "Sale Completed!",
        description: `Total: ₱${data.summary.total.toFixed(2)} | Items: ${data.summary.items_count}`,
      });
      
      setCart([]);
      setShowPayment(false);
      setShowGcashForm(false);
      setPaymentMethod(null);
      setGcashReference("");
      setIsProcessing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Sale Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const products = productsData?.products || [];
  const activePromos = promosData?.promos || [];
  const inventory = inventoryData?.inventory || [];
  const salesHistory = salesHistoryData?.sales || [];

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;
    await logout();
    navigate("/");
  };

  // Map inventory to products
  const productsWithStock = products.map((product: any) => {
    const inv = inventory.find((i: any) => i.product_id === product.id);
    const promo = activePromos.find((p: any) => 
      p.product_ids?.includes(product.id.toString())
    );
    
    return {
      ...product,
      price: parseFloat(product.price) || 0,
      stock: inv?.quantity || 0,
      promo,
    };
  });

  const filteredProducts = productsWithStock.filter((product: Product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;
    const isActive = product.active;
    return matchesSearch && matchesCategory && isActive;
  });

  const categories = Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))) as string[];

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.productId === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(
          cart.map((item) =>
            item.productId === product.id
              ? (() => {
                  const currentSubtotal = cart.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
                  const newSubtotal = currentSubtotal + product.price; // Adding one more item
                  const newQuantity = item.quantity + 1;
                  return {
                    ...item, 
                    quantity: newQuantity,
                    discountAmount: getDiscountAmount(product.price, product.promo, newSubtotal) * newQuantity,
                    finalPrice: getDiscountedPrice(product.price, product.promo, newSubtotal) * newQuantity,
                  };
                })()
              : item
          )
        );
      } else {
        toast({
          title: "Out of Stock",
          description: `Only ${product.stock} units available`,
          variant: "destructive",
        });
      }
    } else {
      const currentSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const newSubtotal = currentSubtotal + product.price; // Adding this product
      const discountAmount = getDiscountAmount(product.price, product.promo, newSubtotal);
      const finalPrice = getDiscountedPrice(product.price, product.promo, newSubtotal);
      
      setCart([
        ...cart,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: product.image || "📦",
          stock: product.stock,
          promo: product.promo,
          discountAmount,
          finalPrice,
        },
      ]);
    }
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
    } else {
      setCart(
        cart.map((item) => {
          if (item.id === cartItemId) {
            if (quantity <= item.stock) {
              const currentSubtotal = cart.reduce((sum, cartItem) => 
                cartItem.id === item.id 
                  ? sum + (cartItem.price * quantity) // Use new quantity for this item
                  : sum + (cartItem.price * cartItem.quantity), 0
              );
              const discountAmount = getDiscountAmount(item.price, item.promo, currentSubtotal) * quantity;
              const finalPrice = getDiscountedPrice(item.price, item.promo, currentSubtotal) * quantity;
              return { 
                ...item, 
                quantity,
                discountAmount,
                finalPrice,
              };
            } else {
              toast({
                title: "Insufficient Stock",
                description: `Only ${item.stock} units available`,
                variant: "destructive",
              });
            }
          }
          return item;
        })
      );
    }
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter((item) => item.id !== cartItemId));
  };

  // Use enhanced cart calculation with minimum purchase requirements
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalDiscount = cart.reduce((sum, item) => {
      if (!item.promo) return sum;
      const itemDiscount = getDiscountAmount(item.price, item.promo, subtotal) * item.quantity;
      return sum + itemDiscount;
    }, 0);
    const total = Math.max(0, subtotal - totalDiscount);  const handleCheckout = async (method: "cash" | "gcash") => {
    if (cart.length === 0) {
      toast({
        title: "Cart is Empty",
        description: "Please add items to cart before checkout",
        variant: "destructive",
      });
      return;
    }

    if (!user?.branch_id) {
      toast({
        title: "Branch Not Set",
        description: "Please contact administrator",
        variant: "destructive",
      });
      return;
    }

    setPaymentMethod(method);

    // If Gcash is selected, show reference form
    if (method === "gcash") {
      setShowGcashForm(true);
      return;
    }

    // For cash, proceed directly
    setIsProcessing(true);

    const saleData = {
      branchId: user.branch_id,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      paymentMethod: "cash",
      totalAmount: total,
      notes: `POS Sale - ${cart.length} items`,
    };

    createSaleMutation.mutate(saleData);
  };

  const handleGcashPayment = async () => {
    if (!gcashReference || gcashReference.trim().length === 0) {
      toast({
        title: "Reference Required",
        description: "Please enter Gcash reference number",
        variant: "destructive",
      });
      return;
    }

    if (gcashReference.trim().length < 6) {
      toast({
        title: "Invalid Reference",
        description: "Reference number must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    const saleData = {
      branchId: user.branch_id,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      paymentMethod: "gcash",
      totalAmount: total,
      notes: `POS Sale - ${cart.length} items - Gcash Ref: ${gcashReference.trim()}`,
      gcashReference: gcashReference.trim(),
    };

    createSaleMutation.mutate(saleData);
  };

  if (productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading POS System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-black via-gray-900 to-black border-b border-gold-500/30 sticky top-0 z-30 shadow-lg">
        <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative">
                <Snowflake className="w-6 h-6 sm:w-8 sm:h-8 text-gold-400" />
                <div className="absolute inset-0 bg-gold-400/20 blur-lg rounded-full" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-gold-400 leading-tight">
                  Point of Sale
                </h1>
                <p className="text-xs text-gray-400 hidden sm:block">
                  Branch POS System
                </p>
              </div>
            </div>

            {/* User Info & Clock */}
            <div className="ml-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4 w-full sm:w-auto sm:justify-end">
              <div className="hidden md:flex flex-col items-end min-w-0">
                <p className="text-xs text-gray-400">Operator</p>
                <p className="text-sm font-medium text-gold-400 truncate max-w-[12rem]">{user?.name}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm text-gray-300 bg-black/40 px-3 py-2 rounded-lg border border-gold-500/20">
                <Clock className="w-4 h-4 text-gold-400" />
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto border-gold-500/40 px-3 text-gold-300 hover:bg-gold-500/15 hover:text-gold-200"
              >
                <LogOut className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Logout</span>
                <span className="sm:hidden">Log out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 pb-36 sm:pb-36 md:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Search & Filter */}
            <Card className="border-2 border-slate-200 shadow-lg">
              <CardContent className="pt-4 sm:pt-6 space-y-3 sm:space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 sm:pl-10 text-sm sm:text-base h-10 sm:h-12 border-gray-300 focus:border-gold-500 focus:ring-gold-500/20 rounded-lg"
                  />
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 -mx-1 px-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      selectedCategory === null
                        ? "bg-gradient-to-r from-gold-500 to-gold-600 text-black shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        selectedCategory === category
                          ? "bg-gradient-to-r from-gold-500 to-gold-600 text-black shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filteredProducts.map((product) => {
                const hasPromo = !!product.promo;
                const potentialSubtotal = subtotal + product.price; // If this product was added
                const discountedPrice = hasPromo 
                  ? getDiscountedPrice(product.price, product.promo, potentialSubtotal)
                  : product.price;
                const discountAmount = hasPromo
                  ? getDiscountAmount(product.price, product.promo, potentialSubtotal)
                  : 0;
                
                return (
                  <Card
                    key={product.id}
                    className="hover:shadow-lg transition-all hover:scale-[1.02] border-slate-200 relative overflow-hidden"
                  >
                    {hasPromo && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 animate-pulse">
                          <Tag className="w-3 h-3" />
                          <span className="text-xs font-bold">
                            {product.promo.discount_type === "percentage"
                              ? `${product.promo.discount_value}% OFF`
                              : `₱${product.promo.discount_value} OFF`}
                          </span>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-3 sm:p-4 flex flex-col h-full">
                      <div className="w-full aspect-square bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl overflow-hidden mb-3 relative">
                        {product.image && product.image.startsWith('/') ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                              if (nextEl) nextEl.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-full h-full items-center justify-center text-5xl sm:text-6xl ${product.image && product.image.startsWith('/') ? 'hidden' : 'flex'}`}
                        >
                          📦
                        </div>
                        {product.stock === 0 && (
                          <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                            <span className="text-white text-sm font-bold">OUT OF STOCK</span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[10px] sm:text-xs text-slate-600 font-medium">
                          <Package className="w-3 h-3 inline mr-1" />
                          <span className={product.stock < 10 && product.stock > 0 ? 'text-orange-600 font-bold' : product.stock === 0 ? 'text-red-600 font-bold' : 'text-green-600'}>{product.stock}</span>
                        </p>
                        {product.stock < 10 && product.stock > 0 && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Low
                          </span>
                        )}
                      </div>
                      <div className="mt-auto space-y-2">
                        {hasPromo ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs sm:text-sm text-slate-400 line-through">
                                ₱{product.price.toFixed(2)}
                              </p>
                              <p className="text-base sm:text-lg font-bold text-red-600">
                                ₱{discountedPrice.toFixed(2)}
                              </p>
                            </div>
                            <p className="text-[10px] text-green-600 font-medium">
                              Save ₱{discountAmount.toFixed(2)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-base sm:text-lg font-bold text-primary">
                            ₱{product.price.toFixed(2)}
                          </p>
                        )}
                        <Button
                          onClick={() => addToCart(product)}
                          size="sm"
                          className="w-full min-h-11 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-semibold shadow-sm"
                          disabled={product.stock === 0}
                        >
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          <span className="text-xs sm:text-sm font-semibold">
                            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                          </span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-slate-100 to-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium mb-1">No products found</p>
                <p className="text-xs text-slate-500">Try adjusting your search or filters</p>
              </div>
            )}
          </div>

          {/* Cart Section */}
          <div id="cart-section" className="lg:col-span-1 space-y-4">
            <Card className="lg:sticky lg:top-20 border-2 border-slate-200 shadow-lg lg:max-h-[calc(100vh-6rem)] lg:overflow-hidden">
              <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ShoppingCart className="w-5 h-5 text-gold-500" />
                  <span>Cart ({cart.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 pb-28 md:pb-4 lg:overflow-y-auto lg:max-h-[calc(100vh-10rem)]">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-slate-100 to-slate-50 rounded-full flex items-center justify-center mb-4">
                      <ShoppingCart className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium mb-2">Cart is empty</p>
                    <p className="text-xs text-slate-400">Add products to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Cart Items */}
                    <div className="space-y-2 sm:space-y-3 max-h-[36vh] sm:max-h-60 lg:max-h-[50vh] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
                        >
                          {/* Top row: Image, Info, Remove button (mobile) */}
                          <div className="flex items-start gap-3 flex-1">
                            <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg overflow-hidden">
                              {item.image && item.image.startsWith('/') ? (
                                <img 
                                  src={item.image} 
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (nextEl) nextEl.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div 
                                className={`w-full h-full items-center justify-center text-xl sm:text-2xl ${item.image && item.image.startsWith('/') ? 'hidden' : 'flex'}`}
                              >
                                📦
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm sm:text-base text-slate-900 truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                                  ₱{item.price.toFixed(2)}
                                </p>
                                {item.promo && (
                                  <span className="text-[10px] sm:text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                    <Tag className="w-2.5 h-2.5" />
                                    {item.promo.discount_type === "percentage"
                                      ? `${item.promo.discount_value}%`
                                      : `₱${item.promo.discount_value}`}
                                  </span>
                                )}
                              </div>
                              {item.discountAmount > 0 && (
                                <p className="text-[10px] sm:text-xs text-green-600 font-medium mt-0.5">
                                  -₱{item.discountAmount.toFixed(2)} saved
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="sm:hidden p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Bottom row: Quantity controls (mobile) / Right side (desktop) */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                            <div className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 p-1 w-full sm:w-auto">
                              <button
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity - 1)
                                }
                                className="p-2 hover:bg-slate-100 rounded transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                              <span className="w-8 text-center text-sm font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity + 1)
                                }
                                className="p-2 hover:bg-slate-100 rounded transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            </div>
                            <div className="text-sm sm:text-base font-bold text-slate-900 sm:min-w-[5rem] sm:text-right">
                              ₱{(item.price * item.quantity - item.discountAmount).toFixed(2)}
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="hidden sm:block p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="border-t border-slate-200 pt-3 sm:pt-4 space-y-2 sm:space-y-3">
                      <div className="flex justify-between gap-3 text-sm sm:text-base">
                        <span className="text-slate-600 font-medium">Subtotal:</span>
                        <span className="font-bold text-slate-900">
                          ₱{subtotal.toFixed(2)}
                        </span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between gap-3 text-sm sm:text-base">
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Discounts:
                          </span>
                          <span className="font-bold text-green-600">
                            -₱{totalDiscount.toFixed(2)}
                          </span>
                        </div>
                      )}


                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-base sm:text-lg font-bold bg-gradient-to-r from-gold-500/10 to-gold-600/10 p-3 sm:p-4 rounded-xl border-2 border-gold-500/30 shadow-sm">
                        <span className="text-slate-900">Total:</span>
                        <span className="text-gold-600 text-lg sm:text-xl">
                          ₱{total.toFixed(2)}
                        </span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <div className="text-xs">
                            <p className="font-bold text-green-800">You're saving ₱{totalDiscount.toFixed(2)}!</p>
                            <p className="text-green-700">{cart.filter(i => i.promo).length} promo(s) applied</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Checkout Button */}
                    <Button
                      onClick={() => setShowPayment(true)}
                      disabled={cart.length === 0}
                      className="w-full min-h-12 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold py-4 sm:py-6 shadow-lg hover:shadow-xl transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      Proceed to Payment
                    </Button>

                    {/* Clear Cart */}
                    <Button
                      onClick={() => setCart([])}
                      variant="outline"
                      disabled={cart.length === 0}
                      className="w-full min-h-12 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Cart
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="w-5 h-5 text-gold-500" />
                  <span>Recent History</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                {salesHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">No transactions yet.</p>
                ) : (
                  salesHistory.map((sale: any) => (
                    <div
                      key={sale.id}
                      className="rounded-lg border border-slate-200 p-3 bg-white flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 w-full sm:w-auto">
                        <p className="text-sm font-semibold text-slate-900 truncate" title={sale.id}>{sale.id}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(sale.sale_date || sale.date).toLocaleString()} • {sale.items_count || 0} item(s)
                        </p>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto">
                        <p className="text-sm font-bold text-gold-600">₱{Number(sale.total_amount || 0).toFixed(2)}</p>
                        <p className="text-[11px] text-slate-500 uppercase">{sale.payment_method || "cash"}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating Mobile Cart Button */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-black via-gray-900 to-black border-t border-gold-500/30 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg z-40">
          <button
            onClick={() => {
              // Scroll to cart section
              const cartSection = document.getElementById('cart-section');
              cartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-black py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-bold flex items-center justify-between shadow-lg hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-black text-gold-400 text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold border border-gold-500">
                    {cart.length}
                  </span>
                )}
              </div>
              <span className="text-sm sm:text-base">View Cart</span>
            </div>
            {cart.length > 0 && (
              <span className="text-base sm:text-lg font-bold">
                ₱{cart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0).toFixed(2)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Hidden Barcode Input for Auto Scan */}
      <input
        ref={barcodeInputRef}
        type="text"
        value={barcodeInput}
        onChange={onBarcodeInputChange}
        onKeyDown={handleBarcodeKeyDown}
        className="sr-only"
        autoFocus
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Multi-match product selection modal */}
      {multiMatchProducts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl">
            <CardHeader>
              <CardTitle>Multiple products matched</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">Multiple products match the scanned barcode. Choose which to add:</p>
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {multiMatchProducts.map((p) => (
                  <div key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-2 border rounded">
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-slate-500">₱{p.price.toFixed(2)}</div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button size="sm" onClick={() => addFromMulti(p)}>Add</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="ghost" onClick={() => setMultiMatchProducts(null)}>Cancel</Button>
                <Button onClick={addAllFromMulti}>Add All</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 border-gold-500/30">
            <CardHeader className="border-b border-gold-500/20 bg-gradient-to-r from-gold-500/10 to-gold-600/10">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gold-600" />
                Select Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5 sm:pt-6">
              <div className="bg-gradient-to-r from-gold-500/10 to-gold-600/10 p-4 rounded-xl border-2 border-gold-500/30">
                <p className="text-xs sm:text-sm text-slate-600 mb-1">Total Amount</p>
                <p className="text-2xl sm:text-3xl font-bold text-gold-600">
                  ₱{total.toFixed(2)}
                </p>
                {totalDiscount > 0 && (
                  <div className="mt-2 pt-2 border-t border-gold-500/30">
                    <p className="text-xs text-green-600 font-medium">
                      Discount Applied: -₱{totalDiscount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Original: ₱{subtotal.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Scan-to-Pay Barcode Input removed as requested */}

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleCheckout("gcash")}
                  disabled={isProcessing}
                  className="w-full p-4 sm:p-5 border-2 border-blue-300 rounded-xl hover:bg-blue-50 hover:border-blue-500 hover:shadow-lg transition-all flex items-center gap-3 sm:gap-4 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">G</div>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-slate-900 text-sm sm:text-base">
                      Gcash Payment
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Mobile payment via Gcash
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleCheckout("cash")}
                  disabled={isProcessing}
                  className="w-full p-4 sm:p-5 border-2 border-green-300 rounded-xl hover:bg-green-50 hover:border-green-500 hover:shadow-lg transition-all flex items-center gap-3 sm:gap-4 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Banknote className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-slate-900 text-sm sm:text-base">Cash Payment</p>
                    <p className="text-xs sm:text-sm text-slate-600">Manual payment at counter</p>
                  </div>
                </button>
              </div>

              <Button
                onClick={() => {
                  setShowPayment(false);
                  setPaymentMethod(null);
                  setPayBarcode("");
                  setPayBarcodeError("");
                }}
                variant="outline"
                disabled={isProcessing}
                className="w-full py-3 font-semibold border-slate-300 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gcash Reference Form Modal */}
      {showGcashForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200 border-blue-500/30">
            <CardHeader className="border-b border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-blue-600/10">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-sm font-bold">G</div>
                Gcash Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5 sm:pt-6">
              <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 p-4 rounded-xl border-2 border-blue-500/30">
                <p className="text-xs sm:text-sm text-slate-600 mb-1">Total Amount</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                  ₱{total.toFixed(2)}
                </p>
                {totalDiscount > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-500/30">
                    <p className="text-xs text-green-600 font-medium">
                      Discount Applied: -₱{totalDiscount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Original: ₱{subtotal.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">i</div>
                    Payment Instructions
                  </h3>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Open your Gcash app</li>
                    <li>Send ₱{total.toFixed(2)} to the merchant</li>
                    <li>Take note of the reference number</li>
                    <li>Enter the reference number below</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <label htmlFor="gcash-ref" className="text-sm font-semibold text-slate-700 block">
                    Gcash Reference Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="gcash-ref"
                    type="text"
                    placeholder="Enter reference number (e.g. 1234567890)"
                    value={gcashReference}
                    onChange={(e) => setGcashReference(e.target.value)}
                    className="border-blue-300 focus:border-blue-500 focus:ring-blue-500/20 text-center text-lg font-mono tracking-wider"
                    maxLength={20}
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-slate-500">
                    {gcashReference.length}/20 characters
                  </p>
                </div>
              </div>

              {isProcessing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="text-sm">
                    <p className="font-bold text-blue-800">Processing Payment...</p>
                    <p className="text-blue-700">Please wait</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={handleGcashPayment}
                  disabled={isProcessing || !gcashReference.trim()}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 sm:py-5 shadow-lg hover:shadow-xl transition-all text-sm sm:text-base disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Complete Payment
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setShowGcashForm(false);
                    setGcashReference("");
                    setPaymentMethod(null);
                  }}
                  variant="outline"
                  disabled={isProcessing}
                  className="w-full py-3 font-semibold border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                >
                  Back to Payment Options
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <Receipt
          saleData={receiptData}
          branchName={branchName || ""}
          onClose={() => {
            setShowReceipt(false);
            setReceiptData(null);
          }}
          onPrint={() => {
            // Create a print-friendly version
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Receipt - ${receiptData.saleId}</title>
                        <style>
                          /* Print page sizing for standard 80mm thermal receipt */
                          @page { size: 80mm auto; margin: 5mm; }
                          @media print {
                            body { font-family: 'Courier New', monospace; margin: 0; padding: 0; color: #000; background: #fff; }
                            .receipt { max-width: 80mm; width: 100%; margin: 0 auto; padding: 6px 8px; box-sizing: border-box; }
                            .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
                            .store-name { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
                            .store-info { font-size: 10px; margin-bottom: 2px; }
                            .sale-info { font-size: 10px; margin-bottom: 8px; }
                            .items { margin-bottom: 8px; }
                            .item { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 10px; }
                            .item-name { flex: 1; }
                            .item-qty { width: 22px; text-align: center; }
                            .item-price { width: 48px; text-align: right; }
                            .totals { border-top: 1px solid #000; padding-top: 5px; }
                            .total { font-weight: bold; font-size: 12px; }
                            .footer { text-align: center; font-size: 9px; margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; }
                          }
                        </style>
                </head>
                <body>
                  <div class="receipt">
                    <div class="header">
                      <div class="store-name">SIA POS</div>
                      <div class="store-info">${branchName || ""}</div>
                      <div class="store-info">Frozen Foods & Products</div>
                      <div class="store-info">123 Main Street, Batangas</div>
                      <div class="store-info">Tel: (043) 123-4567</div>
                    </div>
                    
                    <div class="sale-info">
                      <div>Receipt #: ${receiptData.saleId}</div>
                      <div>Date: ${receiptData.date.toLocaleDateString()}</div>
                      <div>Time: ${receiptData.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>Operator: ${receiptData.operator}</div>
                      <div>Payment: ${receiptData.paymentMethod}${receiptData.gcashReference ? ` (Ref: ${receiptData.gcashReference})` : ''}</div>
                    </div>
                    
                    <div class="items">
                      ${receiptData.items.map((item: any) => `
                        <div class="item">
                          <span class="item-name">${item.name}</span>
                          <span class="item-qty">${item.quantity}</span>
                          <span class="item-price">₱${item.finalPrice.toFixed(2)}</span>
                        </div>
                      `).join('')}
                    </div>
                    
                    <div class="totals">
                      <div>Subtotal: ₱${receiptData.subtotal.toFixed(2)}</div>
                      ${receiptData.totalDiscount > 0 ? `<div>Discount: -₱${receiptData.totalDiscount.toFixed(2)}</div>` : ''}
                      <div class="total">TOTAL: ₱${receiptData.total.toFixed(2)}</div>
                    </div>
                    
                    <div class="footer">
                      <div>Thank you for your business!</div>
                      <div>Please keep this receipt for your records.</div>
                      <div>${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString()}</div>
                    </div>
                  </div>
                </body>
                </html>
              `);
              printWindow.document.close();
              printWindow.print();
            }
          }}
        />
      )}
    </div>
  );
}
































































































