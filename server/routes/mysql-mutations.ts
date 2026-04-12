import { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { getConnection } from "../db";
import { logActivity } from "./activity-logs";
import fs from "fs";
import path from "path";

const BCRYPT_ROUNDS = 12;

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRole(role: any) {
  const allowed = new Set(["admin", "branch_admin", "pos_operator", "customer", "rider"]);
  if (typeof role === "string" && allowed.has(role)) return role;
  return null;
}

const settingsFallbackPath = path.join(process.cwd(), "data", "settings-fallback.json");

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = String((error as any).code || "");
  const message = error.message.toLowerCase();
  return ["ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "ENOTFOUND", "ENETUNREACH", "ETIMEDOUT", "EAI_AGAIN"].includes(code) ||
    message.includes("econnrefused") ||
    message.includes("cannot reach ipv6") ||
    message.includes("supabase direct db host resolved to ipv6");
}

function ensureFallbackDir() {
  const dir = path.dirname(settingsFallbackPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readFallbackSettings(): Record<string, string | null> {
  try {
    ensureFallbackDir();
    if (!fs.existsSync(settingsFallbackPath)) return {};
    const raw = fs.readFileSync(settingsFallbackPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string | null>;
  } catch {
    return {};
  }
}

function writeFallbackSettings(settings: Record<string, string | null>) {
  ensureFallbackDir();
  fs.writeFileSync(settingsFallbackPath, JSON.stringify(settings, null, 2), "utf8");
}

function isPaymentStatusEnumMismatch(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("data truncated") && message.includes("payment_status");
}

async function salesColumnExists(connection: any, columnName: string): Promise<boolean> {
  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM sales LIKE ?", [columnName]);
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

async function getPaymentStatusValue(
  connection: any,
  desired: "succeeded" | "failed"
): Promise<string> {
  try {
    const [rows] = await connection.query("SHOW COLUMNS FROM sales LIKE 'payment_status'");
    const column = (rows as any[])[0];
    const type = String(column?.Type || "").toLowerCase();

    // Example input: enum('pending','succeeded','failed')
    const values = type
      .replace(/^enum\(/, "")
      .replace(/\)$/, "")
      .split(",")
      .map((entry: string) => entry.trim().replace(/^'/, "").replace(/'$/, ""));

    if (desired === "succeeded") {
      if (values.includes("succeeded")) return "succeeded";
      if (values.includes("paid")) return "paid";
      if (values.includes("completed")) return "completed";
      return "pending";
    }

    if (values.includes("failed")) return "failed";
    if (values.includes("cancelled")) return "cancelled";
    return "pending";
  } catch {
    return desired;
  }
}

async function tableExists(connection: any, tableName: string): Promise<boolean> {
  try {
    const [rows] = await connection.query("SHOW TABLES LIKE ?", [tableName]);
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

async function upsertDeliveryHistoryRecord(connection: any, saleId: string) {
  const hasDeliveryHistoryTable = await tableExists(connection, "delivery_history");
  if (!hasDeliveryHistoryTable) {
    return;
  }

  await connection.query(
    `INSERT INTO delivery_history (
      id, sale_id, rider_id, branch_id, customer_name, customer_phone, customer_address,
      total_amount, payment_status, picked_up_at, delivered_at, created_at
    )
    SELECT
      CONCAT('dh-', s.id),
      s.id,
      s.assigned_rider_id,
      s.branch_id,
      JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.name')),
      JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.phone')),
      JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.address')),
      COALESCE(s.total_amount, 0),
      COALESCE(s.payment_status, 'completed'),
      s.picked_up_at,
      COALESCE(s.delivered_at, NOW()),
      NOW()
    FROM sales s
    WHERE s.id = ?
      AND s.assigned_rider_id IS NOT NULL
      AND s.customer_info IS NOT NULL
    ON CONFLICT (sale_id) DO UPDATE SET
      rider_id = EXCLUDED.rider_id,
      branch_id = EXCLUDED.branch_id,
      customer_name = EXCLUDED.customer_name,
      customer_phone = EXCLUDED.customer_phone,
      customer_address = EXCLUDED.customer_address,
      total_amount = EXCLUDED.total_amount,
      payment_status = EXCLUDED.payment_status,
      picked_up_at = EXCLUDED.picked_up_at,
      delivered_at = EXCLUDED.delivered_at,
      created_at = EXCLUDED.created_at` ,
    [saleId]
  );
}

async function upsertRiderBranchAssignment(
  connection: any,
  riderId: string,
  branchId: string,
  assignedBy: string | null,
) {
  const hasAssignmentTable = await tableExists(connection, "rider_branch_assignments");
  if (!hasAssignmentTable) {
    return;
  }

  await connection.query(
    `INSERT INTO rider_branch_assignments (id, rider_id, branch_id, assigned_by, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, TRUE, NOW(), NOW())
     ON CONFLICT (rider_id) DO UPDATE SET
       branch_id = EXCLUDED.branch_id,
       assigned_by = EXCLUDED.assigned_by,
       active = TRUE,
       updated_at = NOW()`,
    [`rba-${riderId}`, riderId, branchId, assignedBy]
  );
}

async function ensureProcurementTables(connection: any) {
  return;
}

export const handleCreateProductMySQL: RequestHandler = async (req, res) => {
  const { name, sku, barcode, category, description, price, cost, image, active } = req.body || {};

  if (!name || !sku || !category) {
    res.status(400).json({ error: "name, sku, and category are required" });
    return;
  }

  const id = randomId("prod");
  const safeBarcode = barcode || `BC-${Date.now()}`;

  let connection;
  try {
    connection = await getConnection();

    await connection.query(
      `INSERT INTO products (
        id, name, sku, barcode, category, description, price, cost, image, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        String(name).trim(),
        String(sku).trim(),
        String(safeBarcode).trim(),
        String(category).trim(),
        description ? String(description) : "",
        toNumber(price, 0),
        toNumber(cost, 0),
        image ? String(image) : "/placeholder.svg",
        active !== false,
      ]
    );

    const [rows] = await connection.query("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    const createdProduct = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_PRODUCT",
      entityType: "product",
      entityId: id,
      entityName: createdProduct?.name || String(name),
      description: `Product ${String(name)} created`,
      metadata: { sku, barcode: safeBarcode, category, price: toNumber(price, 0) },
      ipAddress: req.ip || null,
      branchId: req.user?.branch_id || null,
    });
    res.status(201).json({ product: (rows as any[])[0] });
  } catch (error: any) {
    console.error("MySQL create product error:", error);
    if (String(error?.message || "").includes("Duplicate entry")) {
      res.status(409).json({ error: "Product with same SKU or barcode already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create product" });
  } finally {
    connection?.release();
  }
};

export const handleUpdateProductMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { name, sku, barcode, category, description, price, cost, image, active } = req.body || {};

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(String(name).trim());
  }
  if (sku !== undefined) {
    updates.push("sku = ?");
    values.push(String(sku).trim());
  }
  if (barcode !== undefined) {
    updates.push("barcode = ?");
    values.push(String(barcode).trim());
  }
  if (category !== undefined) {
    updates.push("category = ?");
    values.push(String(category).trim());
  }
  if (description !== undefined) {
    updates.push("description = ?");
    values.push(String(description));
  }
  if (price !== undefined) {
    updates.push("price = ?");
    values.push(toNumber(price, 0));
  }
  if (cost !== undefined) {
    updates.push("cost = ?");
    values.push(toNumber(cost, 0));
  }
  if (image !== undefined) {
    updates.push("image = ?");
    values.push(String(image));
  }
  if (active !== undefined) {
    updates.push("active = ?");
    values.push(!!active);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    values.push(id);
    const [result] = await connection.query(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`, values);

    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const [rows] = await connection.query("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    const updatedProduct = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_PRODUCT",
      entityType: "product",
      entityId: id,
      entityName: updatedProduct?.name || id,
      description: `Product ${updatedProduct?.name || id} updated`,
      metadata: { sku, barcode, category, price, cost, active },
      ipAddress: req.ip || null,
      branchId: req.user?.branch_id || null,
    });
    res.json({ product: (rows as any[])[0] });
  } catch (error: any) {
    console.error("MySQL update product error:", error);
    if (String(error?.message || "").includes("Duplicate entry")) {
      res.status(409).json({ error: "Duplicate SKU or barcode" });
      return;
    }
    res.status(500).json({ error: "Failed to update product" });
  } finally {
    connection?.release();
  }
};

export const handleDeleteProductMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.query("DELETE FROM products WHERE id = ?", [id]);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_PRODUCT",
      entityType: "product",
      entityId: id,
      entityName: `Product #${id}`,
      description: "Product deleted",
      metadata: { product_id: id },
      ipAddress: req.ip || null,
      branchId: req.user?.branch_id || null,
    });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("MySQL delete product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  } finally {
    connection?.release();
  }
};

export const handleGetLowStockMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT i.id, i.product_id, i.branch_id, i.quantity, i.reorder_level, i.last_stock_check,
              p.name as product_name, p.sku, p.barcode, b.name as branch_name
       FROM inventory i
       INNER JOIN products p ON p.id = i.product_id
       INNER JOIN branches b ON b.id = i.branch_id
       WHERE i.quantity <= i.reorder_level
       ORDER BY i.quantity ASC, i.last_stock_check DESC`
    );
    res.json({ inventory: rows });
  } catch (error) {
    console.error("MySQL get low stock error:", error);
    res.json({ inventory: [] });
  } finally {
    connection?.release();
  }
};

export const handleAddInventoryMySQL: RequestHandler = async (req, res) => {
  const body = req.body || {};
  const productId = body.productId ?? body.product_id;
  const branchId = body.branchId ?? body.branch_id;
  const quantity = body.quantity;
  const reorderLevel = body.reorderLevel ?? body.reorder_level;

  if (!productId || !branchId) {
    res.status(400).json({ error: "productId and branchId are required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const id = randomId("inv");
    await connection.query(
      `INSERT INTO inventory (id, product_id, branch_id, quantity, reorder_level, last_stock_check)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON CONFLICT (product_id, branch_id) DO UPDATE SET
         quantity = inventory.quantity + EXCLUDED.quantity,
         reorder_level = EXCLUDED.reorder_level,
         last_stock_check = NOW()`,
      [id, productId, branchId, Math.max(0, Math.floor(toNumber(quantity, 0))), Math.max(0, Math.floor(toNumber(reorderLevel, 50)))]
    );

    const [rows] = await connection.query(
      `SELECT i.*, p.name as product_name, p.sku, p.barcode, b.name as branch_name
       FROM inventory i
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN branches b ON b.id = i.branch_id
       WHERE i.product_id = ? AND i.branch_id = ?
       LIMIT 1`,
      [productId, branchId]
    );

    const inventoryRecord = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "ADD_INVENTORY",
      entityType: "inventory",
      entityId: inventoryRecord?.id || null,
      entityName: inventoryRecord?.product_name || productId,
      description: `Inventory adjusted for ${inventoryRecord?.product_name || productId}`,
      metadata: { product_id: productId, branch_id: branchId, quantity: Math.max(0, Math.floor(toNumber(quantity, 0))) },
      ipAddress: req.ip || null,
      branchId: String(branchId),
    });
    res.status(201).json({ inventory: (rows as any[])[0] });
  } catch (error) {
    console.error("MySQL add inventory error:", error);
    res.status(500).json({ error: "Failed to add inventory" });
  } finally {
    connection?.release();
  }
};

export const handleUpdateInventoryMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const quantity = body.quantity;
  const reorderLevel = body.reorderLevel ?? body.reorder_level;

  const updates: string[] = [];
  const values: any[] = [];

  if (quantity !== undefined) {
    updates.push("quantity = ?");
    values.push(Math.max(0, Math.floor(toNumber(quantity, 0))));
  }
  if (reorderLevel !== undefined) {
    updates.push("reorder_level = ?");
    values.push(Math.max(0, Math.floor(toNumber(reorderLevel, 50))));
  }

  updates.push("last_stock_check = NOW()");

  let connection;
  try {
    connection = await getConnection();
    values.push(id);
    const [result] = await connection.query(`UPDATE inventory SET ${updates.join(", ")} WHERE id = ?`, values);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Inventory item not found" });
      return;
    }

    const [rows] = await connection.query(
      `SELECT i.*, p.name as product_name, p.sku, p.barcode, b.name as branch_name
       FROM inventory i
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN branches b ON b.id = i.branch_id
       WHERE i.id = ?
       LIMIT 1`,
      [id]
    );

    const inventoryRecord = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_INVENTORY",
      entityType: "inventory",
      entityId: inventoryRecord?.id || id,
      entityName: inventoryRecord?.product_name || id,
      description: `Inventory updated for ${inventoryRecord?.product_name || id}`,
      metadata: { quantity, reorder_level: reorderLevel },
      ipAddress: req.ip || null,
      branchId: inventoryRecord?.branch_id || req.user?.branch_id || null,
    });
    res.json({ inventory: (rows as any[])[0] });
  } catch (error) {
    console.error("MySQL update inventory error:", error);
    res.status(500).json({ error: "Failed to update inventory" });
  } finally {
    connection?.release();
  }
};

export const handleDeleteInventoryMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.query("DELETE FROM inventory WHERE id = ?", [id]);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Inventory item not found" });
      return;
    }
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_INVENTORY",
      entityType: "inventory",
      entityId: id,
      entityName: `Inventory #${id}`,
      description: "Inventory item deleted",
      metadata: { inventory_id: id },
      ipAddress: req.ip || null,
      branchId: req.user?.branch_id || null,
    });
    res.json({ message: "Inventory item deleted successfully" });
  } catch (error) {
    console.error("MySQL delete inventory error:", error);
    res.status(500).json({ error: "Failed to delete inventory" });
  } finally {
    connection?.release();
  }
};

