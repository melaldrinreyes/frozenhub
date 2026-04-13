import {
  Product,
  Inventory,
  User,
  Pricing,
  Sale,
} from "./mockData";

// Simulate localStorage/database with in-memory storage
// Note: This is a legacy data manager. In production, all data should be fetched from API endpoints.
class DataManager {
  private products: Product[] = [];
  private inventory: Inventory[] = [];
  private users: User[] = [];
  private pricing: Pricing[] = [];
  private sales: Sale[] = [];

  // Product operations
  getProducts() {
    return [...this.products];
  }

  getProductById(id: string) {
    return this.products.find((p) => p.id === id);
  }

  addProduct(product: Omit<Product, "id" | "createdAt">) {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      createdAt: new Date(),
    };
    this.products.push(newProduct);
    return newProduct;
  }

  updateProduct(id: string, updates: Partial<Product>) {
    const index = this.products.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.products[index] = { ...this.products[index], ...updates };
      return this.products[index];
    }
    return null;
  }

  deleteProduct(id: string) {
    this.products = this.products.filter((p) => p.id !== id);
  }

  // Inventory operations
  getInventory() {
    return [...this.inventory];
  }

  getInventoryByBranch(branchId: string) {
    return this.inventory.filter((i) => i.branchId === branchId);
  }

  updateInventory(id: string, quantity: number) {
    const index = this.inventory.findIndex((i) => i.id === id);
    if (index !== -1) {
      this.inventory[index] = {
        ...this.inventory[index],
        quantity,
        lastStockCheck: new Date(),
      };
      return this.inventory[index];
    }
    return null;
  }

  getLowStockItems() {
    return this.inventory.filter((i) => i.quantity <= i.reorderLevel);
  }

  // User operations
  getUsers() {
    return [...this.users];
  }

  getUserById(id: string) {
    return this.users.find((u) => u.id === id);
  }

  addUser(user: Omit<User, "id" | "createdAt">) {
    const newUser: User = {
      ...user,
      id: `user-${Date.now()}`,
      createdAt: new Date(),
    };
    this.users.push(newUser);
    return newUser;
  }

  updateUser(id: string, updates: Partial<User>) {
    const index = this.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...updates };
      return this.users[index];
    }
    return null;
  }

  deleteUser(id: string) {
    this.users = this.users.filter((u) => u.id !== id);
  }

  // Pricing operations
  getPricing() {
    return [...this.pricing];
  }

  getPricingByProduct(productId: string) {
    return this.pricing.find((p) => p.productId === productId);
  }

  addPricing(pricing: Omit<Pricing, "id">) {
    const newPricing: Pricing = {
      ...pricing,
      id: `price-${Date.now()}`,
    };
    this.pricing.push(newPricing);
    return newPricing;
  }

  updatePricing(id: string, updates: Partial<Pricing>) {
    const index = this.pricing.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.pricing[index] = { ...this.pricing[index], ...updates };
      return this.pricing[index];
    }
    return null;
  }

  // Sales operations
  getSales() {
    return [...this.sales];
  }

  getSalesByBranch(branchId: string) {
    return this.sales.filter((s) => s.branchId === branchId);
  }

  addSale(sale: Omit<Sale, "id">) {
    const newSale: Sale = {
      ...sale,
      id: `sale-${Date.now()}`,
    };
    this.sales.push(newSale);
    return newSale;
  }

  getSalesStats(startDate: Date, endDate: Date) {
    const filteredSales = this.sales.filter(
      (s) => s.date >= startDate && s.date <= endDate,
    );

    const totalSales = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalOrders = filteredSales.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    return {
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalOrders,
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
    };
  }
}

// Export singleton instance
export const dataManager = new DataManager();

// Filtering and sorting utilities
export function filterBySearch<T extends { [key: string]: any }>(
  items: T[],
  searchTerm: string,
  searchFields: (keyof T)[],
): T[] {
  if (!searchTerm) return items;

  const lowerSearch = searchTerm.toLowerCase();
  return items.filter((item) =>
    searchFields.some((field) =>
      String(item[field]).toLowerCase().includes(lowerSearch),
    ),
  );
}

export function sortItems<T extends { [key: string]: any }>(
  items: T[],
  sortBy: keyof T,
  order: "asc" | "desc" = "asc",
): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

export function paginateItems(
  items: any[],
  page: number,
  pageSize: number,
): { items: any[]; totalPages: number; currentPage: number } {
  // Safety check: ensure items is an array
  if (!Array.isArray(items)) {
    console.error('paginateItems: items is not an array', items);
    return {
      items: [],
      totalPages: 0,
      currentPage: 1,
    };
  }

  const totalPages = Math.ceil(items.length / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    totalPages,
    currentPage: page,
  };
}
