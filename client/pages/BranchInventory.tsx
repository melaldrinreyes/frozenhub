import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Package,
  AlertTriangle,
  Search,
  Edit,
  TrendingDown,
  ArrowRightLeft,
  Eye,
  Bell,
} from "lucide-react";
import { filterBySearch, paginateItems } from "@/lib/dataManager";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/hooks/use-toast";
import { StockTransferDialog } from "@/components/StockTransferDialog";
import { ProductAvailabilityDialog } from "@/components/ProductAvailabilityDialog";

// Define Inventory type locally
interface Inventory {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  reorder_level: number;
  branch_id: string;
  branch_name: string;
  last_stock_check: string;
}

export default function BranchInventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch inventory for current branch
  const { data, isLoading } = useQuery({
    queryKey: ["inventory", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return { inventory: [] };
      return await apiClient.getInventory(user.branch_id);
    },
    enabled: !!user?.branch_id,
  });

  const inventory = data?.inventory || [];
  
  // Fetch transfer logs to check for new incoming transfers
  const { data: transfersData } = useQuery({
    queryKey: ["transfer-logs-new", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return { logs: [] };
      return await apiClient.getTransferLogs({ branchId: user.branch_id });
    },
    enabled: !!user?.branch_id,
    refetchInterval: 10000, // Check every 10 seconds
  });

  const transferLogs = transfersData?.logs || [];
  
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
  
  // Check for new incoming transfers (less than 5 minutes old, to this branch)
  const newIncomingTransfers = transferLogs.filter((log: any) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const transferDate = parseDate(log.transferred_at || log.transfer_date);
    return log.to_branch_id === user?.branch_id && transferDate > fiveMinutesAgo;
  });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProductName, setSelectedProductName] = useState<string>("");

  // Update inventory mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; quantity: number }) => {
      return await apiClient.updateInventory(data.id, { quantity: data.quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Success",
        description: "Inventory updated successfully",
      });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update inventory",
      });
    },
  });

  // Filter inventory - use correct field names
  let filteredInventory = inventory;

  if (searchTerm) {
    filteredInventory = inventory.filter((item: Inventory) =>
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (filterLowStock) {
    filteredInventory = filteredInventory.filter(
      (i) => i.quantity <= i.reorder_level,
    );
  }

  const { items: paginatedInventory, totalPages } = paginateItems(
    filteredInventory,
    currentPage,
    10,
  );

  const lowStockCount = inventory.filter(
    (i) => i.quantity <= i.reorder_level,
  ).length;

  const totalStock = inventory.reduce((sum, i) => sum + i.quantity, 0);

  const handleOpenDialog = (item: Inventory) => {
    setSelectedItem(item);
    setAdjustmentQty(item.quantity);
    setAdjustmentReason("");
    setIsDialogOpen(true);
  };

  const handleAdjustStock = () => {
    if (!selectedItem) return;
    
    if (adjustmentQty < 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Quantity cannot be negative",
      });
      return;
    }

    updateMutation.mutate({
      id: selectedItem.id,
      quantity: adjustmentQty,
    });
  };

  const getStockStatus = (item: Inventory) => {
    const percentage = (item.quantity / item.reorder_level) * 100;
    if (percentage === 0) return { label: "Out of Stock", color: "red" };
    if (percentage <= 50) return { label: "Critical", color: "red" };
    if (percentage <= 100) return { label: "Low", color: "yellow" };
    return { label: "Adequate", color: "green" };
  };

  if (isLoading) {
    return (
      <AdminLayout userRole="branch">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading inventory...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userRole="branch">
      <div className="space-y-6">
        {/* Notification Banner for New Incoming Transfers */}
        {newIncomingTransfers.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 rounded-full p-2 animate-bounce">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-green-900">
                    {newIncomingTransfers.length} New Stock Transfer{newIncomingTransfers.length > 1 ? 's' : ''}!
                  </h3>
                  <Badge className="bg-green-500 text-white">NEW</Badge>
                </div>
                <p className="text-sm text-green-700 mt-0.5">
                  Your branch has received {newIncomingTransfers.length} stock transfer{newIncomingTransfers.length > 1 ? 's' : ''} in the last 5 minutes
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Branch Inventory
          </h1>
          <p className="text-slate-600 mt-2">
            Manage inventory for your branch location
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-blue-900">Total Stock</CardTitle>
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">{totalStock}</div>
              <p className="text-xs text-blue-600 font-medium mt-1">Units in inventory</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-red-900">
                Low Stock Items
              </CardTitle>
              <div className="p-2 bg-red-500 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700">
                {lowStockCount}
              </div>
              <p className="text-xs text-red-600 font-medium mt-1">Need attention</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gold-50 to-yellow-100 border-gold-200 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-gold-900">
                Product Types
              </CardTitle>
              <div className="p-2 bg-gold-500 rounded-lg">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold-700">{inventory.length}</div>
              <p className="text-xs text-gold-600 font-medium mt-1">Tracked products</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {lowStockCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">
                {lowStockCount} Item(s) Below Reorder Level
              </h3>
              <p className="text-sm text-amber-800">
                Please request reorder from head office
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4 flex-col sm:flex-row">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>

              <Button
                onClick={() => {
                  setFilterLowStock(!filterLowStock);
                  setCurrentPage(1);
                }}
                variant={filterLowStock ? "default" : "outline"}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Low Stock Only
              </Button>

              <Button
                onClick={() => setShowTransferDialog(true)}
                variant="outline"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer Stock
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Levels ({filteredInventory.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Product
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-900">
                      Current Stock
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-900">
                      Reorder Level
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium">No inventory items found</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Products will appear here once they are added to your branch
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedInventory.map((item) => {
                    const status = getStockStatus(item);
                    const percentage =
                      (item.quantity / item.reorder_level) * 100;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            {item.product_name}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {item.reorder_level}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  percentage === 0
                                    ? "bg-red-500"
                                    : percentage <= 50
                                      ? "bg-red-500"
                                      : percentage <= 100
                                        ? "bg-yellow-500"
                                        : "bg-green-500"
                                }`}
                                style={{
                                  width: `${Math.min(percentage, 100)}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                                status.color === "red"
                                  ? "bg-red-100 text-red-800"
                                  : status.color === "yellow"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {status.label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedProductId(item.product_id);
                                setSelectedProductName(item.product_name);
                                setShowAvailabilityDialog(true);
                              }}
                              title="View availability across branches"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Dialog
                              open={isDialogOpen && selectedItem?.id === item.id}
                              onOpenChange={setIsDialogOpen}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenDialog(item)}
                                  title="Adjust stock quantity"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Adjust Stock</DialogTitle>
                              </DialogHeader>

                              <div className="space-y-4">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {item.product_name}
                                  </p>
                                  <p className="text-sm text-slate-600">
                                    Current: {item.quantity} units
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="adjustment">
                                    New Quantity
                                  </Label>
                                  <Input
                                    id="adjustment"
                                    type="number"
                                    min="0"
                                    value={adjustmentQty}
                                    onChange={(e) =>
                                      setAdjustmentQty(
                                        parseInt(e.target.value) || 0,
                                      )
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="reason">
                                    Reason (Optional)
                                  </Label>
                                  <Input
                                    id="reason"
                                    value={adjustmentReason}
                                    onChange={(e) =>
                                      setAdjustmentReason(e.target.value)
                                    }
                                    placeholder="e.g., Stock count, Damaged goods, etc."
                                  />
                                </div>

                                <div className="flex gap-3 pt-4">
                                  <Button
                                    onClick={handleAdjustStock}
                                    className="flex-1 bg-primary hover:bg-primary/90"
                                    disabled={updateMutation.isPending}
                                  >
                                    {updateMutation.isPending ? "Updating..." : "Update Stock"}
                                  </Button>
                                  <Button
                                    onClick={() => setIsDialogOpen(false)}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedInventory.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No inventory items found</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Products will appear here once they are added to your branch
                  </p>
                </div>
              ) : (
                paginatedInventory.map((item) => {
                  const status = getStockStatus(item);
                  const percentage = (item.quantity / item.reorder_level) * 100;

                  return (
                    <div
                      key={item.id}
                      className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-lg p-4 shadow-sm"
                    >
                      {/* Product Name */}
                      <div className="mb-3">
                        <h3 className="font-semibold text-slate-900 text-base mb-1">
                          {item.product_name}
                        </h3>
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                            status.color === "red"
                              ? "bg-red-100 text-red-800"
                              : status.color === "yellow"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {status.label}
                        </span>
                      </div>

                      {/* Stock Info Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="text-xs text-slate-600 font-medium mb-1">Current Stock</div>
                          <div className="text-lg font-bold text-slate-900">{item.quantity}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 font-medium mb-1">Reorder Level</div>
                          <div className="text-lg font-semibold text-slate-700">{item.reorder_level}</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              percentage === 0
                                ? "bg-red-500"
                                : percentage <= 50
                                  ? "bg-red-500"
                                  : percentage <= 100
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.min(percentage, 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t border-slate-200">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedProductId(item.product_id);
                            setSelectedProductName(item.product_name);
                            setShowAvailabilityDialog(true);
                          }}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Dialog
                          open={isDialogOpen && selectedItem?.id === item.id}
                          onOpenChange={setIsDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenDialog(item)}
                              className="flex-1"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Adjust
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Adjust Stock</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {item.product_name}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Current: {item.quantity} units
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="adjustment-mobile">
                                  New Quantity
                                </Label>
                                <Input
                                  id="adjustment-mobile"
                                  type="number"
                                  min="0"
                                  value={adjustmentQty}
                                  onChange={(e) =>
                                    setAdjustmentQty(
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="reason-mobile">
                                  Reason (Optional)
                                </Label>
                                <Input
                                  id="reason-mobile"
                                  value={adjustmentReason}
                                  onChange={(e) =>
                                    setAdjustmentReason(e.target.value)
                                  }
                                  placeholder="e.g., Stock count, Damaged goods, etc."
                                />
                              </div>

                              <div className="flex gap-3 pt-4">
                                <Button
                                  onClick={handleAdjustStock}
                                  className="flex-1 bg-primary hover:bg-primary/90"
                                  disabled={updateMutation.isPending}
                                >
                                  {updateMutation.isPending ? "Updating..." : "Update Stock"}
                                </Button>
                                <Button
                                  onClick={() => setIsDialogOpen(false)}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs md:text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex-1 sm:flex-none"
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
                    className="flex-1 sm:flex-none"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stock Transfer Dialog */}
      <StockTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        currentBranchId={user?.branch_id}
      />

      {/* Product Availability Dialog */}
      <ProductAvailabilityDialog
        open={showAvailabilityDialog}
        onOpenChange={setShowAvailabilityDialog}
        productId={selectedProductId}
        productName={selectedProductName}
      />
    </AdminLayout>
  );
}




