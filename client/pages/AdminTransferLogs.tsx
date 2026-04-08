import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Filter,
  Download,
  Package,
  User,
  CheckCircle,
  XCircle,
  Lock,
  Bell,
  ArrowRightLeft,
} from "lucide-react";

export default function AdminTransferLogs() {
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  // Helper function to safely parse Firestore timestamps
  const parseDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    
    // Handle Firestore Timestamp
    if (dateValue._seconds) {
      return new Date(dateValue._seconds * 1000);
    }
    if (dateValue.seconds) {
      return new Date(dateValue.seconds * 1000);
    }
    
    // Handle ISO string or Date object
    return new Date(dateValue);
  };

  // Quick date range setters
  const setDateRange = (range: 'week' | 'month' | 'year' | 'all') => {
    const end = new Date();
    const endDateStr = end.toISOString().split('T')[0];
    setEndDate(endDateStr);

    let start: Date;
    switch (range) {
      case 'week':
        start = new Date();
        start.setDate(start.getDate() - 7);
        setStartDate(start.toISOString().split('T')[0]);
        break;
      case 'month':
        start = new Date();
        start.setMonth(start.getMonth() - 1);
        setStartDate(start.toISOString().split('T')[0]);
        break;
      case 'year':
        start = new Date();
        start.setFullYear(start.getFullYear() - 1);
        setStartDate(start.toISOString().split('T')[0]);
        break;
      case 'all':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  // Fetch branches for filter
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.getBranches(),
  });

  // Fetch transfer logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ["transfer-logs", branchFilter, productFilter, startDate, endDate, limit],
    queryFn: () => apiClient.getTransferLogs({
      branchId: branchFilter !== "all" ? branchFilter : undefined,
      productId: productFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit,
    }),
  });

  const logs = logsData?.logs || [];
  const branches = branchesData?.branches || [];

  // Check for new transfers (less than 5 minutes old)
  const newTransfers = logs.filter((log: any) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const transferDate = parseDate(log.transferred_at || log.transfer_date);
    return transferDate > fiveMinutesAgo;
  });

  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = ["Date", "Product", "Quantity", "From Branch", "To Branch", "Reason", "Approved By", "Status"];
    const rows = logs.map((log: any) => [
      parseDate(log.transferred_at || log.transfer_date).toLocaleString(),
      log.product_name,
      log.quantity,
      log.from_branch_name,
      log.to_branch_name,
      log.reason || "N/A",
      log.approved_by_name,
      log.status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transfer-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        {/* Notification Banner for New Transfers */}
        {newTransfers.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 rounded-full p-2 animate-bounce">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-blue-900">
                    {newTransfers.length} New Transfer{newTransfers.length > 1 ? 's' : ''}!
                  </h3>
                  <Badge className="bg-blue-500 text-white">NEW</Badge>
                </div>
                <p className="text-sm text-blue-700 mt-0.5">
                  {newTransfers.length} new stock transfer{newTransfers.length > 1 ? 's have' : ' has'} been made in the last 5 minutes
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
            Stock Transfer Logs
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Complete audit trail of all stock transfers between branches
          </p>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              Filters
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Filter transfer logs by branch, product, date range, or limit results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Quick Date Range Buttons */}
            <div className="mb-4 pb-4 border-b">
              <Label className="text-sm mb-2 block">Quick Date Range</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('week')}
                  className="text-xs"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('month')}
                  className="text-xs"
                >
                  Last 30 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('year')}
                  className="text-xs"
                >
                  Last Year
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange('all')}
                  className="text-xs"
                >
                  All Time
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Branch Filter */}
              <div className="space-y-2">
                <Label htmlFor="branch-filter" className="text-sm">Branch</Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger id="branch-filter">
                    <SelectValue placeholder="All branches" />
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

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-sm">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-sm">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <Label htmlFor="limit" className="text-sm">Results Limit</Label>
                <Select value={limit.toString()} onValueChange={(val) => setLimit(parseInt(val))}>
                  <SelectTrigger id="limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 records</SelectItem>
                    <SelectItem value="50">50 records</SelectItem>
                    <SelectItem value="100">100 records</SelectItem>
                    <SelectItem value="200">200 records</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBranchFilter("all");
                  setProductFilter("");
                  setStartDate("");
                  setEndDate("");
                  setLimit(50);
                }}
                className="w-full sm:w-auto"
              >
                Clear Filters
              </Button>
              <Button
                onClick={handleExportCSV}
                disabled={logs.length === 0}
                className="bg-amber-500 hover:bg-amber-600 w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Total Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{logs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                In selected period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Total Units Transferred
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {logs.reduce((sum: number, log: any) => sum + log.quantity, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all transfers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Large Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                {logs.filter((log: any) => log.quantity > 100).length}
                <Lock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Transfers &gt;100 units
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transfer Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Transfer History</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Showing {logs.length} transfer{logs.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">No Transfer Logs Found</h3>
                <p className="text-sm text-muted-foreground">
                  No stock transfers match your current filters.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {logs.map((log: any) => (
                    <div
                      key={log.id}
                      className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header with Product and Date */}
                      <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-100">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white flex-shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm mb-1">
                              {log.product_name}
                            </h3>
                            <p className="text-xs text-slate-500 mb-1">ID: {log.product_id}</p>
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Calendar className="w-3 h-3 flex-shrink-0" />
                              <p className="text-xs">
                                {parseDate(log.transferred_at || log.transfer_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })} • {parseDate(log.transferred_at || log.transfer_date).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-2">
                          {log.status === "success" ? (
                            <Badge className="bg-green-500 hover:bg-green-600 text-xs whitespace-nowrap">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs whitespace-nowrap">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Quantity Display */}
                      <div className="mb-3 bg-white rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center justify-center gap-2">
                          {log.quantity > 100 && <Lock className="h-4 w-4 text-amber-500" />}
                          <span className={`text-2xl font-bold ${log.quantity > 100 ? 'text-amber-600' : 'text-slate-900'}`}>
                            {log.quantity}
                          </span>
                          <span className="text-sm text-slate-500">units</span>
                        </div>
                        {log.quantity > 100 && (
                          <p className="text-xs text-center text-amber-600 mt-1">Large Transfer</p>
                        )}
                      </div>

                      {/* Transfer Route */}
                      <div className="mb-3 bg-white rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                              <p className="text-xs font-medium text-slate-500">From</p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {log.from_branch_name}
                            </p>
                          </div>
                          <ArrowRightLeft className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 text-right">
                            <div className="flex items-center justify-end gap-2 mb-1">
                              <p className="text-xs font-medium text-slate-500">To</p>
                              <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            </div>
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {log.to_branch_name}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Details */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs font-medium text-slate-500">Approved By</p>
                          </div>
                          <p className="text-sm text-slate-900 font-semibold truncate">
                            {log.approved_by_name}
                          </p>
                        </div>
                        {log.reason && (
                          <div className="bg-white rounded-lg p-3 border border-slate-100 col-span-2">
                            <p className="text-xs font-medium text-slate-500 mb-1">Reason</p>
                            <p className="text-sm text-slate-900">
                              {log.reason}
                            </p>
                          </div>
                        )}
                        {log.notes && (
                          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 col-span-2">
                            <p className="text-xs font-medium text-amber-700 mb-1">Notes</p>
                            <p className="text-sm text-amber-900">
                              {log.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm px-2 sm:px-4">Date & Time</TableHead>
                          <TableHead className="text-xs sm:text-sm px-2 sm:px-4">Product</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-2 sm:px-4">Quantity</TableHead>
                          <TableHead className="text-xs sm:text-sm px-2 sm:px-4">From Branch</TableHead>
                          <TableHead className="text-xs sm:text-sm px-2 sm:px-4">To Branch</TableHead>
                          <TableHead className="text-xs sm:text-sm px-2 sm:px-4">Reason</TableHead>
                          <TableHead className="text-xs sm:text-sm px-2 sm:px-4">Approved By</TableHead>
                          <TableHead className="text-center text-xs sm:text-sm px-2 sm:px-4">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="px-2 sm:px-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium text-xs sm:text-sm">
                                    {parseDate(log.transferred_at || log.transfer_date).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {parseDate(log.transferred_at || log.transfer_date).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 sm:px-4">
                              <div className="font-medium text-xs sm:text-sm">{log.product_name}</div>
                              <div className="text-xs text-muted-foreground">ID: {log.product_id}</div>
                            </TableCell>
                            <TableCell className="text-center px-2 sm:px-4">
                              <div className="flex items-center justify-center gap-1">
                                {log.quantity > 100 && <Lock className="h-3 w-3 text-amber-500" />}
                                <span className={`font-bold text-xs sm:text-sm ${log.quantity > 100 ? 'text-amber-600' : ''}`}>
                                  {log.quantity}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 sm:px-4">
                              <div className="flex items-center gap-2">
                                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                                <div>
                                  <div className="font-medium text-xs sm:text-sm">{log.from_branch_name}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 sm:px-4">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                                <div>
                                  <div className="font-medium text-xs sm:text-sm">{log.to_branch_name}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 sm:px-4">
                              <div className="max-w-[200px] truncate text-xs sm:text-sm">
                                {log.reason || <span className="text-muted-foreground italic">No reason provided</span>}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 sm:px-4">
                              <div className="font-medium text-xs sm:text-sm">{log.approved_by_name}</div>
                              {log.notes && (
                                <div className="text-xs text-amber-600">{log.notes}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-center px-2 sm:px-4">
                              {log.status === "success" ? (
                                <Badge className="bg-green-500 hover:bg-green-600 text-xs whitespace-nowrap">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Success
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs whitespace-nowrap">
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Failed
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
