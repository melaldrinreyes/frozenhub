import { RequestHandler } from "express";
import { getConnection } from "../db";
import { logActivity } from "./activity-logs";

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get COD collections for a rider (pending and collected)
 */
export const handleGetRiderCODCollections: RequestHandler = async (req, res) => {
  const riderId = req.user?.id || req.session?.userId;
  if (!riderId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user?.role !== "rider") {
    res.status(403).json({ error: "Only riders can view COD collections" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT cc.id, cc.sale_id, cc.rider_id, cc.branch_id, cc.customer_name, cc.customer_phone,
              cc.amount, cc.status, cc.created_at, cc.collected_at, cc.collected_notes,
              b.name as branch_name, s.id as sale_exists
       FROM cod_collections cc
       LEFT JOIN branches b ON b.id = cc.branch_id
       LEFT JOIN sales s ON s.id = cc.sale_id
       WHERE cc.rider_id = ?
       ORDER BY cc.created_at DESC`,
      [riderId]
    );

    res.json({ collections: rows });
  } catch (error) {
    console.error("Get COD collections error:", error);
    res.status(500).json({ error: "Failed to fetch COD collections" });
  } finally {
    connection?.release();
  }
};

/**
 * Mark a COD collection as collected by rider
 */
export const handleMarkCODCollected: RequestHandler = async (req, res) => {
  const riderId = req.user?.id || req.session?.userId;
  if (!riderId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user?.role !== "rider") {
    res.status(403).json({ error: "Only riders can mark collections as collected" });
    return;
  }

  const { collectionId } = req.params;
  const { notes } = req.body || {};
  if (!collectionId) {
    res.status(400).json({ error: "collectionId is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    // Verify rider owns this collection
    const [rows] = await connection.query(
      `SELECT id, rider_id, status FROM cod_collections WHERE id = ? LIMIT 1`,
      [collectionId]
    );

    const collection = (rows as any[])[0];
    if (!collection) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }

    if (String(collection.rider_id) !== String(riderId)) {
      res.status(403).json({ error: "Access denied for this collection" });
      return;
    }

    if (collection.status !== "pending") {
      res.status(400).json({ error: `Cannot collect from status: ${collection.status}` });
      return;
    }

    // Update collection status
    await connection.query(
      `UPDATE cod_collections SET status = 'collected', collected_at = NOW(), collected_notes = ? WHERE id = ?`,
      [notes || null, collectionId]
    );

    const [updatedRows] = await connection.query(
      `SELECT * FROM cod_collections WHERE id = ? LIMIT 1`,
      [collectionId]
    );

    await logActivity(connection, {
      userId: riderId,
      userName: req.user?.name || "Rider",
      userRole: "rider",
      action: "MARK_COD_COLLECTED",
      entityType: "cod_collection",
      entityId: collectionId,
      entityName: `Collection #${collectionId}`,
      description: `Rider marked COD collection as collected`,
      metadata: { notes: notes || null },
      ipAddress: req.ip || null,
      branchId: (updatedRows as any[])[0]?.branch_id || null,
    });

    res.json({ collection: (updatedRows as any[])[0], message: "Collection marked as collected" });
  } catch (error) {
    console.error("Mark COD collected error:", error);
    res.status(500).json({ error: "Failed to update collection" });
  } finally {
    connection?.release();
  }
};

/**
 * Create a remittance: rider remits collected COD payments to their assigned branch
 */
