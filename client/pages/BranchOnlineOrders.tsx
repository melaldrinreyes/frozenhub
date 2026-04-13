import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  MapPin,
  User,
  CreditCard,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OnlineOrder {
  id: string;
  branch_id: string;
  customer_id?: string;
  customer_email?: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  payment_method: string;
  order_type: string;
  total_amount: number;
  items_count: number;
  status: string;
  payment_status?: "pending" | "succeeded" | "failed";
  assigned_rider_id?: string | null;
  assigned_rider_name?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  notes: string;
  sale_date: any;
  created_at: any;
}

interface RiderUser {
  id: string;
  name: string;
  branch_id?: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  discount_amount: number;
  subtotal: number;
  promo_name?: string;
}

export default function BranchOnlineOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRiders, setSelectedRiders] = useState<Record<string, string>>({});

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

  // Fetch online orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["online-orders", user?.branch_id],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const result = await apiClient.getSales(
        user?.branch_id,
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        1,
        100,
        "all"
      );
      
      console.log("🛒 All Sales:", result);
      
      // Filter only online orders
      const onlineOrders = result.sales
        .filter((sale: any) => sale.order_type === 'online')
        .map((sale: any) => ({
          ...sale,
          total_amount: toNumber(sale.total_amount),
          items_count: toNumber(sale.items_count),
        }));
      console.log("🌐 Online Orders:", onlineOrders);
      
      return onlineOrders;
    },
    enabled: !!user?.branch_id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: riders = [] } = useQuery({
    queryKey: ["branch-riders", user?.branch_id],
    queryFn: async () => {
      const result = await apiClient.getUsers({ role: "rider", branchId: user?.branch_id });
      return (result.users || []).map((r: any) => ({ id: r.id, name: r.name, branch_id: r.branch_id }));
    },
    enabled: !!user?.branch_id,
  });

  // Filter orders by status
  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((order: OnlineOrder) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const busyRiderIds = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach((order: OnlineOrder) => {
      if (
        order.assigned_rider_id &&
        (order.status === "picked_up" || order.status === "out_for_delivery")
      ) {
        ids.add(order.assigned_rider_id);
      }
    });
    return ids;
  }, [orders]);

  // Fetch order items when expanded
  const { data: orderItems = [] } = useQuery({
    queryKey: ["order-items", expandedOrderId],
    queryFn: async () => {
      if (!expandedOrderId) return [];
      const result = await apiClient.getSaleItems(expandedOrderId);
      console.log("📦 Order Items:", result);
      return (result.items || []).map((item: any) => ({
        ...item,
        unit_price: toNumber(item.unit_price ?? item.price),
        discount_amount: toNumber(item.discount_amount),
        subtotal: toNumber(item.subtotal ?? item.total),
      }));
    },
    enabled: !!expandedOrderId,
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiClient.updateOrderStatus(orderId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-orders"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const assignRiderMutation = useMutation({
    mutationFn: async ({ orderId, riderId }: { orderId: string; riderId: string }) =>
      apiClient.assignRider(orderId, riderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-orders"] });
      toast({
        title: "Rider assigned",
        description: "The selected rider is now assigned to this order.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error?.message || "Could not assign rider.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  const handleAssignRider = (order: OnlineOrder) => {
    const riderId = selectedRiders[order.id] || order.assigned_rider_id;
    if (!riderId) {
      toast({
        title: "Select rider",
        description: "Choose a rider first.",
        variant: "destructive",
      });
      return;
    }

    assignRiderMutation.mutate({ orderId: order.id, riderId });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pending", variant: "secondary" },
      preparing: { label: "Preparing", variant: "default" },
      ready: { label: "Ready for Rider", variant: "outline" },
      picked_up: { label: "Picked Up", variant: "default" },
      out_for_delivery: { label: "Picked Up", variant: "default" },
      completed: { label: "Completed", variant: "default" },
      cancelled: { label: "Cancelled", variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "default" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const pendingCount = orders.filter((o: OnlineOrder) => o.status === "pending").length;
  const preparingCount = orders.filter((o: OnlineOrder) => o.status === "preparing").length;
  const readyCount = orders.filter((o: OnlineOrder) => o.status === "ready").length;
  const pickedUpCount = orders.filter((o: OnlineOrder) => o.status === "picked_up" || o.status === "out_for_delivery").length;
  const completedCount = orders.filter((o: OnlineOrder) => o.status === "completed").length;

  // Check for new pending orders (orders less than 5 minutes old)
  const newPendingOrders = useMemo(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return orders.filter((order: OnlineOrder) => {
      const orderDate = parseDate(order.sale_date);
      return order.status === "pending" && orderDate > fiveMinutesAgo;
    });
  }, [orders]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Notification Banner for New Orders */}
        {newPendingOrders.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 rounded-lg p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 rounded-full p-2 animate-bounce">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-orange-900">
                    {newPendingOrders.length} New Order{newPendingOrders.length > 1 ? 's' : ''}!
                                  {riders.length === 0 && (
                  <Badge className="bg-orange-500 text-white">NEW</Badge>
                                      No riders assigned to this branch
                <p className="text-sm text-orange-700 mt-0.5">
                  You have {newPendingOrders.length} new pending order{newPendingOrders.length > 1 ? 's' : ''} waiting for confirmation
                                  {riders.map((rider: RiderUser) => {
                                    const isBusy = busyRiderIds.has(rider.id) && rider.id !== order.assigned_rider_id;
                                    return (
                                      <SelectItem key={rider.id} value={rider.id} disabled={isBusy}>
                                        {isBusy ? `${rider.name} (Busy)` : rider.name}
                                      </SelectItem>
                                    );
                                  })}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Online Orders</h1>
            <p className="text-muted-foreground mt-1">
              Orders placed by customers through their customer accounts
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orders.length}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Preparing</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{preparingCount}</div>
              <p className="text-xs text-muted-foreground">Being prepared</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ready for Rider</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{readyCount}</div>
              <p className="text-xs text-muted-foreground">Waiting for rider</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Out for Delivery</CardTitle>
              <ShoppingCart className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pickedUpCount}</div>
              <p className="text-xs text-muted-foreground">Picked up by rider</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedCount}</div>
              <p className="text-xs text-muted-foreground">Delivered and verified</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Order List</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="picked_up">Picked Up</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No online orders found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order: OnlineOrder) => (
                  <Card key={order.id} className="border-2">
                    <CardContent className="p-4 sm:pt-6">
                      {/* Order Header */}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusIcon(order.status)}
                            <span className="font-semibold text-sm sm:text-base">
                              Order #{order.id.split('-')[1]}
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">
                            {parseDate(order.sale_date).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                          <div className="text-xl sm:text-2xl font-bold">
                            ₱{order.total_amount.toFixed(2)}
                          </div>
                          {getStatusBadge(order.status)}
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Customer</div>
                            <div className="text-sm">{order.customer_name}</div>
                            {order.customer_email && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {order.customer_email}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Phone</div>
                            <div className="text-sm">{order.customer_phone}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 md:col-span-2">
                          <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Address</div>
                            <div className="text-sm">{order.customer_address}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CreditCard className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Payment</div>
                            <div className="text-sm">
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                Cash on Delivery
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`ml-2 ${order.payment_status === "succeeded" ? "bg-emerald-50 text-emerald-700" : order.payment_status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                              >
                                Payment {order.payment_status || "pending"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Items</div>
                            <div className="text-sm">{order.items_count} item(s)</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">Assigned Rider</div>
                            <div className="text-sm">{order.assigned_rider_name || "Unassigned"}</div>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="text-sm font-medium text-yellow-800 mb-1">Order Notes:</div>
                          <div className="text-sm text-yellow-700">{order.notes}</div>
                        </div>
                      )}

                      {/* Order Items (Expandable) */}
                      <div className="border-t pt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                          className="w-full flex justify-between items-center"
                        >
                          <span>View Order Items</span>
                          {expandedOrderId === order.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>

                        {expandedOrderId === order.id && (
                          <div className="mt-4 space-y-2">
                            {orderItems.map((item: OrderItem) => (
                              <div
                                key={item.id}
                                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="font-medium">{item.product_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    ₱{item.unit_price.toFixed(2)} x {item.quantity}
                                    {item.discount_amount > 0 && (
                                      <span className="ml-2 text-green-600">
                                        (₱{item.discount_amount.toFixed(2)} off{item.promo_name && ` - ${item.promo_name}`})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="font-semibold">
                                  ₱{item.subtotal.toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status Actions */}
                      {order.status !== "completed" && order.status !== "cancelled" && (
                        <div className="border-t pt-4 mt-4 flex flex-col sm:flex-row gap-2">
                          {order.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => handleStatusChange(order.id, "preparing")}
                                disabled={updateStatusMutation.isPending}
                              >
                                Accept & Prepare
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="w-full sm:w-auto"
                                onClick={() => handleStatusChange(order.id, "cancelled")}
                                disabled={updateStatusMutation.isPending}
                              >
                                Cancel Order
                              </Button>
                            </>
                          )}
                          {order.status === "preparing" && (
                            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <Select
                                value={selectedRiders[order.id] || order.assigned_rider_id || ""}
                                onValueChange={(value) =>
                                  setSelectedRiders((prev) => ({ ...prev, [order.id]: value }))
                                }
                              >
                                <SelectTrigger className="sm:col-span-2 w-full">
                                  <SelectValue placeholder="Select rider" />
                                </SelectTrigger>
                                <SelectContent>
                                  {riders.length === 0 && (
                                    <SelectItem value="__no_riders" disabled>
                                      No riders assigned to this branch
                                    </SelectItem>
                                  )}
                                  {riders.map((rider: RiderUser) => {
                                    const isBusy = busyRiderIds.has(rider.id) && rider.id !== order.assigned_rider_id;
                                    return (
                                      <SelectItem key={rider.id} value={rider.id} disabled={isBusy}>
                                        {isBusy ? `${rider.name} (Busy)` : rider.name}
                                      </SelectItem>
                                    );
                                  })}
                              </Select>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAssignRider(order)}
                                disabled={assignRiderMutation.isPending}
                              >
                                Assign Rider
                              </Button>

                              <Button
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => handleStatusChange(order.id, "ready")}
                                disabled={
                                  updateStatusMutation.isPending ||
                                  !(selectedRiders[order.id] || order.assigned_rider_id)
                                }
                              >
                                Mark as Ready
                              </Button>
                            </div>
                          )}
                          {order.status === "ready" && (
                            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2 text-sm text-slate-600 px-1 py-2">
                                {order.assigned_rider_name
                                  ? `Assigned to ${order.assigned_rider_name}. Waiting for pickup.`
                                  : "Waiting for rider assignment."}
                              </div>

                              <Select
                                value={selectedRiders[order.id] || order.assigned_rider_id || ""}
                                onValueChange={(value) =>
                                  setSelectedRiders((prev) => ({ ...prev, [order.id]: value }))
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select rider" />
                                </SelectTrigger>
                                <SelectContent>
                                    {riders.length === 0 && (
                                      <SelectItem value="__no_riders" disabled>
                                        No riders assigned to this branch
                                      </SelectItem>
                                    )}
                                    {riders.map((rider: RiderUser) => {
                                      const isBusy = busyRiderIds.has(rider.id) && rider.id !== order.assigned_rider_id;
                                      return (
                                        <SelectItem key={rider.id} value={rider.id} disabled={isBusy}>
                                          {isBusy ? `${rider.name} (Busy)` : rider.name}
                                        </SelectItem>
                                      );
                                    })}
                              </Select>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAssignRider(order)}
                                disabled={assignRiderMutation.isPending}
                              >
                                {order.assigned_rider_id ? "Reassign" : "Assign"}
                              </Button>
                            </div>
                          )}
                          {(order.status === "picked_up" || order.status === "out_for_delivery") && (
                            <div className="text-sm text-indigo-700 px-1 py-2">
                              {order.assigned_rider_name
                                ? `${order.assigned_rider_name} picked up order. In transit to customer.`
                                : "Rider picked up order. In transit to customer."}
                            </div>
                          )}
                        </div>
                      )}

                      {order.status === "completed" && (
                        <div className="border-t pt-4 mt-4 text-sm text-emerald-700">
                          Delivery completed{order.delivered_at ? ` on ${new Date(order.delivered_at).toLocaleString()}` : ""}. Payment has been marked as succeeded.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
