-- Create activity_logs table for tracking all system activities
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100),
  user_name VARCHAR(255),
  user_role ENUM('admin', 'branch_admin', 'pos_operator', 'customer', 'rider'),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  entity_name VARCHAR(255),
  description TEXT,
  metadata JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  branch_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_entity_type (entity_type),
  INDEX idx_entity_id (entity_id),
  INDEX idx_branch_id (branch_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_action (user_id, action),
  INDEX idx_entity_composite (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for searching by date range
CREATE INDEX IF NOT EXISTS idx_created_at_range ON activity_logs(created_at DESC, user_id, action);
