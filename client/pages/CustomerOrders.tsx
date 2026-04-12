import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/authContext";
import { CustomerLayout } from "@/components/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Snowflake,
  Home,
  ShoppingBag,
  ShoppingCart,
  LogOut,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Order {
  id: string;
  branch_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  payment_method: string;
  order_type: string;
  total_amount: number;
  items_count: number;
  status: string;
  payment_status?: "pending" | "succeeded" | "failed";
  assigned_rider_name?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  notes: string;
  sale_date: any;
  created_at: any;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  discount_amount: number;
  subtotal: number;
  promo_name?: string;
  product_image?: string;
}

export default function CustomerOrders() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Parse Firestore timestamp
  const parseDate = (date: any): Date => {
    if (!date) return new Date();
    if (date._seconds) {
      return new Date(date._seconds * 1000);
    }
    if (date.seconds) {
      return new Date(date.seconds * 1000);
    }
    return new Date(date);
  };

  // Fetch customer orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer-orders", user?.id],
    queryFn: async () => {
      // Get all sales for the customer
      const response = await fetch(`/api/customer/orders?customerId=${user?.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      const data = await response.json();
      console.log("📦 Customer Orders:", data);
      return (data.orders || []).map((order: any) => ({
        ...order,
        total_amount: toNumber(order.total_amount),
        items_count: toNumber(order.items_count),
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/customer/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerId: user?.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel order");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Cancelled",
        description: "Your order has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancelOrder = (orderId: string) => {
    if (window.confirm("Are you sure you want to cancel this order?")) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  const printOnlineReceipt = (order: Order) => {
    const isPaymentSucceeded = order.payment_status === "succeeded";
    const popup = window.open("", "_blank", "width=480,height=760");
    if (!popup) return;

    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Online Receipt ${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #111827; }
            .receipt { max-width: 360px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
            .label { color: #6b7280; }
            .ok { color: #047857; font-weight: 700; }
            .warn { color: #b45309; font-weight: 700; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
            .divider { border-top: 1px dashed #d1d5db; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="title">Frozen Hub Online Receipt</div>
            <div class="row"><span class="label">Order ID</span><span>${order.id}</span></div>
            <div class="row"><span class="label">Date</span><span>${parseDate(order.sale_date).toLocaleString()}</span></div>
            <div class="row"><span class="label">Customer</span><span>${order.customer_name || "N/A"}</span></div>
            <div class="row"><span class="label">Delivery Address</span><span>${order.customer_address || "N/A"}</span></div>
            <div class="row"><span class="label">Items</span><span>${order.items_count}</span></div>
            <div class="row"><span class="label">Payment Method</span><span>Cash on Delivery</span></div>
            <div class="row"><span class="label">Order Status</span><span>${order.status}</span></div>
            <div class="row"><span class="label">Payment Status</span><span class="${isPaymentSucceeded ? "ok" : "warn"}">${order.payment_status || "pending"}</span></div>
            ${order.delivered_at ? `<div class="row"><span class="label">Delivered At</span><span>${new Date(order.delivered_at).toLocaleString()}</span></div>` : ""}
            <div class="divider"></div>
            <div class="row"><strong>Total</strong><strong>PHP ${Number(order.total_amount || 0).toFixed(2)}</strong></div>
            <p style="margin-top:12px;font-size:12px;color:#6b7280;">
              This receipt confirms ${isPaymentSucceeded ? "successful payment and completed delivery" : "the current order state"}.
            </p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  // Filter orders by status
  const filteredOrders = statusFilter === "all" 
    ? orders 
    : orders.filter((order: Order) => order.status === statusFilter);

  // Fetch order items when expanded
  const { data: orderItems = [] } = useQuery({
    queryKey: ["order-items", expandedOrderId],
    queryFn: async () => {
      if (!expandedOrderId) return [];
      
      // Fetch order items
      const result = await apiClient.getSaleItems(expandedOrderId);
      const items = result.items;
      
      // Fetch product details for each item to get images
      const itemsWithImages = await Promise.all(
        items.map(async (item: OrderItem) => {
          try {
            const productResult = await apiClient.getProduct(item.product_id);
            return {
              ...item,
              unit_price: toNumber((item as any).unit_price ?? (item as any).price),
              discount_amount: toNumber((item as any).discount_amount),
              subtotal: toNumber((item as any).subtotal ?? (item as any).total),
              original_price: toNumber((item as any).original_price ?? (item as any).unit_price ?? (item as any).price),
              product_image: productResult.product?.image || null,
            };
          } catch (error) {
            console.error(`Failed to fetch product ${item.product_id}:`, error);
            return {
              ...item,
              unit_price: toNumber((item as any).unit_price ?? (item as any).price),
              discount_amount: toNumber((item as any).discount_amount),
              subtotal: toNumber((item as any).subtotal ?? (item as any).total),
              original_price: toNumber((item as any).original_price ?? (item as any).unit_price ?? (item as any).price),
            };
          }
        })
      );
      
      return itemsWithImages;
    },
    enabled: !!expandedOrderId,
  });

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: "⏳ Pending", className: "bg-yellow-500 text-white font-semibold px-4 py-1.5 text-sm" },
      preparing: { label: "👨‍🍳 Preparing", className: "bg-blue-500 text-white font-semibold px-4 py-1.5 text-sm" },
      ready: { label: "📦 Ready for dispatch", className: "bg-green-500 text-white font-semibold px-4 py-1.5 text-sm" },
      picked_up: { label: "🛵 Picked up", className: "bg-indigo-500 text-white font-semibold px-4 py-1.5 text-sm" },
      out_for_delivery: { label: "🚚 Out for delivery", className: "bg-indigo-500 text-white font-semibold px-4 py-1.5 text-sm" },
      completed: { label: "✓ Completed", className: "bg-gray-500 text-white font-semibold px-4 py-1.5 text-sm" },
      cancelled: { label: "✗ Cancelled", className: "bg-red-500 text-white font-semibold px-4 py-1.5 text-sm" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800" };
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "preparing":
        return <Package className="h-5 w-5 text-blue-500" />;
      case "ready":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "picked_up":
      case "out_for_delivery":
        return <ShoppingCart className="h-5 w-5 text-indigo-500" />;
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-gray-600" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const pendingCount = orders.filter((o: Order) => o.status === "pending").length;
  const preparingCount = orders.filter((o: Order) => o.status === "preparing").length;
  const deliveryCount = orders.filter((o: Order) => ["ready", "picked_up", "out_for_delivery"].includes(o.status)).length;

  return (
    <CustomerLayout>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Total Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold">{orders.length}</div>
              </CardContent>
            </Card>

            <Card className="border-2 border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-yellow-800">
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
                  {pendingCount}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-blue-800">
                  Preparing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {preparingCount}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-green-800">
                  For Delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-green-600">
                  {deliveryCount}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <CardTitle className="text-lg sm:text-xl">Order History</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="picked_up">Picked up</SelectItem>
                    <SelectItem value="out_for_delivery">Out for delivery</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                  <p className="text-muted-foreground">Loading your orders...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No orders found</p>
                  <p className="text-sm mb-4">Start shopping to place your first order!</p>
                  <Link to="/customer/shop">
                    <Button className="gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      Start Shopping
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order: Order) => (
                    <Card key={order.id} className="border-2 hover:shadow-lg transition-all overflow-hidden">
                      {/* Status Color Bar */}
                      <div className={`h-2 ${
                        order.status === 'pending' ? 'bg-yellow-400' :
                        order.status === 'preparing' ? 'bg-blue-500' :
                        order.status === 'ready' ? 'bg-green-500' :
                        order.status === 'picked_up' ? 'bg-indigo-500' :
                        order.status === 'out_for_delivery' ? 'bg-indigo-500' :
                        order.status === 'completed' ? 'bg-gray-400' :
                        'bg-red-500'
                      }`} />
                      
                      <CardContent className="p-4 sm:p-6">
                        {/* Order Header */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 pb-4 border-b-2">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className={`p-2 rounded-full ${
                                order.status === 'pending' ? 'bg-yellow-100' :
                                order.status === 'preparing' ? 'bg-blue-100' :
                                order.status === 'ready' ? 'bg-green-100' :
                                order.status === 'picked_up' ? 'bg-indigo-100' :
                                order.status === 'out_for_delivery' ? 'bg-indigo-100' :
                                order.status === 'completed' ? 'bg-gray-100' :
                                'bg-red-100'
                              }`}>
                                {getStatusIcon(order.status)}
                              </div>
                              <div>
                                <span className="font-bold text-base sm:text-lg text-gray-900 block">
                                  Order #{order.id.split('-')[1].substring(0, 8).toUpperCase()}
                                </span>
                                <div className="text-xs sm:text-sm text-muted-foreground">
                                  {parseDate(order.sale_date).toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })} at {parseDate(order.sale_date).toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                            <div>
                              <div className="text-xs text-gray-500 text-right">Total Amount</div>
                              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                ₱{order.total_amount.toFixed(2)}
                              </div>
                            </div>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>

                        {/* Order Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-muted-foreground">
                                Delivery Address
                              </div>
                              <div className="text-sm break-words">{order.customer_address}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Phone className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Contact
                              </div>
                              <div className="text-sm">{order.customer_phone}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <CreditCard className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Payment
                              </div>
                              <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                Cash on Delivery
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`ml-2 text-xs ${order.payment_status === "succeeded" ? "bg-emerald-50 text-emerald-700" : order.payment_status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                              >
                                Payment {order.payment_status || "pending"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Package className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <div className="text-xs font-medium text-muted-foreground">
                                Items
                              </div>
                              <div className="text-sm">{order.items_count} item(s)</div>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {order.notes && (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="text-xs font-medium text-blue-800 mb-1">
                              Your Notes:
                            </div>
                            <div className="text-sm text-blue-700">{order.notes}</div>
                          </div>
                        )}

                        {/* Cancel Button - Only show for pending orders */}
                        {(order.status === 'pending' || order.status === 'preparing') && (
                          <div className="mb-4">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancelOrderMutation.isPending}
                              className="w-full"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {cancelOrderMutation.isPending ? "Cancelling..." : "Cancel Order"}
                            </Button>
                          </div>
                        )}

                        {order.payment_status === "succeeded" && order.status === "completed" && (
                          <div className="mb-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => printOnlineReceipt(order)}
                              className="w-full"
                            >
                              Print Online Receipt (Payment Succeeded)
                            </Button>
                          </div>
                        )}

                        {/* Order Items (Expandable) */}
                        <div className="border-t pt-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                            }
                            className="w-full flex justify-between items-center"
                          >
                            <span className="text-sm">View Order Items</span>
                            {expandedOrderId === order.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>

                          {expandedOrderId === order.id && (
                            <div className="mt-4 space-y-3">
                              {orderItems.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground">
                                  Loading items...
                                </div>
                              ) : (
                                orderItems.map((item: OrderItem) => (
                                  <div
                                    key={item.id}
                                    className="flex gap-3 p-3 bg-white border-2 border-gray-100 rounded-lg hover:border-blue-200 transition-all"
                                  >
                                    {/* Product Image */}
                                    <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden">
                                      {item.product_image ? (
                                        <img
                                          src={item.product_image}
                                          alt={item.product_name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                                          <Package className="h-8 w-8 text-blue-400" />
                                        </div>
                                      )}
                                    </div>

                                    {/* Product Details */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-semibold text-sm sm:text-base text-gray-900 break-words line-clamp-2">
                                            {item.product_name}
                                          </h4>
                                          
                                          {/* Price Info */}
                                          <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <div className="text-sm text-gray-600">
                                              ₱{item.unit_price.toFixed(2)} × {item.quantity}
                                            </div>
                                            
                                            {/* Discount Badge */}
                                            {item.discount_amount > 0 && (
                                              <Badge className="bg-green-100 text-green-700 text-xs">
                                                -₱{item.discount_amount.toFixed(2)} off
                                              </Badge>
                                            )}
                                            
                                            {/* Promo Name */}
                                            {item.promo_name && (
                                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                                                {item.promo_name}
                                              </Badge>
                                            )}
                                          </div>

                                          {/* Original Price (if discounted) */}
                                          {item.discount_amount > 0 && item.original_price > item.unit_price && (
                                            <div className="mt-1 text-xs text-gray-400 line-through">
                                              Original: ₱{item.original_price.toFixed(2)}
                                            </div>
                                          )}
                                        </div>

                                        {/* Subtotal */}
                                        <div className="flex-shrink-0 text-right">
                                          <div className="text-lg font-bold text-blue-600">
                                            ₱{item.subtotal.toFixed(2)}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            Subtotal
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </CustomerLayout>
  );
}
