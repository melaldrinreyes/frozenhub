// API Client with error handling and automatic credentials

const API_BASE = "/api";
const REQUEST_TIMEOUT_MS = 15000;
const JWT_TOKEN_KEY = "frozenhub_jwt_token";

// In development, suppress expected 401 errors from auth checks
const SUPPRESS_AUTH_ERRORS = import.meta.env.DEV;

interface ApiError {
  error: string;
  message?: string;
}

const DB_UNAVAILABLE_MESSAGE = "The database backend is not currently reachable.";

function isInfrastructureDbMessage(message: string) {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("database backend unavailable") ||
    normalized.includes("database backend is not currently reachable") ||
    normalized.includes("supabase direct db host resolved to ipv6") ||
    normalized.includes("cannot reach ipv6") ||
    normalized.includes("enotfound") ||
    normalized.includes("enetunreach") ||
    normalized.includes("econnrefused") ||
    normalized.includes("database is not currently reachable");
}

const FALLBACK_SETTING_MAP: Record<string, any> = {
  hero_banner: null,
  hero_title: { id: "hero_title", setting_key: "hero_title", setting_value: "Frozen Foods" },
  hero_subtitle: { id: "hero_subtitle", setting_key: "hero_subtitle", setting_value: "Premium" },
  hero_description: {
    id: "hero_description",
    setting_key: "hero_description",
    setting_value: "Quality frozen products delivered to your door. Browse our extensive catalog of meats, seafood, vegetables, and ready-to-eat meals.",
  },
  about_title: { id: "about_title", setting_key: "about_title", setting_value: "About Batangas Premium Bongabong" },
  about_description: {
    id: "about_description",
    setting_key: "about_description",
    setting_value: "At Batangas Premium Bongabong, we've been delivering premium quality frozen products to Filipino families and businesses since our establishment. Our commitment to excellence and customer satisfaction has made us a trusted name in the frozen foods industry.",
  },
  about_mission: {
    id: "about_mission",
    setting_key: "about_mission",
    setting_value: "To provide the highest quality frozen goods while ensuring food safety, sustainability, and exceptional customer service across all our branch locations.",
  },
  about_values: {
    id: "about_values",
    setting_key: "about_values",
    setting_value: "We believe in quality, freshness, and customer satisfaction. Every product meets our strict standards before reaching your table.",
  },
  company_name: { id: "company_name", setting_key: "company_name", setting_value: "Batangas Premium Bongabong" },
  company_logo: { id: "company_logo", setting_key: "company_logo", setting_value: null },
  featured_bg_type: { id: "featured_bg_type", setting_key: "featured_bg_type", setting_value: "color" },
  featured_bg_color: { id: "featured_bg_color", setting_key: "featured_bg_color", setting_value: "#f9fafb" },
  featured_bg_image: { id: "featured_bg_image", setting_key: "featured_bg_image", setting_value: null },
  promo_title: { id: "promo_title", setting_key: "promo_title", setting_value: "Special Holiday Sale!" },
  promo_subtitle: { id: "promo_subtitle", setting_key: "promo_subtitle", setting_value: "Limited Time Offer" },
  promo_description: { id: "promo_description", setting_key: "promo_description", setting_value: "Get up to 30% OFF on selected frozen products. Stock up now for the holidays!" },
  promo_button1_text: { id: "promo_button1_text", setting_key: "promo_button1_text", setting_value: "Shop Now" },
  promo_button1_link: { id: "promo_button1_link", setting_key: "promo_button1_link", setting_value: "#products" },
  promo_button2_text: { id: "promo_button2_text", setting_key: "promo_button2_text", setting_value: "View Deals" },
  promo_button2_link: { id: "promo_button2_link", setting_key: "promo_button2_link", setting_value: "#products" },
  promo_enabled: { id: "promo_enabled", setting_key: "promo_enabled", setting_value: true },
  promo_bg_color: { id: "promo_bg_color", setting_key: "promo_bg_color", setting_value: "#d97706" },
};

const FALLBACK_SETTING_KEYS = Object.keys(FALLBACK_SETTING_MAP);

function isDatabaseUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const statusCode = Number((error as any).status || 0);
  return statusCode === 503 || isInfrastructureDbMessage(error.message) || error.message === DB_UNAVAILABLE_MESSAGE;
}

