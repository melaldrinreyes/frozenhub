// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Search,
  TrendingUp,
} from "lucide-react";
import { filterBySearch, paginateItems } from "@/lib/dataManager";
import { apiClient } from "@/lib/apiClient";

export default function AdminPricing() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productId: "",
    basePrice: 0,
    wholesalePrice: 0,
    retailPrice: 0,
    distributorPrice: 0,
    markup: 0,
  });

  // Fetch pricing
  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: () => apiClient.getPricing(),
  });

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.getProducts(),
  });

  const pricing = pricingData?.pricing || [];
  const products = productsData?.products || [];

  // Create pricing mutation
  const createPricingMutation = useMutation({
    mutationFn: (data: any) => apiClient.createPricing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setIsDialogOpen(false);
      setEditingId(null);
    },
    onError: (error: any) => {
      alert(error.message || "Failed to create pricing");
    },
  });

  // Update pricing mutation
  const updatePricingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updatePricing(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      setIsDialogOpen(false);
      setEditingId(null);
    },
    onError: (error: any) => {
      alert(error.message || "Failed to update pricing");
    },
  });

  // Delete pricing mutation
  const deletePricingMutation = useMutation({
    mutationFn: (id: string) => apiClient.deletePricing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to delete pricing");
    },
  });

  // Filter pricing
  let filteredPricing = pricing;

  if (searchTerm) {
    filteredPricing = filterBySearch(filteredPricing, searchTerm, [
      "product_name",
    ]);
  }

  const { items: paginatedPricing, totalPages } = paginateItems(
    filteredPricing,
    currentPage,
    10,
  );

  const getProductName = (productId: string) => {
    return products.find((p: any) => p.id === productId)?.name || "Unknown";
  };

  const handleOpenDialog = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        productId: item.product_id,
        basePrice: item.base_price,
        wholesalePrice: item.wholesale_price,
        retailPrice: item.retail_price,
        distributorPrice: item.distributor_price,
        markup: item.markup,
      });
    } else {
      setEditingId(null);
      setFormData({
        productId: "",
        basePrice: 0,
        wholesalePrice: 0,
        retailPrice: 0,
        distributorPrice: 0,
        markup: 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSavePricing = () => {
    if (!formData.productId) {
      alert("Please select a product");
      return;
    }

    if (editingId) {
      updatePricingMutation.mutate({ 
        id: editingId, 
        data: formData 
      });
    } else {
      createPricingMutation.mutate(formData);
    }
  };

  const handleDeletePricing = (id: string) => {
    if (confirm("Are you sure you want to delete this pricing?")) {
      deletePricingMutation.mutate(id);
    }
  };

  const calculateMarkup = (base: number, wholesale: number) => {
    if (base === 0) return 0;
    return parseFloat((((base - wholesale) / wholesale) * 100).toFixed(1));
  };

  if (pricingLoading || productsLoading) {
    return (
      <AdminLayout userRole="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading pricing data...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Pricing Management
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1 sm:mt-2">
              Manage product pricing for different channels
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-primary hover:bg-primary/90 flex items-center gap-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Add Pricing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {editingId ? "Edit Pricing" : "Add New Pricing"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product">Product *</Label>
                  <Select
                    value={formData.productId || ""}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        productId: value,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base">Base Price (₱) *</Label>
                    <Input
                      id="base"
                      type="number"
                      step="0.01"
                      value={formData.basePrice || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setFormData({
                          ...formData,
                          basePrice: value,
                          markup: calculateMarkup(
                            value,
                            formData.wholesalePrice || 0,
                          ),
                        });
                      }}
                      placeholder="12.99"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wholesale">Wholesale Price (₱)</Label>
                    <Input
                      id="wholesale"
                      type="number"
                      step="0.01"
                      value={formData.wholesalePrice || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setFormData({
                          ...formData,
                          wholesalePrice: value,
                          markup: calculateMarkup(
                            formData.basePrice || 0,
                            value,
                          ),
                        });
                      }}
                      placeholder="11.50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="retail">Retail Price (₱)</Label>
                    <Input
                      id="retail"
                      type="number"
                      step="0.01"
                      value={formData.retailPrice || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          retailPrice: parseFloat(e.target.value),
                        })
                      }
                      placeholder="14.99"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="distributor">Distributor Price (₱)</Label>
                    <Input
                      id="distributor"
                      type="number"
                      step="0.01"
                      value={formData.distributorPrice || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          distributorPrice: parseFloat(e.target.value),
                        })
                      }
                      placeholder="10.99"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="markup">Markup (%)</Label>
                    <Input
                      id="markup"
                      type="number"
                      value={formData.markup || ""}
                      disabled
                      className="bg-slate-100"
                    />
                  </div>

                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleSavePricing}
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={createPricingMutation.isPending || updatePricingMutation.isPending}
                  >
                    {createPricingMutation.isPending || updatePricingMutation.isPending
                      ? "Saving..."
                      : editingId 
                      ? "Update Pricing" 
                      : "Add Pricing"}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Products with Pricing
              </CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pricing.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Markup</CardTitle>
              <TrendingUp className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  pricing.reduce((sum, p) => sum + p.markup, 0) /
                    pricing.length || 0
                ).toFixed(1)}
                %
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pricing Channels
              </CardTitle>
              <DollarSign className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-slate-600 mt-1">
                Retail, Wholesale, Distributor, Base
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by product name..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Pricing Details ({filteredPricing.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[120px]">
                      Product
                    </th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[90px]">
                      Base Price
                    </th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[90px]">
                      Wholesale
                    </th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[80px]">
                      Retail
                    </th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[100px]">
                      Distributor
                    </th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[70px]">
                      Markup
                    </th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[100px]">
                      Effective From
                    </th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-slate-900 min-w-[100px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPricing.map((item: any) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-2 sm:px-4 font-semibold text-slate-900">
                        {item.product_name}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-right">
                        ₱{parseFloat(item.base_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-right text-slate-600">
                        ₱{parseFloat(item.wholesale_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-right text-slate-600">
                        ₱{parseFloat(item.retail_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-right text-slate-600">
                        ₱{parseFloat(item.distributor_price).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-right">
                        <span className="text-green-600 font-semibold">
                          {parseFloat(item.markup).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-slate-600 text-xs sm:text-sm">
                        {new Date(item.effective_from).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 sm:px-4">
                        <div className="flex gap-1 sm:gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDialog(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            onClick={() => handleDeletePricing(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
    </AdminLayout>
  );
}





