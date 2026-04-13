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
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Shield,
  Check,
  X,
  Mail,
  Phone,
  Building,
  Calendar,
} from "lucide-react";
import { filterBySearch, paginateItems } from "@/lib/dataManager";
import { apiClient } from "@/lib/apiClient";

const ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "branch_admin", label: "Branch Administrator" },
  { value: "pos_operator", label: "POS Operator" },
  { value: "rider", label: "Rider" },
];

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalBranchId, setEditingOriginalBranchId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "pos_operator",
    branchId: "",
  });
  const [password, setPassword] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<
    | {
        type: "toggle-rider" | "delete-user";
        user: any;
      }
    | null
  >(null);

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.getUsers(),
  });

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.getBranches(),
  });

  const users = usersData?.users || [];
  const branches = branchesData?.branches || [];

  // Create a map of branch IDs to branch names for quick lookup
  const branchMap = branches.reduce((acc: any, branch: any) => {
    acc[branch.id] = branch.name;
    return acc;
  }, {});

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (data: any) => apiClient.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsDialogOpen(false);
      setEditingId(null);
      setPassword("");
    },
    onError: (error: any) => {
      alert(error.message || "Failed to create user");
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsDialogOpen(false);
      setEditingId(null);
    },
    onError: (error: any) => {
      alert(error.message || "Failed to update user");
    },
  });

  const toggleRiderStatusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.updateUser(id, { active }),
    onSuccess: (response: any, variables) => {
      queryClient.setQueryData(["users"], (oldData: any) => {
        if (!oldData?.users) return oldData;

        const returnedUser = response?.user;
        return {
          ...oldData,
          users: oldData.users.map((user: any) =>
            user.id === variables.id
              ? {
                  ...user,
                  ...(returnedUser || {}),
                  active: returnedUser?.active ?? variables.active,
                }
              : user
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to update rider status");
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      alert(error.message || "Failed to delete user");
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

  if (selectedRole) {
    filteredUsers = filteredUsers.filter((u: any) => u.role === selectedRole);
  }

  const { items: paginatedUsers, totalPages } = paginateItems(
    filteredUsers,
    currentPage,
    10,
  );

  const getRoleLabel = (role: string) => {
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  const isUserActive = (user: any) => {
    const raw = user?.active;
    return !(raw === false || raw === 0 || String(raw).toLowerCase() === "false");
  };

  const getStatusStyles = (user: any) =>
    isUserActive(user)
      ? "bg-emerald-600 text-white border border-emerald-700 shadow-sm"
      : "bg-rose-600 text-white border border-rose-700 shadow-sm";

  const getStatusLabel = (user: any) => (isUserActive(user) ? "Enabled" : "Disabled");

  const handleOpenDialog = (user?: any) => {
    if (user) {
      setEditingId(user.id);
      const originalBranchId = user.branch_id || "";
      setEditingOriginalBranchId(originalBranchId);
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        branchId: originalBranchId,
      });
      setPassword(""); // Clear password when editing
    } else {
      setEditingId(null);
      setEditingOriginalBranchId("");
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "pos_operator",
        branchId: "",
      });
      setPassword(""); // Clear password when creating new
    }
    setIsDialogOpen(true);
  };

  const handleSaveUser = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      alert("Please fill all required fields");
      return;
    }

    const roleNeedsBranch = ["branch_admin", "pos_operator", "rider"].includes(formData.role);
    const effectiveBranchId = formData.branchId || (editingId ? editingOriginalBranchId : "");
    if (roleNeedsBranch && !effectiveBranchId) {
      alert("Please select a branch for this role");
      return;
    }

    // Validate password for new users
    if (!editingId && !password) {
      alert("Password is required for new users");
      return;
    }

    if (editingId) {
      const updateData: any = {
        ...formData,
        branchId: formData.branchId || undefined,
      };
      updateUserMutation.mutate({ id: editingId, data: updateData });
    } else {
      createUserMutation.mutate({ ...formData, password });
    }
  };

  const handleDeleteUser = (id: string) => {
    const targetUser = users.find((u: any) => u.id === id);
    if (!targetUser) return;
    setConfirmDialog({ type: "delete-user", user: targetUser });
  };

  const handleToggleRiderStatus = (user: any) => {
    if (user.role !== "rider") return;
    setConfirmDialog({ type: "toggle-rider", user });
  };

  const handleConfirmDialogAction = () => {
    if (!confirmDialog) return;

    if (confirmDialog.type === "toggle-rider") {
      const riderIsActive = isUserActive(confirmDialog.user);
      toggleRiderStatusMutation.mutate({
        id: confirmDialog.user.id,
        active: !riderIsActive,
      });
    }

    if (confirmDialog.type === "delete-user") {
      deleteUserMutation.mutate(confirmDialog.user.id);
    }

    setConfirmDialog(null);
  };

  const adminCount = users.filter((u: any) => u.role === "admin").length;
  const activeCount = users.filter((u: any) => isUserActive(u)).length;

  if (isLoading) {
    return (
      <AdminLayout userRole="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading users...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout userRole="admin">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              User Management
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1 sm:mt-2">
              Manage system users and their roles
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-primary hover:bg-primary/90 flex items-center gap-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {editingId ? "Edit User" : "Add New User"}
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

                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm">Role *</Label>
                    <Select
                      value={formData.role || ""}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          role: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(formData.role === "branch_admin" ||
                  formData.role === "pos_operator" ||
                  formData.role === "rider") && (
                  <div className="space-y-2">
                    <Label htmlFor="branch">
                      {formData.role === "rider" ? "Assigned Branch" : "Branch"}
                    </Label>
                    <Select
                      value={formData.branchId || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, branchId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch: any) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleSaveUser}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    {editingId ? "Update User" : "Add User"}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-slate-600 mt-1">All system users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Active Users
              </CardTitle>
              <Check className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-slate-600 mt-1">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                Administrators
              </CardTitle>
              <Shield className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{adminCount}</div>
              <p className="text-xs text-slate-600 mt-1">
                System + Branch admins
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 sm:pt-6 space-y-4">
            <div className="flex gap-3 sm:gap-4 flex-col sm:flex-row">
              <div className="flex-1 relative">
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

              <Select
                value={selectedRole || "all"}
                onValueChange={(value) => {
                  setSelectedRole(value === "all" ? "" : value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedUsers.length === 0 ? (
              /* Empty State */
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No users found</h3>
                <p className="text-sm text-slate-600 mb-6">
                  {searchTerm || selectedRole 
                    ? "Try adjusting your filters to find what you're looking for."
                    : "Get started by adding your first user to the system."}
                </p>
                {!searchTerm && !selectedRole && (
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First User
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {paginatedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header with Name and Actions */}
                      <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-100">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-base mb-1 truncate">
                              {user.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                              <p className="text-xs truncate">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                              <p className="text-xs">{user.phone}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDialog(user)}
                            className="h-9 w-9 p-0 hover:bg-blue-50 hover:text-blue-600"
                            title="Edit user"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id)}
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                            <p className="text-xs font-medium text-slate-500">Role</p>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Building className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs font-medium text-slate-500">Branch</p>
                          </div>
                          <p className="text-sm text-slate-900 font-semibold truncate">
                            {user.branch_id ? (branchMap[user.branch_id] || user.branch_id) : "-"}
                          </p>
                        </div>
                        {user.role === "rider" && (
                          <div className="col-span-2 bg-white rounded-lg p-3 border border-slate-100">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium text-slate-500">Rider Status</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleRiderStatus(user)}
                                  disabled={toggleRiderStatusMutation.isPending}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1 h-auto ${getStatusStyles(user)} hover:opacity-90`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                                  {getStatusLabel(user)}
                                </Button>
                              </div>
                              <p className="text-xs text-slate-500">Tap status to change</p>
                            </div>
                          </div>
                        )}
                        <div className="col-span-2 bg-white rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            <p className="text-xs font-medium text-slate-500">Member Since</p>
                          </div>
                          <p className="text-sm text-slate-900 font-semibold">
                            {new Date(user.created_at).toLocaleDateString('en-US', {
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
                      User
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Phone
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Branch
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Joined
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {user.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{user.email}</td>
                      <td className="py-3 px-4 text-slate-600">{user.phone}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {user.branch_id ? (branchMap[user.branch_id] || user.branch_id) : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {user.role === "rider" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleRiderStatus(user)}
                            disabled={toggleRiderStatusMutation.isPending}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold h-auto ${getStatusStyles(user)} hover:opacity-90`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                            {getStatusLabel(user)}
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDialog(user)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            onClick={() => handleDeleteUser(user.id)}
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

      <AlertDialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.type === "toggle-rider"
                ? `${isUserActive(confirmDialog?.user) ? "Disable" : "Enable"} Rider`
                : "Delete User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === "toggle-rider"
                ? `Are you sure you want to ${isUserActive(confirmDialog?.user) ? "disable" : "enable"} rider ${confirmDialog?.user?.name}?`
                : `Are you sure you want to delete user ${confirmDialog?.user?.name}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDialogAction}
              className={confirmDialog?.type === "delete-user" ? "bg-red-600 hover:bg-red-700" : undefined}
            >
              {confirmDialog?.type === "toggle-rider"
                ? isUserActive(confirmDialog?.user)
                  ? "Disable Rider"
                  : "Enable Rider"
                : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}




