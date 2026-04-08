// Mock data for the CMS system

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
  cost: number;
  image: string;
  active: boolean;
  createdAt: Date;
}

export interface Inventory {
  id: string;
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  quantity: number;
  reorderLevel: number;
  lastStockCheck: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "system_admin" | "branch_admin" | "pos_operator";
  branch?: string;
  status: "active" | "inactive";
  createdAt: Date;
}

export interface Pricing {
  id: string;
  productId: string;
  productName: string;
  basePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  distributorPrice: number;
  markup: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface Sale {
  id: string;
  date: Date;
  branchId: string;
  branchName: string;
  totalAmount: number;
  itemsCount: number;
  paymentMethod: "cash" | "online";
  status: "completed" | "pending" | "cancelled";
  items: SaleItem[];
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  phone: string;
  manager: string;
  createdAt: Date;
}
