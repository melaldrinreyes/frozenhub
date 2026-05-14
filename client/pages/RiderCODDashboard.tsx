import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/authContext";
import { DollarSign, Check, Send, Phone, MapPin, Briefcase, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

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

export default function RiderCODDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [showRemittanceDialog, setShowRemittanceDialog] = useState(false);
  const [remittanceNotes, setRemittanceNotes] = useState("");

  // Fetch COD collections
  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ["cod-collections", user?.id],
    queryFn: async () => {
      const response = await fetch("/api/rider/cod-collections", withAuth());
      if (!response.ok) throw new Error("Failed to fetch COD collections");
      return response.json();
    },
    enabled: !!user?.id && user?.role === "rider",
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark collection as collected
  const markCollectedMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const response = await fetch(
        `/api/rider/cod-collections/${collectionId}/collect`,
        withAuth({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "" }),
        })
      );
      if (!response.ok) throw new Error("Failed to mark collection as collected");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cod-collections"] });
      toast({ title: "Marked as collected", description: "Collection status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // Create remittance
  const createRemittanceMutation = useMutation({
    mutationFn: async (collectionIds: string[]) => {
      const response = await fetch("/api/rider/remittances", withAuth({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionIds, notes: remittanceNotes }),
      }));
      if (!response.ok) throw new Error("Failed to create remittance");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cod-collections"] });
      queryClient.invalidateQueries({ queryKey: ["rider-remittances"] });
      toast({ title: "Remittance created", description: `Submitted ₱${data.remittance.total_amount.toFixed(2)} to branch` });
      setShowRemittanceDialog(false);
      setSelectedCollections(new Set());
      setRemittanceNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const collections = collectionsData?.collections || [];

  // Get collected collections
  const collectedCollections = collections.filter((c: any) => c.status === "collected");
  const totalCollected = collectedCollections.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

  const handleSelectCollection = (collectionId: string) => {
    const newSet = new Set(selectedCollections);
    if (newSet.has(collectionId)) {
      newSet.delete(collectionId);
    } else {
      newSet.add(collectionId);
    }
    setSelectedCollections(newSet);
  };

  const handleSubmitRemittance = () => {
    if (selectedCollections.size === 0) {
      toast({ title: "No collections selected", description: "Select at least one collection to remit", variant: "destructive" });
      return;
    }
    createRemittanceMutation.mutate(Array.from(selectedCollections));
  };

  if (collectionsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center text-gray-500">Loading COD collections...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 p-4 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <div className="flex items-center gap-3 min-w-0">
                <Briefcase className="w-7 h-7 flex-shrink-0" />
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">COD Collections</h1>
              </div>
              <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl">
                Collect and manage Cash on Delivery payments from your assigned orders
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
                  <p className="text-sm text-gray-500 font-medium">Pending Collections</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{collections.filter((c: any) => c.status === "pending").length}</p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Collected Today</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">₱{totalCollected.toFixed(2)}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Ready to Remit</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{selectedCollections.size}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Send className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Collections List */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-gray-200 pb-4">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Collections
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {collections.length === 0 ? (
              <p className="text-center text-gray-500 py-12 text-sm">No COD collections assigned yet</p>
            ) : (
              <div className="space-y-6">
                {/* Pending Collections */}
                {collections.filter((c: any) => c.status === "pending").length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 mb-4 px-1">Pending Collections</h3>
                    <div className="space-y-3">
                      {collections.filter((c: any) => c.status === "pending").map((collection: any) => (
                        <div key={collection.id} className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl hover:shadow-sm transition-shadow">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{collection.customer_name || "Customer"}</p>
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-2">
                              <Phone className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{collection.customer_phone}</span>
                            </p>
                            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{collection.branch_name}</span>
                            </p>
                            <p className="text-lg font-bold text-gray-900 mt-3">₱{Number(collection.amount).toFixed(2)}</p>
                          </div>
                          <Button
                            onClick={() => markCollectedMutation.mutate(collection.id)}
                            disabled={markCollectedMutation.isPending}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Collect
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collected Collections (Ready to Remit) */}
                {collectedCollections.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 mb-4 px-1">Collected (Ready to Remit)</h3>
                    <div className="space-y-3">
                      {collectedCollections.map((collection: any) => (
                        <div
                          key={collection.id}
                          className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:shadow-sm transition-all"
                          onClick={() => handleSelectCollection(collection.id)}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Checkbox
                              checked={selectedCollections.has(collection.id)}
                              onChange={() => handleSelectCollection(collection.id)}
                              className="mt-1 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{collection.customer_name || "Customer"}</p>
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-2">
                                <Phone className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{collection.customer_phone}</span>
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Collected: {new Date(collection.collected_at).toLocaleString()}
                              </p>
                              <p className="text-lg font-bold text-gray-900 mt-3">₱{Number(collection.amount).toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remitted Collections */}
                {collections.filter((c: any) => c.status === "remitted").length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 mb-4 px-1">Remitted</h3>
                    <div className="space-y-3">
                      {collections.filter((c: any) => c.status === "remitted").map((collection: any) => (
                        <div key={collection.id} className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 bg-green-50 border border-green-200 rounded-xl opacity-75">
                          <Check className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{collection.customer_name || "Customer"}</p>
                            <p className="text-sm text-gray-600 mt-2">₱{Number(collection.amount).toFixed(2)} - Remitted</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remit Button */}
        {collectedCollections.length > 0 && (
          <Button
            onClick={() => setShowRemittanceDialog(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 text-base sm:text-lg shadow-lg"
            disabled={selectedCollections.size === 0}
          >
            <Send className="w-5 h-5 mr-2" />
            Remit {selectedCollections.size > 0 ? `₱${collectedCollections.filter(c => selectedCollections.has(c.id)).reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)}` : "Collections"} to Branch
          </Button>
        )}

        {/* Remittance Dialog */}
        <Dialog open={showRemittanceDialog} onOpenChange={setShowRemittanceDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Confirm Remittance</DialogTitle>
              <DialogDescription>
                Submit collected COD payments to your assigned branch
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">Collections to Remit:</p>
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  {collectedCollections
                    .filter(c => selectedCollections.has(c.id))
                    .map((c) => (
                      <div key={c.id} className="flex justify-between text-sm p-2 bg-white rounded border border-gray-100">
                        <span className="font-medium text-gray-900">{c.customer_name}</span>
                        <span className="font-semibold text-gray-900">₱{Number(c.amount).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-lg font-bold text-gray-900">
                  Total: ₱{collectedCollections
                    .filter(c => selectedCollections.has(c.id))
                    .reduce((sum, c) => sum + Number(c.amount), 0)
                    .toFixed(2)}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Notes (Optional)</label>
                <Textarea
                  value={remittanceNotes}
                  onChange={(e) => setRemittanceNotes(e.target.value)}
                  placeholder="Add any notes about this remittance..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-col sm:flex-row">
              <Button variant="outline" onClick={() => setShowRemittanceDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRemittance}
                disabled={createRemittanceMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {createRemittanceMutation.isPending ? "Submitting..." : "Submit Remittance"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

