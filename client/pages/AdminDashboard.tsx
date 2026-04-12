import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useMemo, useState } from "react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Package,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

const COLORS = ["#f59e0b", "#fbbf24", "#d97706", "#b45309"];

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

export default function AdminDashboard() {
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [trendRange, setTrendRange] = useState<TrendRange>("30d");
  const [trendBranchId, setTrendBranchId] = useState<string>("all");
  const [customTrendStartDate, setCustomTrendStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return formatDateLocal(date);
  });
  const [customTrendEndDate, setCustomTrendEndDate] = useState(() => {
    const date = new Date();
    return formatDateLocal(date);
  });
  const salesPerPage = 10;

  const trendDateRange = buildTrendDateRange(trendRange, customTrendStartDate, customTrendEndDate);

  // Fetch all branches
  const { data: branchesData, isLoading: isLoadingBranches } = useQuery({
    queryKey: ["branches-admin"],
    queryFn: async () => {
      const response = await fetch('/api/branches');
      if (!response.ok) throw new Error('Failed to fetch branches');
      return response.json();
    },
  });

  // Fetch system-wide totals for the summary cards.
  // This is more reliable than the branch-scoped sales stats route for admin views.
  const { data: systemStatsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ["system-stats-admin"],
    queryFn: async () => {
      return apiClient.getSystemStats();
    },
  });

  // Fetch sales trend data (all branches)
  const { data: salesTrendData, isLoading: isLoadingTrend } = useQuery({
    queryKey: ["sales-trend-admin", trendBranchId, trendDateRange.startDate, trendDateRange.endDate],
    queryFn: async () => {
      return apiClient.getSalesTrend(
        trendBranchId === "all" ? undefined : trendBranchId,
        trendDateRange.startDate,
        trendDateRange.endDate
      );
    },
  });

  // Fetch inventory (all branches)
  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ["inventory-admin"],
    queryFn: async () => {
      const response = await fetch('/api/inventory');
      if (!response.ok) throw new Error('Failed to fetch inventory');
      return response.json();
    },
  });

  // Fetch products for category distribution chart
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-admin-dashboard"],
    queryFn: () => apiClient.getProducts(),
  });

  // Fetch recent sales (all branches)
  const { data: recentSalesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ["recent-sales-admin", salesPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: salesPage.toString(),
        limit: salesPerPage.toString(),
      });
      const response = await fetch(`/api/sales?${params}`);
      if (!response.ok) throw new Error('Failed to fetch recent sales');
      const result = await response.json();
      const pagination = result?.pagination || {};

      return {
        ...result,
        totalPages: Number(pagination.pages || 0),
        totalSales: Number(pagination.total || 0),
        hasMore: Number(pagination.page || 1) < Number(pagination.pages || 0),
      };
    },
  });

  const dashboardData = (salesTrendData?.trend || []).map((entry: any) => ({
    ...entry,
    sales: Number(entry?.sales || 0),
  }));

  const categoryData = useMemo(() => {
    const products = Array.isArray(productsData?.products) ? productsData.products : [];
    const totalProductsCount = products.length;
    if (totalProductsCount === 0) return [] as Array<{ name: string; value: number }>;

    const categoryCounts = products.reduce((acc: Record<string, number>, product: any) => {
      const categoryName = String(product?.category || "Uncategorized").trim() || "Uncategorized";
      acc[categoryName] = (acc[categoryName] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(categoryCounts)
      .map(([name, count]) => ({
        name,
        value: Math.round((count / totalProductsCount) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [productsData]);
  const totalProducts = inventoryData?.inventory?.length || 0;
  const totalRevenue = systemStatsData?.stats?.sales?.revenue || 0;
  const totalSales = systemStatsData?.stats?.sales?.total || 0;
  const activeBranches = branchesData?.branches?.filter((b: any) => b.is_active)?.length || 0;
  const lowStockCount = inventoryData?.inventory?.filter((item: any) => item.quantity <= (item.reorder_level || 10))?.length || 0;

  const selectedTrendBranchName = useMemo(() => {
    if (trendBranchId === "all") return "All branches";
    const branch = branchesData?.branches?.find((b: any) => String(b.id) === String(trendBranchId));
    return branch?.name || branch?.branch_name || "Selected branch";
  }, [trendBranchId, branchesData]);

  // Helper function to get branch name from branch_id
  const getBranchName = (branchId: string) => {
    if (!branchId || !branchesData?.branches) return 'Main Branch';
    const branch = branchesData.branches.find((b: any) => b.id === branchId);
    return branch?.name || branch?.branch_name || 'Unknown Branch';
  };

  return (
    <AdminLayout userRole="admin">
      <div className="min-h-screen bg-slate-50/50 -m-6 sm:-m-8 p-6 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1 sm:mt-2">
              Welcome back! Here's an overview of your frozen food business.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold text-blue-900">
                Total Products
              </CardTitle>
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingInventory ? (
                <div className="text-xl sm:text-2xl font-bold text-blue-700 animate-pulse">...</div>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-blue-700">{totalProducts.toLocaleString()}</div>
                  <p className="text-xs text-blue-600 font-medium">Across all branches</p>
                  <p className="text-[11px] text-blue-500 mt-1">Source: Inventory records</p>
                </>
              )}
            </CardContent>
          </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-semibold text-green-900">
                  Total Revenue
                </CardTitle>
                <div className="p-2 bg-green-500 rounded-lg">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="text-xl sm:text-2xl font-bold text-green-700 animate-pulse">...</div>
                ) : (
                  <>
                    <div className="text-2xl sm:text-3xl font-bold text-green-700">₱{totalRevenue.toLocaleString()}</div>
                    <p className="text-xs text-green-600 font-medium">All time</p>
                    <p className="text-[11px] text-green-500 mt-1">Source: Sales transactions (sum of total_amount)</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gold-50 to-yellow-100 border-gold-200 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-semibold text-gold-900">
                  Total Sales
                </CardTitle>
                <div className="p-2 bg-gold-500 rounded-lg">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="text-xl sm:text-2xl font-bold text-gold-700 animate-pulse">...</div>
                ) : (
                  <>
                    <div className="text-2xl sm:text-3xl font-bold text-gold-700">{totalSales.toLocaleString()}</div>
                    <p className="text-xs text-gold-600 font-medium">All time orders</p>
                    <p className="text-[11px] text-gold-700/80 mt-1">Source: Sales transactions (count)</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold text-purple-900">
                Active Branches
              </CardTitle>
              <div className="p-2 bg-purple-500 rounded-lg">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingBranches ? (
                <div className="text-xl sm:text-2xl font-bold text-purple-700 animate-pulse">...</div>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-purple-700">{activeBranches}</div>
                  <p className="text-xs text-purple-600 font-medium">Operating now</p>
                  <p className="text-[11px] text-purple-500 mt-1">Source: Active branches list</p>
                </>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Alerts */}
          <div className="bg-gold-50 border border-gold-200 rounded-lg shadow-sm p-3 sm:p-4 flex gap-2 sm:gap-3">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gold-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gold-900 text-sm sm:text-base">Low Stock Alert</h3>
            {isLoadingInventory ? (
              <p className="text-xs sm:text-sm text-gold-800">Loading inventory...</p>
            ) : lowStockCount > 0 ? (
              <p className="text-xs sm:text-sm text-gold-800">
                {lowStockCount} products are running low on inventory. <Link to="/admin/inventory" className="underline font-medium">Review and reorder</Link>.
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-gold-800">
                All products have sufficient stock levels.
              </p>
            )}
          </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card className="lg:col-span-2 bg-white shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">Sales Trend - {trendDateRange.label}</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">{selectedTrendBranchName}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="w-full sm:w-52">
                    <Select value={trendBranchId} onValueChange={setTrendBranchId}>
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue placeholder="Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {(branchesData?.branches || []).map((branch: any) => (
                          <SelectItem key={branch.id} value={String(branch.id)}>
                            {branch.name || branch.branch_name || "Unnamed Branch"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTrend ? (
                <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-slate-500">
                  Loading sales data...
                </div>
              ) : dashboardData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[250px] sm:h-[300px] text-slate-500">
                  <TrendingUp className="w-12 h-12 mb-2 text-slate-400" />
                  <p>No sales data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                  <LineChart data={dashboardData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: any) => [`₱${value.toLocaleString()}`, 'Sales']}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
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
              <CardTitle className="text-base sm:text-lg">Product Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-slate-500">
                  Loading category data...
                </div>
              ) : categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-slate-500">
                  No category data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                      style={{ fontSize: "11px" }}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Link to="/admin/catalogs">
                <Card className="hover:shadow-md transition-all cursor-pointer h-full bg-white border-2 border-slate-300 hover:border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-base">
                      Manage Catalogs
                    </p>
                    <p className="text-xs text-slate-600">Post new products</p>
                  </div>
                </div>
              </CardContent>
                </Card>
              </Link>

              <Link to="/admin/pricing">
                <Card className="hover:shadow-md transition-all cursor-pointer h-full bg-white border-2 border-slate-300 hover:border-secondary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-secondary/10 rounded-lg">
                    <DollarSign className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-base">Pricing</p>
                    <p className="text-xs text-slate-600">Update prices</p>
                  </div>
                </div>
              </CardContent>
                </Card>
              </Link>

              <Link to="/admin/inventory">
                <Card className="hover:shadow-md transition-all cursor-pointer h-full bg-white border-2 border-slate-300 hover:border-accent">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-base">Inventory</p>
                    <p className="text-xs text-slate-600">Track stock</p>
                  </div>
                </div>
              </CardContent>
                </Card>
              </Link>

              <Link to="/admin/users">
                <Card className="hover:shadow-md transition-all cursor-pointer h-full bg-white border-2 border-slate-300 hover:border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-base">Users</p>
                    <p className="text-xs text-slate-600">Manage access</p>
                  </div>
                </div>
              </CardContent>
                </Card>
              </Link>
            </div>
          </div>

        {/* Recent Sales */}
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-base sm:text-lg">Latest Sales ({recentSalesData?.sales?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">Order ID</th>
                    <th className="text-left py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">Branch</th>
                    <th className="text-left py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">Date</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">Items</th>
                    <th className="text-left py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">Amount</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">Payment</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">Status</th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingSales ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 border-t border-slate-200">
                        <div className="flex flex-col items-center gap-3">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
                          <p>Loading recent sales...</p>
                        </div>
                      </td>
                    </tr>
                  ) : recentSalesData?.sales?.length > 0 ? (
                    recentSalesData.sales.map((sale: any, index: number) => {
                      const saleDate = sale.sale_date?._seconds 
                        ? new Date(sale.sale_date._seconds * 1000)
                        : new Date(sale.sale_date || sale.created_at);
                      
                      return (
                        <tr key={sale.id} className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <td className="py-4 px-4 font-mono text-xs text-slate-900 border-r border-slate-200">
                            {sale.id}
                          </td>
                          <td className="py-4 px-4 text-slate-700 text-sm font-medium border-r border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                              {getBranchName(sale.branch_id)}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-600 text-sm border-r border-slate-200">
                            {saleDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} at {saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </td>
                          <td className="py-4 px-4 text-center font-semibold text-slate-900 border-r border-slate-200">
                            {sale.items?.length || 0}
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900 border-r border-slate-200">
                            ₱{(sale.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-4 text-center border-r border-slate-200">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              sale.payment_method === 'cash' 
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                              {sale.payment_method === 'cash' ? 'Cash' : sale.payment_method === 'online' ? 'Online' : sale.payment_method}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center border-r border-slate-200">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              sale.status === 'completed'
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : sale.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-red-100 text-red-800 border border-red-300'
                            }`}>
                              {sale.status === 'completed' ? 'Completed' : sale.status === 'pending' ? 'Pending' : 'Cancelled'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs border-slate-300 hover:bg-slate-100"
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowItemsDialog(true);
                              }}
                            >
                              <span className="mr-1">▼</span> View Items
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 border-t border-slate-200">
                        <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-medium">No recent sales found</p>
                        <p className="text-xs text-slate-400 mt-1">Sales will appear here once transactions are made</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden p-4 space-y-3">
              {isLoadingSales ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
                    <p>Loading recent sales...</p>
                  </div>
                </div>
              ) : recentSalesData?.sales?.length > 0 ? (
                recentSalesData.sales.map((sale: any) => {
                  const saleDate = sale.sale_date?._seconds 
                    ? new Date(sale.sale_date._seconds * 1000)
                    : new Date(sale.sale_date || sale.created_at);
                  
                  return (
                    <div
                      key={sale.id}
                      className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-300 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header: Order ID and Status */}
                      <div className="flex items-start justify-between mb-3 pb-3 border-b-2 border-slate-200">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-600 font-medium mb-1">Order ID</div>
                          <div className="font-mono text-xs font-semibold text-slate-900 break-all">
                            {sale.id}
                          </div>
                        </div>
                        <span className={`ml-2 flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                          sale.status === 'completed'
                            ? 'bg-green-100 text-green-800 border-2 border-green-300'
                            : sale.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 border-2 border-amber-300'
                            : 'bg-red-100 text-red-800 border-2 border-red-300'
                        }`}>
                          {sale.status === 'completed' ? 'Completed' : sale.status === 'pending' ? 'Pending' : 'Cancelled'}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="mb-3 pb-3 border-b border-slate-200">
                        <div className="text-xs text-slate-600 font-medium mb-1">Date</div>
                        <div className="text-sm text-slate-800 font-medium">
                          {saleDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} at {saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>
                      </div>

                      {/* Branch */}
                      <div className="mb-3 pb-3 border-b border-slate-200">
                        <div className="text-xs text-slate-600 font-medium mb-1">Branch</div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-sm text-slate-800 font-medium">{getBranchName(sale.branch_id)}</span>
                        </div>
                      </div>

                      {/* Payment Method and Items */}
                      <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-slate-200">
                        <div>
                          <div className="text-xs text-slate-600 font-medium mb-1">Items</div>
                          <div className="text-xl font-bold text-slate-900">{sale.items?.length || 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 font-medium mb-1">Payment</div>
                          <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold ${
                            sale.payment_method === 'cash' 
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {sale.payment_method === 'cash' ? 'Cash' : 'Online'}
                          </span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="mb-3">
                        <div className="text-xs text-slate-600 font-medium mb-1">Amount</div>
                        <div className="text-2xl font-bold text-gold-600">
                          ₱{(sale.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t-2 border-slate-200">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full text-xs border-2 border-slate-300 hover:bg-slate-200"
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowItemsDialog(true);
                          }}
                        >
                          <span className="mr-1">▼</span> View Items
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-500">
                  <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium">No recent sales found</p>
                  <p className="text-xs text-slate-400 mt-1">Sales will appear here once transactions are made</p>
                </div>
              )}
            </div>
          </CardContent>
          
          {/* Pagination */}
          {recentSalesData?.sales?.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-slate-600">
                Page {salesPage} {recentSalesData?.totalPages ? `of ${recentSalesData.totalPages}` : ''}
                {recentSalesData?.totalSales && (
                  <span className="ml-2">({recentSalesData.totalSales} total sales)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                  disabled={salesPage === 1 || isLoadingSales}
                  className="border-slate-300 hover:bg-slate-100 font-semibold"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, recentSalesData?.totalPages || 1))].map((_, i) => {
                    const pageNum = salesPage <= 3 ? i + 1 : salesPage - 2 + i;
                    if (pageNum > (recentSalesData?.totalPages || 1)) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === salesPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSalesPage(pageNum)}
                        disabled={isLoadingSales}
                        className={pageNum === salesPage 
                          ? "bg-gold-500 hover:bg-gold-600 text-black font-bold" 
                          : "border-slate-300 hover:bg-slate-100"
                        }
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSalesPage(p => p + 1)}
                  disabled={!recentSalesData?.hasMore || isLoadingSales}
                  className="border-slate-300 hover:bg-slate-100 font-semibold"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
        </div>
      </div>

      {/* View Items Dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Items - {selectedSale?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              console.log("🔍 Selected Sale Data:", selectedSale);
              console.log("🔍 Items:", selectedSale?.items);
              if (selectedSale?.items && selectedSale.items.length > 0) {
                console.log("🔍 First Item:", selectedSale.items[0]);
              }
              return null;
            })()}
            {selectedSale?.items && selectedSale.items.length > 0 ? (
              <div className="space-y-3">
                {selectedSale.items.map((item: any, index: number) => {
                  console.log(`🔍 Item ${index}:`, item);
                  return (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{item.product_name || item.name}</h4>
                      <p className="text-sm text-slate-600">
                        Quantity: {item.quantity} × ₱{parseFloat(item.unit_price || item.price || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gold-600">
                        ₱{parseFloat(item.subtotal || (item.unit_price || item.price || 0) * (item.quantity || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )})}
                <div className="pt-4 border-t-2 border-slate-300 flex justify-between items-center">
                  <span className="text-lg font-semibold text-slate-900">Total Amount:</span>
                  <span className="text-2xl font-bold text-gold-600">
                    ₱{(selectedSale?.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p>No items found for this order</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}



