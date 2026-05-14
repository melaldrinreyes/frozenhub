import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/authContext";
import { CheckCircle2, Clock, AlertCircle, Eye, ArrowLeft, DollarSign, ShieldCheck, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

const JWT_TOKEN_KEY = "frozenhub_jwt_token";

function withAuth(init: RequestInit = {}): RequestInit {
  const token = typeof window !== "undefined" ? localStorage.getItem(JWT_TOKEN_KEY) : null;
  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  };
}

function getStatusColor(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "acknowledged":
      return "bg-blue-100 text-blue-800";
    case "verified":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "pending":
      return <Clock className="w-4 h-4" />;
    case "acknowledged":
      return <AlertCircle className="w-4 h-4" />;
    case "verified":
      return <CheckCircle2 className="w-4 h-4" />;
    default:
      return null;
  }
}

export default function BranchRemittancePanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRemittance, setSelectedRemittance] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch branch remittances
  const { data: remittancesData, isLoading: remittancesLoading, refetch } = useQuery({
    queryKey: ["branch-remittances", user?.branch_id],
    queryFn: async () => {
      const response = await fetch("/api/branch/remittances", withAuth());
      if (!response.ok) throw new Error("Failed to fetch remittances");
      return response.json();
    },
    enabled: !!user?.branch_id && (user?.role === "branch_admin" || user?.role === "admin"),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch remittance details
  const { data: detailsData, isLoading: detailsLoading } = useQuery({
    queryKey: ["remittance-details", selectedRemittance],
    queryFn: async () => {
      const response = await fetch(`/api/remittances/${selectedRemittance}`, withAuth());
      if (!response.ok) throw new Error("Failed to fetch details");
      return response.json();
    },
    enabled: !!selectedRemittance,
  });

  // Acknowledge remittance
  const acknowledgeMutation = useMutation({
    mutationFn: async (remittanceId: string) => {
      const response = await fetch(`/api/remittances/${remittanceId}/acknowledge`, withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }));
      if (!response.ok) throw new Error("Failed to acknowledge remittance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-remittances"] });
      queryClient.invalidateQueries({ queryKey: ["remittance-details"] });
      toast({ title: "Remittance acknowledged", description: "Receipt recorded" });
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // Verify remittance
  const verifyMutation = useMutation({
    mutationFn: async (remittanceId: string) => {
      const response = await fetch(`/api/remittances/${remittanceId}/verify`, withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }));
      if (!response.ok) throw new Error("Failed to verify remittance");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-remittances"] });
      queryClient.invalidateQueries({ queryKey: ["remittance-details"] });
      toast({ title: "Remittance verified", description: "Payment confirmed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const remittances = remittancesData?.remittances || [];
  const remittance = detailsData?.remittance;
  const items = detailsData?.items || [];

  const pendingRemittances = remittances.filter((r: any) => r.status === "pending");
  const acknowledgedRemittances = remittances.filter((r: any) => r.status === "acknowledged");
  const verifiedRemittances = remittances.filter((r: any) => r.status === "verified");

  const handleViewDetails = (remittanceId: string) => {
    setSelectedRemittance(remittanceId);
    setShowDetailsDialog(true);
  };

  const handleAcknowledge = (remittanceId: string) => {
    acknowledgeMutation.mutate(remittanceId);
  };

  const handleVerify = (remittanceId: string) => {
    verifyMutation.mutate(remittanceId);
  };

  if (remittancesLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center text-gray-500">Loading remittances...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="w-7 h-7 flex-shrink-0" />
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">COD Remittances</h1>
              </div>
              <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl">
                Review, acknowledge, and verify rider remittances before COD revenue reaches branch sales
              </p>
            </div>
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              className="w-full sm:w-auto bg-white/20 hover:bg-white/30 text-white border border-white/30"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Pending Remittances</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{pendingRemittances.length}</p>
                <p className="text-xs text-gray-500 mt-2">
                ₱{pendingRemittances.reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0).toFixed(2)}
              </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Acknowledged</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{acknowledgedRemittances.length}</p>
                <p className="text-xs text-gray-500 mt-2">
                ₱{acknowledgedRemittances.reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0).toFixed(2)}
              </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Verified</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{verifiedRemittances.length}</p>
                <p className="text-xs text-gray-500 mt-2">
                ₱{verifiedRemittances.reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0).toFixed(2)}
              </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remittances by Status */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b border-gray-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Remittance Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full flex flex-wrap justify-start gap-2 border-b bg-transparent p-0 h-auto">
          <TabsTrigger value="pending" className="flex items-center gap-2 rounded-full px-4 py-2">
            <Clock className="w-4 h-4" />
            Pending ({pendingRemittances.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="flex items-center gap-2 rounded-full px-4 py-2">
            <AlertCircle className="w-4 h-4" />
            Acknowledged ({acknowledgedRemittances.length})
          </TabsTrigger>
          <TabsTrigger value="verified" className="flex items-center gap-2 rounded-full px-4 py-2">
            <CheckCircle2 className="w-4 h-4" />
            Verified ({verifiedRemittances.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingRemittances.length === 0 ? (
            <Card className="border border-dashed border-gray-300">
              <CardContent className="pt-6 text-center text-gray-500">No pending remittances</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRemittances.map((remittance: any) => (
                <RemittanceCard
                  key={remittance.id}
                  remittance={remittance}
                  onViewDetails={() => handleViewDetails(remittance.id)}
                  onAcknowledge={() => handleAcknowledge(remittance.id)}
                  isLoading={acknowledgeMutation.isPending}
                  showAction={true}
                  actionLabel="Acknowledge"
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="acknowledged" className="mt-4">
          {acknowledgedRemittances.length === 0 ? (
            <Card className="border border-dashed border-gray-300">
              <CardContent className="pt-6 text-center text-gray-500">No acknowledged remittances</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {acknowledgedRemittances.map((remittance: any) => (
                <RemittanceCard
                  key={remittance.id}
                  remittance={remittance}
                  onViewDetails={() => handleViewDetails(remittance.id)}
                  onAction={() => handleVerify(remittance.id)}
                  isLoading={verifyMutation.isPending}
                  showAction={true}
                  actionLabel="Verify Payment"
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="verified" className="mt-4">
          {verifiedRemittances.length === 0 ? (
            <Card className="border border-dashed border-gray-300">
              <CardContent className="pt-6 text-center text-gray-500">No verified remittances</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {verifiedRemittances.map((remittance: any) => (
                <RemittanceCard
                  key={remittance.id}
                  remittance={remittance}
                  onViewDetails={() => handleViewDetails(remittance.id)}
                  isLoading={false}
                  showAction={false}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Remittance Details</DialogTitle>
            <DialogDescription>
              {remittance && `ID: ${remittance.id}`}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading details...</div>
          ) : remittance ? (
            <div className="space-y-6">
              {/* Remittance Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Rider</p>
                  <p className="font-semibold">{remittance.rider_name}</p>
                  <p className="text-xs text-gray-500">{remittance.rider_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branch</p>
                  <p className="font-semibold">{remittance.branch_name}</p>
                  <p className="text-xs text-gray-500">{remittance.branch_location}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-2xl font-bold">₱{Number(remittance.total_amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Collections</p>
                  <p className="text-2xl font-bold">{remittance.collection_count}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3 border-l-2 border-gray-300 pl-4">
                <div>
                  <Badge className="mb-2">{remittance.status.toUpperCase()}</Badge>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(remittance.created_at).toLocaleString()}
                  </p>
                </div>
                {remittance.acknowledged_at && (
                  <div>
                    <p className="font-semibold text-sm text-blue-600">Acknowledged</p>
                    <p className="text-xs text-gray-500">
                      {new Date(remittance.acknowledged_at).toLocaleString()} by {remittance.acknowledged_by_name}
                    </p>
                  </div>
                )}
                {remittance.verified_at && (
                  <div>
                    <p className="font-semibold text-sm text-green-600">Verified</p>
                    <p className="text-xs text-gray-500">
                      {new Date(remittance.verified_at).toLocaleString()} by {remittance.verified_by_name}
                    </p>
                  </div>
                )}
              </div>

              {/* Collections List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Collections ({items.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {items.map((item: any) => (
                    <div key={item.id} className="flex justify-between p-2 bg-gray-50 rounded text-sm">
                      <div>
                        <p className="font-semibold">{item.customer_name}</p>
                        <p className="text-xs text-gray-500">{item.customer_phone}</p>
                      </div>
                      <p className="font-bold">₱{Number(item.amount).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)} className="w-full sm:w-auto">
                  Close
                </Button>
                {remittance.status === "pending" && (
                  <Button
                    onClick={() => {
                      handleAcknowledge(remittance.id);
                      setShowDetailsDialog(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1 w-full sm:w-auto"
                    disabled={acknowledgeMutation.isPending}
                  >
                    Acknowledge Receipt
                  </Button>
                )}
                {remittance.status === "acknowledged" && (
                  <Button
                    onClick={() => {
                      handleVerify(remittance.id);
                      setShowDetailsDialog(false);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white flex-1 w-full sm:w-auto"
                    disabled={verifyMutation.isPending}
                  >
                    Verify Payment
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

interface RemittanceCardProps {
  remittance: any;
  onViewDetails: () => void;
  onAcknowledge?: () => void;
  onAction?: () => void;
  isLoading: boolean;
  showAction: boolean;
  actionLabel?: string;
}

function RemittanceCard({
  remittance,
  onViewDetails,
  onAcknowledge,
  onAction,
  isLoading,
  showAction,
  actionLabel = "Acknowledge",
}: RemittanceCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getStatusColor(remittance.status)}>
                {getStatusIcon(remittance.status)}
                <span className="ml-1">{remittance.status.toUpperCase()}</span>
              </Badge>
            </div>
            <p className="font-semibold text-lg">{remittance.rider_name}</p>
            <p className="text-sm text-gray-600">₱{Number(remittance.total_amount).toFixed(2)} • {remittance.collection_count} collections</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(remittance.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onViewDetails}>
              <Eye className="w-4 h-4 mr-1" />
              Details
            </Button>
            {showAction && onAction && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={onAction}
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : actionLabel}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