export const handleStockTransferMySQL: RequestHandler = async (req, res) => {
  const { productId, fromBranchId, toBranchId, quantity, reason, notes } = req.body || {};
  const transferQty = Math.max(1, Math.floor(toNumber(quantity, 0)));

  if (!productId || !fromBranchId || !toBranchId || fromBranchId === toBranchId) {
    res.status(400).json({ error: "Valid productId, fromBranchId, and toBranchId are required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    const [productRows] = await connection.query("SELECT id, name FROM products WHERE id = ? LIMIT 1", [productId]);
    const product = (productRows as any[])[0];
    if (!product) throw new Error("Product not found");

    const [branchRows] = await connection.query("SELECT id, name FROM branches WHERE id IN (?, ?)", [fromBranchId, toBranchId]);
    const branches = branchRows as any[];
    const fromBranch = branches.find((b) => b.id === fromBranchId);
    const toBranch = branches.find((b) => b.id === toBranchId);
    if (!fromBranch || !toBranch) throw new Error("Branch not found");

    const [fromInvRows] = await connection.query(
      `SELECT id, quantity
       FROM inventory
       WHERE product_id = ? AND branch_id = ?
       LIMIT 1
       FOR UPDATE`,
      [productId, fromBranchId]
    );

    const fromInv = (fromInvRows as any[])[0];
    if (!fromInv || Number(fromInv.quantity || 0) < transferQty) {
      throw new Error("Insufficient stock in source branch");
    }

    await connection.query(
      `UPDATE inventory SET quantity = quantity - ?, last_stock_check = NOW() WHERE id = ?`,
      [transferQty, fromInv.id]
    );

    const [toInvRows] = await connection.query(
      `SELECT id FROM inventory WHERE product_id = ? AND branch_id = ? LIMIT 1 FOR UPDATE`,
      [productId, toBranchId]
    );

    const toInv = (toInvRows as any[])[0];
    if (toInv) {
      await connection.query(
        `UPDATE inventory SET quantity = quantity + ?, last_stock_check = NOW() WHERE id = ?`,
        [transferQty, toInv.id]
      );
    } else {
      await connection.query(
        `INSERT INTO inventory (id, product_id, branch_id, quantity, reorder_level, last_stock_check)
         VALUES (?, ?, ?, ?, 50, NOW())`,
        [randomId("inv"), productId, toBranchId, transferQty]
      );
    }

    const logId = randomId("stl");
    await connection.query(
      `INSERT INTO stock_transfer_logs (
        id, transfer_date, product_id, product_name, from_branch_id, from_branch_name,
        to_branch_id, to_branch_name, quantity, reason, approved_by, approved_by_name, status, notes
      ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [
        logId,
        productId,
        product.name,
        fromBranchId,
        fromBranch.name,
        toBranchId,
        toBranch.name,
        transferQty,
        reason || null,
        req.user?.id || req.session?.userId || null,
        req.user?.name || "System",
        notes || null,
      ]
    );

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "STOCK_TRANSFER",
      entityType: "inventory",
      entityId: logId,
      entityName: product.name,
      description: `Transferred ${transferQty} units of ${product.name}`,
      metadata: {
        product_id: productId,
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        quantity: transferQty,
        reason: reason || null,
      },
      ipAddress: req.ip || null,
      branchId: String(fromBranchId),
    });

    await connection.commit();
    res.json({ message: "Stock transfer completed", transferId: logId });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error("MySQL stock transfer error:", error);
    res.status(400).json({ error: error?.message || "Failed to transfer stock" });
  } finally {
    connection?.release();
  }
};

export const handleGetProductAvailabilityMySQL: RequestHandler = async (req, res) => {
  const { productId } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [productRows] = await connection.query(
      `SELECT id, name, price, image FROM products WHERE id = ? LIMIT 1`,
      [productId]
    );
    const product = (productRows as any[])[0];
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const [invRows] = await connection.query(
      `SELECT i.id, i.branch_id, i.quantity, i.reorder_level, b.name as branch_name
       FROM inventory i
       INNER JOIN branches b ON b.id = i.branch_id
       WHERE i.product_id = ?
       ORDER BY b.name ASC`,
      [productId]
    );

    const inventory = invRows as any[];
    const totalQuantity = inventory.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const branchesInStock = inventory.filter((row) => Number(row.quantity || 0) > 0).length;
    const branchesLowStock = inventory.filter((row) => Number(row.quantity || 0) <= Number(row.reorder_level || 0)).length;

    res.json({
      product_id: product.id,
      product_name: product.name,
      price: toNumber(product.price, 0),
      image: product.image,
      total_quantity: totalQuantity,
      branches_in_stock: branchesInStock,
      branches_low_stock: branchesLowStock,
      total_branches: inventory.length,
      inventory,
    });
  } catch (error) {
    console.error("MySQL product availability error:", error);
    res.status(500).json({ error: "Failed to fetch product availability" });
  } finally {
    connection?.release();
  }
};

export const handleCleanupDuplicatesMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [dupeRows] = await connection.query(
      `SELECT product_id, branch_id, MIN(id) as keep_id, COUNT(*) as cnt
       FROM inventory
       GROUP BY product_id, branch_id
       HAVING COUNT(*) > 1`
    );

    let removed = 0;
    for (const row of dupeRows as any[]) {
      const [rows] = await connection.query(
        `SELECT id FROM inventory WHERE product_id = ? AND branch_id = ? AND id <> ?`,
        [row.product_id, row.branch_id, row.keep_id]
      );
      for (const extra of rows as any[]) {
        await connection.query(`DELETE FROM inventory WHERE id = ?`, [extra.id]);
        removed += 1;
      }
    }

    res.json({ message: "Duplicate cleanup completed", removed });
  } catch (error) {
    console.error("MySQL cleanup duplicates error:", error);
    res.status(500).json({ error: "Failed to cleanup duplicates" });
  } finally {
    connection?.release();
  }
};

export const handleCreateBranchMySQL: RequestHandler = async (req, res) => {
  const { name, location, phone, manager } = req.body || {};
  if (!name || !location || !phone || !manager) {
    res.status(400).json({ error: "name, location, phone, and manager are required" });
    return;
  }

  const id = randomId("branch");
  let connection;
  try {
    connection = await getConnection();
    await connection.query(
      `INSERT INTO branches (id, name, location, phone, manager, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, name, location, phone, manager]
    );

    const [rows] = await connection.query("SELECT *, TRUE as is_active FROM branches WHERE id = ? LIMIT 1", [id]);
    const branch = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_BRANCH",
      entityType: "branch",
      entityId: id,
      entityName: branch?.name || name,
      description: `Branch ${branch?.name || name} created`,
      metadata: { location, phone, manager },
      ipAddress: req.ip || null,
      branchId: id,
    });
    res.status(201).json({ branch: (rows as any[])[0] });
  } catch (error) {
    console.error("MySQL create branch error:", error);
    res.status(500).json({ error: "Failed to create branch" });
  } finally {
    connection?.release();
  }
};

