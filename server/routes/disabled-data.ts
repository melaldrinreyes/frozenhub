import { RequestHandler } from "express";

const GET_FALLBACKS: Record<string, any> = {
  handleGetUsers: { users: [] },
  handleGetPurchases: { purchases: [], pagination: { total: 0, page: 1, pages: 0, limit: 10 } },
  handleGetPurchase: { purchase: null },
  handleGetPurchaseStats: { totalPurchases: 0, totalAmount: 0, avgPurchaseValue: 0 },
  handleGetPurchaseTrend: { trend: [] },
  handleGetSuppliers: { suppliers: [] },
  handleGetLowStock: { inventory: [] },
  handleGetProductAvailability: { inventory: [], total_quantity: 0, branches_in_stock: 0 },
  handleGetSaleItems: { items: [] },
  handleGetCustomerOrders: { orders: [] },
};

export function disabledRoute(routeName: string): RequestHandler {
  return (req, res) => {
    if (req.method === "GET") {
      const payload = GET_FALLBACKS[routeName];
      if (payload) {
        res.json(payload);
        return;
      }

      res.json({
        ok: true,
        route: routeName,
        data: [],
        message: "Temporary fallback response while migration is in progress.",
      });
      return;
    }

    res.status(503).json({
      error: "Data backend unavailable",
      route: routeName,
      message: "This endpoint is temporarily disabled while the data backend is being migrated.",
    });
  };
}