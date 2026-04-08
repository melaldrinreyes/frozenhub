import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Tag, DollarSign, BarChart3, Calendar } from "lucide-react";

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

interface ProductDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function ProductDetailsDialog({
  open,
  onOpenChange,
  product,
}: ProductDetailsDialogProps) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Product Details</DialogTitle>
          <DialogDescription>
            Complete information about this product
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Image */}
          <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <Package className="w-24 h-24 text-slate-400" />
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            {/* Name and Status */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900">
                  {product.name}
                </h3>
                <p className="text-sm text-slate-600 mt-1">SKU: {product.sku}</p>
              </div>
              <Badge variant={product.active ? "default" : "secondary"}>
                {product.active ? "Active" : "Inactive"}
              </Badge>
            </div>

            <Separator />

            {/* Category */}
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">Category</p>
                <p className="text-sm text-slate-600">{product.category}</p>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-2">
                    Description
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {product.description}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Selling Price
                  </p>
                  <p className="text-lg font-bold text-green-600">
                    ₱{parseFloat(product.price.toString()).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Cost</p>
                  <p className="text-lg font-bold text-slate-700">
                    ₱{parseFloat(product.cost.toString()).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-900">
                  Profit Margin
                </p>
                <p className="text-lg font-bold text-amber-600">
                  ₱
                  {(
                    parseFloat(product.price.toString()) -
                    parseFloat(product.cost.toString())
                  ).toFixed(2)}
                  <span className="text-sm font-normal ml-1">
                    (
                    {(
                      ((parseFloat(product.price.toString()) -
                        parseFloat(product.cost.toString())) /
                        parseFloat(product.price.toString())) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </p>
              </div>
            </div>

            <Separator />

            {/* Created Date */}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Date Added
                </p>
                <p className="text-sm text-slate-600">
                  {new Date(product.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
