import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Tag,
  Calendar,
  Percent,
  DollarSign,
  Package,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getTimeRemaining, formatDate, getPromoStatus } from "@/lib/dateUtils";
import { formatPromoDate, getPromoCountdown } from "@/lib/discountUtils";

interface Promo {
  id: string;
  name: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number ;
  min_purchase: number | null;
  max_discount: number | null;
  start_date: string;
  end_date: string;
  active: boolean;
  product_count: number;
  creator_name: string;
}

export default function AdminPromos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingPromo, setDeletingPromo] = useState<string | null>(null);
  const [showProductsDialog, setShowProductsDialog] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<{
    conflicts: any[];
    pendingData: any;
    isUpdate: boolean;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    min_purchase: "",
    max_discount: "",
    start_date: "",
    end_date: "",
    active: true,
    product_ids: [] as string[],
  });

  // Fetch promos
  const { data: promosData, isLoading } = useQuery({
    queryKey: ["promos"],
    queryFn: () => apiClient.getPromos(),
  });

  // Fetch products for selection
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.getProducts(),
  });

  // Fetch promo details with products
  const { data: promoDetailsData } = useQuery({
    queryKey: ["promo", selectedPromoId],
    queryFn: () => apiClient.getPromo(selectedPromoId!),
    enabled: !!selectedPromoId,
  });

  // Create promo mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.createPromo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promos"] });
      toast({
        title: "Success",
        description: "Promo created successfully",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      // Handle conflict errors with option to deactivate
      if (error.status === 409 && error.data?.conflicts) {
        setConflictData({
          conflicts: error.data.conflicts,
          pendingData: formData,
          isUpdate: false,
        });
        setShowConflictDialog(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create promo",
          variant: "destructive",
        });
      }
    },
  });

  // Update promo mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => {
      console.log("🔄 Updating promo:", { id, data });
      return apiClient.updatePromo(id, data);
    },
    onSuccess: (response) => {
      console.log("✅ Promo update success:", response);
      queryClient.invalidateQueries({ queryKey: ["promos"] });
      toast({
        title: "Success",
        description: "Promo updated successfully",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      console.error("❌ Promo update error:", error);
      // Handle conflict errors with option to deactivate
      if (error.status === 409 && error.data?.conflicts) {
        setConflictData({
          conflicts: error.data.conflicts,
          pendingData: { id: editingPromo?.id, ...formData },
          isUpdate: true,
        });
        setShowConflictDialog(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update promo",
          variant: "destructive",
        });
      }
    },
  });

  // Delete promo mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deletePromo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promos"] });
      toast({
        title: "Success",
        description: "Promo deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingPromo(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete promo",
        variant: "destructive",
      });
    },
  });

  // Bulk deactivate mutation for resolving conflicts
  const bulkDeactivateMutation = useMutation({
    mutationFn: (promoIds: string[]) =>
      apiClient.bulkUpdatePromos(promoIds, false),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["promos"] });
      toast({
        title: "Conflicting promos deactivated",
        description: "Proceeding with promo creation/update...",
      });

      // Now retry the original operation
      if (conflictData) {
        if (conflictData.isUpdate && conflictData.pendingData.id) {
          const { id, ...data } = conflictData.pendingData;
          updateMutation.mutate({ id, data });
        } else {
          createMutation.mutate(conflictData.pendingData);
        }
        setShowConflictDialog(false);
        setConflictData(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate conflicting promos",
        variant: "destructive",
      });
    },
  });

  // Handle conflict resolution
  const handleResolveConflict = (deactivateConflicts: boolean) => {
    if (!conflictData) return;

    if (deactivateConflicts) {
      // Deactivate all conflicting promos
      const conflictIds = conflictData.conflicts.map((c: any) => c.id);
      bulkDeactivateMutation.mutate(conflictIds);
    } else {
      // Cancel operation
      setShowConflictDialog(false);
      setConflictData(null);
      toast({
        title: "Operation cancelled",
        description: "Promo was not created/updated due to conflicts",
      });
    }
  };

  const promos = promosData?.promos || [];
  const products = productsData?.products || [];

  const handleOpenDialog = (promo?: Promo) => {
    if (promo) {
      setEditingPromo(promo);
      
      // Helper function to safely convert date to string
      const formatDateForInput = (date: any) => {
        if (!date) return "";
        
        // If it's already a string, extract the date part
        if (typeof date === 'string') {
          return date.split("T")[0];
        }
        
        // If it's a Firestore Timestamp, convert to Date first
        if (date && typeof date.toDate === 'function') {
          return date.toDate().toISOString().split("T")[0];
        }
        
        // If it's a Date object
        if (date instanceof Date) {
          return date.toISOString().split("T")[0];
        }
        
        // Fallback: try to create a Date
        try {
          return new Date(date).toISOString().split("T")[0];
        } catch {
          return "";
        }
      };
      
      setFormData({
        name: promo.name,
        description: promo.description || "",
        discount_type: promo.discount_type,
        discount_value: promo.discount_value.toString(),
        min_purchase: promo.min_purchase.toString(),
        max_discount: promo.max_discount?.toString() || "",
        start_date: formatDateForInput(promo.start_date),
        end_date: formatDateForInput(promo.end_date),
        active: promo.active,
        product_ids: [],
      });
    } else {
      setEditingPromo(null);
      setFormData({
        name: "",
        description: "",
        discount_type: "percentage",
        discount_value: "",
        min_purchase: "",
        max_discount: "",
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        active: true,
        product_ids: [],
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingPromo(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      discount_value: parseFloat(formData.discount_value),
      min_purchase: formData.min_purchase && formData.min_purchase.trim() !== "" ? parseFloat(formData.min_purchase) : null,
      max_discount: formData.max_discount && formData.max_discount.trim() !== "" ? parseFloat(formData.max_discount) : null,
    };

    console.log("📝 Form submission:", { editingPromo, formData, processedData: data });

    if (editingPromo) {
      console.log("🔄 Updating existing promo:", editingPromo.id);
      updateMutation.mutate({ id: editingPromo.id, data });
    } else {
      console.log("➕ Creating new promo");
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    setDeletingPromo(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingPromo) {
      deleteMutation.mutate(deletingPromo);
    }
  };

  const handleViewProducts = (promoId: string) => {
    setSelectedPromoId(promoId);
    setShowProductsDialog(true);
  };

  const handleViewInCatalog = (promoId: string) => {
    // Navigate to catalog page with promo filter
    navigate(`/admin/catalogs?promo=${promoId}`);
  };

  const toggleProductSelection = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      product_ids: prev.product_ids.includes(productId)
        ? prev.product_ids.filter((id) => id !== productId)
        : [...prev.product_ids, productId],
    }));
  };

  const isPromoActive = (promo: Promo) => {
    const now = new Date();
    const start = new Date(promo.start_date);
    const end = new Date(promo.end_date);
    return promo.active && now >= start && now <= end;
  };

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Promo Management</h1>
            <p className="text-sm sm:text-base text-gray-600">Create and manage promotional discounts</p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-gold-500 hover:bg-gold-600 text-black w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Promo
          </Button>
        </div>

        {/* Promos Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Tag className="w-5 h-5 text-gold-500" />
              Active Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading promos...</div>
            ) : promos.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gold-100 to-gold-50 rounded-full flex items-center justify-center mb-4">
                  <Tag className="w-8 h-8 text-gold-400" />
                </div>
                <p className="text-slate-600 font-medium mb-2">No promos created yet</p>
                <p className="text-sm text-slate-500">Create your first promo to get started!</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {promos.map((promo: Promo) => (
                    <div
                      key={promo.id}
                      className="bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 text-base line-clamp-1">
                            {promo.name}
                          </h3>
                          {promo.description && (
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                              {promo.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-2">
                          {isPromoActive(promo) ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                          ) : promo.active ? (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">Scheduled</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {/* Discount */}
                        <div className="bg-gradient-to-br from-gold-50 to-gold-100/50 p-3 rounded-lg border border-gold-200">
                          <div className="flex items-center gap-1.5 text-gold-700 mb-1">
                            {promo.discount_type === "percentage" ? (
                              <Percent className="w-3.5 h-3.5" />
                            ) : (
                              <DollarSign className="w-3.5 h-3.5" />
                            )}
                            <span className="text-xs font-medium">Discount</span>
                          </div>
                          <div className="font-bold text-gold-600 text-base">
                            {promo.discount_type === "percentage" 
                              ? `${promo.discount_value}%` 
                              : `₱${promo.discount_value}`}
                          </div>
                          {promo.min_purchase > 0 && (
                            <div className="text-xs text-slate-600 mt-1">
                              Min: ₱{Number(promo.min_purchase).toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Products */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                            <Package className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Products</span>
                          </div>
                          <button
                            onClick={() => handleViewProducts(promo.id)}
                            className="font-bold text-primary text-base hover:underline"
                          >
                            {promo.product_count}
                          </button>
                        </div>

                        {/* Period & Status */}
                        <div className="col-span-2 bg-white p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Calendar className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">Period</span>
                            </div>
                            {(() => {
                              const status = getPromoStatus(promo.start_date, promo.end_date);
                              return (
                                <Badge className={`text-xs px-2 py-0.5 ${status.color} text-white`}>
                                  {status.text}
                                </Badge>
                              );
                            })()}
                          </div>
                          <div className="text-sm font-semibold text-slate-900 mb-1">
                            {formatDate(promo.start_date)} 
                            <span className="text-slate-500 mx-1">to</span>
                            {formatDate(promo.end_date)}
                          </div>
                          {(() => {
                            const timeRemaining = getTimeRemaining(promo.end_date);
                            const status = getPromoStatus(promo.start_date, promo.end_date);
                            
                            if (status.status === 'active' && !timeRemaining.isExpired) {
                              return (
                                <div className="text-xs text-orange-600 font-medium">
                                  ⏱️ {timeRemaining.formatted} remaining
                                </div>
                              );
                            } else if (status.status === 'upcoming') {
                              return (
                                <div className="text-xs text-blue-600 font-medium">
                                  🕒 Starts in {getTimeRemaining(promo.start_date).formatted}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-3 border-t border-slate-200">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewInCatalog(promo.id)}
                          className="flex-1 text-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(promo)}
                          className="flex-1 text-xs"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(promo.id)}
                          className="h-9 w-9 p-0 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Name</TableHead>
                      <TableHead className="min-w-[100px]">Discount</TableHead>
                      <TableHead className="min-w-[120px]">Period</TableHead>
                      <TableHead className="min-w-[100px]">Products</TableHead>
                      <TableHead className="min-w-[80px]">Status</TableHead>
                      <TableHead className="min-w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {promos.map((promo: Promo) => (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{promo.name}</div>
                          {promo.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {promo.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {promo.discount_type === "percentage" ? (
                            <>
                              <Percent className="w-4 h-4 text-gold-500" />
                              <span className="font-semibold text-gold-600">
                                {promo.discount_value}%
                              </span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4 text-gold-500" />
                              <span className="font-semibold text-gold-600">
                                ₱{promo.discount_value}
                              </span>
                            </>
                          )}
                        </div>
                        {promo.min_purchase > 0 && (
                          <div className="text-xs text-gray-500">
                            Min: ₱{promo.min_purchase}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {formatDate(promo.start_date)}
                          </div>
                          <div className="text-gray-500 text-xs">
                            to {formatDate(promo.end_date)}
                          </div>
                          {(() => {
                            const timeRemaining = getTimeRemaining(promo.end_date);
                            const status = getPromoStatus(promo.start_date, promo.end_date);
                            
                            if (status.status === 'active' && !timeRemaining.isExpired) {
                              return (
                                <div className="text-xs text-orange-600 font-medium mt-1">
                                  {timeRemaining.formatted} left
                                </div>
                              );
                            } else if (status.status === 'upcoming') {
                              return (
                                <div className="text-xs text-blue-600 font-medium mt-1">
                                  Starts in {getTimeRemaining(promo.start_date).formatted}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleViewProducts(promo.id)}
                          className="p-0 h-auto"
                        >
                          <Package className="w-4 h-4 mr-1" />
                          {promo.product_count} products
                        </Button>
                      </TableCell>
                      <TableCell>
                        {isPromoActive(promo) ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : promo.active ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Scheduled</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInCatalog(promo.id)}
                            title="View in Catalog"
                          >
                            <ExternalLink className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(promo)}
                            title="Edit Promo"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(promo.id)}
                            title="Delete Promo"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingPromo ? "Edit Promo" : "Create New Promo"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Set up promotional discounts for your products
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <Label htmlFor="name" className="text-xs sm:text-sm">Promo Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Black Friday Sale"
                    className="text-sm"
                    required
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <Label htmlFor="description" className="text-xs sm:text-sm">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe the promotion..."
                    className="text-sm"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="discount_type" className="text-xs sm:text-sm">Discount Type *</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: "percentage" | "fixed") =>
                      setFormData({ ...formData, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (₱)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discount_value" className="text-xs sm:text-sm">
                    Discount Value * {formData.discount_type === "percentage" ? "(%)" : "(₱)"}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.discount_type === "percentage" ? "100" : undefined}
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_value: e.target.value })
                    }
                    className="text-sm"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="min_purchase" className="text-xs sm:text-sm">Minimum Purchase (₱)</Label>
                  <Input
                    id="min_purchase"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_purchase}
                    onChange={(e) =>
                      setFormData({ ...formData, min_purchase: e.target.value })
                    }
                    className="text-sm"
                  />
                </div>

                {formData.discount_type === "percentage" && (
                  <div>
                    <Label htmlFor="max_discount" className="text-xs sm:text-sm">Max Discount (₱)</Label>
                    <Input
                      id="max_discount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.max_discount}
                      onChange={(e) =>
                        setFormData({ ...formData, max_discount: e.target.value })
                      }
                      placeholder="Optional"
                      className="text-sm"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="start_date" className="text-xs sm:text-sm">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    className="text-sm"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="end_date" className="text-xs sm:text-sm">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    className="text-sm"
                    required
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, active: checked })
                    }
                  />
                  <Label htmlFor="active" className="text-xs sm:text-sm">Active</Label>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <Label className="text-xs sm:text-sm">Select Products</Label>
                  <div className="border rounded-lg p-2 sm:p-3 max-h-40 sm:max-h-48 overflow-y-auto space-y-1.5">
                    {products.map((product: any) => (
                      <div
                        key={product.id}
                        className="flex items-center space-x-2 p-1.5 sm:p-2 hover:bg-gray-50 rounded"
                      >
                        <input
                          type="checkbox"
                          id={`product-${product.id}`}
                          checked={formData.product_ids.includes(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="rounded flex-shrink-0"
                        />
                        <label
                          htmlFor={`product-${product.id}`}
                          className="flex-1 cursor-pointer flex items-center gap-2 min-w-0"
                        >
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-7 h-7 sm:w-8 sm:h-8 object-cover rounded flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs sm:text-sm truncate">{product.name}</div>
                            <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                              ₱{product.price} - {product.sku}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2">
                    {formData.product_ids.length} product(s) selected
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  className="text-xs sm:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gold-500 hover:bg-gold-600 text-black text-xs sm:text-sm"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingPromo ? "Update" : "Create"} Promo
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Promo</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this promo? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Products Dialog */}
        <Dialog open={showProductsDialog} onOpenChange={setShowProductsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Promo Products</DialogTitle>
              <DialogDescription>
                Products included in this promotion
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {promoDetailsData?.promo?.products?.map((product: any) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 p-3 border rounded-lg"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-gray-500">
                      {product.sku} - {product.category}
                    </div>
                    <div className="text-sm font-semibold text-gold-600">
                      ₱{product.price}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Conflict Resolution Dialog */}
        <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Tag className="w-5 h-5" />
                Promo Conflict Detected
              </DialogTitle>
              <DialogDescription>
                The following active promos apply to some of the same products during overlapping dates.
              </DialogDescription>
            </DialogHeader>

            {conflictData && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 mb-3">Conflicting Promos:</h3>
                  <div className="space-y-3">
                    {conflictData.conflicts.map((conflict: any) => (
                      <div key={conflict.id} className="bg-white rounded-md p-3 border border-red-100">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-gray-900">{conflict.name}</div>
                            <div className="text-sm text-gray-600">
                              {new Date(conflict.start_date).toLocaleDateString()} - {new Date(conflict.end_date).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge className="bg-red-100 text-red-700">Active</Badge>
                        </div>
                        {conflict.overlapping_products && conflict.overlapping_products.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Affects {conflict.overlapping_products.length} overlapping product(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-900 mb-2">What would you like to do?</h3>
                  <p className="text-sm text-yellow-800">
                    You can either deactivate the conflicting promos to proceed, or cancel this operation.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => handleResolveConflict(false)}
                disabled={bulkDeactivateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleResolveConflict(true)}
                disabled={bulkDeactivateMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {bulkDeactivateMutation.isPending ? (
                  <>Deactivating...</>
                ) : (
                  <>Deactivate Conflicting Promos & Continue</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
