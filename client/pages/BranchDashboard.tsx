import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Package,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  MapPin,
  Phone,
  User,
  Barcode,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import POSPage from "@/pages/POSPage";

type TrendRange = "all" | "7d" | "30d" | "90d" | "1y" | "custom";

function formatDateLocal(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTrendDateRange(range: TrendRange, customStart: string, customEnd: string) {
  const end = new Date();
  const start = new Date();

  if (range === "all") {
    start.setFullYear(2020, 0, 1);
  } else if (range === "custom") {
    const parsedStart = customStart ? new Date(customStart) : null;
    const parsedEnd = customEnd ? new Date(customEnd) : null;

    if (parsedStart && !Number.isNaN(parsedStart.getTime())) {
      start.setTime(parsedStart.getTime());
    } else {
      start.setDate(start.getDate() - 6);
    }

    if (parsedEnd && !Number.isNaN(parsedEnd.getTime())) {
      end.setTime(parsedEnd.getTime());
    }
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (range === "90d") {
    start.setDate(start.getDate() - 89);
  } else if (range === "1y") {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    start.setDate(start.getDate() - 6);
  }

  if (start > end) {
    const temp = new Date(start);
    start.setTime(end.getTime());
    end.setTime(temp.getTime());
  }

  return {
    startDate: formatDateLocal(start),
    endDate: formatDateLocal(end),
    label:
      range === "custom"
        ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : range === "all"
          ? "All Time"
        : range === "7d"
          ? "Last 7 Days"
          : range === "30d"
            ? "Last 30 Days"
            : range === "90d"
              ? "Last 90 Days"
              : "Last 1 Year",
  };
}

function summarizeTrendData(trendData: any[]) {
  const totals = trendData.reduce(
    (accumulator, entry) => {
      const sales = Number(entry?.sales || 0);
      const orders = Number(entry?.orders || 0);

      accumulator.totalRevenue += sales;
      accumulator.totalSales += orders;
      return accumulator;
    },
    { totalRevenue: 0, totalSales: 0 }
  );

  const averageOrderValue = totals.totalSales > 0 ? totals.totalRevenue / totals.totalSales : 0;

  return {
    totalRevenue: totals.totalRevenue,
    totalSales: totals.totalSales,
    avgOrderValue: averageOrderValue,
  };
}

export default function BranchDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "pos">("dashboard");
  const [trendRange, setTrendRange] = useState<TrendRange>("all");
  const [customTrendStartDate, setCustomTrendStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return formatDateLocal(date);
  });
  const [customTrendEndDate, setCustomTrendEndDate] = useState(() => {
    const date = new Date();
    return formatDateLocal(date);
  });
  const { user } = useAuth();

  const trendDateRange = buildTrendDateRange(trendRange, customTrendStartDate, customTrendEndDate);

  // Fetch branch information for the logged-in branch admin
  const { data: branchData, isLoading: isBranchLoading } = useQuery({
    queryKey: ["branch", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return null;
      const data = await apiClient.getBranches(); // Fetch all branches

      // Find the branch matching the logged-in user's branch_id
      const branch = data.branches.find((b: any) => b.id === user.branch_id);

      if (!branch) throw new Error("Branch not found");

      return branch;
    },
  });

  // Fetch sales trend data (LAST 7 DAYS for chart)
  const { data: salesTrendData, isLoading: isLoadingTrend } = useQuery({
    queryKey: ["dashboard-sales-trend", user?.branch_id, trendDateRange.startDate, trendDateRange.endDate],
    queryFn: async () => {
      return apiClient.getSalesTrend(
        user?.branch_id || undefined,
        trendDateRange.startDate,
        trendDateRange.endDate
      );
    },
    enabled: !!user && user.role === "branch_admin",
  });

  // Fetch sales statistics for the same range used by the dashboard view
  const { data: salesStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["dashboard-sales-stats", user?.branch_id, trendDateRange.startDate, trendDateRange.endDate],
    queryFn: async () => {
      return apiClient.getSalesStats(
        user?.branch_id || undefined,
        trendDateRange.startDate,
        trendDateRange.endDate
      );
    },
    enabled: !!user && user.role === "branch_admin",
  });

  // Fetch inventory for this branch only
  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ["inventory", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return { inventory: [] };
      return apiClient.getInventory(user.branch_id);
    },
    enabled: !!user?.branch_id,
  });

  // Calculate total inventory units for this branch
  const totalInventoryUnits = inventoryData?.inventory?.reduce((sum: number, item: any) => {
    return sum + (item.quantity || 0);
  }, 0) || 0;

  // Calculate low stock items (quantity <= reorder_level)
  const lowStockCount = inventoryData?.inventory?.filter((item: any) => 
    item.quantity <= (item.reorder_level || 10)
  ).length || 0;

  // Fetch recent sales/orders for this branch (same approach as Sales Report)
  const { data: recentSalesData, isLoading: isLoadingRecentSales } = useQuery({
    queryKey: ["recent-sales", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) throw new Error("Branch not set");

      // Fetch latest records for this branch regardless of date window.
      // This avoids false "no data" states when there were no sales in the last 7 days.
      const params = new URLSearchParams({
        branchId: user.branch_id,
        page: '1',
        limit: '10',
        status: 'all',
      });
      
      const response = await fetch(`/api/sales?${params}`);
      if (!response.ok) throw new Error("Failed to fetch recent sales");
      const result = await response.json();

      // Normalize sale_date into a parsed Date on the client for consistent rendering
      if (result.sales && Array.isArray(result.sales)) {
        result.sales = result.sales.map((s: any) => {
          let parsed = null;
          try {
            if (s.sale_date?._seconds) parsed = new Date(s.sale_date._seconds * 1000);
            else if (typeof s.sale_date === 'number') parsed = new Date(s.sale_date * 1000);
            else if (s.sale_date) parsed = new Date(s.sale_date);
          } catch (e) {
            console.error('Recent sales date parse error', e, s.sale_date);
            parsed = new Date();
          }
          return { ...s, sale_date_parsed: parsed };
        });
      }
      
      console.log('📋 Recent Orders Data:', result);
      if (result.sales?.length > 0) {
        console.log('   First order:', result.sales[0]);
        console.log('   sale_date type:', typeof result.sales[0].sale_date);
        console.log('   sale_date value:', result.sales[0].sale_date);
      }
      
      return result;
    },
    enabled: !!user?.branch_id,
  });

  const recentOrders = recentSalesData?.sales || [];

  const dashboardData = salesTrendData?.trend || [];
  const dashboardSummary = salesStats || summarizeTrendData(dashboardData);

  // Helper to normalize/parse sale_date from various API shapes
  const getOrderDate = (order: any): Date => {
    try {
      if (order.sale_date_parsed) return new Date(order.sale_date_parsed);
      if (order.sale_date?._seconds) {
        return new Date(order.sale_date._seconds * 1000);
      }
      if (typeof order.sale_date === 'number') {
        return new Date(order.sale_date * 1000);
      }
      if (order.sale_date) {
        return new Date(order.sale_date);
      }
    } catch (e) {
      console.error('getOrderDate parsing error', e, order.sale_date);
    }
    return new Date();
  };

  if (activeTab === "pos") {
    return (
      <AdminLayout userRole="branch">
        <div className="space-y-4">
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab("dashboard")}
              className="px-4 py-2 font-semibold text-slate-600 border-b-2 border-transparent hover:text-slate-900"
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("pos")}
              className="px-4 py-2 font-semibold text-gold-500 border-b-2 border-gold-500"
            >
              Point of Sale
            </button>
          </div>
          <POSPage />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userRole="branch">
      <div className="min-h-screen bg-slate-50/50 -m-6 sm:-m-8 p-6 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-300 bg-white rounded-t-lg shadow-sm px-4 pt-4">
          <button
            onClick={() => setActiveTab("dashboard")}
            className="px-4 py-2 font-semibold text-gold-500 border-b-2 border-gold-500"
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("pos")}
            className="px-4 py-2 font-semibold text-slate-600 border-b-2 border-transparent hover:text-slate-900"
          >
            Point of Sale
            </button>
          </div>

          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Branch Dashboard
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1 sm:mt-2">
              Overview of your branch operations and sales.
            </p>
          </div>

          {/* Branch Information Card */}
          {!isBranchLoading && branchData && (
            <Card className="border-gold-500/30 bg-gradient-to-r from-gold-50 to-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gold-600">
                <MapPin className="w-5 h-5" />
                Branch Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gold-100 rounded-lg">
                    <Package className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Branch Name</p>
                    <p className="font-semibold text-slate-900">{branchData.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gold-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Location</p>
                    <p className="font-semibold text-slate-900">{branchData.location}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gold-100 rounded-lg">
                    <Phone className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Phone</p>
                    <p className="font-semibold text-slate-900">{branchData.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gold-100 rounded-lg">
                    <User className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Manager</p>
                    <p className="font-semibold text-slate-900">{branchData.manager}</p>
                  </div>
                </div>

                {/* Add barcode display in the Branch Information Card */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gold-100 rounded-lg">
                    <Barcode className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Barcode</p>
                    <p className="font-semibold text-slate-900">{branchData.barcode}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Branch Inventory
              </CardTitle>
              <Package className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingInventory ? "..." : totalInventoryUnits.toLocaleString()}
              </div>
              <p className="text-xs text-slate-600">Total units in {branchData?.name || "your branch"}</p>
            </CardContent>
          </Card>

            <Card className="hover:shadow-md transition-shadow bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Sales ({trendDateRange.label})
                </CardTitle>
                <DollarSign className="w-4 h-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₱{(dashboardSummary?.totalRevenue || 0).toLocaleString()}</div>
                <p className="text-xs text-slate-600">Branch revenue for the selected range</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Orders ({trendDateRange.label})
                </CardTitle>
                <ShoppingCart className="w-4 h-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardSummary?.totalSales || 0}</div>
                <p className="text-xs text-slate-600">Completed orders for the selected range</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg. Order Value
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-gold-500/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₱{(dashboardSummary?.avgOrderValue || 0).toLocaleString()}</div>
              <p className="text-xs text-slate-600">Average across the selected range</p>
            </CardContent>
          </Card>
          </div>

          {/* Alerts */}
          {lowStockCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-3 sm:p-4 flex gap-2 sm:gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900">Low Stock Alert</h3>
                <p className="text-sm text-amber-800">
                  {lowStockCount} product{lowStockCount > 1 ? 's' : ''} need reordering. 
                  <Link to="/branch/inventory" className="ml-1 underline font-semibold">
                    View inventory
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="bg-white shadow-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <CardTitle className="text-lg sm:text-xl leading-tight">
                    Sales Trend ({trendDateRange.label})
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">Current branch only</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="w-full sm:w-44">
                    <Select value={trendRange} onValueChange={(value) => setTrendRange(value as TrendRange)}>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder="Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days</SelectItem>
                        <SelectItem value="1y">Last 1 Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {trendRange === "custom" && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Input
                        type="date"
                        value={customTrendStartDate}
                        onChange={(event) => setCustomTrendStartDate(event.target.value)}
                        className="h-10 w-full sm:w-40"
                      />
                      <Input
                        type="date"
                        value={customTrendEndDate}
                        onChange={(event) => setCustomTrendEndDate(event.target.value)}
                        className="h-10 w-full sm:w-40"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTrend ? (
                <div className="flex items-center justify-center h-[260px] sm:h-[300px]">
                  <div className="text-sm text-slate-500">Loading sales data...</div>
                </div>
              ) : dashboardData.length === 0 ? (
                <div className="flex items-center justify-center h-[260px] sm:h-[300px]">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No sales data available</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dashboardData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                      formatter={(value: any) => [`₱${value.toLocaleString()}`, 'Sales']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: "#f59e0b" }}
                      name="Sales (₱)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

            <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Order Volume ({trendDateRange.label})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTrend ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-sm text-slate-500">Loading order data...</div>
                </div>
              ) : dashboardData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No order data available</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="orders" fill="#00b366" radius={[8, 8, 0, 0]} name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Link to="/branch/products">
                <Card className="hover:shadow-md transition-all cursor-pointer h-full bg-white border-2 border-slate-300 hover:border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      View Products
                    </p>
                    <p className="text-xs text-slate-600">
                      Available inventory
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/branch/inventory">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full bg-white border-2 border-slate-300 hover:border-secondary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-secondary/10 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Inventory</p>
                    <p className="text-xs text-slate-600">Manage stock</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/branch/sales">
            <Card className="hover:shadow-md transition-all cursor-pointer h-full bg-white border-2 border-slate-300 hover:border-accent">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <DollarSign className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Sales Records
                    </p>
                    <p className="text-xs text-slate-600">Transaction history</p>
                  </div>
                </div>
              </CardContent>
            </Card>
              </Link>
            </div>
          </div>

          {/* Recent Orders */}
          <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Order ID
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Rider
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingRecentSales ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Loading recent orders...
                      </td>
                    </tr>
                  ) : recentOrders.length > 0 ? (
                    recentOrders.map((order: any) => {
                        // normalize sale_date using helper
                        const orderDate: Date = getOrderDate(order);
                      
                      return (
                        <tr
                          key={order.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-slate-900">
                            #{order.id.split('-').pop()?.substring(0, 8)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {order.order_type === "online" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                                </svg>
                                Online Order
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                                </svg>
                                Walk-in
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            ₱{(order.total_amount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                order.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : order.status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {order.status === "completed" ? "Completed" : order.status === "pending" ? "Pending" : "Cancelled"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            {order.assigned_rider_name || "Unassigned"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            <div>{orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            <div className="text-slate-400">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No recent orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {isLoadingRecentSales ? (
                <div className="py-8 text-center text-slate-500">
                  Loading recent orders...
                </div>
              ) : recentOrders.length > 0 ? (
                recentOrders.map((order: any) => {
                  // normalize sale_date using helper
                  const orderDate: Date = getOrderDate(order);
                  
                  return (
                    <div
                      key={order.id}
                      className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header: Order ID and Status */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs text-slate-600 font-medium mb-1">Order ID</div>
                          <div className="font-mono text-sm font-semibold text-slate-900">
                            #{order.id.split('-').pop()?.substring(0, 8)}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            order.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : order.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {order.status === "completed" ? "Completed" : order.status === "pending" ? "Pending" : "Cancelled"}
                        </span>
                      </div>

                      {/* Customer Type */}
                      <div className="mb-3">
                        <div className="text-xs text-slate-600 font-medium mb-1">Customer</div>
                        {order.order_type === "online" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                            </svg>
                            Online Order
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                            </svg>
                            Walk-in
                          </span>
                        )}
                      </div>

                      {/* Amount and Date */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                        <div>
                          <div className="text-xs text-slate-600 font-medium mb-1">Amount</div>
                          <div className="text-lg font-bold text-slate-900">
                            ₱{(order.total_amount || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-600 font-medium mb-1">Date</div>
                          <div className="text-xs text-slate-800 font-semibold">
                            {orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* Rider */}
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="text-xs text-slate-600 font-medium mb-1">Assigned Rider</div>
                        <div className="text-xs text-slate-800 font-semibold">
                          {order.assigned_rider_name || "Unassigned"}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500">
                  No recent orders found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </AdminLayout>
  );
}



