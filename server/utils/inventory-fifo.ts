type DbConnection = {
  query: (sql: string, values?: any[]) => Promise<[any, any]>;
};

export type FifoAllocation = {
  batchId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedAt: string;
};

type InboundBatchInput = {
  productId: string;
  branchId: string;
  quantity: number;
  unitCost: number;
  sourceType: "purchase" | "manual" | "transfer_in" | "seed";
  sourceRef?: string | null;
  sourceItemRef?: string | null;
  receivedAt?: string | Date | null;
};

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toInt(value: any, fallback = 0) {
  return Math.floor(toNumber(value, fallback));
}

export async function ensureInventoryBatchSchema(connection: DbConnection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS inventory_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL CHECK (source_type IN ('purchase', 'manual', 'transfer_in', 'seed')),
      source_ref TEXT NULL,
      source_item_ref TEXT NULL,
      quantity_received INTEGER NOT NULL DEFAULT 0,
      quantity_remaining INTEGER NOT NULL DEFAULT 0,
      unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (quantity_received >= 0),
      CHECK (quantity_remaining >= 0),
      CHECK (quantity_remaining <= quantity_received)
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS sale_item_inventory_batches (
      id TEXT PRIMARY KEY,
      sale_item_id TEXT NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
      batch_id TEXT NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
      total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (quantity > 0)
    )`
  );

  await connection.query(
    `CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_branch
     ON inventory_batches(product_id, branch_id, received_at, created_at)`
  );
  await connection.query(
    `CREATE INDEX IF NOT EXISTS idx_inventory_batches_source_ref
     ON inventory_batches(source_type, source_ref)`
  );
  await connection.query(
    `CREATE INDEX IF NOT EXISTS idx_sale_item_inventory_batches_sale_item
     ON sale_item_inventory_batches(sale_item_id)`
  );
}

async function seedLegacyInventoryBatchIfNeeded(
  connection: DbConnection,
  productId: string,
  branchId: string,
) {
  const [countRows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM inventory_batches
     WHERE product_id = ? AND branch_id = ? AND quantity_remaining > 0`,
    [productId, branchId]
  );

  const existing = toInt((countRows as any[])[0]?.total, 0);
  if (existing > 0) return;

  const [rows] = await connection.query(
    `SELECT i.quantity, p.cost
     FROM inventory i
     INNER JOIN products p ON p.id = i.product_id
     WHERE i.product_id = ? AND i.branch_id = ?
     LIMIT 1`,
    [productId, branchId]
  );

  const inv = (rows as any[])[0];
  const quantity = toInt(inv?.quantity, 0);
  if (quantity <= 0) return;

  const unitCost = toNumber(inv?.cost, 0);
  await recordInboundInventoryBatch(connection, {
    productId,
    branchId,
    quantity,
    unitCost,
    sourceType: "seed",
    sourceRef: `${productId}:${branchId}`,
    sourceItemRef: null,
  });
}

export async function recordInboundInventoryBatch(connection: DbConnection, input: InboundBatchInput) {
  const quantity = Math.max(0, toInt(input.quantity, 0));
  if (quantity <= 0) return null;

  await ensureInventoryBatchSchema(connection);

  const batchId = `ib-${input.sourceType}-${randomSuffix()}`;
  await connection.query(
    `INSERT INTO inventory_batches (
      id, product_id, branch_id, source_type, source_ref, source_item_ref,
      quantity_received, quantity_remaining, unit_cost, received_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), NOW())`,
    [
      batchId,
      input.productId,
      input.branchId,
      input.sourceType,
      input.sourceRef || null,
      input.sourceItemRef || null,
      quantity,
      quantity,
      Number(toNumber(input.unitCost, 0).toFixed(2)),
      input.receivedAt ? new Date(input.receivedAt) : null,
    ]
  );

  return batchId;
}

export async function deleteInboundBatchesBySource(
  connection: DbConnection,
  sourceType: "purchase" | "manual" | "transfer_in" | "seed",
  sourceRef: string,
) {
  await ensureInventoryBatchSchema(connection);
  await connection.query(
    `DELETE FROM inventory_batches WHERE source_type = ? AND source_ref = ?`,
    [sourceType, sourceRef]
  );
}

export async function consumeInventoryFifo(
  connection: DbConnection,
  params: { productId: string; branchId: string; quantity: number }
): Promise<FifoAllocation[]> {
  const requestedQty = Math.max(0, toInt(params.quantity, 0));
  if (requestedQty <= 0) return [];

  await ensureInventoryBatchSchema(connection);
  await seedLegacyInventoryBatchIfNeeded(connection, params.productId, params.branchId);

  const [batchRows] = await connection.query(
    `SELECT id, quantity_remaining, unit_cost, received_at
     FROM inventory_batches
     WHERE product_id = ? AND branch_id = ? AND quantity_remaining > 0
     ORDER BY received_at ASC, created_at ASC, id ASC
     FOR UPDATE`,
    [params.productId, params.branchId]
  );

  const batches = batchRows as any[];
  const totalAvailable = batches.reduce((sum, row) => sum + toInt(row.quantity_remaining, 0), 0);
  if (totalAvailable < requestedQty) {
    throw new Error(`Insufficient stock for product ${params.productId}`);
  }

  const allocations: FifoAllocation[] = [];
  let remaining = requestedQty;

  for (const row of batches) {
    if (remaining <= 0) break;

    const batchAvailable = toInt(row.quantity_remaining, 0);
    if (batchAvailable <= 0) continue;

    const consumeQty = Math.min(batchAvailable, remaining);
    const nextRemaining = batchAvailable - consumeQty;
    const unitCost = Number(toNumber(row.unit_cost, 0).toFixed(2));

    await connection.query(
      `UPDATE inventory_batches
       SET quantity_remaining = ?
       WHERE id = ?`,
      [nextRemaining, row.id]
    );

    allocations.push({
      batchId: String(row.id),
      quantity: consumeQty,
      unitCost,
      totalCost: Number((unitCost * consumeQty).toFixed(2)),
      receivedAt: new Date(row.received_at).toISOString(),
    });

    remaining -= consumeQty;
  }

  return allocations;
}

export async function recordSaleItemBatchAllocations(
  connection: DbConnection,
  saleItemId: string,
  allocations: FifoAllocation[],
) {
  if (!Array.isArray(allocations) || allocations.length === 0) return;
  await ensureInventoryBatchSchema(connection);

  for (const allocation of allocations) {
    await connection.query(
      `INSERT INTO sale_item_inventory_batches (
        id, sale_item_id, batch_id, quantity, unit_cost, total_cost, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        `siib-${randomSuffix()}`,
        saleItemId,
        allocation.batchId,
        allocation.quantity,
        allocation.unitCost,
        allocation.totalCost,
      ]
    );
  }
}
