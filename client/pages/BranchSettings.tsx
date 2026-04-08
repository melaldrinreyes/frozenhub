import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import ChangePassword from "@/components/ChangePassword";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { apiClient } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export default function BranchSettings() {
  const { user } = useAuth();

  // Fetch branch data
  const { data: branchesData, isLoading: isLoadingBranch } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const result = await apiClient.getBranches();
      return result;
    },
  });

  // Find current user's branch
  const currentBranch = branchesData?.branches?.find(
    (branch: any) => branch.id === user?.branch_id
  );

  return (
    <AdminLayout userRole="branch">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Branch Settings</h1>
          <p className="text-slate-600 mt-2">
            View your branch information and manage your account
          </p>
        </div>

        {/* Info Message */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-900 font-medium">Branch Information</p>
            <p className="text-blue-700 text-sm mt-1">
              Branch details are managed by administrators. If you need to update any branch information, please contact your system administrator.
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoadingBranch ? (
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200">
            <CardContent className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-2" />
              <p className="text-slate-600">Loading branch information...</p>
            </CardContent>
          </Card>
        ) : !currentBranch ? (
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200">
            <CardContent className="py-12 flex flex-col items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
              <p className="text-red-800 font-medium">Branch information not found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Branch Information (Read-Only) */}
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 shadow-sm">
              <CardHeader className="border-b-2 border-slate-200">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <MapPin className="w-5 h-5 text-yellow-600" />
                  Branch Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-900 font-semibold">
                      Branch Name
                    </Label>
                    <div className="bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium">
                      {currentBranch.name || "N/A"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-900 font-semibold">
                      Contact Number
                    </Label>
                    <div className="bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium">
                      {currentBranch.contact_number || "N/A"}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-900 font-semibold">
                      Address
                    </Label>
                    <div className="bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium">
                      {currentBranch.address || "N/A"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Information */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 shadow-sm">
              <CardHeader className="border-b-2 border-blue-200">
                <CardTitle className="text-blue-900">System Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-blue-700 uppercase font-semibold mb-1">
                      Branch ID
                    </p>
                    <p className="text-sm font-mono font-semibold text-blue-900 bg-white border border-blue-200 rounded px-3 py-2">
                      {currentBranch.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-blue-700 uppercase font-semibold mb-1">
                      Status
                    </p>
                    <p className="text-sm font-semibold text-green-700 flex items-center gap-2 bg-white border border-blue-200 rounded px-3 py-2">
                      <span className="w-2 h-2 bg-green-600 rounded-full" />
                      Active
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-blue-700 uppercase font-semibold mb-1">
                      Manager
                    </p>
                    <p className="text-sm font-semibold text-blue-900 bg-white border border-blue-200 rounded px-3 py-2">
                      {user?.name || "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-blue-700 uppercase font-semibold mb-1">
                      Email
                    </p>
                    <p className="text-sm font-semibold text-blue-900 bg-white border border-blue-200 rounded px-3 py-2 break-all">
                      {user?.email || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <ChangePassword />
          </>
        )}
      </div>
    </AdminLayout>
  );
}




