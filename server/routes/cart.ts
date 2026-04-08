import { RequestHandler } from "express";

// Temporary stub implementations while the backend is being rebuilt.

export const getCart: RequestHandler = async (req, res) => {
  res.json({ cart: null, items: [] });
};

export const addToCart: RequestHandler = async (req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const updateCartItem: RequestHandler = async (req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const removeFromCart: RequestHandler = async (req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const clearCart: RequestHandler = async (req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};

export const syncCart: RequestHandler = async (req, res) => {
  res.status(501).json({ error: "Not implemented - data migration in progress" });
};
