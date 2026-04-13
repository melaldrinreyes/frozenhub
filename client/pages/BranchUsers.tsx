// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Check,
  Mail,
  Phone,
  Calendar,
  ShoppingCart,
} from "lucide-react";
import { filterBySearch, paginateItems } from "@/lib/dataManager";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";

export default function BranchUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [password, setPassword] = useState("");

  // Fetch users for this branch
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["branch-users", user?.branch_id],
    queryFn: async () => {
      if (!user?.branch_id) return { users: [] };
      return apiClient.getUsers({ branchId: user.branch_id, role: "pos_operator" });
    },
    enabled: !!user?.branch_id,
  });

  const users = usersData?.users || [];

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: any) => apiClient.createUser({
      ...data,
      role: "pos_operator",
      branchId: user?.branch_id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-users"] });
      setIsDialogOpen(false);
      setEditingId(null);
      setPassword("");
      setFormData({ name: "", email: "", phone: "" });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to create POS operator");
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-users"] });
      setIsDialogOpen(false);
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "" });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to update POS operator");
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-users"] });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to delete POS operator");
    },
  });

  // Filter users
  let filteredUsers = users;

  if (searchTerm) {
    filteredUsers = filterBySearch(filteredUsers, searchTerm, [
      "name",
      "email",
    ]);
  }

  const { items: paginatedUsers, totalPages } = paginateItems(
    filteredUsers,
    currentPage,
    10,
  );

  const handleOpenDialog = (user?: any) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
      setPassword("");
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
      });
      setPassword("");
    }
    setIsDialogOpen(true);
  };

  const handleSaveUser = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      alert("Please fill all required fields");
      return;
    }

    if (!editingId && !password) {
      alert("Password is required for new POS operators");
      return;
    }

    if (editingId) {
      updateUserMutation.mutate({ id: editingId, data: formData });
    } else {
      createUserMutation.mutate({ ...formData, password });
    }
  };

  const handleDeleteUser = (id: string) => {
    if (confirm("Are you sure you want to delete this POS operator?")) {
      deleteUserMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout userRole="branch">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading POS operators...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userRole="branch">
      <div className="min-h-screen bg-slate-50/50 -m-6 sm:-m-8 p-6 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  POS Operators
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mt-1 sm:mt-2">
                  Manage POS operators for your branch
                </p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => handleOpenDialog()}
                    className="bg-primary hover:bg-primary/90 flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Add POS Operator
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                      {editingId ? "Edit POS Operator" : "Add New POS Operator"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm">Full Name *</Label>
                        <Input
                          id="name"
                          value={formData.name || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          placeholder="John Smith"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm">Phone *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          placeholder="+1-555-0000"
                        />
                      </div>

                      {!editingId && (
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-sm">Password *</Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button
                        onClick={handleSaveUser}
                        className="flex-1 bg-primary hover:bg-primary/90"
                        disabled={createUserMutation.isPending || updateUserMutation.isPending}
                      >
                        {editingId ? "Update Operator" : "Add Operator"}
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
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Card className="bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Total POS Operators</CardTitle>
                <Users className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-slate-600 mt-1">Active in your branch</p>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Active Today
                </CardTitle>
                <Check className="w-4 h-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-slate-600 mt-1">Currently available</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white shadow-sm">
            <CardContent className="pt-4 sm:pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 sm:pl-10 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                POS Operators ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paginatedUsers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No POS operators found
                  </h3>
                  <p className="text-sm text-slate-600 mb-6">
                    {searchTerm
                      ? "Try adjusting your search to find what you're looking for."
                      : "Get started by adding your first POS operator."}
                  </p>
                  {!searchTerm && (
                    <Button
                      onClick={() => handleOpenDialog()}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First POS Operator
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {paginatedUsers.map((operator: any) => (
                      <div
                        key={operator.id}
                        className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-100">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {operator.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-slate-900 text-base mb-1 truncate">
                                {operator.name}
                              </h3>
                              <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                <p className="text-xs truncate">{operator.email}</p>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                <p className="text-xs">{operator.phone}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDialog(operator)}
                              className="h-9 w-9 p-0 hover:bg-blue-50 hover:text-blue-600"
                              title="Edit operator"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteUser(operator.id)}
                              title="Delete operator"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs font-medium text-slate-500">Member Since</p>
                          </div>
                          <p className="text-sm text-slate-900 font-semibold">
                            {new Date(operator.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
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
                            Name
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">
                            Email
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">
                            Phone
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">
                            Joined
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedUsers.map((operator: any) => (
                          <tr
                            key={operator.id}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {operator.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {operator.email}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {operator.phone}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {new Date(operator.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleOpenDialog(operator)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                  onClick={() => handleDeleteUser(operator.id)}
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
              {totalPages > 1 && paginatedUsers.length > 0 && (
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
      </div>
    </AdminLayout>
  );
}