export const handleUpdateBranchMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { name, location, phone, manager } = req.body || {};

  const updates: string[] = [];
  const values: any[] = [];
  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (location !== undefined) {
    updates.push("location = ?");
    values.push(location);
  }
  if (phone !== undefined) {
    updates.push("phone = ?");
    values.push(phone);
  }
  if (manager !== undefined) {
    updates.push("manager = ?");
    values.push(manager);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    values.push(id);
    const [result] = await connection.query(`UPDATE branches SET ${updates.join(", ")} WHERE id = ?`, values);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    const [rows] = await connection.query("SELECT *, TRUE as is_active FROM branches WHERE id = ? LIMIT 1", [id]);
    const branch = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_BRANCH",
      entityType: "branch",
      entityId: id,
      entityName: branch?.name || id,
      description: `Branch ${branch?.name || id} updated`,
      metadata: { name, location, phone, manager },
      ipAddress: req.ip || null,
      branchId: id,
    });
    res.json({ branch: (rows as any[])[0] });
  } catch (error) {
    console.error("MySQL update branch error:", error);
    res.status(500).json({ error: "Failed to update branch" });
  } finally {
    connection?.release();
  }
};

export const handleDeleteBranchMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [existingRows] = await connection.query("SELECT name FROM branches WHERE id = ? LIMIT 1", [id]);
    const existingBranch = (existingRows as any[])[0];
    const [result] = await connection.query("DELETE FROM branches WHERE id = ?", [id]);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_BRANCH",
      entityType: "branch",
      entityId: id,
      entityName: existingBranch?.name || id,
      description: `Branch ${existingBranch?.name || id} deleted`,
      metadata: { branch_id: id },
      ipAddress: req.ip || null,
      branchId: id,
    });
    res.json({ message: "Branch deleted successfully" });
  } catch (error: any) {
    console.error("MySQL delete branch error:", error);
    const msg = String(error?.message || "");
    if (msg.includes("foreign key constraint")) {
      res.status(409).json({ error: "Cannot delete branch with existing users/inventory" });
      return;
    }
    res.status(500).json({ error: "Failed to delete branch" });
  } finally {
    connection?.release();
  }
};

