import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapPin, Plus, Edit, Trash2, Search, Phone, User, Calendar, Building2 } from "lucide-react";
import { paginateItems } from "@/lib/dataManager";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

interface Branch {
  id: string;
  name: string;
  location: string;
  phone: string;
  manager: string;
  created_at: string;
}

export default function AdminManageBranches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    phone: "",
    manager: "",
  });

  // Fetch branches from API
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await apiClient.getBranches();
      return response.branches as Branch[];
    },
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({
        title: "Success",
        description: "Branch created successfully",
      });
      setIsDialogOpen(false);
      setFormData({ name: "", location: "", phone: "", manager: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create branch",
        variant: "destructive",
      });
    },
  });

  // Update branch mutation
  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiClient.updateBranch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({
        title: "Success",
        description: "Branch updated successfully",
      });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({ name: "", location: "", phone: "", manager: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update branch",
        variant: "destructive",
      });
    },
  });

  // Delete branch mutation
  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast({
        title: "Success",
        description: "Branch deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete branch",
        variant: "destructive",
      });
    },
  });

  // Filter branches
  const filteredBranches = useMemo(() => {
    // Ensure branches is an array
    const branchArray = Array.isArray(branches) ? branches : [];
    if (!searchTerm) return branchArray;
    
    const term = searchTerm.toLowerCase();
    return branchArray.filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.location.toLowerCase().includes(term) ||
        b.manager.toLowerCase().includes(term)
    );
  }, [branches, searchTerm]);

  const { items: paginatedBranches, totalPages } = paginateItems(
    filteredBranches,
    currentPage,
    10,
  );

  const handleOpenDialog = (branch?: Branch) => {
    if (branch) {
      setEditingId(branch.id);
      setFormData({
        name: branch.name,
        location: branch.location,
        phone: branch.phone,
        manager: branch.manager,
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", location: "", phone: "", manager: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSaveBranch = () => {
    if (!formData.name || !formData.location || !formData.phone || !formData.manager) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      updateBranchMutation.mutate({ id: editingId, data: formData });
    } else {
      createBranchMutation.mutate(formData);
    }
  };

  const handleDeleteBranch = (id: string) => {
    if (confirm("Are you sure you want to delete this branch? This action cannot be undone.")) {
      deleteBranchMutation.mutate(id);
    }
  };

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Manage Branches
            </h1>
            <p className="text-slate-600 mt-2">
              Create and manage branch locations and their administrators
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-gold-500 hover:bg-gold-600 text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Branch" : "Add New Branch"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Branch Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Main Branch"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="Downtown, City Center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+1-555-0101"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manager">Manager Name</Label>
                    <Input
                      id="manager"
                      value={formData.manager}
                      onChange={(e) =>
                        setFormData({ ...formData, manager: e.target.value })
                      }
                      placeholder="John Smith"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSaveBranch}
                    className="flex-1 bg-gold-500 hover:bg-gold-600 text-white"
                  >
                    {editingId ? "Update Branch" : "Add Branch"}
                  </Button>
                  <Button
                    onClick={() => setIsDialogOpen(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Branches
            </CardTitle>
            <MapPin className="w-4 h-4 text-gold-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branches.length}</div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by name, location, or manager..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branches Table */}
        <Card>
          <CardHeader>
            <CardTitle>Branches ({filteredBranches.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">
                Loading branches...
              </div>
            ) : paginatedBranches.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No branches found</h3>
                <p className="text-sm text-slate-600 mb-6">
                  {searchTerm 
                    ? "Try adjusting your search to find what you're looking for."
                    : "Get started by adding your first branch location."}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="bg-gold-500 hover:bg-gold-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Branch
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {paginatedBranches.map((branch) => (
                    <div
                      key={branch.id}
                      className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header with Branch Name and Actions */}
                      <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-100">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {branch.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-base mb-1">
                              {branch.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <p className="text-xs truncate">{branch.location}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDialog(branch)}
                            className="h-9 w-9 p-0 hover:bg-gold-50 hover:text-gold-600"
                            title="Edit branch"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteBranch(branch.id)}
                            title="Delete branch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs font-medium text-slate-500">Manager</p>
                          </div>
                          <p className="text-sm text-slate-900 font-semibold truncate">
                            {branch.manager}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs font-medium text-slate-500">Phone</p>
                          </div>
                          <p className="text-sm text-slate-900 font-semibold">
                            {branch.phone}
                          </p>
                        </div>
                        <div className="col-span-2 bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs font-medium text-slate-500">Created</p>
                          </div>
                          <p className="text-sm text-slate-900 font-semibold">
                            {new Date(branch.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Branch
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Location
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Manager
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Phone
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Created
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBranches.map((branch) => (
                        <tr
                          key={branch.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {branch.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              {branch.location}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {branch.manager}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-slate-400" />
                              {branch.phone}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {new Date(branch.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gold-600 hover:text-gold-700 hover:bg-gold-50 h-8 w-8 p-0"
                                onClick={() => handleOpenDialog(branch)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                onClick={() => handleDeleteBranch(branch.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && paginatedBranches.length > 0 && (
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




