-- COD Remittance System: Tracks payment collections from riders and remittances to branches
-- Enables rider to collect COD payments and remit to their assigned branch

-- Table: cod_collections
-- Stores pending COD payment collections assigned to riders
CREATE TABLE IF NOT EXISTS cod_collections (
  id VARCHAR(255) PRIMARY KEY,
  sale_id VARCHAR(255) NOT NULL UNIQUE,
  rider_id VARCHAR(255) NOT NULL,
  branch_id VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status ENUM('pending', 'collected', 'remitted', 'cancelled') DEFAULT 'pending' COMMENT 'pending=awaiting collection, collected=rider collected, remitted=remitted to branch, cancelled',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  collected_at DATETIME NULL COMMENT 'When rider marked as collected',
  collected_notes TEXT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  
  KEY idx_rider_id (rider_id),
  KEY idx_branch_id (branch_id),
  KEY idx_status (status),
  KEY idx_rider_status (rider_id, status),
  KEY idx_branch_status (branch_id, status),
  KEY idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: remittances
-- Tracks remittance transactions when riders submit collected money to branch
CREATE TABLE IF NOT EXISTS remittances (
  id VARCHAR(255) PRIMARY KEY,
  rider_id VARCHAR(255) NOT NULL,
  branch_id VARCHAR(255) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  collection_count INT DEFAULT 0 COMMENT 'Number of COD collections remitted',
  notes TEXT,
  status ENUM('pending', 'acknowledged', 'verified') DEFAULT 'pending' COMMENT 'pending=submitted, acknowledged=branch received, verified=branch verified',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME NULL COMMENT 'When branch acknowledged receipt',
  acknowledged_by_user_id VARCHAR(255) NULL COMMENT 'Branch admin who acknowledged',
  verified_at DATETIME NULL COMMENT 'When branch verified amount',
  verified_by_user_id VARCHAR(255) NULL COMMENT 'Branch admin who verified',
  
  FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  
  KEY idx_rider_id (rider_id),
  KEY idx_branch_id (branch_id),
  KEY idx_status (status),
  KEY idx_rider_status (rider_id, status),
  KEY idx_branch_status (branch_id, status),
  KEY idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: remittance_items
-- Individual collections included in a remittance
CREATE TABLE IF NOT EXISTS remittance_items (
  id VARCHAR(255) PRIMARY KEY,
  remittance_id VARCHAR(255) NOT NULL,
  cod_collection_id VARCHAR(255) NOT NULL,
  sale_id VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (remittance_id) REFERENCES remittances(id) ON DELETE CASCADE,
  FOREIGN KEY (cod_collection_id) REFERENCES cod_collections(id) ON DELETE RESTRICT,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
  
  KEY idx_remittance_id (remittance_id),
  KEY idx_cod_collection_id (cod_collection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add COD tracking column to sales table if not exists
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS is_cod_pending BOOLEAN DEFAULT FALSE COMMENT 'For online orders: true if payment_method=cod and not yet remitted',
ADD COLUMN IF NOT EXISTS cod_collection_id VARCHAR(255) COMMENT 'Link to cod_collections record',
ADD COLUMN IF NOT EXISTS remittance_id VARCHAR(255) COMMENT 'Link to remittances (for tracking which remittance this order was remitted in',
ADD KEY idx_is_cod_pending (is_cod_pending),
ADD KEY idx_cod_collection_id (cod_collection_id);

SELECT 'COD Remittance System tables created successfully!' as message;
