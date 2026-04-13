import { useState, useMemo, Fragment } from "react";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { paginateItems } from "@/lib/dataManager";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";

// Define Sale type locally (previously from mockData)
interface Sale {
  id: string;
  date: Date;
  branchId: string;
  branchName: string;
  totalAmount: number;
  itemsCount: number;
  paymentMethod: "cash" | "online";
  status: "completed" | "pending" | "cancelled";
  items?: SaleItem[];
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface BranchSaleRow {
  id: string;
  sale_date: any;
  items_count?: number;
  items?: any[];
  total_amount?: number | string;
  payment_method?: string;
  status?: string;
  assigned_rider_name?: string | null;
}

function formatDateLocal(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BranchSales() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("all");

  // Calculate date range
  const dateRangeParams = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setDate(startDate.getDate() - 30); // Last 30 days instead of -1 month
        break;
      case "quarter":
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "year":
        startDate.setDate(startDate.getDate() - 365);
        break;
      case "all":
        // Show all time data
        startDate.setFullYear(2020, 0, 1); // Start from 2020
        break;
    }
    
    return {
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate),
    };
  }, [dateRange]);

  // Fetch sales statistics
  const { data: salesStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["sales-stats", user?.branch_id, dateRangeParams],
    queryFn: async () => {
      const result = await apiClient.getSalesStats(user?.branch_id || undefined, dateRangeParams.startDate, dateRangeParams.endDate);
      console.log("📊 Sales Stats:", result);
      return result;
    },
    enabled: !!user && user.role === "branch_admin",
  });

  // Fetch sales trend for charts
  const { data: salesTrend, isLoading: isLoadingTrend } = useQuery({
    queryKey: ["sales-trend", user?.branch_id, dateRangeParams],
    queryFn: async () => {
      const result = await apiClient.getSalesTrend(user?.branch_id || undefined, dateRangeParams.startDate, dateRangeParams.endDate);
      console.log("📈 Sales Trend:", result);
      return result;
    },
    enabled: !!user && user.role === "branch_admin",
  });

  // Fetch sales list
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ["sales", user?.branch_id, dateRangeParams],
    queryFn: async () => {
      const result = await apiClient.getSales(user?.branch_id || undefined, dateRangeParams.startDate, dateRangeParams.endDate);
      console.log("🛒 Sales List:", result);
      return result;
    },
    enabled: !!user && user.role === "branch_admin",
  });

  const sales: BranchSaleRow[] = (salesData?.sales as BranchSaleRow[] | undefined) || [];
  const chartData = salesTrend?.trend || [];

  const { data: expandedSaleItems = [] } = useQuery({
    queryKey: ["branch-sale-items", expandedSaleId],
    queryFn: async () => {
      if (!expandedSaleId) return [];
      const result = await apiClient.getSaleItems(expandedSaleId);
      return (result.items || []).map((item: any) => ({
        ...item,
        unit_price: Number(item.unit_price ?? item.price ?? 0),
        subtotal: Number(item.subtotal ?? item.total ?? 0),
      }));
    },
    enabled: !!expandedSaleId,
  });

  const { items: paginatedSales, totalPages } = paginateItems(
    sales,
    currentPage,
    10,
  );

  // Calculate statistics from API data or use defaults
  const totalRevenue = salesStats?.totalRevenue || 0;
  const totalOrders = salesStats?.totalSales || sales.length;
  const avgOrderValue = salesStats?.avgOrderValue || 0;
  
  // Calculate payment mix from sales data
  const payment = {
    cash: sales.filter((s: any) => s.payment_method === "cash").length,
    online: sales.filter((s: any) => s.payment_method === "online" || s.payment_method === "gcash").length,
  };

  // Export to CSV function
  const handleExportReport = () => {
    try {
      // Prepare CSV headers
      const headers = [
        "Order ID",
        "Date",
        "Time",
        "Items Count",
        "Total Amount",
        "Payment Method",
        "Status",
        "Item Details"
      ];

      // Prepare CSV rows
      const rows = sales.map((sale: any) => {
        // Handle Firestore Timestamp
        let saleDate: Date;
        try {
          if (sale.sale_date?._seconds) {
            saleDate = new Date(sale.sale_date._seconds * 1000);
          } else if (sale.sale_date?.toDate) {
            saleDate = sale.sale_date.toDate();
          } else if (sale.sale_date) {
            saleDate = new Date(sale.sale_date);
          } else {
            saleDate = new Date();
          }
          
          if (isNaN(saleDate.getTime())) {
            saleDate = new Date();
          }
        } catch (e) {
          saleDate = new Date();
        }

        // Format item details
        const itemDetails = sale.items && sale.items.length > 0
          ? sale.items.map((item: any) => 
              `${item.product_name} (${item.quantity}x ₱${parseFloat(item.unit_price || 0).toFixed(2)})`
            ).join("; ")
          : "No items";

        return [
          sale.id,
          saleDate.toLocaleDateString(),
          saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sale.items?.length || 0,
          `₱${parseFloat(sale.total_amount || 0).toFixed(2)}`,
          sale.payment_method === "cash" ? "Cash" : "Online",
          sale.status.charAt(0).toUpperCase() + sale.status.slice(1),
          `"${itemDetails}"` // Wrap in quotes to handle commas in item details
        ];
      });

      // Combine headers and rows
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // Add BOM for Excel UTF-8 support
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      
      // Create download link
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      // Generate filename with date range
      const filename = `Sales_Report_${dateRange}_${formatDateLocal(new Date())}.csv`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting report:", error);
      alert("Failed to export report. Please try again.");
    }
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
          <Button 
            onClick={handleExportReport}
            disabled={sales.length === 0}
            className="bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-2 border-2 border-yellow-600 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>

        {/* Date Range Selector */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {["week", "month", "quarter", "year", "all"].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all border-2 ${
                    dateRange === range
                      ? "bg-yellow-500 text-white border-yellow-600 shadow-md"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  {range === "all" ? "All Time" : range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900">
                Total Revenue
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">₱{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-green-700 mt-1 font-medium">
                +12% from last period
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">
                Total Orders
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{sales.length}</div>
              <p className="text-xs text-blue-700 mt-1 font-medium">Completed orders</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-900">
                Avg Order Value
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900">
                ₱{avgOrderValue.toLocaleString()}
              </div>
              <p className="text-xs text-yellow-700 mt-1 font-medium">Per transaction</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">Payment Mix</CardTitle>
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <p className="font-semibold text-purple-900">
                  Cash: {payment.cash}
                </p>
                <p className="text-purple-700 font-medium">Online: {payment.online}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 shadow-sm">
            <CardHeader className="border-b-2 border-slate-200">
              <CardTitle className="text-slate-900">Sales Trend</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="date" stroke="#475569" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#475569" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 shadow-sm">
            <CardHeader className="border-b-2 border-slate-200">
              <CardTitle className="text-slate-900">Order Volume</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="date" stroke="#475569" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#475569" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar dataKey="orders" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Recent Sales ({sales.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      Order ID
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      Date
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      Items
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      Amount
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      Payment
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      Status
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      Rider
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale, index) => {
                    // Handle Firestore Timestamp properly
                    let saleDate: Date;
                    try {
                      if (sale.sale_date?._seconds) {
                        // Firestore Timestamp serialized format from API
                        saleDate = new Date(sale.sale_date._seconds * 1000);
                      } else if (sale.sale_date?.toDate) {
                        saleDate = sale.sale_date.toDate();
                      } else if (sale.sale_date) {
                        saleDate = new Date(sale.sale_date);
                      } else {
                        saleDate = new Date();
                      }
                      
                      // Validate date
                      if (isNaN(saleDate.getTime())) {
                        console.error('Invalid date for sale:', sale.id, sale.sale_date);
                        saleDate = new Date();
                      }
                    } catch (e) {
                      console.error('Date parsing error:', e, sale.sale_date);
                      saleDate = new Date();
                    }
                    
                    return (
                    <Fragment key={`sale-row-${sale.id || index}`}>
                      <tr
                        key={`sale-${sale.id}`}
                        className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                      >
                        <td className="py-4 px-4 font-mono text-xs text-slate-900 border-r border-slate-200">
                          {sale.id}
                        </td>
                        <td className="py-4 px-4 text-slate-600 text-sm border-r border-slate-200">
                          {saleDate.toLocaleDateString()} at{" "}
                          {saleDate.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-slate-900 border-r border-slate-200">
                          {Number(sale.items_count ?? sale.items?.length ?? 0)}
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900 border-r border-slate-200">
                          ₱{parseFloat(sale.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-center border-r border-slate-200">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                              sale.payment_method === "cash"
                                ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                : "bg-blue-100 text-blue-800 border-blue-300"
                            }`}
                          >
                            {sale.payment_method === "cash" ? "Cash" : "Online"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center border-r border-slate-200">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                              sale.status === "completed"
                                ? "bg-green-100 text-green-800 border-green-300"
                                : sale.status === "pending"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-red-100 text-red-800 border-red-300"
                            }`}
                          >
                            {((sale.status || 'completed').charAt(0).toUpperCase() +
                              (sale.status || 'completed').slice(1))}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center text-xs text-slate-700 border-r border-slate-200">
                          {sale.assigned_rider_name || "Unassigned"}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                            className="flex items-center gap-1 text-xs border-slate-300 hover:bg-slate-100"
                          >
                            {expandedSaleId === sale.id ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                View
                              </>
                            )} Items
                          </Button>
                        </td>
                      </tr>
                      {expandedSaleId === sale.id && (
                        <tr key={`sale-${sale.id}-items`} className="bg-slate-100 border-b-2 border-slate-300">
                          <td colSpan={8} className="py-4 px-4">
                            <div className="ml-8 border-2 border-slate-200 rounded-lg p-4 bg-white">
                              <h4 className="font-semibold text-slate-900 mb-3 text-sm">Items Purchased:</h4>
                              {expandedSaleItems.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                      <tr className="border-b-2 border-slate-200">
                                        <th className="text-left py-2 px-3 font-semibold text-slate-700 border-r border-slate-200">Product</th>
                                        <th className="text-right py-2 px-3 font-semibold text-slate-700 border-r border-slate-200">Unit Price</th>
                                        <th className="text-right py-2 px-3 font-semibold text-slate-700 border-r border-slate-200">Quantity</th>
                                        <th className="text-right py-2 px-3 font-semibold text-slate-700">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expandedSaleItems.map((item: any, itemIndex: number) => (
                                        <tr key={`item-${sale.id}-${item.id || itemIndex}`} className={`border-b border-slate-100 ${itemIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                          <td className="py-2 px-3 text-slate-700 font-medium border-r border-slate-200">{item.product_name || "Unknown Product"}</td>
                                          <td className="py-2 px-3 text-right text-slate-600 border-r border-slate-200">₱{parseFloat(item.unit_price || 0).toFixed(2)}</td>
                                          <td className="py-2 px-3 text-right text-slate-600 border-r border-slate-200">{item.quantity || 0}</td>
                                          <td className="py-2 px-3 text-right font-bold text-slate-900">₱{parseFloat(item.subtotal || 0).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">No item details found for this order.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden p-4 space-y-3">
              {paginatedSales.map((sale) => {
                // Handle Firestore Timestamp properly
                let saleDate: Date;
                try {
                  if (sale.sale_date?._seconds) {
                    saleDate = new Date(sale.sale_date._seconds * 1000);
                  } else if (sale.sale_date?.toDate) {
                    saleDate = sale.sale_date.toDate();
                  } else if (sale.sale_date) {
                    saleDate = new Date(sale.sale_date);
                  } else {
                    saleDate = new Date();
                  }
                  
                  if (isNaN(saleDate.getTime())) {
                    saleDate = new Date();
                  }
                } catch (e) {
                  saleDate = new Date();
                }
                
                const isExpanded = expandedSaleId === sale.id;
                
                return (
                  <div
                    key={sale.id}
                    className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-300 rounded-lg p-4 shadow-sm"
                  >
                    {/* Header: Order ID and Status */}
                    <div className="flex items-start justify-between mb-3 pb-3 border-b-2 border-slate-200">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-600 font-medium mb-1">Order ID</div>
                        <div className="font-mono text-xs font-semibold text-slate-900 break-all">
                          {sale.id}
                        </div>
                      </div>
                      <span className={`ml-2 flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border-2 ${
                        (sale.status || 'completed') === 'completed'
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : (sale.status || 'completed') === 'pending'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {((sale.status || 'completed').charAt(0).toUpperCase() +
                          (sale.status || 'completed').slice(1))}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="mb-3 pb-3 border-b border-slate-200">
                      <div className="text-xs text-slate-600 font-medium mb-1">Date</div>
                      <div className="text-sm text-slate-800 font-medium">
                        {saleDate.toLocaleDateString()} at {saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Payment Method and Items */}
                    <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="text-xs text-slate-600 font-medium mb-1">Items</div>
                        <div className="text-xl font-bold text-slate-900">{Number(sale.items_count ?? sale.items?.length ?? 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-600 font-medium mb-1">Payment</div>
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-semibold border ${
                          sale.payment_method === 'cash' 
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300' 
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}>
                          {sale.payment_method === 'cash' ? 'Cash' : 'Online'}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="mb-3">
                      <div className="text-xs text-slate-600 font-medium mb-1">Amount</div>
                      <div className="text-2xl font-bold text-gold-600">
                        ₱{parseFloat(sale.total_amount || 0).toFixed(2)}
                      </div>
                    </div>

                    {/* Rider */}
                    <div className="mb-3">
                      <div className="text-xs text-slate-600 font-medium mb-1">Assigned Rider</div>
                      <div className="text-sm font-semibold text-slate-800">
                        {sale.assigned_rider_name || "Unassigned"}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t-2 border-slate-200">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                        className="w-full text-xs border-2 border-slate-300 hover:bg-slate-200"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3 mr-1" />
                            Hide Items
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3 mr-1" />
                            View Items
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t-2 border-slate-200">
                        <h4 className="font-semibold text-slate-900 mb-2 text-xs">Items Purchased:</h4>
                        {expandedSaleItems.length > 0 ? (
                          <div className="space-y-2">
                            {expandedSaleItems.map((item: any, itemIndex: number) => (
                              <div key={item.id || itemIndex} className="bg-white border border-slate-200 rounded p-2 text-xs">
                                <div className="font-medium text-slate-900 mb-1">{item.product_name || "Unknown Product"}</div>
                                <div className="grid grid-cols-3 gap-2 text-slate-600">
                                  <div>
                                    <span className="text-[10px] text-slate-500">Price:</span>
                                    <div className="font-semibold">₱{parseFloat(item.unit_price || 0).toFixed(2)}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500">Qty:</span>
                                    <div className="font-semibold">{item.quantity || 0}</div>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500">Total:</span>
                                    <div className="font-bold text-slate-900">₱{parseFloat(item.subtotal || 0).toFixed(2)}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">No item details found for this order.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}




