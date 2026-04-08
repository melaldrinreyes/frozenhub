-- Sample activity logs for AdminDashboard Recent Activity section
INSERT INTO activity_logs (
  id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, description, metadata, ip_address, branch_id, created_at
) VALUES 
-- Recent product additions
('log-1', 'user-admin-001', 'Admin User', 'admin', 'CREATE', 'product', 'prod-001', 'Frozen Chicken Breast - 5kg pack', 'New product added to catalog', '{"category": "Frozen Meat", "price": 850.00}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('log-2', 'user-admin-001', 'Admin User', 'admin', 'CREATE', 'product', 'prod-002', 'Premium Ice Cream - Vanilla 1L', 'New product added to catalog', '{"category": "Frozen Desserts", "price": 320.00}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 4 HOUR)),

-- Price updates
('log-3', 'user-admin-001', 'Admin User', 'admin', 'PRICE_UPDATED', 'product_category', 'cat-vegetables', 'Frozen Vegetables', 'Bulk price adjustment for category', '{"old_price_range": "50-200", "new_price_range": "45-180", "discount": "10%"}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
('log-4', 'user-admin-001', 'Admin User', 'admin', 'UPDATE', 'product', 'prod-seafood-001', 'Frozen Salmon Fillet 500g', 'Price updated due to supplier cost change', '{"old_price": 450.00, "new_price": 420.00}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 8 HOUR)),

-- Sales transactions
('log-5', 'user-pos-001', 'POS Operator', 'pos_operator', 'SALE_CREATED', 'sale', 'sale-2847', 'Order #2847', 'Sale transaction completed', '{"total": 1250.00, "items": 5, "payment_method": "cash", "discount": 125.00}', '192.168.1.100', 'branch-003', DATE_SUB(NOW(), INTERVAL 1 DAY)),
('log-6', 'user-pos-002', 'Branch Manager', 'branch_admin', 'SALE_CREATED', 'sale', 'sale-2846', 'Order #2846', 'Large bulk order processed', '{"total": 3450.00, "items": 12, "payment_method": "card", "customer_type": "wholesale"}', '192.168.1.101', 'branch-002', DATE_SUB(NOW(), INTERVAL 1 DAY)),

-- Inventory adjustments
('log-7', 'user-branch-001', 'Branch Admin', 'branch_admin', 'INVENTORY_ADJUSTED', 'inventory', 'inv-seafood-001', 'Frozen Seafood Collection', 'Monthly inventory reconciliation completed', '{"adjusted_items": 15, "total_value_change": -450.00, "reason": "spoilage"}', '192.168.1.102', 'branch-001', DATE_SUB(NOW(), INTERVAL 2 DAY)),
('log-8', 'user-admin-001', 'Admin User', 'admin', 'INVENTORY_ADJUSTED', 'inventory', 'inv-chicken-001', 'Frozen Chicken Products', 'Stock replenishment from supplier', '{"adjusted_items": 50, "total_value_change": 12500.00, "reason": "restock"}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),

-- Promotional activities
('log-9', 'user-admin-001', 'Admin User', 'admin', 'PROMO_ACTIVATED', 'promotion', 'promo-001', 'Weekend Special - 15% Off Frozen Meals', 'Weekend promotion activated', '{"discount_type": "percentage", "discount_value": 15, "valid_until": "2025-11-10"}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
('log-10', 'user-admin-001', 'Admin User', 'admin', 'PROMO_DEACTIVATED', 'promotion', 'promo-halloween', 'Halloween Bundle Deals', 'Seasonal promotion ended', '{"reason": "expired", "total_usage": 45, "total_savings": 2250.00}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 6 HOUR)),

-- User activities
('log-11', 'user-branch-002', 'Jane Smith', 'branch_admin', 'USER_LOGIN', 'auth', 'user-branch-002', 'Jane Smith', 'User logged into system', '{"login_method": "email", "device": "desktop"}', '192.168.1.103', 'branch-002', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
('log-12', 'user-pos-003', 'Mike Johnson', 'pos_operator', 'USER_LOGIN', 'auth', 'user-pos-003', 'Mike Johnson', 'User started shift', '{"login_method": "email", "device": "pos_terminal", "shift": "morning"}', '192.168.1.104', 'branch-001', DATE_SUB(NOW(), INTERVAL 1 HOUR)),

-- System maintenance
('log-13', 'user-admin-001', 'Admin User', 'admin', 'UPDATE', 'system', 'backup-001', 'Database Backup', 'Scheduled database backup completed', '{"backup_size": "2.4GB", "duration": "3 minutes", "status": "success"}', '192.168.1.1', NULL, DATE_SUB(NOW(), INTERVAL 3 DAY)),
('log-14', 'user-admin-001', 'Admin User', 'admin', 'CREATE', 'user', 'user-new-001', 'New POS Operator', 'New user account created', '{"role": "pos_operator", "branch": "branch-004", "permissions": "standard"}', '192.168.1.1', 'branch-004', DATE_SUB(NOW(), INTERVAL 4 DAY)),

-- Recent updates
('log-15', 'user-admin-001', 'Admin User', 'admin', 'UPDATE', 'branch', 'branch-003', 'Downtown Branch', 'Branch operating hours updated', '{"old_hours": "9-18", "new_hours": "8-20", "reason": "customer_demand"}', '192.168.1.1', 'branch-003', DATE_SUB(NOW(), INTERVAL 45 MINUTE));