import { RequestHandler } from "express";

// Temporary stub implementations while the backend is being rebuilt.

export const getCart: RequestHandler = async (_req, res) => {
  res.json({ cart: null, items: [] });
};

export const addToCart: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const updateCartItem: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const removeFromCart: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const clearCart: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const syncCart: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};
