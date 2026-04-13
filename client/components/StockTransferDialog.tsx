import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, Lock, TrendingUp, TrendingDown, Clock } from "lucide-react";

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBranchId?: string;
  preselectedProductId?: string;
  preselectedProductName?: string;
}

export function StockTransferDialog({
  open,
  onOpenChange,
  currentBranchId,
  preselectedProductId,
  preselectedProductName,
}: StockTransferDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [fromBranch, setFromBranch] = useState(currentBranchId || "");
  const [toBranch, setToBranch] = useState("");
  const [productId, setProductId] = useState(preselectedProductId || "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<any>(null);

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.getBranches(),
  });

  // Fetch products for the selected from branch
  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ["inventory", fromBranch],
    queryFn: () => apiClient.getInventory(fromBranch),
    enabled: !!fromBranch,
  });

  // Get available quantity for selected product
  const selectedInventoryItem = inventoryData?.inventory?.find(
    (item: any) => item.product_id === productId
  );
  const availableQuantity = selectedInventoryItem?.quantity || 0;

  const transferMutation = useMutation({
    mutationFn: (data: {
      from_branch_id: string;
      to_branch_id: string;
      product_id: string;
      quantity: number;
      reason?: string;
      password?: string;
    }) => apiClient.transferStock(data),
    onSuccess: (data) => {
      const transfer = data.transfer;
      const transferQuantity = transfer?.quantity ?? pendingTransfer?.quantity ?? 0;
      const transferProductName = transfer?.product_name ?? pendingTransfer?.productName ?? "Selected product";
      const fromBranchName = transfer?.from_branch ?? pendingTransfer?.fromBranchName ?? "Source branch";
      const toBranchName = transfer?.to_branch ?? pendingTransfer?.toBranchName ?? "Destination branch";
      const fromRemainingStock = transfer?.remaining_stock ?? pendingTransfer?.remainingStock ?? 0;
      const toNewStock = transfer?.new_stock ?? transferQuantity;
      toast({
        title: "✅ Stock Transferred Successfully",
        description: (
          <div className="mt-2 space-y-1 text-sm">
            <p><strong>{transferQuantity}</strong> units of <strong>{transferProductName}</strong></p>
            <p className="text-xs text-muted-foreground">
              From: {fromBranchName} (Now: {fromRemainingStock} units)<br/>
              To: {toBranchName} (Now: {toNewStock} units)
            </p>
            {Boolean(transfer?.was_large_transfer ?? pendingTransfer?.isLargeTransfer) && (
              <p className="text-xs text-amber-600">🔒 Large transfer verified</p>
            )}
          </div>
        ),
      });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["transfer-logs"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      // Check if password verification is required
      if (error?.data?.requiresPassword || String(error?.message || "").toLowerCase().includes("password")) {
        setShowPasswordDialog(true);
        return;
      }
      
      toast({
        title: "Transfer Failed",
        description: error?.data?.error || error?.message || "Transfer failed",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFromBranch(currentBranchId || "");
    setToBranch("");
    setProductId(preselectedProductId || "");
    setQuantity("");
    setReason("");
    setPassword("");
    setShowPasswordDialog(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (qty > availableQuantity) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${availableQuantity} units available`,
        variant: "destructive",
      });
      return;
    }

    if (!fromBranch || !toBranch || !productId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (fromBranch === toBranch) {
      toast({
        title: "Invalid Transfer",
        description: "Cannot transfer to the same branch",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog instead of immediately transferring
    const fromBranchName = branches.find((b: any) => b.id === fromBranch)?.name;
    const toBranchName = branches.find((b: any) => b.id === toBranch)?.name;
    const productName = availableProducts.find((p: any) => p.product_id === productId)?.product_name;
    const fromBranchLocation = branches.find((b: any) => b.id === fromBranch)?.location;
    const toBranchLocation = branches.find((b: any) => b.id === toBranch)?.location;
    const isLargeTransfer = qty > 100;

    setPendingTransfer({
      from_branch_id: fromBranch,
      to_branch_id: toBranch,
      product_id: productId,
      quantity: qty,
      reason: reason || undefined,
      fromBranchName,
      toBranchName,
      fromBranchLocation,
      toBranchLocation,
      productName,
      currentStock: availableQuantity,
      remainingStock: availableQuantity - qty,
      isLargeTransfer,
    });
    setShowConfirmation(true);
  };

  const handleConfirmTransfer = () => {
    if (pendingTransfer) {
      // Check if large transfer needs password
      if (pendingTransfer.isLargeTransfer && !password) {
        setShowConfirmation(false);
        setShowPasswordDialog(true);
        return;
      }

      transferMutation.mutate({
        from_branch_id: pendingTransfer.from_branch_id,
        to_branch_id: pendingTransfer.to_branch_id,
        product_id: pendingTransfer.product_id,
        quantity: pendingTransfer.quantity,
        reason: pendingTransfer.reason,
        password: password || undefined,
      });
      setShowConfirmation(false);
      setPendingTransfer(null);
    }
  };

  const handlePasswordSubmit = () => {
    if (!password) {
      toast({
        title: "Password Required",
        description: "Please enter your password to verify this large transfer",
        variant: "destructive",
      });
      return;
    }

    if (pendingTransfer) {
      transferMutation.mutate({
        from_branch_id: pendingTransfer.from_branch_id,
        to_branch_id: pendingTransfer.to_branch_id,
        product_id: pendingTransfer.product_id,
        quantity: pendingTransfer.quantity,
        reason: pendingTransfer.reason,
        password,
      });
      setShowPasswordDialog(false);
      setPassword("");
    }
  };

  const branches = branchesData?.branches || [];
  const availableProducts = inventoryData?.inventory || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[500px] max-h-[90vh] overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Transfer Stock Between Branches</DialogTitle>
            <DialogDescription>
              Move inventory from one branch to another. This action will update both branches immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* From Branch */}
              <div className="grid gap-2">
                <Label htmlFor="from-branch">From Branch *</Label>
                <Select value={fromBranch} onValueChange={setFromBranch}>
                  <SelectTrigger id="from-branch">
                    <SelectValue placeholder="Select source branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch: any) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} - {branch.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To Branch */}
              <div className="grid gap-2">
                <Label htmlFor="to-branch">To Branch *</Label>
                <Select value={toBranch} onValueChange={setToBranch}>
                  <SelectTrigger id="to-branch">
                    <SelectValue placeholder="Select destination branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter((branch: any) => branch.id !== fromBranch)
                      .map((branch: any) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} - {branch.location}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product */}
              <div className="grid gap-2">
                <Label htmlFor="product">Product *</Label>
                {isLoadingInventory ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <Select
                    value={productId}
                    onValueChange={setProductId}
                    disabled={!fromBranch}
                  >
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((item: any) => (
                        <SelectItem key={item.product_id} value={item.product_id}>
                          {item.product_name} (Available: {item.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!fromBranch && (
                  <p className="text-xs text-muted-foreground">
                    Select a source branch first
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="grid gap-2">
                <Label htmlFor="quantity">
                  Quantity * {availableQuantity > 0 && `(Available: ${availableQuantity})`}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={availableQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  disabled={!productId}
                />
              </div>

              {/* Reason (Optional) */}
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Restocking, Customer request, etc."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={transferMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={transferMutation.isPending}>
                {transferMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Transfer Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Stock Transfer
              {pendingTransfer?.isLargeTransfer && (
                <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-100 px-2 py-1 rounded">
                  <Lock className="h-3 w-3" />
                  Large Transfer (&gt;100 units)
                </span>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm">
                  Please review the transfer details carefully before confirming. This action will immediately update inventory levels in both branches.
                </p>
                
                {pendingTransfer && (
                  <>
                    {/* Transfer Overview Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Product</p>
                          <p className="font-semibold text-foreground">{pendingTransfer.productName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Transfer Quantity</p>
                          <p className="font-semibold text-xl text-amber-600">{pendingTransfer.quantity} units</p>
                        </div>
                      </div>
                    </div>

                    {/* From/To Branches */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {/* From Branch */}
                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <p className="text-xs font-medium text-red-600">From (Source)</p>
                        </div>
                        <p className="font-semibold text-foreground mb-1">{pendingTransfer.fromBranchName}</p>
                        <p className="text-xs text-muted-foreground mb-2">{pendingTransfer.fromBranchLocation}</p>
                        <div className="pt-2 border-t border-red-200 dark:border-red-800">
                          <p className="text-xs text-muted-foreground">Current Stock</p>
                          <p className="font-semibold text-foreground">{pendingTransfer.currentStock} units</p>
                          <p className="text-xs text-red-600 mt-1">After: {pendingTransfer.remainingStock} units</p>
                        </div>
                      </div>

                      {/* To Branch */}
                      <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <p className="text-xs font-medium text-green-600">To (Destination)</p>
                        </div>
                        <p className="font-semibold text-foreground mb-1">{pendingTransfer.toBranchName}</p>
                        <p className="text-xs text-muted-foreground mb-2">{pendingTransfer.toBranchLocation}</p>
                        <div className="pt-2 border-t border-green-200 dark:border-green-800">
                          <p className="text-xs text-muted-foreground">Will Receive</p>
                          <p className="font-semibold text-green-600 text-lg">+{pendingTransfer.quantity} units</p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    {pendingTransfer.reason && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Transfer Reason</p>
                        <p className="text-sm text-foreground">{pendingTransfer.reason}</p>
                      </div>
                    )}

                    {/* Transfer Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date().toLocaleString()}</span>
                      </div>
                      <div>
                        Approved by: <span className="font-medium text-foreground">{user?.name}</span>
                      </div>
                    </div>
                  </>
                )}

                {pendingTransfer?.isLargeTransfer && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      🔒 <strong>Large Transfer Alert:</strong> Transfers over 100 units require password verification for security. You'll be asked to enter your password in the next step.
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-md">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    ⚠️ <strong>Important:</strong> This will reduce stock at the source branch and increase stock at the destination branch. This action will be logged and cannot be easily undone.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTransfer}
              disabled={transferMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {transferMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {pendingTransfer?.isLargeTransfer ? "Continue to Verification" : "Confirm Transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Verification Dialog for Large Transfers */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[90vh] overflow-y-auto sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              Password Verification Required
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm">
                  This transfer exceeds 100 units and requires password verification for security purposes.
                </p>

                {pendingTransfer && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">Transfer Summary</p>
                    <p className="text-sm text-foreground">
                      <strong>{pendingTransfer.quantity} units</strong> of <strong>{pendingTransfer.productName}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pendingTransfer.fromBranchName} → {pendingTransfer.toBranchName}
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="password-verify">Enter Your Password</Label>
                  <Input
                    id="password-verify"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePasswordSubmit();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your account password to authorize this large transfer.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={transferMutation.isPending}
              onClick={() => {
                setPassword("");
                setShowPasswordDialog(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePasswordSubmit}
              disabled={transferMutation.isPending || !password}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {transferMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Verify & Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
