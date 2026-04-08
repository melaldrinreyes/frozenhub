import { RequestHandler } from "express";

// Temporary stub implementations while the backend is being rebuilt.

export const handleGetActivityLogs: RequestHandler = async (req, res) => {
  res.json({ logs: [], pagination: { total: 0, page: 1, pages: 1, limit: 20 } });
};

export const handleGetActivityStats: RequestHandler = async (req, res) => {
  res.json({ totalLogs: 0, byAction: {}, byUser: {} });
};

export const handleGetRecentActivity: RequestHandler = async (req, res) => {
  res.json({ logs: [] });
};
