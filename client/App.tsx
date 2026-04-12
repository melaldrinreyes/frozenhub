import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/authContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LogoutConfirmHost from "@/components/LogoutConfirmHost";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import BranchDashboard from "./pages/BranchDashboard";
import AdminCatalogs from "./pages/AdminCatalogs";
import AdminPricing from "./pages/AdminPricing";
import AdminPromos from "./pages/AdminPromos";
import AdminInventory from "./pages/AdminInventory";
import AdminUsers from "./pages/AdminUsers";
import AdminSettings from "./pages/AdminSettings";
import AdminCMS from "./pages/AdminCMS";
import AdminTransferLogs from "./pages/AdminTransferLogs";
import AuditLogs from "./pages/AuditLogs";
import BranchProducts from "./pages/BranchProducts";
import BranchInventory from "./pages/BranchInventory";
import BranchSales from "./pages/BranchSales";
import BranchOnlineOrders from "./pages/BranchOnlineOrders";
import BranchSettings from "./pages/BranchSettings";
import BranchUsers from "./pages/BranchUsers";
import CustomerShop from "./pages/CustomerShop";
import CustomerCart from "./pages/CustomerCart";
import CustomerOrders from "./pages/CustomerOrders";
import RiderProfile from "./pages/RiderProfile";
import AdminManageBranches from "./pages/AdminManageBranches";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <LogoutConfirmHost />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* Public Routes */}
            <Route
              path="/"
              element={<Index />}
            />
            <Route path="/deals" element={<Navigate to="/" replace />} />
            <Route path="/shop" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />

            {/* System Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/catalogs"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminCatalogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pricing"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminPricing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/promos"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminPromos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/branches"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminManageBranches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cms"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminCMS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/transfer-logs"
              element={
                <ProtectedRoute allowedRoles={["admin", "branch_admin"]}>
                  <AdminTransferLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />

            {/* Branch Admin Routes */}
            <Route
              path="/branch/dashboard"
              element={
                <ProtectedRoute allowedRoles={["branch_admin"]}>
                  <BranchDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branch/products"
              element={
                <ProtectedRoute allowedRoles={["branch_admin"]}>
                  <BranchProducts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branch/inventory"
              element={
                <ProtectedRoute allowedRoles={["branch_admin"]}>
                  <BranchInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branch/sales"
              element={
                <ProtectedRoute allowedRoles={["branch_admin"]}>
                  <BranchSales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branch/online-orders"
              element={
                <ProtectedRoute allowedRoles={["branch_admin"]}>
                  <BranchOnlineOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branch/audit-logs"
              element={
                <ProtectedRoute allowedRoles={["branch_admin"]}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branch/settings"
              element={
                <ProtectedRoute allowedRoles={["branch_admin"]}>
                  <BranchSettings />
                </ProtectedRoute>
              }
            />

            {/* Customer Routes */}
            <Route
              path="/customer/home"
              element={<Navigate to="/customer/shop" replace />}
            />
            <Route
              path="/customer/shop"
              element={<CustomerShop />}
            />
            <Route
              path="/customer/cart"
              element={<CustomerCart />}
            />
            <Route
              path="/customer/orders"
              element={
                <ProtectedRoute allowedRoles={["customer"]}>
                  <CustomerOrders />
                </ProtectedRoute>
              }
            />

            {/* Rider Routes */}
            <Route
              path="/rider/dashboard"
              element={
                <ProtectedRoute allowedRoles={["rider"]}>
                  <RiderProfile />
                </ProtectedRoute>
              }
            />
            <Route path="/rider/profile" element={<Navigate to="/rider/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.hasChildNodes()) {
  createRoot(rootElement).render(<App />);
}
