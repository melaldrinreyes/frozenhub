import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { initializeDatabase, seedDatabase } from "./db";
import { loadUser, requireAuth, requireRole } from "./middleware/auth";
import { jwtMiddleware } from "./middleware/jwt";
import {
  helmetConfig,
  loginRateLimiter,
  signupRateLimiter,
  apiRateLimiter,
  publicRateLimiter,
  strictRateLimiter,
  hppProtection,
  sanitizeInput,
  securityLogger,
  preventTimingAttacks,
} from "./middleware/security";
import {
  sessionFingerprinting,
  trackSessionActivity,
  checkSessionTimeout,
  limitConcurrentSessions,
} from "./middleware/sessionSecurity";

// Import route handlers
import { handleDemo } from "./routes/demo";
import { 
  handleLogin, 
  handleSignup, 
  handleLogout, 
  handleGetMe,
} from "./routes/auth";
import {
  handleGetProducts,
  handleGetProduct,
  handleCreateProduct,
  handleUpdateProduct,
  handleDeleteProduct,
} from "./routes/products";
import {
  handleGetInventory,
  handleGetLowStock,
  handleUpdateInventory,
  handleAddInventory,
  handleDeleteInventory,
  handleStockTransfer,
  handleGetProductAvailability,
  handleGetTransferLogs,
  handleCleanupDuplicates,
} from "./routes/inventory";
import {
  handleGetBranches,
  handleGetUsers,
  handleCreateUser,
  handleUpdateUser,
  handleDeleteUser,
  handleCreateBranch,
  handleUpdateBranch,
  handleDeleteBranch,
  handleChangePassword,
} from "./routes/admin";
import {
  handleGetSales,
  handleGetSalesStats,
  handleGetSalesTrend,
  handleCreateSale,
  handleCreateCustomerOrder,
  handleGetPricing,
  handleCreatePricing,
  handleUpdatePricing,
  handleDeletePricing,
  handleUpdateOrderStatus,
  handleGetSaleItems,
  handleGetCustomerOrders,
  handleCancelCustomerOrder,
} from "./routes/sales";
import { handleGetSystemStats } from "./routes/stats";
import {
  handleGetPurchases,
  handleGetPurchase,
  handleCreatePurchase,
  handleUpdatePurchase,
  handleDeletePurchase,
  handleGetPurchaseStats,
  handleGetPurchaseTrend,
  handleGetSuppliers,
  handleCreateSupplier,
} from "./routes/purchases";
import {
  handleGetCategories,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
} from "./routes/categories";
import {
  handleGetSettings,
  handleGetSetting,
  handleUpdateSetting,
  handleDeleteSetting,
} from "./routes/settings";
import {
  upload,
  uploadBanner,
  handleUploadProductImage,
  handleDeleteProductImage,
  handleUploadBanner,
  handleDeleteBanner,
} from "./routes/upload";
import {
  getActivePromos,
  getPromos,
  getPromo,
  createPromo,
  updatePromo,
  deletePromo,
  getProductPromos,
  getPromoAnalytics,
  bulkUpdatePromos,
} from "./routes/promos";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  syncCart,
} from "./routes/cart";
import {
  handleGetActivityLogs,
  handleGetActivityStats,
  handleGetRecentActivity,
} from "./routes/activity-logs";
import {
  handleLoginMySQL,
  handleSignupMySQL,
  handleGetProductsMySQL,
  handleGetProductMySQL,
  handleGetBranchesMySQL,
  handleGetInventoryMySQL,
  handleGetTransferLogsMySQL,
  handleGetSalesMySQL,
  handleGetRiderDeliveryHistoryMySQL,
  handleGetSalesStatsMySQL,
  handleGetSalesTrendMySQL,
  handleGetPricingMySQL,
  handleCreatePricingMySQL,
  handleUpdatePricingMySQL,
  handleDeletePricingMySQL,
  getPromosMySQL,
  getPromoMySQL,
  createPromoMySQL,
  updatePromoMySQL,
  deletePromoMySQL,
  bulkUpdatePromosMySQL,
  getPromoAnalyticsMySQL,
  handleCreateSaleMySQL,
  handleGetCategoriesMySQL,
  handleGetSettingsMySQL,
  handleGetSettingMySQL,
  handleGetSystemStatsMySQL,
  getActivePromosMySQL,
  getProductPromosMySQL,
} from "./routes/mysql-core";
import {
  handleCreateProductMySQL,
  handleUpdateProductMySQL,
  handleDeleteProductMySQL,
  handleGetLowStockMySQL,
  handleCleanupDuplicatesMySQL,
  handleAddInventoryMySQL,
  handleUpdateInventoryMySQL,
  handleDeleteInventoryMySQL,
  handleStockTransferMySQL,
  handleGetProductAvailabilityMySQL,
  handleCreateBranchMySQL,
  handleUpdateBranchMySQL,
  handleDeleteBranchMySQL,
  handleGetUsersMySQL,
  handleCreateUserMySQL,
  handleUpdateUserMySQL,
  handleAssignRiderBranchMySQL,
  handleDeleteUserMySQL,
  handleChangePasswordMySQL,
  handleGetSaleItemsMySQL,
  handleUpdateOrderStatusMySQL,
  handleAssignRiderMySQL,
  handleCreateCustomerOrderMySQL,
  handleGetCustomerOrdersMySQL,
  handleCancelCustomerOrderMySQL,
  handleGetPurchasesMySQL,
  handleGetPurchaseMySQL,
  handleCreatePurchaseMySQL,
  handleUpdatePurchaseMySQL,
  handleDeletePurchaseMySQL,
  handleGetPurchaseStatsMySQL,
  handleGetPurchaseTrendMySQL,
  handleGetSuppliersMySQL,
  handleCreateSupplierMySQL,
  handleCreateCategoryMySQL,
  handleUpdateCategoryMySQL,
  handleDeleteCategoryMySQL,
  handleUpdateSettingMySQL,
  handleDeleteSettingMySQL,
} from "./routes/mysql-mutations";