export const handleGetUsersMySQL: RequestHandler = async (req, res) => {
  const { role, branchId } = req.query;

  let connection;
  try {
    connection = await getConnection();

    const hasAssignmentTable = await tableExists(connection, "rider_branch_assignments");
    const branchExpr = hasAssignmentTable
      ? "CASE WHEN u.role = 'rider' THEN COALESCE(rba.branch_id, u.branch_id) ELSE u.branch_id END"
      : "u.branch_id";
    const joinExpr = hasAssignmentTable
      ? "LEFT JOIN rider_branch_assignments rba ON rba.rider_id = u.id AND rba.active = TRUE"
      : "";

    const clauses: string[] = [];
    const values: any[] = [];

    if (req.user?.role === "branch_admin" && req.user?.branch_id) {
      clauses.push(`${branchExpr} = ?`);
      values.push(req.user.branch_id);
    }

    if (role) {
      clauses.push("u.role = ?");
      values.push(role);
    }

    if (branchId && req.user?.role !== "branch_admin") {
      clauses.push(`${branchExpr} = ?`);
      values.push(branchId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await connection.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role,
              ${branchExpr} as branch_id,
            u.created_at,
              b.name as branch_name
       FROM users u
       ${joinExpr}
       LEFT JOIN branches b ON b.id = ${branchExpr}
       ${where}
       ORDER BY u.created_at DESC`,
      values
    );

    res.json({ users: rows });
  } catch (error) {
    console.error("MySQL get users error:", error);
    res.json({ users: [] });
  } finally {
    connection?.release();
  }
};

export const handleCreateUserMySQL: RequestHandler = async (req, res) => {
  const { name, email, phone, password, role, branch_id, branchId } = req.body || {};
  const normalizedBranchId = branch_id || branchId || null;
  const normalizedRole = normalizeRole(role);

  if (!name || !email || !phone || !password || !normalizedRole) {
    res.status(400).json({ error: "name, email, phone, password, and valid role are required" });
    return;
  }

  const id = randomId("user");
  let connection;
  try {
    connection = await getConnection();
    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

    await connection.query(
      `INSERT INTO users (id, name, email, phone, password_hash, role, branch_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, name, email, phone, passwordHash, normalizedRole, normalizedBranchId]
    );

    if (normalizedRole === "rider" && normalizedBranchId) {
      await upsertRiderBranchAssignment(connection, id, String(normalizedBranchId), req.user?.id || null);
    }

    const [rows] = await connection.query(
      `SELECT id, name, email, phone, role, branch_id, created_at FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    const createdUser = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_USER",
      entityType: "user",
      entityId: id,
      entityName: createdUser?.name || name,
      description: `User ${createdUser?.name || name} created`,
      metadata: { email, phone, role: normalizedRole, branch_id: normalizedBranchId },
      ipAddress: req.ip || null,
      branchId: normalizedBranchId || null,
    });
    res.status(201).json({ user: (rows as any[])[0] });
  } catch (error: any) {
    console.error("MySQL create user error:", error);
    if (String(error?.message || "").includes("Duplicate entry")) {
      res.status(409).json({ error: "Email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create user" });
  } finally {
    connection?.release();
  }
};

export const handleUpdateUserMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, role, branch_id, branchId, password } = req.body || {};
  const normalizedBranchId = branch_id !== undefined ? branch_id : branchId;

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (email !== undefined) {
    updates.push("email = ?");
    values.push(email);
  }
  if (phone !== undefined) {
    updates.push("phone = ?");
    values.push(phone);
  }
  if (role !== undefined) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    updates.push("role = ?");
    values.push(normalizedRole);
  }
  if (normalizedBranchId !== undefined) {
    updates.push("branch_id = ?");
    values.push(normalizedBranchId || null);
  }
  if (password !== undefined && String(password).trim().length > 0) {
    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    updates.push("password_hash = ?");
    values.push(passwordHash);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    values.push(id);
    const [beforeRows] = await connection.query("SELECT role FROM users WHERE id = ? LIMIT 1", [id]);
    const existingUser = (beforeRows as any[])[0];
    if (!existingUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [result] = await connection.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const targetRole = role !== undefined ? normalizeRole(role) : existingUser.role;
    if (targetRole === "rider" && normalizedBranchId) {
      await upsertRiderBranchAssignment(connection, id, String(normalizedBranchId), req.user?.id || null);
    } else if (targetRole !== "rider" && String(existingUser.role) === "rider") {
      await connection.query(
        "UPDATE rider_branch_assignments SET active = FALSE, updated_at = NOW() WHERE rider_id = ?",
        [id]
      );
    }

    const [rows] = await connection.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role,
              CASE WHEN u.role = 'rider' THEN COALESCE(rba.branch_id, u.branch_id) ELSE u.branch_id END as branch_id,
              u.created_at
       FROM users u
       LEFT JOIN rider_branch_assignments rba ON rba.rider_id = u.id AND rba.active = TRUE
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

    const updatedUser = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_USER",
      entityType: "user",
      entityId: id,
      entityName: updatedUser?.name || id,
      description: `User ${updatedUser?.name || id} updated`,
      metadata: { email, phone, role, branch_id: normalizedBranchId, password_changed: String(password || "").trim().length > 0 },
      ipAddress: req.ip || null,
      branchId: updatedUser?.branch_id || normalizedBranchId || null,
    });

    res.json({ user: (rows as any[])[0] });
  } catch (error: any) {
    console.error("MySQL update user error:", error);
    if (String(error?.message || "").includes("Duplicate entry")) {
      res.status(409).json({ error: "Email already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to update user" });
  } finally {
    connection?.release();
  }
};

export const handleDeleteUserMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if ((req.user?.id || req.session?.userId) === id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const [existingRows] = await connection.query("SELECT name, branch_id, role FROM users WHERE id = ? LIMIT 1", [id]);
    const existingUser = (existingRows as any[])[0];
    const [result] = await connection.query("DELETE FROM users WHERE id = ?", [id]);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_USER",
      entityType: "user",
      entityId: id,
      entityName: existingUser?.name || id,
      description: `User ${existingUser?.name || id} deleted`,
      metadata: { branch_id: existingUser?.branch_id || null, role: existingUser?.role || null },
      ipAddress: req.ip || null,
      branchId: existingUser?.branch_id || null,
    });
    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("MySQL delete user error:", error);
    const message = String(error?.message || "");
    const code = String(error?.code || "");

    if (code === "ER_ROW_IS_REFERENCED_2" || /foreign key constraint/i.test(message)) {
      res.status(409).json({
        error:
          "Cannot delete user because they are linked to existing records (orders, promos, transfers, or activity logs). Reassign/delete those records first.",
      });
      return;
    }

    res.status(500).json({ error: message || "Failed to delete user" });
  } finally {
    connection?.release();
  }
};

export const handleAssignRiderBranchMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { branchId } = req.body || {};

  if (!branchId) {
    res.status(400).json({ error: "branchId is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    const [userRows] = await connection.query(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [id]
    );
    const user = (userRows as any[])[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (String(user.role) !== "rider") {
      res.status(400).json({ error: "Only riders can be assigned to branches" });
      return;
    }

    const [branchRows] = await connection.query(
      "SELECT id FROM branches WHERE id = ? LIMIT 1",
      [branchId]
    );
    if ((branchRows as any[]).length === 0) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }

    await upsertRiderBranchAssignment(connection, id, String(branchId), req.user?.id || null);
    // Keep users.branch_id in sync for compatibility with existing views.
    await connection.query("UPDATE users SET branch_id = ? WHERE id = ?", [branchId, id]);

    const [rows] = await connection.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role,
              CASE WHEN u.role = 'rider' THEN COALESCE(rba.branch_id, u.branch_id) ELSE u.branch_id END as branch_id,
              u.created_at
       FROM users u
       LEFT JOIN rider_branch_assignments rba ON rba.rider_id = u.id AND rba.active = TRUE
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

    res.json({ user: (rows as any[])[0], message: "Rider assigned successfully" });
  } catch (error: any) {
    console.error("MySQL assign rider branch error:", error);
    res.status(500).json({ error: error?.message || "Failed to assign rider" });
  } finally {
    connection?.release();
  }
};

export const handleChangePasswordMySQL: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const userId = req.user?.id || req.session?.userId;

  if (!userId || !currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [userId]);
    const user = (rows as any[])[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isMatch = await bcrypt.compare(String(currentPassword), String(user.password_hash));
    if (!isMatch) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
    await connection.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("MySQL change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  } finally {
    connection?.release();
  }
};

export const handleGetSaleItemsMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.user?.role;
  const requesterBranchId = req.user?.branch_id;
  let connection;
  try {
    connection = await getConnection();

    if ((requesterRole === "branch_admin" || requesterRole === "rider") && requesterBranchId) {
      const [saleRows] = await connection.query(
        "SELECT branch_id FROM sales WHERE id = ? LIMIT 1",
        [id]
      );

      const sale = (saleRows as any[])[0];
      if (!sale) {
        res.status(404).json({ error: "Sale not found" });
        return;
      }

      if (String(sale.branch_id) !== String(requesterBranchId)) {
        res.status(403).json({ error: "Access denied for this order" });
        return;
      }
    }

    const [rows] = await connection.query(
      `SELECT si.id, si.sale_id, si.product_id, si.quantity, si.price, si.total,
              si.subtotal, si.discount_amount, si.promo_id,
              p.name as product_name, p.sku, p.image
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ?
       ORDER BY si.id ASC`,
      [id]
    );

    res.json({ items: rows });
  } catch (error) {
    console.error("MySQL get sale items error:", error);
    res.json({ items: [] });
  } finally {
    connection?.release();
  }
};

export const handleUpdateOrderStatusMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = new Set(["pending", "preparing", "ready", "picked_up", "out_for_delivery", "completed", "cancelled"]);

  if (!allowed.has(String(status))) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    const [hasAssignedRider, hasPaymentStatus, hasPickedUpAt, hasDeliveredAt] = await Promise.all([
      salesColumnExists(connection, "assigned_rider_id"),
      salesColumnExists(connection, "payment_status"),
      salesColumnExists(connection, "picked_up_at"),
      salesColumnExists(connection, "delivered_at"),
    ]);

    const [saleRows] = await connection.query(
      hasAssignedRider
        ? "SELECT id, branch_id, status, customer_info, assigned_rider_id FROM sales WHERE id = ? LIMIT 1"
        : "SELECT id, branch_id, status, customer_info, NULL as assigned_rider_id FROM sales WHERE id = ? LIMIT 1",
      [id]
    );
    const sale = (saleRows as any[])[0];

    if (!sale) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }

    if ((req.user?.role === "branch_admin" || req.user?.role === "rider") && req.user?.branch_id) {
      if (String(sale.branch_id) !== String(req.user.branch_id)) {
        res.status(403).json({ error: "Access denied for this branch" });
        return;
      }
    }

    const currentStatus = String(sale.status);
    const nextStatus = String(status);

    // Branch admins can manage kitchen/order preparation flow only.
    if (req.user?.role === "branch_admin") {
      const branchTransitions = new Set([
        "pending->preparing",
        "pending->cancelled",
        "preparing->ready",
        "preparing->cancelled",
      ]);

      if (`${currentStatus}->${nextStatus}` === "preparing->ready" && !sale.assigned_rider_id) {
        res.status(400).json({ error: "Assign a rider before marking order as ready" });
        return;
      }

      if (!branchTransitions.has(`${currentStatus}->${nextStatus}`)) {
        res.status(403).json({ error: "Invalid branch admin status transition" });
        return;
      }
    }

    // Riders can only handle online delivery transitions.
    if (req.user?.role === "rider") {
      const isOnline = !!sale.customer_info;
      if (!isOnline) {
        res.status(403).json({ error: "Riders can update online orders only" });
        return;
      }

      if (!sale.assigned_rider_id || String(sale.assigned_rider_id) !== String(req.user?.id)) {
        res.status(403).json({ error: "You are not assigned to this order" });
        return;
      }

      const riderTransitions = new Set([
        "ready->picked_up",
        "ready->out_for_delivery",
        "picked_up->completed",
        "out_for_delivery->completed",
      ]);

      if (!riderTransitions.has(`${currentStatus}->${nextStatus}`)) {
        res.status(403).json({ error: "Riders can only progress delivery orders" });
        return;
      }
    }

    await connection.beginTransaction();

    const isCompletingOnlineOrder =
      nextStatus === "completed" &&
      currentStatus !== "completed" &&
      !!sale.customer_info;

    if (isCompletingOnlineOrder) {
      const [saleItemRows] = await connection.query(
        `SELECT product_id, quantity
         FROM sale_items
         WHERE sale_id = ?`,
        [id]
      );

      for (const saleItem of saleItemRows as any[]) {
        const productId = String(saleItem.product_id || "");
        const requiredQty = Math.max(0, Math.floor(toNumber(saleItem.quantity, 0)));
        if (!productId || requiredQty <= 0) continue;

        const [inventoryRows] = await connection.query(
          `SELECT id, quantity
           FROM inventory
           WHERE branch_id = ? AND product_id = ?
           LIMIT 1
           FOR UPDATE`,
          [sale.branch_id, productId]
        );

        const inventoryRecord = (inventoryRows as any[])[0];
        const availableQty = Number(inventoryRecord?.quantity || 0);

        if (!inventoryRecord || availableQty < requiredQty) {
          throw new Error(`Insufficient inventory for product ${productId}`);
        }

        await connection.query(
          `UPDATE inventory
           SET quantity = quantity - ?, last_stock_check = NOW()
           WHERE id = ?`,
          [requiredQty, inventoryRecord.id]
        );
      }
    }

    const successPaymentValue = hasPaymentStatus ? await getPaymentStatusValue(connection, "succeeded") : "succeeded";
    const failedPaymentValue = hasPaymentStatus ? await getPaymentStatusValue(connection, "failed") : "failed";

    const statusUpdates: string[] = ["status = ?"];
    const statusValues: any[] = [status];
    if ((String(status) === "picked_up" || String(status) === "out_for_delivery") && hasPickedUpAt) {
      statusUpdates.push("picked_up_at = NOW()");
    }
    if (String(status) === "completed") {
      if (hasDeliveredAt) statusUpdates.push("delivered_at = NOW()");
      if (hasPaymentStatus) statusUpdates.push(`payment_status = '${successPaymentValue}'`);
    }
    if (String(status) === "cancelled" && hasPaymentStatus) {
      statusUpdates.push(`payment_status = '${failedPaymentValue}'`);
    }

    statusValues.push(id);
    let result: any;
    try {
      const [updateResult] = await connection.query(`UPDATE sales SET ${statusUpdates.join(", ")} WHERE id = ?`, statusValues);
      result = updateResult;
    } catch (updateError: any) {
      if (!isPaymentStatusEnumMismatch(updateError)) {
        throw updateError;
      }

      // Fallback for databases where payment_status enum values still reject the chosen value.
      const safeStatusUpdates = statusUpdates.filter((entry) => !entry.includes("payment_status"));
      const [fallbackResult] = await connection.query(
        `UPDATE sales SET ${safeStatusUpdates.join(", ")} WHERE id = ?`,
        [status, id]
      );
      result = fallbackResult;
    }
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }

    if (String(status) === "completed") {
      try {
        await upsertDeliveryHistoryRecord(connection, id);
      } catch (historyError) {
        console.error("MySQL delivery history upsert warning:", historyError);
      }
    }

    await connection.commit();

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_ORDER_STATUS",
      entityType: "sale",
      entityId: id,
      entityName: `Order #${id}`,
      description: `Order status changed from ${currentStatus} to ${nextStatus}`,
      metadata: {
        previous_status: currentStatus,
        next_status: nextStatus,
      },
      ipAddress: req.ip || null,
      branchId: String(sale.branch_id || req.user?.branch_id || "") || null,
    });

    res.json({ message: "Order status updated", status });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error("MySQL update order status error:", error);
    if (error instanceof Error && error.message.toLowerCase().includes("insufficient inventory")) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to update order status" });
  } finally {
    connection?.release();
  }
};

