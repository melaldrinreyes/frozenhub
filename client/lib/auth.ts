export type UserRole =
  | "admin"
  | "branch_admin"
  | "pos_operator"
  | "customer"
  | "rider"
  | null;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branch?: string;
  createdAt: Date;
  password?: string; // Mock - in real app, never store plaintext
}

// Mock users database - In production, fetch from API
export const mockUsers: AuthUser[] = [];

// Authentication logic - In production, use API endpoints
export function authenticateUser(
  email: string,
  password: string,
): AuthUser | null {
  const user = mockUsers.find(
    (u) => u.email === email && u.password === password,
  );
  return user || null;
}

export function createCustomerAccount(
  name: string,
  email: string,
  phone: string,
  password: string,
): AuthUser | null {
  // Check if email already exists
  if (mockUsers.some((u) => u.email === email)) {
    return null; // Email already registered
  }

  const newUser: AuthUser = {
    id: `user-customer-${Date.now()}`,
    name,
    email,
    phone,
    role: "customer",
    createdAt: new Date(),
    password, // Mock - in real app, hash the password
  };

  mockUsers.push(newUser);
  return newUser;
}

export function getUserById(id: string): AuthUser | undefined {
  return mockUsers.find((u) => u.id === id);
}

export function getCustomersByBranch(branchName: string): AuthUser[] {
  return mockUsers.filter(
    (u) => u.role === "customer" && (u.branch === branchName || !u.branch),
  );
}

// Role-based access control
export const rolePermissions = {
  admin: [
    "view_dashboard",
    "manage_catalogs",
    "manage_pricing",
    "manage_inventory",
    "manage_users",
    "manage_branches",
    "manage_settings",
    "view_reports",
  ],
  branch_admin: [
    "view_dashboard",
    "view_products",
    "manage_inventory",
    "manage_pos",
    "view_sales",
    "manage_settings",
  ],
  pos_operator: ["view_pos", "manage_pos"],
  rider: ["view_orders", "manage_profile"],
  customer: ["view_shop", "view_orders", "manage_profile"],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  if (!role || role === null) return false;
  return (rolePermissions[role] as string[])?.includes(permission) ?? false;
}