let dbInitialized = false;
let dbInitializing = false;
let dbInitPromise: Promise<void> | null = null;
let runtimeDataProvider: "supabase" | "none" = getDataProvider();
let dbInitErrorMessage: string | null = null;
let dbInitLastFailureAt = 0;
const DB_INIT_RETRY_COOLDOWN_MS = 15000;

function getDataProvider(): "supabase" | "none" {
  const provider = (process.env.DATA_PROVIDER || "supabase").toLowerCase();
  if (provider === "none") return "none";
  return "supabase";
}

async function ensureDatabaseInitialized() {
  if (dbInitialized) return;

  const now = Date.now();
  if (!dbInitializing && dbInitLastFailureAt > 0 && now - dbInitLastFailureAt < DB_INIT_RETRY_COOLDOWN_MS) {
    return;
  }
  
  // If initialization is in progress, wait for it
  if (dbInitializing && dbInitPromise) {
    await dbInitPromise;
    return;
  }

  dbInitializing = true;
  
  // Initialize database
  dbInitPromise = (async () => {
    try {
      runtimeDataProvider = getDataProvider();
      dbInitErrorMessage = null;

      // Only create data directory if not in serverless environment
      const isServerless = process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;
      if (!isServerless) {
        const dataDir = path.join(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
      }

      if (runtimeDataProvider === "none") {
        console.log("✓ Running with DATA_PROVIDER=none (API data endpoints disabled)");
        dbInitialized = true;
      } else {
        await initializeDatabase();
        await seedDatabase();
        console.log("✓ Supabase/Postgres initialized successfully");
        dbInitialized = true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isConnectionRefused =
        error instanceof Error &&
        ["ECONNREFUSED", "ENOTFOUND", "ENETUNREACH", "ETIMEDOUT", "EAI_AGAIN"].includes(String((error as any).code || ""));
      const isDnsOrNetworkFailure =
        error instanceof Error &&
        (["ENOTFOUND", "ENETUNREACH", "ETIMEDOUT", "EAI_AGAIN"].includes(String((error as any).code || "")) ||
          errorMessage.includes("cannot reach ipv6") ||
          errorMessage.includes("supabase direct db host resolved to ipv6"));

      if ((isConnectionRefused || isDnsOrNetworkFailure) && process.env.NODE_ENV !== "production") {
        console.warn("⚠ Supabase/Postgres is not reachable; running in degraded mode");
        dbInitialized = false;
      } else {
        console.error("Error initializing data provider:", error);
        console.warn("⚠ Database initialization failed; keeping runtime in retry mode");
      }

      dbInitErrorMessage = error instanceof Error ? error.message : String(error);
      dbInitializing = false;
      dbInitLastFailureAt = Date.now();
    }
  })();

  await dbInitPromise;
}

export function createServer() {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxies (e.g., Netlify, Vercel)
  app.set("trust proxy", 1);

  // Security Headers
  app.use(helmetConfig);

  // CORS Configuration
  app.use(cors({
    origin: process.env.NODE_ENV === "production" 
      ? process.env.ALLOWED_ORIGINS?.split(",") || true
      : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // Body parsing with size limits
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // HTTP Parameter Pollution protection
  app.use(hppProtection);

  // Input sanitization
  app.use(sanitizeInput);

  // Security logging
  app.use(securityLogger);
  
  // Session middleware with enhanced security
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "frozenhub-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      name: "sessionId", // Hide default connect.sid name
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        path: "/",
      },
      rolling: true, // Reset expiration on activity
    })
  );

  // Load user from session
  app.use(loadUser);

  // Session security middleware
  app.use(trackSessionActivity);
  app.use(checkSessionTimeout);
  app.use(sessionFingerprinting);
  app.use(limitConcurrentSessions);

  // JWT middleware for stateless auth (serverless compatible)
  app.use(jwtMiddleware);

  // Serve uploaded files statically
  // Use /tmp in serverless, public/uploads locally
  const isServerless = process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;
  const uploadsPath = isServerless 
    ? "/tmp/uploads" 
    : path.join(process.cwd(), "public", "uploads");
  
  // Only create directory if not in serverless (read-only filesystem)
  if (!isServerless && !fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  
  app.use("/uploads", express.static(uploadsPath));
  
  // Debug endpoint for environment/config
  app.get("/api/debug/env", (_req, res) => {
    const allowDemoLogin = String(process.env.ALLOW_DEMO_LOGIN || "").trim().toLowerCase() === "true";
    res.json({
      dataProvider: runtimeDataProvider,
      nodeEnv: process.env.NODE_ENV,
      isNetlify: !!process.env.NETLIFY,
      isServerless: !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL),
      allowDemoLogin,
    });
  });

  // Health check (no rate limiting, no DB requirement)
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong";
    res.json({ message: ping, dataProvider: runtimeDataProvider });
  });
  
  // Initialize selected data provider on first request
  app.use(async (req, res, next) => {
    try {
      await ensureDatabaseInitialized();
      const isLoginEndpoint = req.path === "/api/auth/login";
      const isUploadEndpoint = req.path === "/api/upload/banner" || req.path === "/api/upload/product-image";
      const isSettingsMutationEndpoint = req.path.startsWith("/api/settings/") && (req.method === "PUT" || req.method === "DELETE");
      const isBranchMutationEndpoint = req.path.startsWith("/api/branches") && ["POST", "PUT", "DELETE"].includes(req.method);

      if (!dbInitialized && runtimeDataProvider === "supabase" && req.method !== "GET" && req.path.startsWith("/api/") && req.path !== "/api/ping" && !isLoginEndpoint && !isUploadEndpoint && !isSettingsMutationEndpoint && !isBranchMutationEndpoint) {
        res.status(503).json({
          error: "Database backend unavailable",
          message: "The database backend is not currently reachable.",
        });
        return;
      }

      if (runtimeDataProvider === "none" && req.method !== "GET" && req.path.startsWith("/api/") && req.path !== "/api/ping") {
        res.status(503).json({
          error: "API endpoints are disabled",
          message: "This project is running with DATA_PROVIDER=none. No database backend is initialized.",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Data provider initialization error:", error);
      res.status(500).json({ error: "Data provider initialization failed" });
    }
  });

  // System stats (public access with lenient rate limit)
  app.get("/api/stats/system", publicRateLimiter, runtimeDataProvider === "supabase" ? handleGetSystemStatsMySQL : handleGetSystemStats);

  // Demo endpoint (with rate limiting)
  app.get("/api/demo", apiRateLimiter, handleDemo);

  // Auth routes with specific rate limiters and timing attack prevention
  app.post("/api/auth/login", loginRateLimiter, preventTimingAttacks, runtimeDataProvider === "supabase" ? handleLoginMySQL : handleLogin);
  app.post("/api/auth/signup", signupRateLimiter, preventTimingAttacks, runtimeDataProvider === "supabase" ? handleSignupMySQL : handleSignup);
  app.post("/api/auth/logout", handleLogout);
  app.get("/api/auth/me", handleGetMe);
  
  // Product routes (public read access with lenient rate limit)
  app.get("/api/products", publicRateLimiter, runtimeDataProvider === "supabase" ? handleGetProductsMySQL : handleGetProducts);
  app.get("/api/products/:id", publicRateLimiter, runtimeDataProvider === "supabase" ? handleGetProductMySQL : handleGetProduct);
  app.post("/api/products", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleCreateProductMySQL : handleCreateProduct);
  app.put("/api/products/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleUpdateProductMySQL : handleUpdateProduct);
  app.delete("/api/products/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeleteProductMySQL : handleDeleteProduct);

  // Inventory routes
  app.get("/api/inventory", requireAuth, apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetInventoryMySQL : handleGetInventory);
  app.get("/api/inventory/low-stock", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetLowStockMySQL : handleGetLowStock);
  app.post("/api/inventory/cleanup-duplicates", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleCleanupDuplicatesMySQL : handleCleanupDuplicates);
  app.post("/api/inventory", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleAddInventoryMySQL : handleAddInventory);
  app.put("/api/inventory/:id", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleUpdateInventoryMySQL : handleUpdateInventory);
  app.delete("/api/inventory/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeleteInventoryMySQL : handleDeleteInventory);
  app.post("/api/inventory/transfer", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleStockTransferMySQL : handleStockTransfer);
  app.get("/api/inventory/transfer-logs", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetTransferLogsMySQL : handleGetTransferLogs);
  app.get("/api/inventory/product/:productId", requireAuth, apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetProductAvailabilityMySQL : handleGetProductAvailability);

  // Branch & User management routes (admin only with strict limits)
  app.get("/api/branches", requireAuth, apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetBranchesMySQL : handleGetBranches);
  app.post("/api/branches", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleCreateBranchMySQL : handleCreateBranch);
  app.put("/api/branches/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleUpdateBranchMySQL : handleUpdateBranch);
  app.delete("/api/branches/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeleteBranchMySQL : handleDeleteBranch);
  app.get("/api/users", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetUsersMySQL : handleGetUsers);
  app.post("/api/users", requireAuth, requireRole("admin", "branch_admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleCreateUserMySQL : handleCreateUser);
  app.put("/api/users/:id", requireAuth, requireRole("admin", "branch_admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleUpdateUserMySQL : handleUpdateUser);
  app.patch("/api/riders/:id/branch", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleAssignRiderBranchMySQL : handleUpdateUser);
  app.delete("/api/users/:id", requireAuth, requireRole("admin", "branch_admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeleteUserMySQL : handleDeleteUser);
  app.post("/api/change-password", requireAuth, strictRateLimiter, runtimeDataProvider === "supabase" ? handleChangePasswordMySQL : handleChangePassword);

  // Sales routes
  app.get("/api/sales", requireAuth, requireRole("admin", "branch_admin", "pos_operator", "rider"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetSalesMySQL : handleGetSales);
  app.get("/api/rider/delivery-history", requireAuth, requireRole("rider"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetRiderDeliveryHistoryMySQL : handleGetSales);
  app.get("/api/sales/stats", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetSalesStatsMySQL : handleGetSalesStats);
  app.get("/api/sales/trend", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetSalesTrendMySQL : handleGetSalesTrend);
  app.get("/api/sales/:id/items", requireAuth, requireRole("admin", "branch_admin", "customer", "rider"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetSaleItemsMySQL : handleGetSaleItems);
  app.patch("/api/sales/:id/status", requireAuth, requireRole("admin", "branch_admin", "rider"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleUpdateOrderStatusMySQL : handleUpdateOrderStatus);
  app.patch("/api/sales/:id/assign-rider", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleAssignRiderMySQL : handleUpdateOrderStatus);
  app.post("/api/sales", requireAuth, requireRole("admin", "branch_admin", "pos_operator"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleCreateSaleMySQL : handleCreateSale);
  
  // Customer order route (public, no authentication required)
  app.post("/api/customer/order", apiRateLimiter, runtimeDataProvider === "supabase" ? handleCreateCustomerOrderMySQL : handleCreateCustomerOrder);
  app.get("/api/customer/orders", apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetCustomerOrdersMySQL : handleGetCustomerOrders);
  app.post("/api/customer/orders/:orderId/cancel", apiRateLimiter, runtimeDataProvider === "supabase" ? handleCancelCustomerOrderMySQL : handleCancelCustomerOrder);

  // Pricing routes
  app.get("/api/pricing", requireAuth, requireRole("admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetPricingMySQL : handleGetPricing);
  app.post("/api/pricing", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleCreatePricingMySQL : handleCreatePricing);
  app.put("/api/pricing/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleUpdatePricingMySQL : handleUpdatePricing);
  app.delete("/api/pricing/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeletePricingMySQL : handleDeletePricing);

  // Purchase routes (receiving inventory from suppliers)
  app.get("/api/purchases", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetPurchasesMySQL : handleGetPurchases);
  app.get("/api/purchases/stats", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetPurchaseStatsMySQL : handleGetPurchaseStats);
  app.get("/api/purchases/trend", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetPurchaseTrendMySQL : handleGetPurchaseTrend);
  app.get("/api/purchases/:id", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetPurchaseMySQL : handleGetPurchase);
  app.post("/api/purchases", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleCreatePurchaseMySQL : handleCreatePurchase);
  app.put("/api/purchases/:id", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleUpdatePurchaseMySQL : handleUpdatePurchase);
  app.delete("/api/purchases/:id", requireAuth, requireRole("admin", "branch_admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeletePurchaseMySQL : handleDeletePurchase);
  
  // Supplier routes
  app.get("/api/suppliers", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? handleGetSuppliersMySQL : handleGetSuppliers);
  app.post("/api/suppliers", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleCreateSupplierMySQL : handleCreateSupplier);

  // Category routes (public read access with lenient rate limit)
  app.get("/api/categories", publicRateLimiter, runtimeDataProvider === "supabase" ? handleGetCategoriesMySQL : handleGetCategories);
  app.post("/api/categories", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleCreateCategoryMySQL : handleCreateCategory);
  app.put("/api/categories/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleUpdateCategoryMySQL : handleUpdateCategory);
  app.delete("/api/categories/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeleteCategoryMySQL : handleDeleteCategory);

  // Settings routes (public read access with lenient rate limit)
  app.get("/api/settings", publicRateLimiter, runtimeDataProvider === "supabase" ? handleGetSettingsMySQL : handleGetSettings);
  app.get("/api/settings/:key", publicRateLimiter, runtimeDataProvider === "supabase" ? handleGetSettingMySQL : handleGetSetting);
  app.put("/api/settings/:key", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleUpdateSettingMySQL : handleUpdateSetting);
  app.delete("/api/settings/:key", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? handleDeleteSettingMySQL : handleDeleteSetting);

  // Upload routes (strict rate limiting for file uploads)
  app.post("/api/upload/product-image", requireAuth, requireRole("admin"), strictRateLimiter, upload.single("image"), handleUploadProductImage);
  app.delete("/api/upload/product-image", requireAuth, requireRole("admin"), strictRateLimiter, handleDeleteProductImage);
  app.post("/api/upload/banner", requireAuth, requireRole("admin"), strictRateLimiter, uploadBanner.single("image"), handleUploadBanner);
  app.delete("/api/upload/banner", requireAuth, requireRole("admin"), strictRateLimiter, handleDeleteBanner);

  // Promo routes (active promos is public, others admin only)
  app.get("/api/promos/active", publicRateLimiter, runtimeDataProvider === "supabase" ? getActivePromosMySQL : getActivePromos);
  app.get("/api/promos/analytics", requireAuth, requireRole("admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? getPromoAnalyticsMySQL : getPromoAnalytics);
  app.get("/api/promos", requireAuth, requireRole("admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? getPromosMySQL : getPromos);
  app.get("/api/promos/:id", requireAuth, requireRole("admin"), apiRateLimiter, runtimeDataProvider === "supabase" ? getPromoMySQL : getPromo);
  app.post("/api/promos", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? createPromoMySQL : createPromo);
  app.put("/api/promos/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? updatePromoMySQL : updatePromo);
  app.post("/api/promos/bulk", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? bulkUpdatePromosMySQL : bulkUpdatePromos);
  app.delete("/api/promos/:id", requireAuth, requireRole("admin"), strictRateLimiter, runtimeDataProvider === "supabase" ? deletePromoMySQL : deletePromo);
  app.get("/api/products/:productId/promos", publicRateLimiter, runtimeDataProvider === "supabase" ? getProductPromosMySQL : getProductPromos);

  // Cart routes (customers only)
  app.get("/api/cart", requireAuth, requireRole("customer"), apiRateLimiter, getCart);
  app.post("/api/cart", requireAuth, requireRole("customer"), apiRateLimiter, addToCart);
  app.put("/api/cart/:cartItemId", requireAuth, requireRole("customer"), apiRateLimiter, updateCartItem);
  app.delete("/api/cart/:cartItemId", requireAuth, requireRole("customer"), apiRateLimiter, removeFromCart);
  app.delete("/api/cart", requireAuth, requireRole("customer"), apiRateLimiter, clearCart);
  app.post("/api/cart/sync", requireAuth, requireRole("customer"), apiRateLimiter, syncCart);

  // Activity log routes (admin and branch_admin only)
  app.get("/api/activity-logs", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, handleGetActivityLogs);
  app.get("/api/activity-logs/stats", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, handleGetActivityStats);
  app.get("/api/activity-logs/recent", requireAuth, requireRole("admin", "branch_admin"), apiRateLimiter, handleGetRecentActivity);

  // Serve static files in production only (not in serverless)
  // Note: isServerless is already defined earlier in the function
  if (process.env.NODE_ENV === "production" && !isServerless) {
    const distPath = path.join(process.cwd(), "dist/spa");
    
    // Serve static files
    app.use(express.static(distPath));

    // Handle React Router - serve index.html for all non-API routes
    app.get("*", (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/") || req.path.startsWith("/health")) {
        return res.status(404).json({ error: "Endpoint not found" });
      }

      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