export const handleCreateCustomerOrderMySQL: RequestHandler = async (req, res) => {
  const body = req.body || {};
  const branchId = body.branchId ?? body.branch_id;
  const items = Array.isArray(body.items) ? body.items : [];
  const paymentMethod = body.paymentMethod ?? body.payment_method;
  const totalAmount = body.totalAmount ?? body.total_amount;
  const customerInfo = body.customerInfo ?? body.customer_info;
  const notes = body.notes;
  const customerEmail = body.customerEmail ?? body.customer_email;
  const customerId = body.customerId ?? body.customer_id;

  if (!branchId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "branchId and items are required" });
    return;
  }

  const normalizedPaymentMethod = ["cash", "card", "gcash", "paymaya", "bank_transfer", "online"].includes(String(paymentMethod))
    ? String(paymentMethod)
    : "cash";

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    const saleId = randomId("order");
    let subtotal = 0;
    let itemCount = 0;
    const preparedItems: Array<{
      id: string;
      saleId: string;
      productId: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }> = [];

    for (const item of items) {
      const productId = item?.productId ?? item?.product_id ?? item?.id;
      const quantity = Math.max(1, Math.floor(toNumber(item?.quantity, 1)));
      if (!productId) throw new Error("Invalid order item");

      const [productRows] = await connection.query("SELECT id, price FROM products WHERE id = ? LIMIT 1", [productId]);
      const product = (productRows as any[])[0];
      if (!product) throw new Error(`Product ${productId} not found`);

      const unitPrice = toNumber(product.price, 0);
      const total = Number((unitPrice * quantity).toFixed(2));
      subtotal += total;
      itemCount += quantity;

      preparedItems.push({
        id: randomId("order-item"),
        saleId,
        productId,
        quantity,
        unitPrice,
        total,
      });
    }

    const grandTotal = Number.isFinite(Number(totalAmount)) ? Number(totalAmount) : subtotal;

    const serializedCustomerInfo = JSON.stringify({
      ...(customerInfo || {}),
      email: customerEmail || customerInfo?.email || null,
      customer_id: customerId || null,
    });

    await connection.query(
      `INSERT INTO sales (
        id, date, branch_id, total_amount, items_count, payment_method, status,
        created_by, customer_info, notes, payment_status, subtotal, discount_amount
      ) VALUES (?, NOW(), ?, ?, ?, ?, 'pending', NULL, ?, ?, 'pending', ?, ?)` ,
      [
        saleId,
        branchId,
        grandTotal,
        itemCount,
        normalizedPaymentMethod,
        serializedCustomerInfo,
        notes || null,
        subtotal,
        Math.max(0, Number((subtotal - grandTotal).toFixed(2))),
      ]
    );

    for (const item of preparedItems) {
      await connection.query(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, price, total, subtotal, discount_amount, promo_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        [item.id, item.saleId, item.productId, item.quantity, item.unitPrice, item.total, item.total]
      );
    }

    await connection.commit();

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_ORDER",
      entityType: "sale",
      entityId: saleId,
      entityName: `Order #${saleId}`,
      description: `Customer order created with ${itemCount} items totaling ₱${grandTotal.toFixed(2)}`,
      metadata: {
        items_count: itemCount,
        subtotal,
        total: grandTotal,
        payment_method: normalizedPaymentMethod,
      },
      ipAddress: req.ip || null,
      branchId: String(branchId),
    });

    res.status(201).json({ message: "Order created successfully", orderId: saleId });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error("MySQL create customer order error:", error);
    res.status(400).json({ error: error?.message || "Failed to create customer order" });
  } finally {
    connection?.release();
  }
};