export const handleCreateRemittance: RequestHandler = async (req, res) => {
  const riderId = req.user?.id || req.session?.userId;
  if (!riderId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user?.role !== "rider") {
    res.status(403).json({ error: "Only riders can create remittances" });
    return;
  }

  const { collectionIds, notes } = req.body || {};
  if (!collectionIds || !Array.isArray(collectionIds) || collectionIds.length === 0) {
    res.status(400).json({ error: "collectionIds array is required" });
    return;
  }

  const normalizedCollectionIds = Array.from(
    new Set(
      collectionIds
        .map((collectionId: unknown) => String(collectionId || "").trim())
        .filter(Boolean)
    )
  );

  if (normalizedCollectionIds.length === 0) {
    res.status(400).json({ error: "No valid collection IDs provided" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    const placeholders = normalizedCollectionIds.map(() => "?").join(", ");

    // Get all collections for this rider
    const [collections] = await connection.query(
      `SELECT id, sale_id, rider_id, branch_id, amount, status
       FROM cod_collections
       WHERE id IN (${placeholders})
         AND (rider_id = ? OR rider_id IS NULL)` ,
      [...normalizedCollectionIds, riderId]
    );

    const collectionList = collections as any[];
    if (collectionList.length === 0) {
      await connection.rollback();
      res.status(400).json({ error: "No valid collections found for remittance" });
      return;
    }

    // Verify all collections are 'collected' status and belong to same branch
    const branchIds = new Set<string>();
    let totalAmount = 0;

    for (const col of collectionList) {
      if (col.status !== "collected") {
        await connection.rollback();
        res.status(400).json({ error: `Collection ${col.id} has invalid status: ${col.status}` });
        return;
      }
      branchIds.add(String(col.branch_id));
      totalAmount += Number(col.amount || 0);
    }

    if (branchIds.size > 1) {
      await connection.rollback();
      res.status(400).json({ error: "All collections must be from the same branch" });
      return;
    }

    const branchId = Array.from(branchIds)[0];

    if (!branchId) {
      await connection.rollback();
      res.status(400).json({ error: "Selected collections do not have a branch assigned" });
      return;
    }

    // Create remittance record
    const remittanceId = randomId("rem");
    await connection.query(
      `INSERT INTO remittances (id, rider_id, branch_id, total_amount, collection_count, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [remittanceId, riderId, branchId, totalAmount, collectionList.length, notes || null]
    );

    // Create remittance items and update collection status
    for (const col of collectionList) {
      const itemId = randomId("remi");
      await connection.query(
        `INSERT INTO remittance_items (id, remittance_id, cod_collection_id, sale_id, amount, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [itemId, remittanceId, col.id, col.sale_id || null, col.amount]
      );

      // Mark collection as remitted
      await connection.query(
        `UPDATE cod_collections SET status = 'remitted' WHERE id = ?`,
        [col.id]
      );
      
      // NOTE: Do NOT update `sales` here. Sales should be updated only after
      // the branch admin verifies the remittance. Verification ensures the
      // branch confirms the amount before COD revenue is applied to sales.
    }

    await logActivity(connection, {
      userId: riderId,
      userName: req.user?.name || "Rider",
      userRole: "rider",
      action: "CREATE_REMITTANCE",
      entityType: "remittance",
      entityId: remittanceId,
      entityName: `Remittance #${remittanceId}`,
      description: `Rider created remittance with ${collectionList.length} collections`,
      metadata: { total_amount: totalAmount, collection_count: collectionList.length },
      ipAddress: req.ip || null,
      branchId,
    });

    await connection.commit();

    const [remittanceRows] = await connection.query(
      `SELECT * FROM remittances WHERE id = ? LIMIT 1`,
      [remittanceId]
    );

    res.status(201).json({
      remittance: (remittanceRows as any[])[0],
      message: "Remittance created successfully",
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    console.error("Create remittance error:", error);
    res.status(500).json({ error: "Failed to create remittance" });
  } finally {
    connection?.release();
  }
};

/**
 * Get remittances for a branch (admin view)
 */
export const handleGetBranchRemittances: RequestHandler = async (req, res) => {
  const branchId = req.user?.branch_id;
  if (!branchId) {
    res.status(400).json({ error: "No branch assigned" });
    return;
  }

  if (!["branch_admin", "admin"].includes(String(req.user?.role || ""))) {
    res.status(403).json({ error: "Only branch admins can view remittances" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT r.id, r.rider_id, r.branch_id, r.total_amount, r.collection_count, r.status,
              r.created_at, r.acknowledged_at, r.verified_at,
              u.name as rider_name, u.phone as rider_phone,
              ack_user.name as acknowledged_by_name,
              ver_user.name as verified_by_name
       FROM remittances r
       LEFT JOIN users u ON u.id = r.rider_id
       LEFT JOIN users ack_user ON ack_user.id = r.acknowledged_by_user_id
       LEFT JOIN users ver_user ON ver_user.id = r.verified_by_user_id
       WHERE r.branch_id = ?
       ORDER BY r.created_at DESC`,
      [branchId]
    );

    res.json({ remittances: rows });
  } catch (error) {
    console.error("Get branch remittances error:", error);
    res.status(500).json({ error: "Failed to fetch remittances" });
  } finally {
    connection?.release();
  }
};

/**
 * Get remittance details with items
 */
export const handleGetRemittanceDetails: RequestHandler = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();

    const [remittanceRows] = await connection.query(
      `SELECT r.*, u.name as rider_name, u.phone as rider_phone,
              b.name as branch_name, b.location as branch_location
       FROM remittances r
       LEFT JOIN users u ON u.id = r.rider_id
       LEFT JOIN branches b ON b.id = r.branch_id
       WHERE r.id = ? LIMIT 1`,
      [id]
    );

    const remittance = (remittanceRows as any[])[0];
    if (!remittance) {
      res.status(404).json({ error: "Remittance not found" });
      return;
    }

    // Check access: rider or branch admin
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const userBranchId = req.user?.branch_id;

    const isRider = userRole === "rider" && String(userId) === String(remittance.rider_id);
    const isBranchAdmin = (userRole === "branch_admin" || userRole === "admin") && String(userBranchId) === String(remittance.branch_id);

    if (!isRider && !isBranchAdmin) {
      res.status(403).json({ error: "Access denied for this remittance" });
      return;
    }

    // Get remittance items
    const [items] = await connection.query(
      `SELECT ri.id, ri.remittance_id, ri.cod_collection_id, ri.amount, ri.created_at,
              cc.customer_name, cc.customer_phone, cc.collected_at
       FROM remittance_items ri
       LEFT JOIN cod_collections cc ON cc.id = ri.cod_collection_id
       WHERE ri.remittance_id = ?
       ORDER BY ri.created_at ASC`,
      [id]
    );

    res.json({ remittance, items });
  } catch (error) {
    console.error("Get remittance details error:", error);
    res.status(500).json({ error: "Failed to fetch remittance details" });
  } finally {
    connection?.release();
  }
};

/**
 * Branch admin acknowledges receipt of remittance
 */
export const handleAcknowledgeRemittance: RequestHandler = async (req, res) => {
  const branchId = req.user?.branch_id;
  const userId = req.user?.id;

  if (!branchId || !["branch_admin", "admin"].includes(String(req.user?.role || ""))) {
    res.status(403).json({ error: "Only branch admins can acknowledge remittances" });
    return;
  }

  const { remittanceId } = req.params;
  if (!remittanceId) {
    res.status(400).json({ error: "remittanceId is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    const [rows] = await connection.query(
      `SELECT id, branch_id, status FROM remittances WHERE id = ? LIMIT 1`,
      [remittanceId]
    );

    const remittance = (rows as any[])[0];
    if (!remittance) {
      res.status(404).json({ error: "Remittance not found" });
      return;
    }

    if (String(remittance.branch_id) !== String(branchId)) {
      res.status(403).json({ error: "Remittance does not belong to your branch" });
      return;
    }

    if (remittance.status !== "pending") {
      res.status(400).json({ error: `Cannot acknowledge remittance with status: ${remittance.status}` });
      return;
    }

    await connection.query(
      `UPDATE remittances SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by_user_id = ? WHERE id = ?`,
      [userId, remittanceId]
    );

    const [updatedRows] = await connection.query(
      `SELECT * FROM remittances WHERE id = ? LIMIT 1`,
      [remittanceId]
    );

    await logActivity(connection, {
      userId: userId || null,
      userName: req.user?.name || "Branch Admin",
      userRole: req.user?.role || "branch_admin",
      action: "ACKNOWLEDGE_REMITTANCE",
      entityType: "remittance",
      entityId: remittanceId,
      entityName: `Remittance #${remittanceId}`,
      description: "Branch admin acknowledged remittance receipt",
      metadata: {},
      ipAddress: req.ip || null,
      branchId,
    });

    res.json({ remittance: (updatedRows as any[])[0], message: "Remittance acknowledged" });
  } catch (error) {
    console.error("Acknowledge remittance error:", error);
    res.status(500).json({ error: "Failed to acknowledge remittance" });
  } finally {
    connection?.release();
  }
};

/**
 * Branch admin verifies remittance (confirms amount)
 */
export const handleVerifyRemittance: RequestHandler = async (req, res) => {
  const branchId = req.user?.branch_id;
  const userId = req.user?.id;

  if (!branchId || !["branch_admin", "admin"].includes(String(req.user?.role || ""))) {
    res.status(403).json({ error: "Only branch admins can verify remittances" });
    return;
  }

  const { remittanceId } = req.params;
  if (!remittanceId) {
    res.status(400).json({ error: "remittanceId is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, branch_id, status FROM remittances WHERE id = ? LIMIT 1`,
      [remittanceId]
    );

    const remittance = (rows as any[])[0];
    if (!remittance) {
      await connection.rollback();
      res.status(404).json({ error: "Remittance not found" });
      return;
    }

    if (String(remittance.branch_id) !== String(branchId)) {
      await connection.rollback();
      res.status(403).json({ error: "Remittance does not belong to your branch" });
      return;
    }

    if (remittance.status !== "acknowledged") {
      await connection.rollback();
      res.status(400).json({ error: `Cannot verify remittance with status: ${remittance.status}` });
      return;
    }

    // Mark remittance as verified
    await connection.query(
      `UPDATE remittances SET status = 'verified', verified_at = NOW(), verified_by_user_id = ? WHERE id = ?`,
      [userId, remittanceId]
    );

    // Update related sales only when remittance is verified by branch admin
    const [items] = await connection.query(
      `SELECT sale_id FROM remittance_items WHERE remittance_id = ? AND sale_id IS NOT NULL`,
      [remittanceId]
    );

    const itemList = (items as any[]).map((it: any) => it.sale_id).filter(Boolean);
    for (const saleId of itemList) {
      try {
        await connection.query(
          `UPDATE sales SET is_cod_pending = FALSE, payment_status = 'succeeded' WHERE id = ?`,
          [saleId]
        );
      } catch (e) {
        // Log and continue with other sales; we'll rollback on overall error
        console.error("Failed to update sale for remittance verification:", e);
        throw e;
      }
    }

    const [updatedRows] = await connection.query(
      `SELECT * FROM remittances WHERE id = ? LIMIT 1`,
      [remittanceId]
    );

    await logActivity(connection, {
      userId: userId || null,
      userName: req.user?.name || "Branch Admin",
      userRole: req.user?.role || "branch_admin",
      action: "VERIFY_REMITTANCE",
      entityType: "remittance",
      entityId: remittanceId,
      entityName: `Remittance #${remittanceId}`,
      description: "Branch admin verified remittance",
      metadata: {},
      ipAddress: req.ip || null,
      branchId,
    });
    await connection.commit();

    res.json({ remittance: (updatedRows as any[])[0], message: "Remittance verified" });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    console.error("Verify remittance error:", error);
    res.status(500).json({ error: "Failed to verify remittance" });
  } finally {
    connection?.release();
  }
};

/**
 * Get rider's remittance history
 */
export const handleGetRiderRemittanceHistory: RequestHandler = async (req, res) => {
  const riderId = req.user?.id || req.session?.userId;
  if (!riderId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user?.role !== "rider") {
    res.status(403).json({ error: "Only riders can view their remittance history" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.query(
      `SELECT r.id, r.rider_id, r.branch_id, r.total_amount, r.collection_count, r.status,
              r.created_at, r.acknowledged_at, r.verified_at,
              b.name as branch_name
       FROM remittances r
       LEFT JOIN branches b ON b.id = r.branch_id
       WHERE r.rider_id = ?
       ORDER BY r.created_at DESC`,
      [riderId]
    );

    res.json({ remittances: rows });
  } catch (error) {
    console.error("Get rider remittance history error:", error);
    res.status(500).json({ error: "Failed to fetch remittance history" });
  } finally {
    connection?.release();
  }
};
