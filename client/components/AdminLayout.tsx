// @ts-nocheck
import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/authContext";
import { confirmLogout } from "@/lib/logout";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import {
  Snowflake,
  BarChart3,
  Package,
  DollarSign,
  ShoppingCart,
  Users,
  LogOut,
  Menu,
  X,
  Home,
  Settings,
  Layout,
  FileText,
  Tag,
  MoreHorizontal,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminLayoutProps {
  children: ReactNode;
  userRole?: "admin" | "branch";
  title?: string;
}

export default function AdminLayout({ children, userRole, title }: AdminLayoutProps) {
  const [activeNavItem, setActiveNavItem] = useState("dashboard");
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const isSystemAdmin = userRole === "admin" || user?.role === "admin";

  // Fetch company branding
  const { data: companyLogoData } = useQuery({
    queryKey: ["setting", "company_logo"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("company_logo");
      } catch {
        return { setting: null };
      }
    },
  });

  const { data: companyNameData } = useQuery({
    queryKey: ["setting", "company_name"],
    queryFn: async () => {
      try {
        return await apiClient.getSetting("company_name");
      } catch {
        return { setting: { setting_value: "Batangas Premium Bongabong" } };
      }
    },
  });

  const companyLogo = companyLogoData?.setting?.setting_value;
  const companyName = companyNameData?.setting?.setting_value || "Batangas Premium Bongabong";

  // Fetch new pending orders count for branch admins
  const { data: newOrdersCount = 0 } = useQuery({
    queryKey: ["new-orders-count", user?.branch_id],
    queryFn: async () => {
      if (isSystemAdmin || !user?.branch_id) return 0;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const result = await apiClient.getSales(
        user.branch_id,
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        1,
        100,
        "all"
      );
      
      // Count new pending orders (less than 5 minutes old)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const newPendingOrders = result.sales.filter((sale: any) => {
        if (sale.order_type !== 'online' || sale.status !== 'pending') return false;
        
        const saleDate = sale.sale_date?._seconds 
          ? new Date(sale.sale_date._seconds * 1000)
          : sale.sale_date?.seconds
          ? new Date(sale.sale_date.seconds * 1000)
          : new Date(sale.sale_date);
        
        return saleDate > fiveMinutesAgo;
      });
      
      return newPendingOrders.length;
    },
    enabled: !isSystemAdmin && !!user?.branch_id,
    refetchInterval: 10000, // Check every 10 seconds
  });

  // Fetch new transfer notifications
  const { data: newTransfersCount = 0 } = useQuery({
    queryKey: ["new-transfers-count", user?.id, user?.branch_id],
    queryFn: async () => {
      const result = await apiClient.getTransferLogs();
      
      // Count new transfers (less than 5 minutes old)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const newTransfers = result.logs.filter((log: any) => {
        const transferDate = log.transferred_at?._seconds 
          ? new Date(log.transferred_at._seconds * 1000)
          : log.transferred_at?.seconds
          ? new Date(log.transferred_at.seconds * 1000)
          : log.transfer_date?._seconds
          ? new Date(log.transfer_date._seconds * 1000)
          : log.transfer_date?.seconds
          ? new Date(log.transfer_date.seconds * 1000)
          : new Date(log.transferred_at || log.transfer_date);
        
        if (transferDate <= fiveMinutesAgo) return false;
        
        // For admin: show all new transfers
        if (isSystemAdmin) return true;
        
        // For branch: show only transfers TO their branch
        return log.to_branch_id === user?.branch_id;
      });
      
      return newTransfers.length;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Check every 10 seconds
  });

  const adminNavigation = [
    { label: "Dashboard", href: "/admin/dashboard", icon: Home },
    { label: "Catalogs", href: "/admin/catalogs", icon: BarChart3 },
    { label: "Pricing", href: "/admin/pricing", icon: DollarSign },
    { label: "Promos", href: "/admin/promos", icon: Tag },
    { label: "Inventory", href: "/admin/inventory", icon: Package },
    { label: "Branches", href: "/admin/branches", icon: Package },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Transfer Logs", href: "/admin/transfer-logs", icon: FileText },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
    { label: "CMS", href: "/admin/cms", icon: Layout },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  const branchNavigation = [
    { label: "Dashboard", href: "/branch/dashboard", icon: Home },
    { label: "Products", href: "/branch/products", icon: Package },
    { label: "Inventory", href: "/branch/inventory", icon: ShoppingCart },
    { label: "Sales", href: "/branch/sales", icon: BarChart3 },
    { label: "Online Orders", href: "/branch/online-orders", icon: Globe },
    { label: "Audit Logs", href: "/branch/audit-logs", icon: FileText },
    // { label: "POS Operators", href: "/branch/users", icon: Users }, // Removed as requested
    { label: "Settings", href: "/branch/settings", icon: Settings },
  ];

  const navigation = isSystemAdmin ? adminNavigation : branchNavigation;

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-64 bg-black border-r border-gold-500/20 text-white transition-transform duration-300 z-40",
          "hidden lg:block"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gold-500/20">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} className="w-8 h-8 object-contain" />
              ) : (
                <div className="relative">
                  <Snowflake className="w-8 h-8 text-gold-400" />
                  <div className="absolute inset-0 bg-gold-400/20 blur-lg rounded-full" />
                </div>
              )}
              <h1 className="text-xl font-bold text-gold-400">{companyName}</h1>
            </div>
          </div>

          {/* Role Badge */}
          <div className="px-6 py-4">
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2">
              Current Role
            </div>
            <div
              className={cn(
                "px-3 py-2 rounded-full text-sm font-semibold w-fit",
                isSystemAdmin
                  ? "bg-gold-500/20 text-gold-400 border border-gold-500/30"
                  : "bg-gold-500/20 text-gold-400 border border-gold-500/30",
              )}
            >
              {isSystemAdmin ? "System Admin" : "Branch Admin"}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              const showOrderBadge = item.label === "Online Orders" && newOrdersCount > 0;
              const showTransferBadge = 
                (item.label === "Transfer Logs" || item.label === "Inventory") && 
                newTransfersCount > 0;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative",
                    isActive
                      ? "bg-gold-500 text-black font-semibold"
                      : "text-gray-300 hover:bg-gold-500/10 hover:text-gold-400",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium flex-1">{item.label}</span>
                  {showOrderBadge && (
                    <Badge className="bg-red-500 text-white text-xs px-2 py-0.5 animate-pulse">
                      {newOrdersCount}
                    </Badge>
                  )}
                  {showTransferBadge && (
                    <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5 animate-pulse">
                      {newTransfersCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gold-500/20">
            <Button
              onClick={handleLogout}
              className="w-full justify-start bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-black border-0 shadow-md hover:shadow-lg transition-all font-semibold"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-900 flex-1 truncate">
              {isSystemAdmin ? "System Administration" : "Branch Operations"}
            </h2>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0).toUpperCase() || "A"}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-gold-500/20 z-50">
        <div className="flex items-center justify-around">
          {/* First 4 navigation items */}
          {navigation.slice(0, 4).map((item) => {
            const isActive = location.pathname === item.href;
            const showOrderBadge = item.label === "Online Orders" && newOrdersCount > 0;
            const showTransferBadge = 
              (item.label === "Inventory") && 
              newTransfersCount > 0;
            const badgeCount = showOrderBadge ? newOrdersCount : showTransferBadge ? newTransfersCount : 0;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setActiveNavItem(item.label.toLowerCase())}
                className={`flex flex-col items-center justify-center gap-1 transition-colors py-2 flex-1 relative ${
                  isActive
                    ? "text-gold-400 bg-gold-500/10" 
                    : "text-gray-400 hover:text-gold-400 hover:bg-gold-500/5"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
                {badgeCount > 0 && (
                  <Badge className={`absolute top-1 right-4 ${showOrderBadge ? 'bg-red-500' : 'bg-blue-500'} text-white text-xs px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full animate-pulse`}>
                    {badgeCount}
                  </Badge>
                )}
              </Link>
            );
          })}

          {/* More dropdown for remaining items */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center gap-1 transition-colors py-2 flex-1 ${
                  navigation.slice(4).some(item => location.pathname === item.href)
                    ? "text-gold-400 bg-gold-500/10" 
                    : "text-gray-400 hover:text-gold-400 hover:bg-gold-500/5"
                }`}
              >
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-xs font-medium">More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-48 mb-2 bg-black border-gold-500/20 text-white"
            >
              {navigation.slice(4).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                        isActive
                          ? "text-gold-400 bg-gold-500/10" 
                          : "text-gray-300 hover:text-gold-400 hover:bg-gold-500/5"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              
              {/* Logout button */}
              <DropdownMenuItem 
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 cursor-pointer text-black bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 border-t border-gold-500/20 mt-2 rounded-md mx-1 mb-1 font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-semibold">Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}