export const handleGetCustomerOrdersMySQL: RequestHandler = async (req, res) => {
  const { email, phone, customerId } = req.query;
  const filters: string[] = ["s.customer_info IS NOT NULL"];
  const params: any[] = [];

  if (customerId) {
    filters.push("JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.customer_id')) = ?");
    params.push(customerId);
  }

  if (email) {
    filters.push("JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.email')) = ?");
    params.push(email);
  }
  if (phone) {
    filters.push("JSON_UNQUOTE(JSON_EXTRACT(s.customer_info, '$.phone')) = ?");
    params.push(phone);
  }

  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT s.id, s.date, s.branch_id, s.total_amount, s.items_count, s.payment_method, s.status,
        s.customer_info, s.notes,
        CASE
          WHEN s.payment_status IN ('succeeded', 'paid', 'completed') THEN 'succeeded'
          WHEN s.payment_status IN ('failed', 'cancelled') THEN 'failed'
          WHEN s.status = 'completed' AND s.payment_method = 'cash' THEN 'succeeded'
          ELSE COALESCE(s.payment_status, 'pending')
        END as payment_status,
        s.picked_up_at, s.delivered_at,
        s.assigned_rider_id,
        rider.name as assigned_rider_name
       FROM sales s
      LEFT JOIN users rider ON rider.id = s.assigned_rider_id
       WHERE ${filters.join(" AND ")}
       ORDER BY s.date DESC
       LIMIT 100`,
      params
    );

    const orders = (rows as any[]).map((row) => {
      const customerInfo = typeof row.customer_info === "string" ? JSON.parse(row.customer_info || "{}") : row.customer_info;

      return {
        ...row,
        order_type: customerInfo ? "online" : "pos",
        customer_name: customerInfo?.name || null,
        customer_phone: customerInfo?.phone || null,
        customer_address: customerInfo?.address || null,
        customer_email: customerInfo?.email || null,
        customer_info: customerInfo,
      };
    });

    res.json({ orders });
  } catch (error) {
    console.error("MySQL get customer orders error:", error);
    res.json({ orders: [] });
  } finally {
    connection?.release();
  }
};

export const handleCancelCustomerOrderMySQL: RequestHandler = async (req, res) => {
  const { orderId } = req.params;
  let connection;
  try {
    connection = await getConnection();

    const [orderRows] = await connection.query(
      `SELECT id, branch_id, status FROM sales WHERE id = ? LIMIT 1`,
      [orderId]
    );
    const order = (orderRows as any[])[0];

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Customers can cancel only while branch has not handed off to delivery yet.
    const cancellableStatuses = new Set(["pending", "preparing", "ready"]);
    if (!cancellableStatuses.has(String(order.status || ""))) {
      res.status(400).json({ error: "Order can no longer be cancelled" });
      return;
    }

    const hasPaymentStatus = await salesColumnExists(connection, "payment_status");
    let result: any;
    try {
      const [updateResult] = await connection.query(
        hasPaymentStatus
          ? `UPDATE sales
             SET status = 'cancelled', payment_status = 'failed'
             WHERE id = ?`
          : `UPDATE sales
             SET status = 'cancelled'
             WHERE id = ?`,
        [orderId]
      );
      result = updateResult;
    } catch (updateError: any) {
      if (!isPaymentStatusEnumMismatch(updateError)) {
        throw updateError;
      }

      const [fallbackResult] = await connection.query(
        `UPDATE sales
         SET status = 'cancelled'
         WHERE id = ?`,
        [orderId]
      );
      result = fallbackResult;
    }

    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Order not found or already cancelled" });
      return;
    }

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CANCEL_ORDER",
      entityType: "sale",
      entityId: orderId,
      entityName: `Order #${orderId}`,
      description: "Customer order cancelled",
      metadata: {
        status: "cancelled",
      },
      ipAddress: req.ip || null,
      branchId: String(order.branch_id || req.user?.branch_id || "") || null,
    });

    res.json({ message: "Order cancelled successfully" });
  } catch (error: any) {
    console.error("MySQL cancel customer order error:", error);
    const message = String(error?.message || "");
    if (/connect|ECONNREFUSED|ENOTFOUND|pool/i.test(message)) {
      res.status(503).json({ error: "Database unavailable. Please try again." });
      return;
    }
    res.status(500).json({ error: message || "Failed to cancel order" });
  } finally {
    connection?.release();
  }
};

export const handleAssignRiderMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { riderId } = req.body || {};

  if (!riderId) {
    res.status(400).json({ error: "riderId is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    const hasAssignedRider = await salesColumnExists(connection, "assigned_rider_id");
    if (!hasAssignedRider) {
      res.status(503).json({ error: "Database migration pending. Please restart server and try again." });
      return;
    }

    const [saleRows] = await connection.query(
      `SELECT id, branch_id, status, customer_info
       FROM sales
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const sale = (saleRows as any[])[0];

    if (!sale) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (req.user?.role === "branch_admin" && req.user?.branch_id) {
      if (String(sale.branch_id) !== String(req.user.branch_id)) {
        res.status(403).json({ error: "Access denied for this branch" });
        return;
      }
    }

    if (!sale.customer_info) {
      res.status(400).json({ error: "Rider assignment is available for online orders only" });
      return;
    }

    if (!["pending", "preparing", "ready"].includes(String(sale.status))) {
      res.status(400).json({ error: "Cannot assign rider after pickup or completion" });
      return;
    }

    const [riderRows] = await connection.query(
      `SELECT id, role, branch_id, name
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [riderId]
    );
    const rider = (riderRows as any[])[0];
    if (!rider || String(rider.role) !== "rider") {
      res.status(404).json({ error: "Rider not found" });
      return;
    }

    if (String(rider.branch_id || "") !== String(sale.branch_id || "")) {
      res.status(400).json({ error: "Rider must belong to the same branch as the order" });
      return;
    }

    await connection.query(
      `UPDATE sales
       SET assigned_rider_id = ?, picked_up_at = NULL, delivered_at = NULL
       WHERE id = ?`,
      [riderId, id]
    );

    res.json({ message: "Rider assigned successfully", rider: { id: rider.id, name: rider.name } });
  } catch (error) {
    console.error("MySQL assign rider error:", error);
    res.status(500).json({ error: "Failed to assign rider" });
  } finally {
    connection?.release();
  }
};

export const handleGetPurchasesMySQL: RequestHandler = async (req, res) => {
  const { page = 1, limit = 10, branchId, supplierId, startDate, endDate } = req.query;

  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);

    const pageNum = Math.max(1, Math.floor(toNumber(page, 1)));
    const limitNum = Math.min(100, Math.max(1, Math.floor(toNumber(limit, 10))));
    const offset = (pageNum - 1) * limitNum;

    const clauses: string[] = [];
    const params: any[] = [];

    if (branchId) {
      clauses.push("p.branch_id = ?");
      params.push(branchId);
    }
    if (supplierId) {
      clauses.push("p.supplier_id = ?");
      params.push(supplierId);
    }
    if (startDate) {
      clauses.push("p.purchase_date >= ?");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("p.purchase_date <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [countRows] = await connection.query(`SELECT COUNT(*) as total FROM purchases p ${where}`, params);
    const total = Number((countRows as any[])[0]?.total || 0);

    const [rows] = await connection.query(
      `SELECT p.*, s.name as supplier_name, b.name as branch_name
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN branches b ON b.id = p.branch_id
       ${where}
       ORDER BY p.purchase_date DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    res.json({
      purchases: rows,
      pagination: {
        total,
        page: pageNum,
        pages: total > 0 ? Math.ceil(total / limitNum) : 0,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("MySQL get purchases error:", error);
    res.json({ purchases: [], pagination: { total: 0, page: 1, pages: 0, limit: 10 } });
  } finally {
    connection?.release();
  }
};

export const handleGetPurchaseMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);

    const [rows] = await connection.query(
      `SELECT p.*, s.name as supplier_name, b.name as branch_name
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN branches b ON b.id = p.branch_id
       WHERE p.id = ?
       LIMIT 1`,
      [id]
    );

    const purchase = (rows as any[])[0];
    if (!purchase) {
      res.status(404).json({ error: "Purchase not found" });
      return;
    }

    const [items] = await connection.query(
      `SELECT pi.*, pr.name as product_name, pr.sku
       FROM purchase_items pi
       LEFT JOIN products pr ON pr.id = pi.product_id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id ASC`,
      [id]
    );

    res.json({ purchase: { ...purchase, items } });
  } catch (error) {
    console.error("MySQL get purchase error:", error);
    res.status(500).json({ error: "Failed to fetch purchase" });
  } finally {
    connection?.release();
  }
};

export const handleCreatePurchaseMySQL: RequestHandler = async (req, res) => {
  const { supplierId, branchId, invoiceNumber, purchaseDate, status, notes, items } = req.body || {};

  if (!branchId || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "branchId and items are required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const purchaseId = randomId("purchase");
    let totalAmount = 0;

    for (const item of items) {
      const productId = item?.productId;
      const quantity = Math.max(1, Math.floor(toNumber(item?.quantity, 1)));
      const unitCost = Math.max(0, toNumber(item?.cost, 0));
      if (!productId) throw new Error("Each item requires productId");

      const lineTotal = Number((quantity * unitCost).toFixed(2));
      totalAmount += lineTotal;

      await connection.query(
        `INSERT INTO purchase_items (id, purchase_id, product_id, quantity, cost, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomId("pi"), purchaseId, productId, quantity, unitCost, lineTotal]
      );

      await connection.query(
        `INSERT INTO inventory (id, product_id, branch_id, quantity, reorder_level, last_stock_check)
         VALUES (?, ?, ?, ?, 50, NOW())
         ON CONFLICT (product_id, branch_id) DO UPDATE SET
           quantity = inventory.quantity + EXCLUDED.quantity,
           last_stock_check = NOW()`,
        [randomId("inv"), productId, branchId, quantity]
      );
    }

    await connection.query(
      `INSERT INTO purchases (
        id, supplier_id, branch_id, invoice_number, purchase_date, total_amount,
        status, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        purchaseId,
        supplierId || null,
        branchId,
        invoiceNumber || null,
        purchaseDate || new Date(),
        Number(totalAmount.toFixed(2)),
        ["received", "pending", "cancelled"].includes(String(status)) ? status : "received",
        notes || null,
        req.user?.id || req.session?.userId || null,
      ]
    );

    await connection.commit();
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_PURCHASE",
      entityType: "purchase",
      entityId: purchaseId,
      entityName: `Purchase #${purchaseId}`,
      description: `Purchase created with total ₱${totalAmount.toFixed(2)}`,
      metadata: { supplierId: supplierId || null, branchId, invoiceNumber, status: status || "received", totalAmount },
      ipAddress: req.ip || null,
      branchId: String(branchId),
    });
    res.status(201).json({ message: "Purchase created successfully", id: purchaseId });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error("MySQL create purchase error:", error);
    res.status(400).json({ error: error?.message || "Failed to create purchase" });
  } finally {
    connection?.release();
  }
};

