import { getConnection } from "./db.js";

async function seedActivityLogs() {
  const connection = await getConnection();
  
  try {
    console.log("🌱 Adding sample activity logs...");

    // First, clear existing activity logs to avoid duplicates
    await connection.query("DELETE FROM activity_logs");

    // Insert sample activity logs for Recent Activity section
    const activityLogs = [
      // Recent product additions
      ["log-1", "user-admin-001", "Admin User", "admin", "CREATE", "product", "prod-001", "Frozen Chicken Breast - 5kg pack", "New product added to catalog", '{"category": "Frozen Meat", "price": 850.00}', "192.168.1.1", null, new Date(Date.now() - 2 * 60 * 60 * 1000)], // 2 hours ago
      ["log-2", "user-admin-001", "Admin User", "admin", "CREATE", "product", "prod-002", "Premium Ice Cream - Vanilla 1L", "New product added to catalog", '{"category": "Frozen Desserts", "price": 320.00}', "192.168.1.1", null, new Date(Date.now() - 4 * 60 * 60 * 1000)], // 4 hours ago
      
      // Price updates
      ["log-3", "user-admin-001", "Admin User", "admin", "PRICE_UPDATED", "product_category", "cat-vegetables", "Frozen Vegetables", "Bulk price adjustment for category", '{"old_price_range": "50-200", "new_price_range": "45-180", "discount": "10%"}', "192.168.1.1", null, new Date(Date.now() - 5 * 60 * 60 * 1000)], // 5 hours ago
      ["log-4", "user-admin-001", "Admin User", "admin", "UPDATE", "product", "prod-seafood-001", "Frozen Salmon Fillet 500g", "Price updated due to supplier cost change", '{"old_price": 450.00, "new_price": 420.00}', "192.168.1.1", null, new Date(Date.now() - 8 * 60 * 60 * 1000)], // 8 hours ago
      
      // Sales transactions
      ["log-5", "user-pos-001", "POS Operator", "pos_operator", "SALE_CREATED", "sale", "sale-2847", "Order #2847", "Sale transaction completed", '{"total": 1250.00, "items": 5, "payment_method": "cash", "discount": 125.00}', "192.168.1.100", "branch-003", new Date(Date.now() - 24 * 60 * 60 * 1000)], // 1 day ago
      ["log-6", "user-pos-002", "Branch Manager", "branch_admin", "SALE_CREATED", "sale", "sale-2846", "Order #2846", "Large bulk order processed", '{"total": 3450.00, "items": 12, "payment_method": "card", "customer_type": "wholesale"}', "192.168.1.101", "branch-002", new Date(Date.now() - 25 * 60 * 60 * 1000)], // 1 day ago
      
      // Inventory adjustments
      ["log-7", "user-branch-001", "Branch Admin", "branch_admin", "INVENTORY_ADJUSTED", "inventory", "inv-seafood-001", "Frozen Seafood Collection", "Monthly inventory reconciliation completed", '{"adjusted_items": 15, "total_value_change": -450.00, "reason": "spoilage"}', "192.168.1.102", "branch-001", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)], // 2 days ago
      ["log-8", "user-admin-001", "Admin User", "admin", "INVENTORY_ADJUSTED", "inventory", "inv-chicken-001", "Frozen Chicken Products", "Stock replenishment from supplier", '{"adjusted_items": 50, "total_value_change": 12500.00, "reason": "restock"}', "192.168.1.1", null, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000)], // 2 days ago
      
      // Promotional activities
      ["log-9", "user-admin-001", "Admin User", "admin", "PROMO_ACTIVATED", "promotion", "promo-001", "Weekend Special - 15% Off Frozen Meals", "Weekend promotion activated", '{"discount_type": "percentage", "discount_value": 15, "valid_until": "2025-11-10"}', "192.168.1.1", null, new Date(Date.now() - 3 * 60 * 60 * 1000)], // 3 hours ago
      ["log-10", "user-admin-001", "Admin User", "admin", "PROMO_DEACTIVATED", "promotion", "promo-halloween", "Halloween Bundle Deals", "Seasonal promotion ended", '{"reason": "expired", "total_usage": 45, "total_savings": 2250.00}', "192.168.1.1", null, new Date(Date.now() - 6 * 60 * 60 * 1000)], // 6 hours ago
      
      // User activities
      ["log-11", "user-branch-002", "Jane Smith", "branch_admin", "USER_LOGIN", "auth", "user-branch-002", "Jane Smith", "User logged into system", '{"login_method": "email", "device": "desktop"}', "192.168.1.103", "branch-002", new Date(Date.now() - 30 * 60 * 1000)], // 30 minutes ago
      ["log-12", "user-pos-003", "Mike Johnson", "pos_operator", "USER_LOGIN", "auth", "user-pos-003", "Mike Johnson", "User started shift", '{"login_method": "email", "device": "pos_terminal", "shift": "morning"}', "192.168.1.104", "branch-001", new Date(Date.now() - 60 * 60 * 1000)], // 1 hour ago
    ];

    await connection.query(
      `INSERT INTO activity_logs (
        id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, description, metadata, ip_address, branch_id, created_at
      ) VALUES ?`,
      [activityLogs]
    );

    console.log("✅ Sample activity logs created successfully!");
    console.log(`✅ Added ${activityLogs.length} activity log entries`);
  } catch (error) {
    console.error("❌ Error seeding activity logs:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the seeding
seedActivityLogs().then(() => {
  console.log("🎉 Activity logs seeding completed!");
  process.exit(0);
}).catch((error) => {
  console.error("💥 Seeding failed:", error);
  process.exit(1);
});