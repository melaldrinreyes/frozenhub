import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AlertCircle, Building2, CheckCircle, Package, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProductAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName?: string;
}

export function ProductAvailabilityDialog({
  open,
  onOpenChange,
  productId,
  productName,
}: ProductAvailabilityDialogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["product-availability", productId],
    queryFn: () => apiClient.getProductAvailability(productId),
    enabled: open && !!productId,
  });

  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity === 0) {
      return { label: "Out of Stock", variant: "destructive" as const, icon: XCircle };
    }
    if (quantity <= reorderLevel) {
      return { label: "Low Stock", variant: "secondary" as const, icon: AlertCircle };
    }
    return { label: "In Stock", variant: "default" as const, icon: CheckCircle };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Availability
          </DialogTitle>
          <DialogDescription>
            View inventory levels across all branch locations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error instanceof Error ? error.message : "Failed to load product availability"}
              </AlertDescription>
            </Alert>
          ) : data ? (
            <>
              {/* Summary Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="text-sm font-medium truncate">
                    {data.product_name || productName}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Quantity</p>
                  <p className="text-2xl font-bold">{data.total_quantity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">In Stock</p>
                  <p className="text-2xl font-bold text-green-600">
                    {data.branches_in_stock}/{data.total_branches}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {data.branches_low_stock}
                  </p>
                </div>
              </div>

              {/* Branch-wise Inventory Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Branch</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-center">Reorder Level</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.inventory && data.inventory.length > 0 ? (
                      data.inventory.map((item: any) => {
                        const status = getStockStatus(item.quantity, item.reorder_level);
                        const StatusIcon = status.icon;

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{item.branch_name}</p>
                                  {item.branch_location && (
                                    <p className="text-xs text-muted-foreground">
                                      {item.branch_location}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {item.reorder_level}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={status.variant}
                                className="flex items-center gap-1 w-fit mx-auto"
                              >
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.last_stock_check
                                ? new Date(item.last_stock_check).toLocaleDateString()
                                : "N/A"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No inventory data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