export const handleUpdatePurchaseMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { supplierId, branchId, invoiceNumber, purchaseDate, status, notes, items } = req.body || {};

  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const [existingRows] = await connection.query("SELECT * FROM purchases WHERE id = ? LIMIT 1", [id]);
    const existing = (existingRows as any[])[0];
    if (!existing) {
      await connection.rollback();
      res.status(404).json({ error: "Purchase not found" });
      return;
    }

    let totalAmount = Number(existing.total_amount || 0);

    if (Array.isArray(items)) {
      const [oldItems] = await connection.query("SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?", [id]);
      for (const oldItem of oldItems as any[]) {
        await connection.query(
          `UPDATE inventory
           SET quantity = GREATEST(quantity - ?, 0), last_stock_check = NOW()
           WHERE product_id = ? AND branch_id = ?`,
          [Number(oldItem.quantity || 0), oldItem.product_id, branchId || existing.branch_id]
        );
      }

      await connection.query("DELETE FROM purchase_items WHERE purchase_id = ?", [id]);

      totalAmount = 0;
      for (const item of items) {
        const productId = item?.productId;
        const quantity = Math.max(1, Math.floor(toNumber(item?.quantity, 1)));
        const unitCost = Math.max(0, toNumber(item?.cost, 0));
        if (!productId) throw new Error("Each item requires productId");

        const lineTotal = Number((quantity * unitCost).toFixed(2));
        totalAmount += lineTotal;

        await connection.query(
          `INSERT INTO purchase_items (id, purchase_id, product_id, quantity, cost, total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [randomId("pi"), id, productId, quantity, unitCost, lineTotal]
        );

        await connection.query(
          `INSERT INTO inventory (id, product_id, branch_id, quantity, reorder_level, last_stock_check)
           VALUES (?, ?, ?, ?, 50, NOW())
           ON CONFLICT (product_id, branch_id) DO UPDATE SET
             quantity = inventory.quantity + EXCLUDED.quantity,
             last_stock_check = NOW()`,
          [randomId("inv"), productId, branchId || existing.branch_id, quantity]
        );
      }
    }

    await connection.query(
      `UPDATE purchases
       SET supplier_id = ?,
           branch_id = ?,
           invoice_number = ?,
           purchase_date = ?,
           total_amount = ?,
           status = ?,
           notes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        supplierId !== undefined ? supplierId || null : existing.supplier_id,
        branchId || existing.branch_id,
        invoiceNumber !== undefined ? invoiceNumber || null : existing.invoice_number,
        purchaseDate || existing.purchase_date,
        totalAmount,
        ["received", "pending", "cancelled"].includes(String(status)) ? status : existing.status,
        notes !== undefined ? notes || null : existing.notes,
        id,
      ]
    );

    await connection.commit();
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_PURCHASE",
      entityType: "purchase",
      entityId: id,
      entityName: `Purchase #${id}`,
      description: `Purchase ${id} updated`,
      metadata: { supplierId: supplierId || existing.supplier_id, branchId: branchId || existing.branch_id, invoiceNumber, status },
      ipAddress: req.ip || null,
      branchId: String(branchId || existing.branch_id),
    });
    res.json({ message: "Purchase updated successfully" });
  } catch (error: any) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error("MySQL update purchase error:", error);
    res.status(400).json({ error: error?.message || "Failed to update purchase" });
  } finally {
    connection?.release();
  }
};

export const handleDeletePurchaseMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);
    await connection.beginTransaction();

    const [purchaseRows] = await connection.query("SELECT branch_id FROM purchases WHERE id = ? LIMIT 1", [id]);
    const purchase = (purchaseRows as any[])[0];
    if (!purchase) {
      await connection.rollback();
      res.status(404).json({ error: "Purchase not found" });
      return;
    }

    const [items] = await connection.query("SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?", [id]);
    for (const item of items as any[]) {
      await connection.query(
        `UPDATE inventory
         SET quantity = GREATEST(quantity - ?, 0), last_stock_check = NOW()
         WHERE product_id = ? AND branch_id = ?`,
        [Number(item.quantity || 0), item.product_id, purchase.branch_id]
      );
    }

    await connection.query("DELETE FROM purchases WHERE id = ?", [id]);
    await connection.commit();
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_PURCHASE",
      entityType: "purchase",
      entityId: id,
      entityName: `Purchase #${id}`,
      description: `Purchase ${id} deleted`,
      metadata: { branchId: purchase.branch_id },
      ipAddress: req.ip || null,
      branchId: String(purchase.branch_id),
    });
    res.json({ message: "Purchase deleted successfully" });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error("MySQL delete purchase error:", error);
    res.status(500).json({ error: "Failed to delete purchase" });
  } finally {
    connection?.release();
  }
};

export const handleGetPurchaseStatsMySQL: RequestHandler = async (req, res) => {
  const { branchId, startDate, endDate } = req.query;
  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);

    const clauses: string[] = [];
    const params: any[] = [];

    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    if (startDate) {
      clauses.push("purchase_date >= ?");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("purchase_date <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await connection.query(
      `SELECT COUNT(*) as totalPurchases,
              COALESCE(SUM(total_amount), 0) as totalAmount,
              COALESCE(AVG(total_amount), 0) as avgPurchaseValue
       FROM purchases
       ${where}`,
      params
    );

    const stats = (rows as any[])[0] || {};
    res.json({
      totalPurchases: Number(stats.totalPurchases || 0),
      totalAmount: Number(stats.totalAmount || 0),
      avgPurchaseValue: Number(stats.avgPurchaseValue || 0),
    });
  } catch (error) {
    console.error("MySQL purchase stats error:", error);
    res.json({ totalPurchases: 0, totalAmount: 0, avgPurchaseValue: 0 });
  } finally {
    connection?.release();
  }
};

