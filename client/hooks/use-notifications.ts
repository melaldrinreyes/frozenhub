import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export interface Notification {
  id: string;
  type: "low_stock" | "out_of_stock" | "new_order" | "system" | "transfer";
  title: string;
  message: string;
  read: boolean;
  priority: "low" | "medium" | "high";
  timestamp: string;
  action_url?: string;
  metadata?: {
    product_id?: string;
    product_name?: string;
    branch_id?: string;
    branch_name?: string;
    quantity?: number;
    [key: string]: any;
  };
}

export function useNotifications() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      // Get low stock items
      const inventory = await apiClient.getInventory();
      const lowStockItems = inventory.inventory.filter(
        (item: any) => item.quantity <= item.reorder_level
      );

      // Generate notifications from low stock
      const notifications: Notification[] = lowStockItems.map((item: any) => {
        const isOutOfStock = item.quantity === 0;
        return {
          id: `stock-${item.id}`,
          type: isOutOfStock ? "out_of_stock" : "low_stock",
          title: isOutOfStock ? "Out of Stock" : "Low Stock Alert",
          message: isOutOfStock
            ? `${item.product_name} is out of stock at ${item.branch_name}`
            : `${item.product_name} is low on stock at ${item.branch_name} (${item.quantity} remaining)`,
          read: false,
          priority: isOutOfStock ? "high" : "medium",
          timestamp: new Date().toISOString(),
          action_url: "/admin/inventory",
          metadata: {
            product_id: item.product_id,
            product_name: item.product_name,
            branch_id: item.branch_id,
            branch_name: item.branch_name,
            quantity: item.quantity,
            reorder_level: item.reorder_level,
          },
        };
      });

      return notifications;
    },
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  const notifications = data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const highPriorityCount = notifications.filter(
    (n) => !n.read && n.priority === "high"
  ).length;

  return {
    notifications,
    unreadCount,
    highPriorityCount,
    isLoading,
    refetch,
  };
}