function buildFallbackSettings() {
  return FALLBACK_SETTING_KEYS.map((key) => FALLBACK_SETTING_MAP[key]);
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    suppressAuthErrors = false
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Get JWT token from localStorage if available
    const token = typeof window !== "undefined" ? localStorage.getItem(JWT_TOKEN_KEY) : null;

    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include", // Ensure cookies/sessions are included
      signal: controller.signal,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        const rawErrorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        const errorMessage = isInfrastructureDbMessage(rawErrorMessage) ? DB_UNAVAILABLE_MESSAGE : rawErrorMessage;
        
        // Log unauthorized errors except suppressed auth-check calls
        if (response.status === 401 && !suppressAuthErrors) {
          console.error("❌ Unauthorized request:", {
            endpoint,
            options,
            response: errorData,
          });
        }

        // Silently handle 401 for auth check endpoint (don't throw, don't log)
        if (suppressAuthErrors && response.status === 401) {
          const error: any = new Error("Unauthorized");
          error.status = 401;
          return Promise.reject(error);
        }

        const error: any = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        const timeoutError: any = new Error("Request timed out. Please try again.");
        timeoutError.status = 408;
        throw timeoutError;
      }
      if (!isDatabaseUnavailable(error)) {
        console.error("❌ API Request failed:", { endpoint, error });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.request<{ user: any; token?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    
    // Save JWT token for subsequent requests
    if (response.token && typeof window !== "undefined") {
      localStorage.setItem(JWT_TOKEN_KEY, response.token);
    }
    
    return response;
  }

  async signup(name: string, email: string, phone: string, password: string) {
    const response = await this.request<{ user: any; token?: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, password }),
    });
    
    // Save JWT token for subsequent requests
    if (response.token && typeof window !== "undefined") {
      localStorage.setItem(JWT_TOKEN_KEY, response.token);
    }
    
    return response;
  }

  async logout() {
    // Clear JWT token from localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem(JWT_TOKEN_KEY);
    }
    
    return this.request<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  }

  async getMe() {
    try {
      return await this.request<{ user: any }>("/auth/me", {}, true); // Suppress 401 errors
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return { user: null } as any;
      }
      throw error;
    }
  }

  async exchangeSupabaseSession(accessToken: string) {
    const response = await this.request<{ user: any; token?: string; message: string }>("/auth/supabase-callback", {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    });

    if (response.token && typeof window !== "undefined") {
      localStorage.setItem(JWT_TOKEN_KEY, response.token);
    }

    return response;
  }

  // System Stats
  async getSystemStats() {
    try {
      return await this.request<{ 
        stats: {
          products: { total: number; active: number };
          branches: { total: number; active: number };
          sales: { total: number; revenue: number };
          customers: number;
          support: string;
        }
      }>("/stats/system");
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return {
          stats: {
            products: { total: 0, active: 0 },
            branches: { total: 0, active: 0 },
            sales: { total: 0, revenue: 0 },
            customers: 0,
            support: "24/7",
          },
        };
      }
      throw error;
    }
  }

  // Products
  async getProducts() {
    try {
      return await this.request<{ products: any[] }>("/products");
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return { products: [] };
      }
      throw error;
    }
  }

  async getProduct(id: string) {
    return this.request<{ product: any }>(`/products/${id}`);
  }

  async createProduct(data: any) {
    return this.request<{ product: any; message?: string; generatedSKU?: string }>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<{ product: any }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request<{ message: string }>(`/products/${id}`, {
      method: "DELETE",
    });
  }

  async getProductByBarcode(barcode: string) {
    return this.request<{ product: any }>(`/api/products?barcode=${barcode}`);
  }

  // Inventory
  async getInventory(branchId?: string) {
    const query = branchId ? `?branchId=${branchId}` : "";
    return this.request<{ inventory: any[] }>(`/inventory${query}`);
  }

  async getLowStock() {
    return this.request<{ inventory: any[] }>("/inventory/low-stock");
  }

  async addInventory(data: any) {
    return this.request<{ inventory: any }>("/inventory", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateInventory(id: string, data: any) {
    return this.request<{ inventory: any }>(`/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteInventory(id: string) {
    return this.request<{ message: string }>(`/inventory/${id}`, {
      method: "DELETE",
    });
  }

  async transferStock(data: { from_branch_id: string; to_branch_id: string; product_id: string; quantity: number; reason?: string; password?: string }) {
    return this.request<{ message: string; transfer: any }>("/inventory/transfer", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTransferLogs(filters?: { branchId?: string; productId?: string; startDate?: string; endDate?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.branchId) params.append("branchId", filters.branchId);
    if (filters?.productId) params.append("productId", filters.productId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.limit) params.append("limit", filters.limit.toString());
    
    const query = params.toString();
    return this.request<{ logs: any[]; count: number }>(`/inventory/transfer-logs${query ? `?${query}` : ""}`);
  }

  async getActivityLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    branchId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.action) params.append("action", filters.action);
    if (filters?.entityType) params.append("entityType", filters.entityType);
    if (filters?.branchId) params.append("branchId", filters.branchId);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());
    const query = params.toString();
    return this.request<{ logs: any[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/activity-logs${query ? `?${query}` : ""}`);
  }

  async getActivityStats(filters?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.branchId) params.append("branchId", filters.branchId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    const query = params.toString();
    return this.request<{ totalLogs: number; byAction: Record<string, number>; byEntityType: Record<string, number> }>(`/activity-logs/stats${query ? `?${query}` : ""}`);
  }

  async getRecentActivity(filters?: { branchId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.branchId) params.append("branchId", filters.branchId);
    if (filters?.limit) params.append("limit", filters.limit.toString());
    const query = params.toString();
    return this.request<{ logs: any[] }>(`/activity-logs/recent${query ? `?${query}` : ""}`);
  }

  async getProductAvailability(productId: string) {
    return this.request<{ 
      product_id: string;
      product_name: string;
      price: number;
      image: string;
      total_quantity: number;
      branches_in_stock: number;
      branches_low_stock: number;
      total_branches: number;
      inventory: any[];
    }>(`/inventory/product/${productId}`);
  }

  // Branches
  async getBranches() {
    return this.request<{ branches: any[] }>("/branches");
  }

  async createBranch(data: any) {
    return this.request<{ branch: any }>("/branches", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBranch(id: string, data: any) {
    return this.request<{ branch: any }>(`/branches/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBranch(id: string) {
    return this.request<{ message: string }>(`/branches/${id}`, {
      method: "DELETE",
    });
  }

  // Users
  async getUsers(filters?: { role?: string; branchId?: string }) {
    const params = new URLSearchParams();
    if (filters?.role) params.append("role", filters.role);
    if (filters?.branchId) params.append("branchId", filters.branchId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ users: any[] }>(`/users${query}`);
  }

  async createUser(data: any) {
    return this.request<{ user: any }>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: any) {
    return this.request<{ user: any }>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string) {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: "DELETE",
    });
  }

  async assignRiderBranch(riderId: string, branchId: string) {
    return this.request<{ user: any; message: string }>(`/riders/${riderId}/branch`, {
      method: "PATCH",
      body: JSON.stringify({ branchId }),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>("/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async getCustomerProfile() {
    return this.request<{
      user: any;
      authMethods: {
        googleLinked: boolean;
        passwordEnabled: boolean;
      };
    }>("/customer/profile");
  }

  async updateCustomerProfile(data: { name: string; phone: string }) {
    return this.request<{ user: any; message: string }>("/customer/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Sales
  async getSales(branchId?: string, startDate?: string, endDate?: string, page?: number, limit?: number, status?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (page) params.append("page", page.toString());
    if (limit) params.append("limit", limit.toString());
    if (status) params.append("status", status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ sales: any[]; pagination: any }>(`/sales${query}`);
  }

  async getSalesStats(branchId?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ 
      totalSales: number; 
      totalRevenue: number; 
      avgOrderValue: number;
      totalPurchases: number;
      totalExpenses: number;
      avgPurchaseValue: number;
      totalProfit: number;
      profitMargin: number;
      topProducts?: any[];
      branchBreakdown?: any[];
    }>(`/sales/stats${query}`);
  }

  async getSalesTrend(branchId?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append("branchId", branchId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<{ 
      trend: any[]; 
      totals?: {
        totalSales: number;
        totalPurchases: number;
        totalProfit: number;
        totalTransactions: number;
      }
    }>(`/sales/trend${query}`);
  }

  async createSale(data: any) {
    return this.request<{ sale: any }>("/sales", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSaleItems(saleId: string) {
    return this.request<{ items: any[] }>(`/sales/${saleId}/items`);
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request<{ message: string; status: string }>(`/sales/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async assignRider(orderId: string, riderId: string) {
    return this.request<{ message: string; rider: { id: string; name: string } }>(`/sales/${orderId}/assign-rider`, {
      method: "PATCH",
      body: JSON.stringify({ riderId }),
    });
  }

  async getRiderDeliveryHistory() {
    return this.request<{ history: any[] }>("/rider/delivery-history");
  }

  // Pricing
  async getPricing() {
    return this.request<{ pricing: any[] }>("/pricing");
  }

  async createPricing(data: any) {
    return this.request<{ message: string; id: string }>("/pricing", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePricing(id: string, data: any) {
    return this.request<{ message: string }>(`/pricing/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deletePricing(id: string) {
    return this.request<{ message: string }>(`/pricing/${id}`, {
      method: "DELETE",
    });
  }

  // Categories
  async getCategories() {
    try {
      return await this.request<{ categories: any[] }>("/categories");
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return { categories: [] };
      }
      throw error;
    }
  }

  async createCategory(data: any) {
    return this.request<{ category: any }>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: any) {
    return this.request<{ category: any }>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string) {
    return this.request<{ message: string }>(`/categories/${id}`, {
      method: "DELETE",
    });
  }

  // Upload
  async uploadProductImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/upload/product-image", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(errorData.error || "Upload failed");
    }

    return await response.json() as { imagePath: string; message: string };
  }

  async deleteProductImage(imagePath: string) {
    return this.request<{ message: string }>("/upload/product-image", {
      method: "DELETE",
      body: JSON.stringify({ imagePath }),
    });
  }

  // Settings
  async getSettings() {
    try {
      return await this.request<{ settings: any[] }>("/settings");
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return { settings: buildFallbackSettings() };
      }
      throw error;
    }
  }

  async getSetting(key: string) {
    try {
      return await this.request<{ setting: any }>(`/settings/${key}`);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return { setting: FALLBACK_SETTING_MAP[key] ?? { id: key, setting_key: key, setting_value: null } };
      }
      throw error;
    }
  }

  // Get multiple settings by keys efficiently
  async getSettingsByKeys(keys: string[]) {
    const settings = await this.getSettings();
    const settingsMap: Record<string, any> = {};
    
    settings.settings.forEach((setting: any) => {
      if (keys.includes(setting.setting_key)) {
        settingsMap[setting.setting_key] = setting;
      }
    });
    
    // Fill in missing keys with null
    keys.forEach(key => {
      if (!settingsMap[key]) {
        settingsMap[key] = null;
      }
    });
    
    return settingsMap;
  }

  async updateSetting(key: string, value: string) {
    return this.request<{ setting: any; message: string }>(`/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  }

  async deleteSetting(key: string) {
    return this.request<{ message: string }>(`/settings/${key}`, {
      method: "DELETE",
    });
  }

  // Banner Upload
  async uploadBanner(file: File) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/upload/banner", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(errorData.error || "Upload failed");
    }

    return await response.json() as { imagePath: string; message: string };
  }

  async deleteBanner(imagePath: string) {
    return this.request<{ message: string }>("/upload/banner", {
      method: "DELETE",
      body: JSON.stringify({ imagePath }),
    });
  }

  // Promos
  async getActivePromos() {
    try {
      return await this.request<{ promos: any[] }>("/promos/active");
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return { promos: [] };
      }
      throw error;
    }
  }

  async getPromos() {
    return this.request<{ promos: any[] }>("/promos");
  }

  async getPromo(id: string) {
    return this.request<{ promo: any }>(`/promos/${id}`);
  }

  async createPromo(data: any) {
    return this.request<{ promo: any; message: string }>("/promos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePromo(id: string, data: any) {
    return this.request<{ promo: any; message: string }>(`/promos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deletePromo(id: string) {
    return this.request<{ message: string }>(`/promos/${id}`, {
      method: "DELETE",
    });
  }

  async bulkUpdatePromos(promoIds: string[], active: boolean) {
    return this.request<{ message: string; affected: number }>("/promos/bulk", {
      method: "POST",
      body: JSON.stringify({ promo_ids: promoIds, active }),
    });
  }

  async getPromoAnalytics(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return this.request<{ 
      overview: any; 
      topPromos: any[]; 
      dailyUsage: any[] 
    }>(`/promos/analytics?${params.toString()}`);
  }

  async getProductPromos(productId: string) {
    return this.request<{ promos: any[] }>(`/products/${productId}/promos`);
  }

  // Cart methods
  async getCart() {
    return this.request<{ cartId: string; items: Array<{ cartItemId: string; product: any; quantity: number }> }>("/cart");
  }

  async addToCart(productId: string, quantity = 1) {
    return this.request<{ success: boolean; message: string; productName: string }>("/cart", {
      method: "POST",
      body: JSON.stringify({ productId, quantity }),
    });
  }

  async updateCartItem(cartItemId: string, quantity: number) {
    return this.request<{ success: boolean; message: string }>(`/cart/${cartItemId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    });
  }

  async removeFromCart(cartItemId: string) {
    return this.request<{ success: boolean; message: string }>(`/cart/${cartItemId}`, {
      method: "DELETE",
    });
  }

  async clearCart() {
    return this.request<{ success: boolean; message: string }>("/cart", {
      method: "DELETE",
    });
  }

  async syncCart(items: Array<{ id: string; quantity: number }>) {
    return this.request<{ success: boolean; message: string }>("/cart/sync", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  }
}

export const apiClient = new ApiClient();