export const handleGetPurchaseTrendMySQL: RequestHandler = async (req, res) => {
  const { branchId, startDate, endDate } = req.query;
  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);

    const clauses: string[] = [];
    const params: any[] = [];

    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    if (startDate) {
      clauses.push("purchase_date >= ?");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("purchase_date <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [rows] = await connection.query(
      `SELECT TO_CHAR(purchase_date, 'Mon DD') as month,
              COALESCE(SUM(total_amount), 0) as purchases
       FROM purchases
       ${where}
       GROUP BY TO_CHAR(purchase_date, 'YYYY-MM-DD'), TO_CHAR(purchase_date, 'Mon DD')
       ORDER BY TO_CHAR(purchase_date, 'YYYY-MM-DD') ASC`,
      params
    );

    res.json({ trend: rows });
  } catch (error) {
    console.error("MySQL purchase trend error:", error);
    res.json({ trend: [] });
  } finally {
    connection?.release();
  }
};

export const handleGetSuppliersMySQL: RequestHandler = async (_req, res) => {
  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);
    const [rows] = await connection.query(
      `SELECT id, name, contact_person, phone, email, address, created_at, updated_at
       FROM suppliers
       ORDER BY name ASC`
    );
    res.json({ suppliers: rows });
  } catch (error) {
    console.error("MySQL get suppliers error:", error);
    res.json({ suppliers: [] });
  } finally {
    connection?.release();
  }
};

export const handleCreateSupplierMySQL: RequestHandler = async (req, res) => {
  const { name, contact_person, phone, email, address } = req.body || {};

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    await ensureProcurementTables(connection);

    const id = randomId("supplier");
    await connection.query(
      `INSERT INTO suppliers (id, name, contact_person, phone, email, address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name, contact_person || null, phone || null, email || null, address || null]
    );

    const [rows] = await connection.query("SELECT * FROM suppliers WHERE id = ? LIMIT 1", [id]);
    res.status(201).json({ supplier: (rows as any[])[0] });
  } catch (error) {
    console.error("MySQL create supplier error:", error);
    res.status(500).json({ error: "Failed to create supplier" });
  } finally {
    connection?.release();
  }
};

export const handleCreateCategoryMySQL: RequestHandler = async (req, res) => {
  const { name, description, active } = req.body || {};

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const normalizedName = String(name).trim();

    const [existingRows] = await connection.query(
      `SELECT * FROM categories
       WHERE LOWER(TRIM(name)) = LOWER(?)
       LIMIT 1`,
      [normalizedName]
    );

    const existingCategory = (existingRows as any[])[0];
    if (existingCategory) {
      res.status(200).json({
        category: existingCategory,
        alreadyExists: true,
        message: "Category already exists",
      });
      return;
    }

    const id = randomId("cat");

    await connection.query(
      `INSERT INTO categories (id, name, description, active, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, normalizedName, description || null, active !== false]
    );

    const [rows] = await connection.query("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "CREATE_CATEGORY",
      entityType: "category",
      entityId: id,
      entityName: normalizedName,
      description: `Category ${normalizedName} created`,
      metadata: { description, active },
      ipAddress: req.ip || null,
      branchId: req.user?.branch_id || null,
    });
    res.status(201).json({ category: (rows as any[])[0] });
  } catch (error: any) {
    console.error("MySQL create category error:", error);
    if (String(error?.message || "").includes("Duplicate entry")) {
      const normalizedName = String(name).trim();
      try {
        const [rows] = await connection?.query(
          `SELECT * FROM categories
           WHERE LOWER(TRIM(name)) = LOWER(?)
           LIMIT 1`,
          [normalizedName]
        );
        const existingCategory = (rows as any[])[0];
        if (existingCategory) {
          res.status(200).json({
            category: existingCategory,
            alreadyExists: true,
            message: "Category already exists",
          });
          return;
        }
      } catch {
        // Fall through to conflict response if lookup fails.
      }

      res.status(409).json({ error: "Category already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create category" });
  } finally {
    connection?.release();
  }
};

export const handleUpdateCategoryMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  const { name, description, active } = req.body || {};

  const updates: string[] = [];
  const values: any[] = [];
  if (name !== undefined) {
    updates.push("name = ?");
    values.push(String(name).trim());
  }
  if (description !== undefined) {
    updates.push("description = ?");
    values.push(description || null);
  }
  if (active !== undefined) {
    updates.push("active = ?");
    values.push(!!active);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    values.push(id);
    const [result] = await connection.query(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`, values);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const [rows] = await connection.query("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
    const category = (rows as any[])[0];
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_CATEGORY",
      entityType: "category",
      entityId: id,
      entityName: category?.name || id,
      description: `Category ${category?.name || id} updated`,
      metadata: { name, description, active },
      ipAddress: req.ip || null,
      branchId: req.user?.branch_id || null,
    });
    res.json({ category: (rows as any[])[0] });
  } catch (error: any) {
    console.error("MySQL update category error:", error);
    if (String(error?.message || "").includes("Duplicate entry")) {
      res.status(409).json({ error: "Category already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to update category" });
  } finally {
    connection?.release();
  }
};

export const handleDeleteCategoryMySQL: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.query("DELETE FROM categories WHERE id = ?", [id]);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_CATEGORY",
      entityType: "category",
      entityId: id,
      entityName: `Category #${id}`,
      description: "Category deleted",
      metadata: { category_id: id },
      ipAddress: req.ip || null,
      branchId: req.user?.branch_id || null,
    });
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("MySQL delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  } finally {
    connection?.release();
  }
};

export const handleUpdateSettingMySQL: RequestHandler = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body || {};

  let connection;
  try {
    connection = await getConnection();

    await connection.query(
      `INSERT INTO settings (id, setting_key, setting_value, updated_at, updated_by)
       VALUES (?, ?, ?, NOW(), ?)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [
        randomId("setting"),
        key,
        value ?? null,
        req.user?.id || req.session?.userId || null,
      ]
    );

    const [rows] = await connection.query(
      `SELECT id, setting_key, setting_value, updated_at, updated_by
       FROM settings
       WHERE setting_key = ?
       LIMIT 1`,
      [key]
    );

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "UPDATE_SETTING",
      entityType: "setting",
      entityId: key,
      entityName: key,
      description: `Setting ${key} updated`,
      metadata: { value },
      ipAddress: req.ip || null,
      branchId: null,
    });

    res.json({ setting: (rows as any[])[0], message: "Setting updated successfully" });
  } catch (error) {
    if (isDatabaseUnavailableError(error) && process.env.NODE_ENV !== "production") {
      const fallbackSettings = readFallbackSettings();
      fallbackSettings[key] = value ?? null;
      writeFallbackSettings(fallbackSettings);

      res.json({
        setting: {
          id: `fallback-${key}`,
          setting_key: key,
          setting_value: value ?? null,
          updated_at: new Date().toISOString(),
          updated_by: req.user?.id || req.session?.userId || null,
        },
        message: "Setting updated locally (database offline)",
      });
      return;
    }

    console.error("MySQL update setting error:", error);
    res.status(500).json({ error: "Failed to update setting" });
  } finally {
    connection?.release();
  }
};

export const handleDeleteSettingMySQL: RequestHandler = async (req, res) => {
  const { key } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.query("DELETE FROM settings WHERE setting_key = ?", [key]);
    if (Number((result as any)?.affectedRows || 0) === 0) {
      res.status(404).json({ error: "Setting not found" });
      return;
    }

    await logActivity(connection, {
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userRole: req.user?.role || null,
      action: "DELETE_SETTING",
      entityType: "setting",
      entityId: key,
      entityName: key,
      description: `Setting ${key} deleted`,
      metadata: { key },
      ipAddress: req.ip || null,
      branchId: null,
    });
    res.json({ message: "Setting deleted successfully" });
  } catch (error) {
    if (isDatabaseUnavailableError(error) && process.env.NODE_ENV !== "production") {
      const fallbackSettings = readFallbackSettings();
      if (Object.prototype.hasOwnProperty.call(fallbackSettings, key)) {
        delete fallbackSettings[key];
        writeFallbackSettings(fallbackSettings);
      }

      res.json({ message: "Setting deleted locally (database offline)" });
      return;
    }

    console.error("MySQL delete setting error:", error);
    res.status(500).json({ error: "Failed to delete setting" });
  } finally {
    connection?.release();
  }
};
