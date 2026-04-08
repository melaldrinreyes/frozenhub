import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Download,
} from "lucide-react";
import { paginateItems } from "@/lib/dataManager";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/authContext";

export default function BranchSales() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState("week");

  // Calculate date range
  const dateRangeParams = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, [dateRange]);

  // Fetch sales statistics
  const { data: statsResponse, isLoading: isLoadingStats } = useQuery({
    queryKey: ["sales-stats", user?.branch_id, dateRangeParams],
    queryFn: async () => {
      const response = await fetch(
        `/api/sales/stats?branchId=${user?.branch_id}&startDate=${dateRangeParams.startDate}&endDate=${dateRangeParams.endDate}`
      );
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    enabled: !!user?.branch_id,
  });

  // Fetch sales trend for charts
  const { data: trendResponse, isLoading: isLoadingTrend } = useQuery({
    queryKey: ["sales-trend", user?.branch_id, dateRange],
    queryFn: async () => {
      const days = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : dateRange === 'quarter' ? 90 : 365;
      const response = await fetch(
        `/api/sales/trend?branchId=${user?.branch_id}&days=${days}`
      );
      if (!response.ok) throw new Error('Failed to fetch trend');
      return response.json();
    },
    enabled: !!user?.branch_id,
  });

  // Fetch sales list
  const { data: salesResponse, isLoading: isLoadingSales } = useQuery({
    queryKey: ["sales-list", user?.branch_id, dateRangeParams],
    queryFn: async () => {
      const response = await fetch(
        `/api/sales?branchId=${user?.branch_id}&startDate=${dateRangeParams.startDate}&endDate=${dateRangeParams.endDate}`
      );
      if (!response.ok) throw new Error('Failed to fetch sales');
      return response.json();
    },
    enabled: !!user?.branch_id,
  });

  const salesList = salesResponse?.sales || [];
  const chartData = trendResponse?.trend || [];
  const stats = statsResponse || {
    totalRevenue: 0,
    totalSales: 0,
    avgOrderValue: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    totalProfit: 0,
    profitMargin: 0,
  };

  const { items: paginatedSales, totalPages } = paginateItems(
    salesList,
    currentPage,
    10,
  );

  // Calculate payment mix from sales data
  const payment = {
    cash: salesList.filter((s: any) => s.payment_method === "cash").length,
    online: salesList.filter((s: any) => s.payment_method === "online" || s.payment_method === "gcash").length,
  };

  return (
    <AdminLayout userRole="branch">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sales Reports</h1>
            <p className="text-slate-600 mt-2">
              Track sales performance and revenue
            </p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>

        {/* Date Range Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              {["week", "month", "quarter", "year"].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    dateRange === range
                      ? "bg-primary text-white"
                      : "bg-slate-200 text-slate-900 hover:bg-slate-300"
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{isLoadingStats ? '0.00' : stats.totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-green-600 mt-1">
                +12% from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Orders
              </CardTitle>
              <ShoppingCart className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? '0' : stats.totalSales}
              </div>
              <p className="text-xs text-green-600 mt-1">Completed orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Order Value
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{isLoadingStats ? '0' : stats.avgOrderValue.toFixed(0)}
              </div>
              <p className="text-xs text-slate-600 mt-1">Per transaction</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Mix</CardTitle>
              <Calendar className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <p className="font-semibold text-slate-900">
                  Cash: {payment.cash}
                </p>
                <p className="text-slate-600">Online: {payment.online}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTrend ? (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-slate-500">Loading...</p>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-slate-500">No data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
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
                      stroke="#0080e8"
                      strokeWidth={2}
                      dot={{ fill: "#0080e8" }}
                      name="Sales (₱)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Volume</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTrend ? (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-slate-500">Loading...</p>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <p className="text-slate-500">No data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar 
                      dataKey="salesCount" 
                      fill="#00b366" 
                      radius={[8, 8, 0, 0]} 
                      name="Orders"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales ({salesList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSales ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-slate-500">Loading sales...</p>
              </div>
            ) : salesList.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-slate-500">No sales found for this period</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Order ID
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Date
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-900">
                          Items
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-slate-900">
                          Amount
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Payment
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSales.map((sale: any) => (
                        <tr
                          key={sale.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {sale.id}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {new Date(sale.sale_date?.seconds * 1000 || sale.sale_date).toLocaleDateString()} at{" "}
                            {new Date(sale.sale_date?.seconds * 1000 || sale.sale_date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {sale.items_count || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            ₱{parseFloat(sale.total_amount || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                sale.payment_method === "cash"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {sale.payment_method === "cash" ? "Cash" : "Online"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                sale.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : sale.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {(sale.status || 'completed').charAt(0).toUpperCase() +
                                (sale.status || 'completed').slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
