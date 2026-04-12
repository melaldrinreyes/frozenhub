import { RequestHandler } from "express";
import { getConnection } from "../db";

type ActivityRole = "admin" | "branch_admin" | "pos_operator" | "customer" | "rider";

export async function logActivity(
  connection: any,
  data: {
    userId?: string | null;
    userName?: string | null;
    userRole?: ActivityRole | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    entityName?: string | null;
    description?: string | null;
    metadata?: any;
    ipAddress?: string | null;
    branchId?: string | null;
  }
) {
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await connection.query(
      `INSERT INTO activity_logs (
        id, user_id, user_name, user_role, action, entity_type,
        entity_id, entity_name, description, metadata,
        ip_address, branch_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        logId,
        data.userId || null,
        data.userName || null,
        data.userRole || null,
        data.action,
        data.entityType,
        data.entityId || null,
        data.entityName || null,
        data.description || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        data.ipAddress || null,
        data.branchId || null,
      ]
    );

    return logId;
  } catch (error) {
    console.error("Activity log error:", error);
    return null;
  }
}

function parseMetadata(value: any) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function resolveBranchScope(req: any, requestedBranchId?: string) {
  if (req.user?.role === "branch_admin") {
    return req.user?.branch_id || null;
  }

  if (req.user?.role === "admin") {
    if (!requestedBranchId || requestedBranchId === "all") return null;
    return requestedBranchId;
  }

  return req.user?.branch_id || null;
}

function applyBranchScopeFilter(
  req: any,
  resolvedBranchId: string | null,
  clauses: string[],
  params: any[],
  branchColumn: string
) {
  if (req.user?.role && req.user.role !== "admin") {
    clauses.push(`${branchColumn} = ?`);
    params.push(resolvedBranchId);
    return;
  }

  if (req.user?.role === "admin" && resolvedBranchId) {
    clauses.push(`${branchColumn} = ?`);
    params.push(resolvedBranchId);
  }
}

export const handleGetActivityLogs: RequestHandler = async (req, res) => {
  const connection = await getConnection();
  try {
    const {
      userId,
      action,
      entityType,
      branchId,
      search,
      startDate,
      endDate,
      page = "1",
      limit = "50",
    } = req.query;

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
    const offset = (pageNum - 1) * limitNum;

    const resolvedBranchId = resolveBranchScope(req, String(branchId || ""));

    const clauses: string[] = ["1=1"];
    const params: any[] = [];
    applyBranchScopeFilter(req, resolvedBranchId, clauses, params, "al.branch_id");

    if (userId) {
      clauses.push("al.user_id = ?");
      params.push(userId);
    }

    if (action) {
      clauses.push("al.action = ?");
      params.push(action);
    }

    if (entityType) {
      clauses.push("al.entity_type = ?");
      params.push(entityType);
    }

    if (search) {
      clauses.push("(al.user_name LIKE ? OR al.entity_name LIKE ? OR al.description LIKE ? OR al.action LIKE ?)");
      const searchTerm = `%${String(search)}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (startDate) {
      clauses.push("al.created_at >= ?");
      params.push(startDate);
    }

    if (endDate) {
      clauses.push("al.created_at <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM activity_logs al
       ${where}`,
      params
    );
    const total = Number((countRows as any[])[0]?.total || 0);

    const [rows] = await connection.query(
      `SELECT al.*, b.name AS branch_name
       FROM activity_logs al
       LEFT JOIN branches b ON b.id = al.branch_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const logs = (rows as any[]).map((row) => ({
      ...row,
      metadata: parseMetadata(row.metadata),
    }));

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: total > 0 ? Math.ceil(total / limitNum) : 0,
      },
    });
  } catch (error) {
    console.error("Get activity logs error:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  } finally {
    connection.release();
  }
};

export const handleGetActivityStats: RequestHandler = async (req, res) => {
  const connection = await getConnection();
  try {
    const { branchId, startDate, endDate } = req.query;
    const resolvedBranchId = resolveBranchScope(req, String(branchId || ""));

    const clauses: string[] = ["1=1"];
    const params: any[] = [];
    applyBranchScopeFilter(req, resolvedBranchId, clauses, params, "branch_id");

    if (startDate) {
      clauses.push("created_at >= ?");
      params.push(startDate);
    }

    if (endDate) {
      clauses.push("created_at <= ?");
      params.push(`${endDate} 23:59:59`);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const [totalRows] = await connection.query(
      `SELECT COUNT(*) AS totalLogs
       FROM activity_logs
       ${where}`,
      params
    );

    const [actionRows] = await connection.query(
      `SELECT action, COUNT(*) AS count
       FROM activity_logs
       ${where}
       GROUP BY action
       ORDER BY count DESC, action ASC`,
      params
    );

    const [entityRows] = await connection.query(
      `SELECT entity_type, COUNT(*) AS count
       FROM activity_logs
       ${where}
       GROUP BY entity_type
       ORDER BY count DESC, entity_type ASC`,
      params
    );

    res.json({
      totalLogs: Number((totalRows as any[])[0]?.totalLogs || 0),
      byAction: Object.fromEntries((actionRows as any[]).map((row) => [row.action, Number(row.count || 0)])),
      byEntityType: Object.fromEntries((entityRows as any[]).map((row) => [row.entity_type, Number(row.count || 0)])),
    });
  } catch (error) {
    console.error("Get activity stats error:", error);
    res.status(500).json({ error: "Failed to fetch activity statistics" });
  } finally {
    connection.release();
  }
};

export const handleGetRecentActivity: RequestHandler = async (req, res) => {
  const connection = await getConnection();
  try {
    const { limit = "20", branchId } = req.query;
    const resolvedBranchId = resolveBranchScope(req, String(branchId || ""));

    const clauses: string[] = ["1=1"];
    const params: any[] = [];
    applyBranchScopeFilter(req, resolvedBranchId, clauses, params, "al.branch_id");

    const [rows] = await connection.query(
      `SELECT al.*, b.name AS branch_name
       FROM activity_logs al
       LEFT JOIN branches b ON b.id = al.branch_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [...params, Math.max(1, Math.min(parseInt(String(limit), 10) || 20, 100))]
    );

    res.json({
      logs: (rows as any[]).map((row) => ({
        ...row,
        metadata: parseMetadata(row.metadata),
      })),
    });
  } catch (error) {
    console.error("Get recent activity error:", error);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  } finally {
    connection.release();
  }
};
