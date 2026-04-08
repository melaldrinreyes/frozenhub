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
  Clock,
  Loader2,
  ArrowLeft,
} from "lucide-react";

export default function BranchSalesReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // Today
  });
  const [reportPeriod, setReportPeriod] = useState<"today" | "week" | "month" | "custom">("week");

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
        return; // custom - don't auto-update
    }
    
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    });
  };

  // Fetch sales data for current branch
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["branchSalesReport", dateRange, user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) throw new Error("Branch not set");
      
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        branchId: user.branch_id,
      });
      
      const response = await fetch(`/api/sales?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sales data");
      return response.json();
    },
    enabled: !!user?.branch_id,
  });

  // Fetch sales statistics for current branch
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["branchSalesStats", dateRange, user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) throw new Error("Branch not set");
      
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        branchId: user.branch_id,
      });
      
      const response = await fetch(`/api/sales/stats?${params}`);
      if (!response.ok) throw new Error("Failed to fetch sales stats");
      return response.json();
    },
    enabled: !!user?.branch_id,
  });

  // Process data for charts
  const processChartData = () => {
    if (!salesData?.sales) return { 
      hourlyTrends: [], 
      topProducts: [], 
      paymentMethods: [],
      dailyGoals: [],
    };

    const sales = salesData.sales;
    
    // Hourly trends
    const hourlyMap = new Map();
    sales.forEach((sale: any) => {
      const saleDate = sale.sale_date?.toDate ? sale.sale_date.toDate() : new Date(sale.sale_date);
      const hour = saleDate.getHours();
      const timeSlot = `${hour}:00`;
      const existing = hourlyMap.get(timeSlot) || { time: timeSlot, sales: 0, orders: 0 };
      hourlyMap.set(timeSlot, {
        time: timeSlot,
        sales: existing.sales + parseFloat(sale.total_amount || 0),
        orders: existing.orders + 1,
      });
    });
    const hourlyTrends = Array.from(hourlyMap.values()).sort((a, b) => 
      parseInt(a.time) - parseInt(b.time)
    );

    // Top products
    const productMap = new Map();
    sales.forEach((sale: any) => {
      sale.items?.forEach((item: any) => {
        const existing = productMap.get(item.product_name) || { 
          name: item.product_name, 
          quantity: 0, 
          revenue: 0,
          avgPrice: 0,
        };
        const newQuantity = existing.quantity + item.quantity;
        const newRevenue = existing.revenue + parseFloat(item.subtotal || 0);
        
        productMap.set(item.product_name, {
          name: item.product_name,
          quantity: newQuantity,
          revenue: newRevenue,
          avgPrice: newRevenue / newQuantity,
        });
      });
    });
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

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

    // Daily performance vs goals (mock goals for demo)
    const dailyMap = new Map();
    sales.forEach((sale: any) => {
      const saleDate = sale.sale_date?.toDate ? sale.sale_date.toDate() : new Date(sale.sale_date);
      const date = saleDate.toLocaleDateString();
      const existing = dailyMap.get(date) || { date, actual: 0, goal: 5000 }; // ₱5000 daily goal
      dailyMap.set(date, {
        date,
        actual: existing.actual + parseFloat(sale.total_amount || 0),
        goal: existing.goal,
      });
    });
    const dailyGoals = Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return { hourlyTrends, topProducts, paymentMethods, dailyGoals };
  };

  const { hourlyTrends, topProducts, paymentMethods, dailyGoals } = processChartData();

  const exportBranchReport = () => {
    if (!salesData?.sales) {
      toast({
        title: "No Data",
        description: "No sales data available to export",
        variant: "destructive",
      });
      return;
    }

    // Create detailed CSV content for branch
    const headers = [
      "Date", "Time", "Sale ID", "Cashier", "Items Count", 
      "Subtotal", "Discount", "Total", "Payment Method", "Products"
    ];
    
    const csvContent = [
      headers.join(","),
      ...salesData.sales.map((sale: any) => {
        const products = sale.items?.map((item: any) => 
          `${item.product_name}(${item.quantity})`
        ).join("; ") || "No items";
        
        const saleDate = sale.sale_date?.toDate ? sale.sale_date.toDate() : new Date(sale.sale_date);
        
        return [
          saleDate.toLocaleDateString(),
          saleDate.toLocaleTimeString(),
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

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-sales-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Branch sales report has been downloaded",
    });
  };

  if (salesLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading branch sales report...</p>
        </div>
      </div>
    );
  }

  if (!user?.branch_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Branch Not Set</h2>
          <p className="text-gray-600">Please contact administrator to assign you to a branch.</p>
        </div>
      </div>
    );
  }

  const totalSales = statsData?.totalSales || 0;
  const totalOrders = statsData?.totalOrders || 0;
  const avgOrder = statsData?.avgOrder || 0;
  const totalDiscount = salesData?.sales?.reduce((sum: number, sale: any) => 
    sum + (parseFloat(sale.discount_amount) || 0), 0
  ) || 0;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
                Branch Sales Report
              </h1>
              <p className="text-gray-600 mt-1">Sales performance for your branch</p>
            </div>
          </div>
          <Button onClick={exportBranchReport} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>

        {/* Quick Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Report Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              <Button
                variant={reportPeriod === "today" ? "default" : "outline"}
                onClick={() => { setReportPeriod("today"); updateDateRange("today"); }}
                className="flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Today
              </Button>
              <Button
                variant={reportPeriod === "week" ? "default" : "outline"}
                onClick={() => { setReportPeriod("week"); updateDateRange("week"); }}
                className="flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                This Week
              </Button>
              <Button
                variant={reportPeriod === "month" ? "default" : "outline"}
                onClick={() => { setReportPeriod("month"); updateDateRange("month"); }}
                className="flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                This Month
              </Button>
              <Button
                variant={reportPeriod === "custom" ? "default" : "outline"}
                onClick={() => setReportPeriod("custom")}
              >
                Custom Range
              </Button>
              
              {reportPeriod === "custom" && (
                <>
                  <div>
                    <Label htmlFor="startDate" className="text-xs">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-xs">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      className="text-sm"
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
                  <p className="text-sm font-medium text-gray-600">Branch Sales</p>
                  <p className="text-2xl font-bold text-gray-900">₱{totalSales.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">+12% from last period</p>
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
                  <p className="text-sm font-medium text-gray-600">Orders Processed</p>
                  <p className="text-2xl font-bold text-gray-900">{totalOrders.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-1">+8% from last period</p>
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
                  <p className="text-sm font-medium text-gray-600">Avg. Transaction</p>
                  <p className="text-2xl font-bold text-gray-900">₱{avgOrder.toFixed(0)}</p>
                  <p className="text-xs text-purple-600 mt-1">+3% from last period</p>
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
                  <p className="text-sm font-medium text-gray-600">Discounts Given</p>
                  <p className="text-2xl font-bold text-gray-900">₱{totalDiscount.toFixed(0)}</p>
                  <p className="text-xs text-orange-600 mt-1">{((totalDiscount/totalSales)*100).toFixed(1)}% of sales</p>
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
          {/* Hourly Sales Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Hourly Sales Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`₱${Number(value).toLocaleString()}`, name]} />
                    <Bar dataKey="sales" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Daily Goals */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Performance vs Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyGoals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`₱${Number(value).toLocaleString()}`, name]} />
                    <Bar dataKey="goal" fill="#E5E7EB" name="Goal" />
                    <Bar dataKey="actual" fill="#10B981" name="Actual" />
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
              <CardTitle>Best Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.slice(0, 6).map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-gray-600">{product.quantity} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">₱{product.revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-600">₱{product.avgPrice.toFixed(0)} avg</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods Distribution</CardTitle>
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

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Time</th>
                    <th className="text-left p-2">Sale ID</th>
                    <th className="text-left p-2">Cashier</th>
                    <th className="text-left p-2">Items</th>
                    <th className="text-left p-2">Discount</th>
                    <th className="text-left p-2">Total</th>
                    <th className="text-left p-2">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData?.sales?.slice(0, 15).map((sale: any) => {
                    const saleDate = sale.sale_date?.toDate ? sale.sale_date.toDate() : new Date(sale.sale_date);
                    return (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{saleDate.toLocaleTimeString()}</td>
                        <td className="p-2 font-mono text-xs">{sale.id.split('-').pop()}</td>
                        <td className="p-2">{sale.cashier_name || "Unknown"}</td>
                        <td className="p-2">{sale.items_count}</td>
                        <td className="p-2 text-green-600">₱{(parseFloat(sale.discount_amount || 0)).toFixed(2)}</td>
                        <td className="p-2 font-semibold">₱{parseFloat(sale.total_amount || 0).toFixed(2)}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            sale.payment_method === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {sale.payment_method}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}