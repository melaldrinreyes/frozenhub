import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/authContext";
import { TrendingUp, DollarSign, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

export default function RiderRemittanceHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedRemittance, setSelectedRemittance] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch remittance history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["rider-remittance-history", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/rider/remittances", withAuth());
      if (!response.ok) throw new Error("Failed to fetch remittance history");
      return response.json();
    },
    enabled: !!user?.id && user?.role === "rider",
    refetchInterval: 60000, // Refetch every 60 seconds
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

  const remittances = historyData?.remittances || [];
  const remittance = detailsData?.remittance;
  const items = detailsData?.items || [];

  const totalRemitted = remittances
    .filter((r: any) => r.status === "verified")
    .reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);

  const handleViewDetails = (remittanceId: string) => {
    setSelectedRemittance(remittanceId);
    setShowDetailsDialog(true);
  };

  if (historyLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center text-gray-500">Loading remittance history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 p-4 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <div className="flex items-center gap-3 min-w-0">
                <TrendingUp className="w-7 h-7 flex-shrink-0" />
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Remittance History</h1>
              </div>
              <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl">
                Track all your submitted remittances and their approval status
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Remitted</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">₱{totalRemitted.toFixed(2)}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Remittances</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{remittances.length}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Verified</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {remittances.filter((r: any) => r.status === "verified").length}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Remittance List */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-gray-200 pb-4">
            <CardTitle className="text-gray-900">Recent Remittances</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {remittances.length === 0 ? (
              <p className="text-center text-gray-500 py-12 text-sm">No remittances submitted yet</p>
            ) : (
              <div className="space-y-3">
                {remittances.map((remittance: any) => (
                  <div
                    key={remittance.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleViewDetails(remittance.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <p className="font-semibold text-gray-900 truncate">{remittance.branch_name}</p>
                        <Badge className={`${getStatusColor(remittance.status)} w-fit`}>
                          {remittance.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{new Date(remittance.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-xs">{remittance.collection_count} collections</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-4 flex-shrink-0">
                      <div>
                        <p className="text-xl font-bold text-gray-900">₱{Number(remittance.total_amount).toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(remittance.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(remittance.id);
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Branch Name</p>
                    <p className="font-semibold text-gray-900 mt-1">{remittance.branch_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Status</p>
                    <Badge className={`${getStatusColor(remittance.status)} mt-2 w-fit`}>
                      {remittance.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">₱{Number(remittance.total_amount).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Collections</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{remittance.collection_count}</p>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
                  <div className="space-y-4 border-l-2 border-gray-300 pl-4 ml-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded-full -ml-6 mt-1" />
                        <p className="font-semibold text-sm text-gray-900">Submitted</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(remittance.created_at).toLocaleString()}
                      </p>
                    </div>
                    {remittance.acknowledged_at && (
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-400 rounded-full -ml-6 mt-1" />
                          <p className="font-semibold text-sm text-blue-600">Acknowledged by {remittance.acknowledged_by_name}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(remittance.acknowledged_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {remittance.verified_at && (
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-400 rounded-full -ml-6 mt-1" />
                          <p className="font-semibold text-sm text-green-600">Verified by {remittance.verified_by_name}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(remittance.verified_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collections List */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Collections ({items.length})</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-start p-3 bg-white rounded border border-gray-100 text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{item.customer_name}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">{item.customer_phone}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(item.collected_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="font-bold text-gray-900 ml-2 flex-shrink-0">₱{Number(item.amount).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="outline" onClick={() => setShowDetailsDialog(false)} className="w-full">
                  Close
                </Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
