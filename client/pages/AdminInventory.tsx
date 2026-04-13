import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  AlertTriangle,
  Search,
  Edit,
  Plus,
  TrendingDown,
  Trash2,
  ArrowRightLeft,
  Eye,
  X,
} from "lucide-react";
import { filterBySearch, paginateItems } from "@/lib/dataManager";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/authContext";
import { StockTransferDialog } from "@/components/StockTransferDialog";
import { ProductAvailabilityDialog } from "@/components/ProductAvailabilityDialog";

export default function AdminInventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Helper function to format dates safely
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'Never';
    
    try {
      // Handle Firestore timestamp
      if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
        const date = new Date(dateValue.seconds * 1000);
        return isNaN(date.getTime()) ? 'Never' : date.toLocaleDateString();
      }
      
      // Handle regular date string/object
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? 'Never' : date.toLocaleDateString();
    } catch {
      return 'Never';
    }
  };
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productId: "",
    branchId: "",
    quantity: 0,
    reorderLevel: 50,
  });
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [updateReason, setUpdateReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const requiresAdminPassword = user?.role === "admin";

  // Fetch inventory
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiClient.getInventory(),
  });

  const inventory = inventoryData?.inventory || [];

  // Fetch products for create dialog
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.getProducts(),
  });

  const products = productsData?.products || [];

  // Fetch branches for create dialog
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.getBranches(),
  });

  const branches = branchesData?.branches || [];

  // Create inventory mutation
  const createInventoryMutation = useMutation({
    mutationFn: (data: any) => apiClient.addInventory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Success",
        description: "Inventory entry created successfully",
      });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({ productId: "", branchId: "", quantity: 0, reorderLevel: 50 });
      setUpdateReason("");
      setAdminPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create inventory entry",
        variant: "destructive",
      });
    },
  });

  // Update inventory mutation
  const updateInventoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateInventory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Success",
        description: "Inventory updated successfully",
      });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({ productId: "", branchId: "", quantity: 0, reorderLevel: 50 });
      setUpdateReason("");
      setAdminPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update inventory",
        variant: "destructive",
      });
    },
  });

  // Delete inventory mutation
  const deleteInventoryMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteInventory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Success",
        description: "Inventory entry deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete inventory entry",
        variant: "destructive",
      });
    },
  });

  // Cleanup duplicates mutation
  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/inventory/cleanup-duplicates', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to cleanup duplicates');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({
        title: "Cleanup Complete",
        description: `Removed ${data.stats.entriesDeleted} duplicate entries`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cleanup duplicates",
        variant: "destructive",
      });
    },
  });

  // Filter inventory
  let filteredInventory = inventory;

  if (searchTerm) {
    filteredInventory = filterBySearch(filteredInventory, searchTerm, [
      "product_name",
      "branch_name",
    ]);
  }

  if (selectedBranch) {
    filteredInventory = filteredInventory.filter(
      (i: any) => i.branch_id === selectedBranch,
    );
  }

  if (filterLowStock) {
    filteredInventory = filteredInventory.filter(
      (i: any) => i.quantity <= i.reorder_level,
    );
  }

  const { items: paginatedInventory, totalPages } = paginateItems(
    filteredInventory,
    currentPage,
    10,
  );

  const lowStockCount = inventory.filter(
    (i: any) => i.quantity <= i.reorder_level,
  ).length;

  const totalStock = inventory.reduce((sum: number, i: any) => sum + i.quantity, 0);

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        productId: item.product_id,
        branchId: item.branch_id,
        quantity: item.quantity,
        reorderLevel: item.reorder_level,
      });
      setUpdateReason("");
      setAdminPassword("");
    } else {
      setEditingId(null);
      setFormData({ productId: "", branchId: "", quantity: 0, reorderLevel: 50 });
      setUpdateReason("");
      setAdminPassword("");
    }
    setIsDialogOpen(true);
  };

  const handleSaveInventory = () => {
    if (editingId) {
      if (!updateReason.trim()) {
        toast({
          title: "Reason required",
          description: "Please provide a reason for updating inventory.",
          variant: "destructive",
        });
        return;
      }

      if (requiresAdminPassword && !adminPassword.trim()) {
        toast({
          title: "Admin password required",
          description: "Enter your admin password to update inventory.",
          variant: "destructive",
        });
        return;
      }

      updateInventoryMutation.mutate({
        id: editingId,
        data: {
          quantity: formData.quantity,
          reorder_level: formData.reorderLevel,
          updateReason: updateReason.trim(),
          adminPassword: adminPassword.trim() || undefined,
        },
      });
    } else {
      createInventoryMutation.mutate({
        product_id: formData.productId,
        branch_id: formData.branchId,
        quantity: formData.quantity,
        reorder_level: formData.reorderLevel,
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this inventory entry?")) {
      deleteInventoryMutation.mutate(id);
    }
  };

  const getStockStatus = (item: any) => {
    const percentage = (item.quantity / item.reorder_level) * 100;
    if (percentage === 0) return { label: "Out of Stock", color: "red" };
    if (percentage <= 50) return { label: "Critical", color: "red" };
    if (percentage <= 100) return { label: "Low", color: "yellow" };
    return { label: "Adequate", color: "green" };
  };

  const getProgressWidthClass = (percentage: number) => {
    if (!Number.isFinite(percentage) || percentage <= 0) return "w-0";
    if (percentage <= 25) return "w-1/4";
    if (percentage <= 50) return "w-1/2";
    if (percentage <= 75) return "w-3/4";
    return "w-full";
  };

  if (isLoading) {
    return (
      <AdminLayout userRole="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading inventory...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="max-w-[12ch] text-2xl font-bold leading-tight text-slate-900 sm:max-w-none sm:text-3xl">
              Inventory Management
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
              Monitor stock levels across all branches
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row">
            <Button 
              onClick={() => {
                if (confirm("This will remove duplicate inventory entries. Continue?")) {
                  cleanupDuplicatesMutation.mutate();
                }
              }}
              variant="outline"
              className="w-full gap-2 sm:w-auto"
              disabled={cleanupDuplicatesMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {cleanupDuplicatesMutation.isPending ? "Cleaning..." : "Remove Duplicates"}
            </Button>
            <Button onClick={() => handleOpenDialog()} className="w-full gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Inventory
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
              <Package className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStock}</div>
              <p className="text-xs text-slate-600 mt-1">
                Units across all branches
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Low Stock Items
              </CardTitle>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {lowStockCount}
              </div>
              <p className="text-xs text-slate-600 mt-1">Need reordering</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tracked Items
              </CardTitle>
              <TrendingDown className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventory.length}</div>
              <p className="text-xs text-slate-600 mt-1">
                Product-branch combinations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {lowStockCount > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">
                {lowStockCount} Item(s) Below Reorder Level
              </h3>
              <p className="text-sm text-amber-800">
                Please review and place orders to maintain optimal inventory
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by product or branch..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>

              <Select
                value={selectedBranch || "all"}
                onValueChange={(value) => {
                  setSelectedBranch(value === "all" ? "" : value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
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

              <Button
                onClick={() => {
                  setFilterLowStock(!filterLowStock);
                  setCurrentPage(1);
                }}
                variant={filterLowStock ? "default" : "outline"}
                className="w-full sm:w-auto"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Low Stock Only
              </Button>

              <Button
                onClick={() => setShowTransferDialog(true)}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer Stock
              </Button>
            </div>

            {/* Active Filters Display */}
            {(searchTerm || selectedBranch || filterLowStock) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">Active filters:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {searchTerm}
                    <button
                      onClick={() => setSearchTerm("")}
                      className="ml-1 hover:text-red-600"
                      aria-label="Clear search filter"
                      title="Clear search filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedBranch && (
                  <Badge variant="secondary" className="gap-1">
                    Branch: {branches.find((b: any) => b.id === selectedBranch)?.name}
                    <button
                      onClick={() => setSelectedBranch("")}
                      className="ml-1 hover:text-red-600"
                      aria-label="Clear branch filter"
                      title="Clear branch filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {filterLowStock && (
                  <Badge variant="secondary" className="gap-1">
                    Low Stock Only
                    <button
                      onClick={() => setFilterLowStock(false)}
                      className="ml-1 hover:text-red-600"
                      aria-label="Clear low stock filter"
                      title="Clear low stock filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedBranch("");
                    setFilterLowStock(false);
                    setCurrentPage(1);
                  }}
                  className="text-xs h-7"
                >
                  Clear All
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Inventory Levels ({filteredInventory.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="md:hidden space-y-3">
              {paginatedInventory.map((item) => {
                const status = getStockStatus(item);
                const percentage = (item.quantity / item.reorder_level) * 100;

                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.product_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {item.branch_name}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${
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

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Current Stock</p>
                        <p className="mt-1 font-semibold text-slate-900">{item.quantity}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Reorder Level</p>
                        <p className="mt-1 font-semibold text-slate-900">{item.reorder_level}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`${getProgressWidthClass(percentage)} h-2 rounded-full ${
                            percentage === 0
                              ? "bg-red-500"
                              : percentage <= 50
                                ? "bg-red-500"
                                : percentage <= 100
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Last check: {formatDate(item.last_stock_check)}
                      </p>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedProductId(item.product_id);
                          setSelectedProductName(item.product_name);
                          setShowAvailabilityDialog(true);
                        }}
                        className="flex-1 gap-2"
                        title="View availability across branches"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>

                      <Dialog
                        open={isDialogOpen && editingId === item.id}
                        onOpenChange={setIsDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(item)}
                            className="flex-1 gap-2"
                            title="Edit inventory"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-4">
                          <DialogHeader>
                            <DialogTitle className="text-lg sm:text-xl">Update Inventory</DialogTitle>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div>
                              <p className="font-semibold text-slate-900 text-sm sm:text-base">
                                {item.product_name}
                              </p>
                              <p className="text-xs sm:text-sm text-slate-600">
                                {item.branch_name}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="quantity" className="text-sm">
                                Current Quantity
                              </Label>
                              <Input
                                id="quantity"
                                type="number"
                                value={formData.quantity || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    quantity: parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="reorder" className="text-sm">Reorder Level</Label>
                              <Input
                                id="reorder"
                                type="number"
                                value={formData.reorderLevel || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    reorderLevel:
                                      parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="inventory-reason-mobile" className="text-sm">Reason for Update *</Label>
                              <Textarea
                                id="inventory-reason-mobile"
                                value={updateReason}
                                onChange={(e) => setUpdateReason(e.target.value)}
                                placeholder="Explain why this inventory is being updated"
                              />
                            </div>

                            {requiresAdminPassword && (
                              <div className="space-y-2">
                                <Label htmlFor="inventory-admin-password-mobile" className="text-sm">Admin Password *</Label>
                                <Input
                                  id="inventory-admin-password-mobile"
                                  type="password"
                                  value={adminPassword}
                                  onChange={(e) => setAdminPassword(e.target.value)}
                                  placeholder="Enter admin password"
                                />
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                              <Button
                                onClick={handleSaveInventory}
                                className="flex-1 bg-primary hover:bg-primary/90"
                              >
                                Update Stock
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

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteInventoryMutation.isPending}
                        className="flex-1 gap-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[150px]">
                      Product
                    </th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[120px]">
                      Branch
                    </th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[100px]">
                      Current Stock
                    </th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[100px]">
                      Reorder Level
                    </th>
                    <th className="text-center py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[150px]">
                      Status
                    </th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[100px]">
                      Last Check
                    </th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[120px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInventory.map((item) => {
                    const status = getStockStatus(item);
                const percentage =
                  (item.quantity / item.reorder_level) * 100;                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="py-3 px-2 sm:px-4">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                            {item.product_name}
                          </p>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-slate-600 text-xs sm:text-sm">
                          {item.branch_name}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right font-semibold text-xs sm:text-sm">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right text-slate-600 text-xs sm:text-sm">
                          {item.reorder_level}
                        </td>
                        <td className="py-3 px-2 sm:px-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 sm:w-20 bg-slate-200 rounded-full h-2">
                              <div
                                className={`${getProgressWidthClass(percentage)} h-2 rounded-full ${
                                  percentage === 0
                                    ? "bg-red-500"
                                    : percentage <= 50
                                      ? "bg-red-500"
                                      : percentage <= 100
                                        ? "bg-yellow-500"
                                        : "bg-green-500"
                                }`}
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
                        <td className="py-3 px-2 sm:px-4 text-slate-600 text-xs">
                          {formatDate(item.last_stock_check)}
                        </td>
                        <td className="py-3 px-2 sm:px-4">
                          <div className="flex gap-1 sm:gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedProductId(item.product_id);
                                setSelectedProductName(item.product_name);
                                setShowAvailabilityDialog(true);
                              }}
                              title="View availability across branches"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Dialog
                              open={isDialogOpen && editingId === item.id}
                              onOpenChange={setIsDialogOpen}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenDialog(item)}
                                  title="Edit inventory"
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-4">
                              <DialogHeader>
                                <DialogTitle className="text-lg sm:text-xl">Update Inventory</DialogTitle>
                              </DialogHeader>

                              <div className="space-y-4">
                                <div>
                                  <p className="font-semibold text-slate-900 text-sm sm:text-base">
                                    {item.product_name}
                                  </p>
                                  <p className="text-xs sm:text-sm text-slate-600">
                                    {item.branch_name}
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="quantity" className="text-sm">
                                    Current Quantity
                                  </Label>
                                  <Input
                                    id="quantity"
                                    type="number"
                                    value={formData.quantity || ""}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        quantity: parseInt(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="reorder" className="text-sm">Reorder Level</Label>
                                  <Input
                                    id="reorder"
                                    type="number"
                                    value={formData.reorderLevel || ""}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        reorderLevel:
                                          parseInt(e.target.value) || 0,
                                      })
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="inventory-reason-desktop" className="text-sm">Reason for Update *</Label>
                                  <Textarea
                                    id="inventory-reason-desktop"
                                    value={updateReason}
                                    onChange={(e) => setUpdateReason(e.target.value)}
                                    placeholder="Explain why this inventory is being updated"
                                  />
                                </div>

                                {requiresAdminPassword && (
                                  <div className="space-y-2">
                                    <Label htmlFor="inventory-admin-password-desktop" className="text-sm">Admin Password *</Label>
                                    <Input
                                      id="inventory-admin-password-desktop"
                                      type="password"
                                      value={adminPassword}
                                      onChange={(e) => setAdminPassword(e.target.value)}
                                      placeholder="Enter admin password"
                                    />
                                  </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                  <Button
                                    onClick={handleSaveInventory}
                                    className="flex-1 bg-primary hover:bg-primary/90"
                                  >
                                    Update Stock
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteInventoryMutation.isPending}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs sm:text-sm text-slate-600">
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

      {/* Create Inventory Dialog */}
      <Dialog
        open={isDialogOpen && !editingId}
        onOpenChange={setIsDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Inventory Entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <select
                id="product"
                title="Product"
                aria-label="Product"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                value={formData.productId}
                onChange={(e) =>
                  setFormData({ ...formData, productId: e.target.value })
                }
              >
                <option value="">Select a product</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <select
                id="branch"
                title="Branch"
                aria-label="Branch"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                value={formData.branchId}
                onChange={(e) =>
                  setFormData({ ...formData, branchId: e.target.value })
                }
              >
                <option value="">Select a branch</option>
                {branches.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-quantity">Initial Quantity</Label>
              <Input
                id="new-quantity"
                type="number"
                value={formData.quantity || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quantity: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-reorder">Reorder Level</Label>
              <Input
                id="new-reorder"
                type="number"
                value={formData.reorderLevel || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reorderLevel: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveInventory}
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={
                  !formData.productId ||
                  !formData.branchId ||
                  createInventoryMutation.isPending
                }
              >
                {createInventoryMutation.isPending
                  ? "Adding..."
                  : "Add Inventory"}
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

      {/* Stock Transfer Dialog */}
      <StockTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
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




