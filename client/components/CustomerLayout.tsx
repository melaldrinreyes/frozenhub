import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { confirmLogout } from "@/lib/logout";
import {
  ShoppingBag,
  Package,
  ShoppingCart,
  User,
  LogOut,
  Snowflake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface CustomerLayoutProps {
  children: ReactNode;
}

export function CustomerLayout({ children }: CustomerLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cartItemCount, setCartItemCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  // Get cart item count from localStorage
  useEffect(() => {
    const getCartItemCount = () => {
      try {
        const savedCart = localStorage.getItem("customerCart");
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          const totalItems = parsedCart.reduce((total: number, item: any) => total + (item.quantity || 1), 0);
          setCartItemCount(totalItems);
        } else {
          setCartItemCount(0);
        }
      } catch (error) {
        console.error("Error reading cart:", error);
        setCartItemCount(0);
      }
    };

    // Initial load
    getCartItemCount();

    // Listen for storage changes (when cart is updated from other components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "customerCart") {
        getCartItemCount();
      }
    };

    // Listen for custom cart update events
    const handleCartUpdate = () => {
      getCartItemCount();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("cartUpdated", handleCartUpdate);

    // Also check periodically in case events are missed
    const interval = setInterval(getCartItemCount, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("cartUpdated", handleCartUpdate);
      clearInterval(interval);
    };
  }, []);

  // Get active orders count (pending + preparing + ready)
  useEffect(() => {
    const getActiveOrdersCount = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch(`/api/customer/orders?customerId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          const orders = data.orders || [];
          const activeCount = orders.filter((order: any) => 
            order.status === 'pending' || 
            order.status === 'preparing' || 
            order.status === 'ready'
          ).length;
          setActiveOrdersCount(activeCount);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setActiveOrdersCount(0);
      }
    };

    // Initial load
    getActiveOrdersCount();

    // Refresh every 30 seconds
    const interval = setInterval(getActiveOrdersCount, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;
    await logout();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Header - Desktop & Mobile */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-black via-gray-900 to-black border-b border-gold-500/30 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Snowflake className="h-6 w-6 text-gold-400" />
                <div className="absolute inset-0 bg-gold-400/20 blur-lg rounded-full" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gold-400">
                  Batangas Premium Bongabong
                </h1>
                <p className="text-xs text-gray-400">Quality Frozen Foods</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => navigate("/customer/shop")}
                className={`text-sm font-medium transition-colors ${
                  isActive("/customer/shop")
                    ? "text-gold-400"
                    : "text-gray-300 hover:text-gold-400"
                }`}
              >
                Shop
              </button>
              <button
                onClick={() => navigate("/customer/orders")}
                className={`text-sm font-medium transition-colors relative ${
                  isActive("/customer/orders")
                    ? "text-gold-400"
                    : "text-gray-300 hover:text-gold-400"
                }`}
              >
                Orders
                {activeOrdersCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold bg-orange-500 hover:bg-orange-500 animate-pulse"
                  >
                    {activeOrdersCount > 99 ? "99+" : activeOrdersCount}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => navigate("/customer/cart")}
                className={`text-sm font-medium transition-colors relative ${
                  isActive("/customer/cart")
                    ? "text-gold-400"
                    : "text-gray-300 hover:text-gold-400"
                }`}
              >
                Cart
                {cartItemCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold bg-red-500 hover:bg-red-500 animate-pulse"
                  >
                    {cartItemCount > 99 ? "99+" : cartItemCount}
                  </Badge>
                )}
              </button>
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/90 hover:bg-red-600 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
              >
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20 md:pb-6">{children}</main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-gold-500/20 z-50 shadow-lg">
        <div className="grid grid-cols-4 h-16">

          <button
            onClick={() => navigate("/customer/shop")}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              isActive("/customer/shop")
                ? "text-gold-400 bg-gold-500/10"
                : "text-gray-400 hover:text-gold-400 hover:bg-gold-500/5"
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-medium">Shop</span>
          </button>

          <button
            onClick={() => navigate("/customer/orders")}
            className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
              isActive("/customer/orders")
                ? "text-gold-400 bg-gold-500/10"
                : "text-gray-400 hover:text-gold-400 hover:bg-gold-500/5"
            }`}
          >
            <div className="relative">
              <Package className="w-5 h-5" />
              {activeOrdersCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-[10px] font-bold bg-orange-500 hover:bg-orange-500 animate-pulse min-w-[16px]"
                >
                  {activeOrdersCount > 99 ? "99+" : activeOrdersCount}
                </Badge>
              )}
            </div>
            <span className="text-xs font-medium">Orders</span>
          </button>

          <button
            onClick={() => navigate("/customer/cart")}
            className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
              isActive("/customer/cart")
                ? "text-gold-400 bg-gold-500/10"
                : "text-gray-400 hover:text-gold-400 hover:bg-gold-500/5"
            }`}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-[10px] font-bold bg-red-500 hover:bg-red-500 animate-pulse min-w-[16px]"
                >
                  {cartItemCount > 99 ? "99+" : cartItemCount}
                </Badge>
              )}
            </div>
            <span className="text-xs font-medium">Cart</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-1 transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
