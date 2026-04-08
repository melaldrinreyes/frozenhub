import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, Eye, Star } from "lucide-react";
import { paginateItems } from "@/lib/dataManager";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { ProductDetailsDialog } from "@/components/ProductDetailsDialog";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  image: string;
  active: boolean;
  created_at: string;
}

export default function BranchProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch products from API
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await apiClient.getProducts();
      return response.products.filter((p: Product) => p.active);
    },
  });

  // Ensure products is always an array
  const products = Array.isArray(data) ? data : [];

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    return filtered;
  }, [products, searchTerm, selectedCategory]);

  const { items: paginatedProducts, totalPages } = paginateItems(
    filteredProducts || [],
    currentPage,
    12,
  );

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const toggleFavorite = (id: string) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((f) => f !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailsDialog(true);
  };

  return (
    <AdminLayout userRole="branch">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Available Products
          </h1>
          <p className="text-slate-600 mt-2">
            Browse all available products for your branch
          </p>
        </div>

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

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setSelectedCategory("");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedCategory === ""
                      ? "bg-primary text-white"
                      : "bg-slate-200 text-slate-900 hover:bg-slate-300"
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      setCurrentPage(1);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedCategory === category
                        ? "bg-primary text-white"
                        : "bg-slate-200 text-slate-900 hover:bg-slate-300"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              Loading products...
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No products found
            </div>
          ) : (
            paginatedProducts.map((product) => (
              <Card
                key={product.id}
                className="hover:shadow-lg transition-all overflow-hidden flex flex-col"
              >
                <div className="aspect-square bg-slate-100 flex items-center justify-center relative overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-16 h-16 text-slate-400" />
                  )}
                  <button
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        favorites.includes(product.id)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-400"
                      }`}
                    />
                  </button>
                </div>

                <CardContent className="pt-4 flex-1 flex flex-col">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm line-clamp-2">
                      {product.name}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{product.sku}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {product.category}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-lg font-bold text-gold-500">
                      ₱{parseFloat(product.price.toString()).toFixed(2)}
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-3 bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
                      onClick={() => handleViewDetails(product)}
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
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
      </div>

      {/* Product Details Dialog */}
      <ProductDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        product={selectedProduct}
      />
    </AdminLayout>
  );
}




