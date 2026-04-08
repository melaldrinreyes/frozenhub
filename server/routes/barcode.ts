import express from "express";
import { getConnection } from "../db";

const router = express.Router();

// Endpoint to fetch product details by barcode
router.get("/product", async (req, res) => {
  const { barcode, branch_id } = req.query;

  if (!barcode || !branch_id) {
    return res.status(400).json({ error: "Barcode and branch_id are required" });
  }

  try {
    const connection = await getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM products WHERE barcode = ? AND branch_id = ?",
      [barcode, branch_id]
    );

    if (Array.isArray(rows) && rows.length === 0) {
      return res.status(404).json({ error: "Product not found for this branch" });
    }

    if (!Array.isArray(rows)) {
      return res.status(500).json({ error: "Unexpected database response" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching product by barcode and branch_id:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to fetch payment details by paymentId
router.get("/payment", async (req, res) => {
  const { paymentId } = req.query;

  if (!paymentId) {
    return res.status(400).json({ error: "Payment ID is required" });
  }

  try {
    const connection = await getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM payments WHERE id = ?",
      [paymentId]
    );

    // Ensure rows is treated as an array for payment
    if (Array.isArray(rows) && rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (!Array.isArray(rows)) {
      return res.status(500).json({ error: "Unexpected database response" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching payment by ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;