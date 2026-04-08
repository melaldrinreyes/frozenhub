import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { CustomerLayout } from "@/components/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Snowflake,
  Home,
  ShoppingBag,
  ShoppingCart,
  LogOut,
  Minus,
  Plus,
  Trash2,
  Package,
  Store,
  Tag,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDiscountAmount, formatCurrency } from "@/lib/discountUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
  sku: string;
  promo?: {
    id: string;
    name: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_discount?: number | null;
  } | null;
}

function normalizeCartItem(item: any): CartItem {
  if (item?.product) {
    return {
      id: item.product.id,
      name: item.product.name,
      price: typeof item.product.price === "string" ? parseFloat(item.product.price) : item.product.price,
      quantity: item.quantity || 1,
      image: item.product.image,
      category: item.product.category,
      sku: item.product.sku,
      promo: item.promo || null,
    };
  }

  return {
    id: item.id,
    name: item.name,
    price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
    quantity: item.quantity || 1,
    image: item.image,
    category: item.category,
    sku: item.sku,
    promo: item.promo || null,
  };
}

export default function CustomerCart() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod"); // Online orders use Cash on Delivery
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await fetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
  });

  const branches = branchesData?.branches || [];

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      const response = await fetch("/api/customer/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create order");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const orderId = data?.orderId || data?.sale?.id || "N/A";
      const total = typeof cartTotal === "number" ? cartTotal : 0;
      toast({
        title: "Order placed successfully!",
        description: `Your order #${orderId} has been confirmed. Total: ${formatCurrency(total)}`,
      });
      // Clear cart
      setCart([]);
      localStorage.removeItem("customerCart");
      setShowCheckoutDialog(false);
      
      // Invalidate inventory queries to refresh stock
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      
      // Navigate to success page or home
      setTimeout(() => {
        navigate("/customer/home");
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Order failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("customerCart");
    console.log("Loading cart from localStorage:", savedCart);
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        console.log("Parsed cart:", parsedCart);
        const normalizedCart = parsedCart
          .map((item: any) => normalizeCartItem(item))
          .filter((item: CartItem) => !!item.id && !!item.name);
        setCart(normalizedCart);
      } catch (error) {
        console.error("Error parsing cart:", error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("customerCart", JSON.stringify(cart));
  }, [cart]);

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    toast({
      title: "Item removed",
      description: "Item has been removed from your cart",
    });
  };

  const clearCart = () => {
    setCart([]);
    toast({
      title: "Cart cleared",
      description: "All items have been removed from your cart",
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to your cart before checkout",
        variant: "destructive",
      });
      return;
    }
    setShowCheckoutDialog(true);
  };

  const handleCompleteCheckout = () => {
    // Validation
    if (!selectedBranch) {
      toast({
        title: "Branch required",
        description: "Please select a pickup branch",
        variant: "destructive",
      });
      return;
    }

    if (!customerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    if (!customerPhone.trim()) {
      toast({
        title: "Phone required",
        description: "Please enter your contact number",
        variant: "destructive",
      });
      return;
    }

    // Prepare sale data with customer authentication info
    const saleData = {
      branchId: selectedBranch,
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
      paymentMethod: paymentMethod,
      totalAmount: cartTotal,
      customerInfo: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress || null,
      },
      notes: notes || null,
      customerId: user?.id || null,         // Add customer ID from authenticated user
      customerEmail: user?.email || null,   // Add customer email from authenticated user
    };

    const hasInvalidItem = saleData.items.some((item) => !item.productId || item.quantity <= 0);
    if (hasInvalidItem) {
      toast({
        title: "Invalid cart item",
        description: "One or more cart items are invalid. Please remove and add the item again.",
        variant: "destructive",
      });
      return;
    }

    createSaleMutation.mutate(saleData);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Use enhanced cart calculation with minimum purchase requirements
      const cartSubtotal = cart.reduce((total, item) => {
        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
        return total + (price * item.quantity);
      }, 0);

      const cartDiscount = cart.reduce((total, item) => {
        if (!item.promo) return total;
        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
        const itemDiscount = getDiscountAmount(price, item.promo, cartSubtotal) * item.quantity;
        return total + itemDiscount;
      }, 0);

      const cartTotal = Math.max(0, cartSubtotal - cartDiscount);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CustomerLayout>
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Shopping Cart
            </h1>
            <p className="text-gray-600">
              {itemCount} {itemCount === 1 ? "item" : "items"} in your cart
            </p>
          </div>
          {cart.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearCart}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Cart
            </Button>
          )}
        </div>

        {cart.length === 0 ? (
          /* Empty Cart */
          <div className="text-center py-12 sm:py-16">
            <ShoppingCart className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 text-gray-300" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Your cart is empty</h2>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">
              Add some products to get started!
            </p>
            <Button
              size="lg"
              className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold"
              onClick={() => navigate("/customer/shop")}
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Start Shopping
            </Button>
          </div>
        ) : (
          /* Cart Items */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Cart Items List */}
            <div className="md:col-span-2 space-y-4">
              {cart.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex gap-4 sm:gap-6">
                      {/* Product Image */}
                      <div className="w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-black">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 sm:w-12 sm:h-12 text-gold-400/30" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1 line-clamp-2">
                              {item.name}
                            </h3>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {item.category}
                              </Badge>
                              {item.promo && (
                                <Badge className="text-xs bg-red-600 text-white">
                                  <Tag className="w-3 h-3 mr-1" />
                                  {item.promo.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="font-semibold text-gray-900 w-8 text-center">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            {(() => {
                              const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
                              const subtotal = price * item.quantity;
                              const discount = item.promo ? getDiscountAmount(price, item.promo, cartSubtotal) * item.quantity : 0;
                              const total = subtotal - discount;

                              return (
                                <>
                                  {discount > 0 && (
                                    <div className="text-xs text-gray-400 line-through mb-1">
                                      ₱{subtotal.toFixed(2)}
                                    </div>
                                  )}
                                  <div className="text-lg sm:text-xl font-bold text-gold-600">
                                    ₱{total.toFixed(2)}
                                  </div>
                                  {discount > 0 ? (
                                    <div className="text-xs text-green-600 font-medium">
                                      Save ₱{discount.toFixed(2)}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500">
                                      ₱{price.toFixed(2)} each
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="md:col-span-1">
              <Card className="sticky top-24 shadow-xl md:max-h-[calc(100vh-8rem)]">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({itemCount} items)</span>
                      <span className="font-medium">₱{cartSubtotal.toFixed(2)}</span>
                    </div>
                    {cartDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          Promo Discount
                        </span>
                        <span className="font-medium">-₱{cartDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-bold text-gray-900">
                        <span>Total</span>
                        <span className="text-gold-600">₱{cartTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold text-base"
                    onClick={handleCheckout}
                  >
                    Proceed to Checkout
                  </Button>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    Secure checkout powered by Batangas Premium Bongabong
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-gold-500/20 z-50 pb-safe">
        <div className="grid grid-cols-4 h-16">
          {/* Home */}
          <button
            onClick={() => navigate("/customer/home")}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gold-400 transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>

          {/* Shop */}
          <button
            onClick={() => navigate("/customer/shop")}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gold-400 transition-colors"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-medium">Shop</span>
          </button>

          {/* Cart - Active */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex flex-col items-center justify-center gap-1 text-gold-400 hover:text-gold-500 transition-colors relative"
          >
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <Badge className="absolute top-1 right-8 bg-red-500 text-white text-xs px-1.5 min-w-[1.25rem] h-5">
                {cart.length}
              </Badge>
            )}
            <span className="text-xs font-medium">Cart</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
      </nav>

      {/* Checkout Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gold-600" />
              Complete Your Order
            </DialogTitle>
            <DialogDescription>
              Please provide your details to complete the purchase
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Branch Selection */}
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-sm font-semibold">
                Pickup Branch <span className="text-red-500">*</span>
              </Label>
              <select
                id="branch"
                aria-label="Pickup branch"
                title="Pickup branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                <option value="">Select a branch</option>
                {branches.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} - {branch.address}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Customer Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">
                  Address <span className="text-gray-400">(Optional)</span>
                </Label>
                <Textarea
                  id="address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street, Barangay, City"
                  rows={2}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Payment Method <span className="text-red-500">*</span>
              </Label>
              <div className="border p-4 rounded-md bg-green-50">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-500 text-white p-2 rounded-full">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-green-900">Cash on Delivery</div>
                    <div className="text-sm text-green-700">Pay when you receive your order</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                Order Notes <span className="text-gray-400">(Optional)</span>
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or requests..."
                rows={3}
              />
            </div>

            {/* Order Summary */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Items ({itemCount})</span>
                <span className="font-medium">₱{cartSubtotal.toFixed(2)}</span>
              </div>
              {cartDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-₱{cartDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-gold-600">₱{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCheckoutDialog(false)}
              disabled={createSaleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteCheckout}
              disabled={createSaleMutation.isPending}
              className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black font-bold"
            >
              {createSaleMutation.isPending ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full mr-2" />
                  Processing...
                </>
              ) : (
                <>Place Order</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </CustomerLayout>
  );
}
