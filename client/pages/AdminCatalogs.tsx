import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus,
  Edit,
  Trash2,
  Search,
  Eye,
  Check,
  X,
  Tag,
  DollarSign,
  TrendingUp,
  Layers,
} from "lucide-react";
import {
  filterBySearch,
  sortItems,
  paginateItems,
} from "@/lib/dataManager";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

export default function AdminCatalogs() {
    const [barcodeError, setBarcodeError] = useState<string>("");
    const [checkingBarcode, setCheckingBarcode] = useState(false);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "price" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [updateReason, setUpdateReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "", // Added barcode field
    category: "",
    description: "",
    price: 0,
    cost: 0,
    image: "",
    active: true,
  });

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.getProducts(),
  });

  const products = productsData?.products || [];

  // Fetch categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiClient.getCategories(),
  });

  const categories = categoriesData?.categories || [];

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: (data: any) => apiClient.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      setEditingId(null);
    },
    onError: (error: any) => {
      alert(error.message || "Failed to create product");
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      setEditingId(null);
    },
    onError: (error: any) => {
      alert(error.message || "Failed to update product");
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to delete product");
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => apiClient.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsCategoryDialogOpen(false);
      setEditingCategoryId(null);
    },
    onError: (error: any) => {
      alert(error.message || "Failed to create category");
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsCategoryDialogOpen(false);
      setEditingCategoryId(null);
    },
    onError: (error: any) => {
      alert(error.message || "Failed to update category");
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to delete category");
    },
  });

  // Filter and sort products
  let filteredProducts = products;

  if (searchTerm) {
    filteredProducts = filterBySearch(filteredProducts, searchTerm, [
      "name",
      "sku",
    ]);
  }

  if (selectedCategory) {
    filteredProducts = filteredProducts.filter(
      (p) => p.category === selectedCategory,
    );
  }

  const sortKey =
    sortBy === "name" ? "name" : sortBy === "price" ? "price" : "createdAt";
  filteredProducts = sortItems(filteredProducts, sortKey, sortOrder);

  const { items: paginatedProducts, totalPages } = paginateItems(
    filteredProducts,
    currentPage,
    10,
  );

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || "",
        category: product.category,
        description: product.description,
        price: parseFloat(product.price) || 0,
        cost: parseFloat(product.cost) || 0,
        image: product.image,
        active: product.active,
      });
      setImagePreview(product.image || "");
      setSelectedFile(null);
      setUpdateReason("");
      setAdminPassword("");
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        category: "",
        description: "",
        price: 0,
        cost: 0,
        image: "",
        active: true,
      });
      setImagePreview("");
      setSelectedFile(null);
      setUpdateReason("");
      setAdminPassword("");
    }
    setIsDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.category) {
      alert("Please fill all required fields (Name and Category)");
      return;
    }
    if (barcodeError) {
      alert("Please fix the barcode error before saving.");
      return;
    }
    try {
      setIsUploading(true);
      // Generate barcode if not provided
      let barcode = formData.barcode;
      if (!barcode) {
        barcode = `BAR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }
      // Upload image if a new file is selected
      let imagePath = formData.image;
      if (selectedFile) {
        const uploadResult = await apiClient.uploadProductImage(selectedFile);
        imagePath = uploadResult.imagePath;
      }
      const productData = { ...formData, barcode, image: imagePath };
      if (editingId) {
        if (!updateReason.trim()) {
          alert("Please provide a reason for updating this product.");
          return;
        }
        if (!adminPassword.trim()) {
          alert("Admin password is required to update product details.");
          return;
        }
        updateProductMutation.mutate({
          id: editingId,
          data: {
            ...productData,
            updateReason: updateReason.trim(),
            adminPassword: adminPassword.trim(),
          },
        });
      } else {
        const result = await apiClient.createProduct(productData);
        queryClient.invalidateQueries({ queryKey: ["products"] });
        alert(`Product created successfully!\nBarcode: ${barcode}`);
      }
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        category: "",
        description: "",
        price: 0,
        cost: 0,
        image: "",
        active: true,
      });
      setSelectedFile(null);
      setImagePreview("");
      setBarcodeError("");
      setUpdateReason("");
      setAdminPassword("");
    } catch (error: any) {
      alert(error.message || "Failed to save product");
    } finally {
      setIsUploading(false);
    }
  };

  // Barcode uniqueness check
  const checkBarcodeUnique = async (barcode: string) => {
    if (!barcode) {
      setBarcodeError("");
      return;
    }
    setCheckingBarcode(true);
    try {
      // Check if barcode exists in products (excluding current editingId)
      const allProducts = products;
      const found = allProducts.find(
        (p: any) => p.barcode === barcode && p.id !== editingId
      );
      if (found) {
        setBarcodeError("This barcode is already registered to another product.");
      } else {
        setBarcodeError("");
      }
    } finally {
      setCheckingBarcode(false);
    }
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProductMutation.mutate(id);
    }
  };

  const toggleActive = (id: string) => {
    const product = products.find((p: any) => p.id === id);
    if (product) {
      const reason = window.prompt("Reason for changing product status:");
      if (!reason || !reason.trim()) return;

      const password = window.prompt("Enter admin password to confirm:");
      if (!password || !password.trim()) return;

      updateProductMutation.mutate({
        id,
        data: {
          ...product,
          active: !product.active,
          updateReason: reason.trim(),
          adminPassword: password.trim(),
        },
      });
    }
  };

  const handleOpenCategoryDialog = (category?: any) => {
    if (category) {
      setEditingCategoryId(category.id);
      setCategoryFormData({
        name: category.name,
        description: category.description || "",
      });
    } else {
      setEditingCategoryId(null);
      setCategoryFormData({
        name: "",
        description: "",
      });
    }
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryFormData.name) {
      alert("Please enter a category name");
      return;
    }

    if (editingCategoryId) {
      updateCategoryMutation.mutate({ 
        id: editingCategoryId, 
        data: categoryFormData 
      });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm("Are you sure you want to delete this category? Products using this category will need to be reassigned.")) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const toggleCategoryActive = (id: string) => {
    const category = categories.find((c: any) => c.id === id);
    if (category) {
      updateCategoryMutation.mutate({ 
        id, 
        data: { ...category, active: !category.active } 
      });
    }
  };

  if (isLoading || categoriesLoading) {
    return (
      <AdminLayout userRole="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading products...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Product Catalogs
            </h1>
            <p className="text-slate-600 mt-2">
              Manage product listings and information
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-gold-500 hover:bg-gold-600 text-black font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Product" : "Add New Product"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={formData.name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Frozen Chicken Breast"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sku">
                      SKU <span className="text-muted-foreground text-xs">(Optional - Auto-generated if empty)</span>
                    </Label>
                    <Input
                      id="sku"
                      value={formData.sku || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value })
                      }
                      placeholder="Leave empty for auto-generation"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter((cat: any) => cat.active).map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode || ""}
                      onChange={e => {
                        setFormData({ ...formData, barcode: e.target.value });
                        checkBarcodeUnique(e.target.value);
                      }}
                      onBlur={e => checkBarcodeUnique(e.target.value)}
                      placeholder="Scan or enter barcode"
                      className={barcodeError ? "border-red-500" : ""}
                      autoComplete="off"
                    />
                    {checkingBarcode && (
                      <span className="text-xs text-slate-500">Checking barcode...</span>
                    )}
                    {barcodeError && (
                      <span className="text-xs text-red-600">{barcodeError}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image">Product Image</Label>
                    <div className="space-y-2">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="cursor-pointer"
                      />
                      {imagePreview && (
                        <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <p className="text-xs text-slate-500">
                        Max size: 5MB. Formats: JPEG, PNG, GIF, WebP
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Product description"
                    className="w-full border border-slate-300 rounded-lg p-2"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Retail Price (₱) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price: parseFloat(e.target.value),
                        })
                      }
                      placeholder="12.99"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost Price (₱) *</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cost: parseFloat(e.target.value),
                        })
                      }
                      placeholder="6.50"
                    />
                  </div>
                </div>

                {editingId && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="update-reason">Reason for Update *</Label>
                      <Textarea
                        id="update-reason"
                        value={updateReason}
                        onChange={(e) => setUpdateReason(e.target.value)}
                        placeholder="Explain why this product is being updated"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Admin Password *</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter admin password"
                        autoComplete="current-password"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSaveProduct}
                    className="flex-1 bg-gold-500 hover:bg-gold-600 text-black font-semibold"
                    disabled={isUploading}
                  >
                    {isUploading ? "Uploading..." : editingId ? "Update Product" : "Add Product"}
                  </Button>
                  <Button
                    onClick={() => setIsDialogOpen(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Categories Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Product Categories</CardTitle>
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => handleOpenCategoryDialog()}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategoryId ? "Edit Category" : "Add New Category"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cat-name">Category Name *</Label>
                    <Input
                      id="cat-name"
                      value={categoryFormData.name}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, name: e.target.value })
                      }
                      placeholder="e.g., Dairy, Bakery"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cat-description">Description</Label>
                    <Input
                      id="cat-description"
                      value={categoryFormData.description}
                      onChange={(e) =>
                        setCategoryFormData({ ...categoryFormData, description: e.target.value })
                      }
                      placeholder="Brief description of the category"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCategoryDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveCategory}>
                      {editingCategoryId ? "Update" : "Create"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {categories.map((category: any) => (
                <div
                  key={category.id}
                  className={cn(
                    "p-3 border rounded-lg flex items-center justify-between",
                    category.active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">
                      {category.name}
                    </div>
                    {category.description && (
                      <div className="text-xs text-slate-500 truncate">
                        {category.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleOpenCategoryDialog(category)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => toggleCategoryActive(category.id)}
                    >
                      {category.active ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <X className="w-3 h-3 text-slate-400" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-4 flex-col sm:flex-row">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>

              <Select
                value={selectedCategory || "all"}
                onValueChange={(value) => {
                  setSelectedCategory(value === "all" ? "" : value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.filter((cat: any) => cat.active).map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(value) => {
                  const [by, order] = value.split("-") as [
                    "name" | "price" | "date",
                    "asc" | "desc",
                  ];
                  setSortBy(by);
                  setSortOrder(order);
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="price-asc">Price (Low to High)</SelectItem>
                  <SelectItem value="price-desc">
                    Price (High to Low)
                  </SelectItem>
                  <SelectItem value="date-desc">Newest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Products ({filteredProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedProducts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No products found</h3>
                <p className="text-sm text-slate-600 mb-6">
                  {searchTerm || selectedCategory 
                    ? "Try adjusting your filters to find what you're looking for."
                    : "Get started by adding your first product to the catalog."}
                </p>
                {!searchTerm && !selectedCategory && (
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="bg-gold-500 hover:bg-gold-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Product
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {paginatedProducts.map((product) => {
                    const price = parseFloat(product.price) || 0;
                    const cost = parseFloat(product.cost) || 0;
                    const margin = (((price - cost) / price) * 100).toFixed(1);
                    
                    return (
                      <div
                        key={product.id}
                        className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        {/* Header with Product Image and Info */}
                        <div className="flex items-start gap-3 mb-3 pb-3 border-b border-slate-100">
                          <div className="flex-shrink-0">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                                <Package className="w-8 h-8 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-base mb-1 line-clamp-2">
                              {product.name}
                            </h3>
                            {product.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                                {product.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                SKU: {product.sku}
                              </span>
                              <button
                                onClick={() => toggleActive(product.id)}
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                                  product.active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {product.active ? "Active" : "Inactive"}
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDialog(product)}
                              className="h-9 w-9 p-0 hover:bg-gold-50 hover:text-gold-600"
                              title="Edit product"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteProduct(product.id)}
                              title="Delete product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Product Details Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white rounded-lg p-3 border border-slate-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Layers className="w-3.5 h-3.5 text-slate-600" />
                              <p className="text-xs font-medium text-slate-500">Category</p>
                            </div>
                            <p className="text-sm text-slate-900 font-semibold truncate">
                              {product.category}
                            </p>
                          </div>
                          
                          <div className="bg-white rounded-lg p-3 border border-slate-100">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="w-3.5 h-3.5 text-green-600" />
                              <p className="text-xs font-medium text-slate-500">Price</p>
                            </div>
                            <p className="text-sm text-slate-900 font-bold">
                              ₱{price.toFixed(2)}
                            </p>
                          </div>

                          <div className="bg-white rounded-lg p-3 border border-slate-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Tag className="w-3.5 h-3.5 text-slate-600" />
                              <p className="text-xs font-medium text-slate-500">Cost</p>
                            </div>
                            <p className="text-sm text-slate-900 font-semibold">
                              ₱{cost.toFixed(2)}
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                              <p className="text-xs font-medium text-green-700">Margin</p>
                            </div>
                            <p className="text-sm text-green-900 font-bold">
                              {margin}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Product
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          SKU
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Category
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Price
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Cost
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Margin
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((product) => {
                        const price = parseFloat(product.price) || 0;
                        const cost = parseFloat(product.cost) || 0;
                        const margin = (
                          ((price - cost) / price) *
                          100
                        ).toFixed(1);
                        return (
                          <tr
                            key={product.id}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-12 h-12 object-cover rounded-lg border"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                    <Package className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {product.description?.substring(0, 30)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {product.sku}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {product.category}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              ₱{price.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              ₱{cost.toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-green-600 font-semibold">
                                {margin}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => toggleActive(product.id)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                  product.active
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                                }`}
                              >
                                {product.active ? "Active" : "Inactive"}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenDialog(product)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                  onClick={() => handleDeleteProduct(product.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && paginatedProducts.length > 0 && (
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




