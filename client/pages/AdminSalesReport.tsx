import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  FileText,
  Download,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Loader2,
  ArrowLeft,
} from "lucide-react";

export default function AdminSalesReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // Today
  });
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("daily");

  // Fetch sales data
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["salesReport", dateRange, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...(selectedBranch !== "all" && { branchId: selectedBranch }),
      });
      
      const response = await fetch(`/api/sales?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sales data");
      return response.json();
    },
  });

  // Fetch sales statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["salesStats", dateRange, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        ...(selectedBranch !== "all" && { branchId: selectedBranch }),
      });
      
      const response = await fetch(`/api/sales/stats?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sales stats");
      return response.json();
    },
  });

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await fetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
  });

  // Process data for charts
  const processChartData = () => {
    if (!salesData?.sales) return { dailySales: [], topProducts: [], branchPerformance: [] };

    const sales = salesData.sales;
    
    // Daily sales data
    const dailySalesMap = new Map();
    sales.forEach((sale: any) => {
      const date = new Date(sale.date).toLocaleDateString();
      const existing = dailySalesMap.get(date) || { date, sales: 0, orders: 0, discount: 0 };
      dailySalesMap.set(date, {
        date,
        sales: existing.sales + parseFloat(sale.total_amount),
        orders: existing.orders + 1,
        discount: existing.discount + (parseFloat(sale.discount_amount) || 0),
      });
    });
    const dailySales = Array.from(dailySalesMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Top products
    const productMap = new Map();
    sales.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        const existing = productMap.get(item.product_name) || { name: item.product_name, quantity: 0, revenue: 0 };
        productMap.set(item.product_name, {
          name: item.product_name,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + parseFloat(item.total),
        });
      });
    });
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Branch performance
    const branchMap = new Map();
    sales.forEach((sale: any) => {
      const branchName = sale.branch_name || "Unknown Branch";
      const existing = branchMap.get(branchName) || { name: branchName, sales: 0, orders: 0 };
      branchMap.set(branchName, {
        name: branchName,
        sales: existing.sales + parseFloat(sale.total_amount),
        orders: existing.orders + 1,
      });
    });
    const branchPerformance = Array.from(branchMap.values())
      .sort((a, b) => b.sales - a.sales);

    return { dailySales, topProducts, branchPerformance };
  };

  const { dailySales, topProducts, branchPerformance } = processChartData();
  const branches = branchesData?.branches || [];

  const exportReport = () => {
    if (!salesData?.sales) {
      toast({
        title: "No Data",
        description: "No sales data available to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ["Date", "Sale ID", "Branch", "Items", "Subtotal", "Discount", "Total", "Payment Method"];
    const csvContent = [
      headers.join(","),
      ...salesData.sales.map((sale: any) => [
        new Date(sale.date).toLocaleDateString(),
        sale.id,
        sale.branch_name || "Unknown",
        sale.items_count,
        parseFloat(sale.subtotal || sale.total_amount).toFixed(2),
        parseFloat(sale.discount_amount || 0).toFixed(2),
        parseFloat(sale.total_amount).toFixed(2),
        sale.payment_method,
      ].join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading sales report...</p>
        </div>
      </div>
    );
  }

  const totalSales = statsData?.totalSales || 0;
  const totalOrders = statsData?.totalOrders || 0;
  const avgOrder = statsData?.avgOrder || 0;
  const totalDiscount = dailySales.reduce((sum, day) => sum + day.discount, 0);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="mt-1 hover:bg-gray-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-8 h-8 text-primary" />
                Sales Report
              </h1>
              <p className="text-gray-600 mt-1">Comprehensive sales analytics and insights</p>
            </div>
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
              <div>
                <Label>Branch</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
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
              <div>
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={(value: "daily" | "weekly" | "monthly") => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  <p className="text-sm font-medium text-gray-600">Total Discounts</p>
                  <p className="text-2xl font-bold text-gray-900">₱{totalDiscount.toLocaleString()}</p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Sales Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`₱${Number(value).toLocaleString()}`, name]} />
                    <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Branch Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Branch Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`₱${Number(value).toLocaleString()}`, name]} />
                    <Bar dataKey="sales" fill="#10B981" />
                  </BarChart>
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
              <CardTitle>Top Products by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value, name) => [`₱${Number(value).toLocaleString()}`, name]} />
                    <Bar dataKey="revenue" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders vs Sales */}
          <Card>
            <CardHeader>
              <CardTitle>Orders vs Sales Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={branchPerformance}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="sales"
                      label={({ name, value }) => `${name}: ₱${Number(value).toLocaleString()}`}
                    >
                      {branchPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, "Sales"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Recent Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Sale ID</th>
                    <th className="text-left p-2">Branch</th>
                    <th className="text-left p-2">Items</th>
                    <th className="text-left p-2">Discount</th>
                    <th className="text-left p-2">Total</th>
                    <th className="text-left p-2">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData?.sales?.slice(0, 10).map((sale: any) => (
                    <tr key={sale.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="p-2 font-mono text-xs">{sale.id}</td>
                      <td className="p-2">{sale.branch_name || "Unknown"}</td>
                      <td className="p-2">{sale.items_count}</td>
                      <td className="p-2 text-green-600">₱{(parseFloat(sale.discount_amount) || 0).toFixed(2)}</td>
                      <td className="p-2 font-semibold">₱{parseFloat(sale.total_amount).toFixed(2)}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          sale.payment_method === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sale.payment_method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}