// @ts-nocheck
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/apiClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  Calendar,
  Download,
  Filter,
  BarChart3,
  Clock,
  Loader2,
  Building2,
} from "lucide-react";

export default function AdminSales() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportPeriod, setReportPeriod] = useState<"today" | "week" | "month" | "custom">("week");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.getBranches(),
  });

  // Auto-set date range based on period
  const updateDateRange = (period: string) => {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case "today":
        startDate = new Date(now);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return;
    }
    
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    });
  };

  // Fetch sales data for all branches or selected branch
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["adminSales", dateRange, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        status: "all", // Get all sales regardless of status
      });
      
      if (selectedBranch !== "all") {
        params.append("branchId", selectedBranch);
      }
      
      const response = await fetch(`/api/sales?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sales data");
      return response.json();
    },
  });

  // Fetch sales statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["adminSalesStats", dateRange, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      
      if (selectedBranch !== "all") {
        params.append("branchId", selectedBranch);
      }
      
      const response = await fetch(`/api/sales/stats?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sales stats");
      return response.json();
    },
  });

  const branches = branchesData?.branches || [];
  const sales = salesData?.sales || [];

  // Process data for charts
  const processChartData = () => {
    if (!sales.length) return { 
      branchComparison: [], 
      topProducts: [], 
      paymentMethods: [],
      dailyTrends: [],
    };

    // Branch comparison
    const branchMap = new Map();
    sales.forEach((sale: any) => {
      const branchName = sale.branch_name || "Unknown";
      const existing = branchMap.get(branchName) || { 
        branch: branchName, 
        sales: 0, 
        orders: 0,
        avgOrder: 0,
      };
      const newSales = existing.sales + parseFloat(sale.total_amount || 0);
      const newOrders = existing.orders + 1;
      branchMap.set(branchName, {
        branch: branchName,
        sales: newSales,
        orders: newOrders,
        avgOrder: newSales / newOrders,
      });
    });
    const branchComparison = Array.from(branchMap.values())
      .sort((a, b) => b.sales - a.sales);

    // Top products across all branches
    const productMap = new Map();
    sales.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        const existing = productMap.get(item.product_name) || { 
          name: item.product_name, 
          quantity: 0, 
          revenue: 0,
        };
        productMap.set(item.product_name, {
          name: item.product_name,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + parseFloat(item.subtotal || 0),
        });
      });
    });
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Payment methods
    const paymentMap = new Map();
    sales.forEach((sale: any) => {
      const method = sale.payment_method || "unknown";
      const existing = paymentMap.get(method) || { method, count: 0, total: 0 };
      paymentMap.set(method, {
        method,
        count: existing.count + 1,
        total: existing.total + parseFloat(sale.total_amount || 0),
      });
    });
    const paymentMethods = Array.from(paymentMap.values());

    // Daily trends
    const dailyMap = new Map();
    sales.forEach((sale: any) => {
      const saleDate = sale.sale_date?.toDate ? sale.sale_date.toDate() : new Date(sale.sale_date);
      const date = saleDate.toLocaleDateString();
      const existing = dailyMap.get(date) || { date, sales: 0, orders: 0 };
      dailyMap.set(date, {
        date,
        sales: existing.sales + parseFloat(sale.total_amount || 0),
        orders: existing.orders + 1,
      });
    });
    const dailyTrends = Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return { branchComparison, topProducts, paymentMethods, dailyTrends };
  };

  const { branchComparison, topProducts, paymentMethods, dailyTrends } = processChartData();

  const exportReport = () => {
    if (!sales.length) {
      toast({
        title: "No Data",
        description: "No sales data available to export",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Date", "Time", "Branch", "Sale ID", "Cashier", "Items Count", 
      "Subtotal", "Discount", "Total", "Payment Method", "Products"
    ];
    
    const csvContent = [
      headers.join(","),
      ...sales.map((sale: any) => {
        const products = sale.items?.map((item: any) => 
          `${item.product_name}(${item.quantity})`
        ).join("; ") || "No items";
        
        const saleDate = sale.sale_date?.toDate ? sale.sale_date.toDate() : new Date(sale.sale_date);
        
        return [
          saleDate.toLocaleDateString(),
          saleDate.toLocaleTimeString(),
          sale.branch_name || "Unknown",
          sale.id,
          sale.cashier_name || "Unknown",
          sale.items_count,
          parseFloat(sale.subtotal || sale.total_amount || 0).toFixed(2),
          parseFloat(sale.discount_amount || 0).toFixed(2),
          parseFloat(sale.total_amount || 0).toFixed(2),
          sale.payment_method,
          `"${products}"`,
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-sales-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Sales report has been downloaded",
    });
  };

  if (salesLoading || statsLoading) {
    return (
      <AdminLayout userRole="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
            <p className="text-gray-600">Loading sales data...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const totalSales = statsData?.totalSales || 0;
  const totalOrders = statsData?.totalOrders || 0;
  const avgOrder = statsData?.avgOrder || 0;
  const totalDiscount = sales.reduce((sum: number, sale: any) => 
    sum + (parseFloat(sale.discount_amount) || 0), 0
  );

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-primary" />
              Sales Overview
            </h1>
            <p className="text-gray-600 mt-1">Monitor sales performance across all branches</p>
          </div>
          <Button onClick={exportReport} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Branch Filter */}
              <div>
                <Label htmlFor="branch">Branch</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch: any) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Period Buttons */}
              <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
                <Button
                  variant={reportPeriod === "today" ? "default" : "outline"}
                  onClick={() => { setReportPeriod("today"); updateDateRange("today"); }}
                  size="sm"
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Today
                </Button>
                <Button
                  variant={reportPeriod === "week" ? "default" : "outline"}
                  onClick={() => { setReportPeriod("week"); updateDateRange("week"); }}
                  size="sm"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Week
                </Button>
                <Button
                  variant={reportPeriod === "month" ? "default" : "outline"}
                  onClick={() => { setReportPeriod("month"); updateDateRange("month"); }}
                  size="sm"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Month
                </Button>
                <Button
                  variant={reportPeriod === "custom" ? "default" : "outline"}
                  onClick={() => setReportPeriod("custom")}
                  size="sm"
                >
                  Custom
                </Button>
              </div>

              {/* Custom Date Range */}
              {reportPeriod === "custom" && (
                <>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900">₱{totalSales.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">All branches combined</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{totalOrders.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-1">Across all branches</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Order Value</p>
                  <p className="text-2xl font-bold text-gray-900">₱{avgOrder.toFixed(0)}</p>
                  <p className="text-xs text-purple-600 mt-1">Per transaction</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Branches</p>
                  <p className="text-2xl font-bold text-gray-900">{branchComparison.length}</p>
                  <p className="text-xs text-orange-600 mt-1">With sales activity</p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <Building2 className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Branch Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="branch" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => {
                      if (name === "sales") return [`₱${Number(value).toLocaleString()}`, "Sales"];
                      if (name === "avgOrder") return [`₱${Number(value).toFixed(0)}`, "Avg Order"];
                      return [value, name];
                    }} />
                    <Bar dataKey="sales" fill="#3B82F6" name="Sales" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Daily Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`₱${Number(value).toLocaleString()}`, name]} />
                    <Line type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={2} name="Sales" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.slice(0, 8).map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-gray-600">{product.quantity} units sold</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-green-600">₱{product.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                      label={({ method, total }) => `${method}: ₱${Number(total).toLocaleString()}`}
                    >
                      {paymentMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, "Total"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Branch Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Rank</th>
                    <th className="text-left p-3">Branch</th>
                    <th className="text-right p-3">Total Sales</th>
                    <th className="text-right p-3">Orders</th>
                    <th className="text-right p-3">Avg Order</th>
                  </tr>
                </thead>
                <tbody>
                  {branchComparison.map((branch, index) => (
                    <tr key={branch.branch} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="p-3 font-medium">{branch.branch}</td>
                      <td className="p-3 text-right font-bold text-green-600">₱{branch.sales.toLocaleString()}</td>
                      <td className="p-3 text-right">{branch.orders}</td>
                      <td className="p-3 text-right">₱{branch.avgOrder.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
