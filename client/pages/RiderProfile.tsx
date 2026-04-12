import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/authContext";
import { confirmLogout } from "@/lib/logout";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Bike, Clock, CheckCircle2, MapPin, Phone, User, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RiderOrder {
  id: string;
  branch_id: string;
  status: string;
  order_type: string;
  payment_status?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  total_amount: number;
  items_count: number;
  sale_date: string;
  delivered_at?: string;
  picked_up_at?: string;
}

interface DeliveryHistoryItem {
  id: string;
  sale_id: string;
  rider_id: string;
  branch_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  total_amount: number;
  payment_status?: string;
  picked_up_at?: string;
  delivered_at: string;
  created_at?: string;
}

export default function RiderProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<"all" | "ready" | "picked_up" | "completed">("ready");

  const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;
    await logout();
    navigate("/");
  };

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["rider-orders", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const result = await apiClient.getSales(
        user.branch_id,
        startDate.toISOString().split("T")[0],
        new Date().toISOString().split("T")[0],
        1,
        100,
        "all",
      );

      return (result.sales || [])
        .filter(
          (sale: RiderOrder) =>
            sale.order_type === "online" &&
            ["ready", "picked_up", "out_for_delivery", "completed"].includes(String(sale.status)),
        )
        .map((sale: RiderOrder) => ({
          ...sale,
          total_amount: toNumber((sale as any).total_amount),
          items_count: toNumber((sale as any).items_count),
        }));
    },
    enabled: !!user?.branch_id,
    refetchInterval: 20000,
  });

  const { data: deliveryHistory = [] } = useQuery({
    queryKey: ["rider-delivery-history", user?.id],
    queryFn: async () => {
      const result = await apiClient.getRiderDeliveryHistory();
      return (result.history || []).map((entry: DeliveryHistoryItem) => ({
        ...entry,
        total_amount: toNumber((entry as any).total_amount),
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 20000,
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: "picked_up" | "completed" }) =>
      apiClient.updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rider-orders"] });
      queryClient.invalidateQueries({ queryKey: ["rider-delivery-history"] });
      toast({ title: "Delivery updated", description: "Order status updated." });
    },
    onError: () => {
      toast({ title: "Update failed", description: "Could not mark order as delivered.", variant: "destructive" });
    },
  });

  const filteredOrders = useMemo(() => {
    if (selectedStatus === "all") return orders;
    if (selectedStatus === "picked_up") {
      return orders.filter((o: RiderOrder) => o.status === "picked_up" || o.status === "out_for_delivery");
    }
    return orders.filter((o: RiderOrder) => o.status === selectedStatus);
  }, [orders, selectedStatus]);

  const deliveredRevenue = deliveryHistory.reduce((sum, item) => sum + toNumber(item.total_amount), 0);

  const readyCount = orders.filter((o: RiderOrder) => o.status === "ready").length;
  const deliveryCount = orders.filter((o: RiderOrder) => o.status === "picked_up" || o.status === "out_for_delivery").length;
  const completedCount = deliveryHistory.length;
  const pendingActionsCount = readyCount + deliveryCount;

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 p-4 sm:p-6 text-black shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <div className="flex items-center gap-3 min-w-0">
                <Bike className="w-7 h-7" />
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Rider Dashboard</h1>
              </div>
              <p className="mt-2 text-sm sm:text-base text-black/80 max-w-2xl">
                Branch online deliveries for branch {user?.branch_id || "N/A"}
              </p>
            </div>
            <Button onClick={handleLogout} className="w-full sm:w-auto bg-black text-white hover:bg-black/90">Logout</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ready for Delivery</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{readyCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Completed</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{completedCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Out for Delivery</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{deliveryCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Online Orders</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{orders.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Delivery History</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{deliveryHistory.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Delivered Amount</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">P{deliveredRevenue.toFixed(2)}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Delivery Queue</CardTitle>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button size="sm" variant={selectedStatus === "ready" ? "default" : "outline"} onClick={() => setSelectedStatus("ready")}>Ready</Button>
              <Button size="sm" variant={selectedStatus === "picked_up" ? "default" : "outline"} onClick={() => setSelectedStatus("picked_up")}>Picked Up</Button>
              <Button size="sm" variant={selectedStatus === "completed" ? "default" : "outline"} onClick={() => setSelectedStatus("completed")}>Completed</Button>
              <Button size="sm" variant={selectedStatus === "all" ? "default" : "outline"} onClick={() => setSelectedStatus("all")}>All</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingActionsCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Pending Delivery Actions</p>
                      <p className="text-sm text-amber-800">
                        {readyCount > 0 ? `${readyCount} ready for pickup` : "No ready pickups"}
                        {" • "}
                        {deliveryCount > 0 ? `${deliveryCount} in transit to deliver` : "No in-transit orders"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {readyCount > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setSelectedStatus("ready")}>View Ready</Button>
                    )}
                    {deliveryCount > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setSelectedStatus("picked_up")}>View In Transit</Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isLoading && <div className="text-sm text-slate-500">Loading orders...</div>}
            {!isLoading && filteredOrders.length === 0 && (
              <div className="text-sm text-slate-500">No online orders found for this filter.</div>
            )}

            {filteredOrders.map((order: RiderOrder) => (
              <div key={order.id} className="border rounded-lg p-4 space-y-3 bg-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold break-all">Order {order.id}</div>
                    <div className="text-xs text-slate-500">{new Date(order.sale_date).toLocaleString()}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {order.status === "ready" ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ready</Badge>
                    ) : order.status === "picked_up" || order.status === "out_for_delivery" ? (
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Picked Up</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Completed</Badge>
                    )}
                    <span className="font-semibold">P{Number(order.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-500" />{order.customer_name || "N/A"}</div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500" />{order.customer_phone || "N/A"}</div>
                  <div className="sm:col-span-2 flex items-start gap-2"><MapPin className="w-4 h-4 text-slate-500 mt-0.5" />{order.customer_address || "No address provided"}</div>
                </div>

                {order.status === "ready" && (
                  <Button
                    onClick={() => updateDeliveryMutation.mutate({ orderId: order.id, status: "picked_up" })}
                    disabled={updateDeliveryMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    <Bike className="w-4 h-4 mr-2" /> Mark as Picked Up
                  </Button>
                )}

                {(order.status === "picked_up" || order.status === "out_for_delivery") && (
                  <Button
                    onClick={() => updateDeliveryMutation.mutate({ orderId: order.id, status: "completed" })}
                    disabled={updateDeliveryMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Delivered
                  </Button>
                )}

                {order.status === "completed" && (
                  <div className="text-xs text-green-700 flex items-center gap-1"><Clock className="w-3 h-3" /> Delivery completed</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliveryHistory.length === 0 && (
              <div className="text-sm text-slate-500">No completed deliveries yet.</div>
            )}

            {deliveryHistory.map((order: DeliveryHistoryItem) => (
              <div key={order.id} className="border rounded-lg p-4 bg-slate-50/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div>
                    <div className="font-semibold break-all">Order {order.sale_id}</div>
                    <div className="text-xs text-slate-500">
                      Delivered: {new Date(order.delivered_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="font-semibold">P{toNumber(order.total_amount).toFixed(2)}</div>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      {order.payment_status === "succeeded" ? "Payment succeeded" : "Completed"}
                    </Badge>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-sm mt-3">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-500" />{order.customer_name || "N/A"}</div>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-500" />{order.customer_phone || "N/A"}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
