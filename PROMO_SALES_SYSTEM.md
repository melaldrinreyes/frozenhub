# Professional Promotional & Sales System Documentation

## Overview
This document describes the professional-grade promotional management and sales posting system implemented for Batangas Premium Bongabong POS.

## 🎯 Key Features

### Promotional System

#### 1. **Comprehensive Validation**
- ✅ Name length validation (3-100 characters)
- ✅ Discount value validation (0-100% for percentage, positive for fixed)
- ✅ Date range validation (start < end, max 365 days duration)
- ✅ Minimum purchase and maximum discount validation
- ✅ Product existence verification
- ✅ At least 1 product must be selected

#### 2. **Conflict Detection**
- ✅ Automatically detects overlapping promos on same products
- ✅ Prevents conflicting promotions during the same period
- ✅ Returns detailed conflict information with promo names and dates
- ✅ Allows admins to make informed decisions

#### 3. **Usage Tracking & Analytics**
- ✅ Tracks how many times each promo has been used
- ✅ Calculates total discount given per promo
- ✅ Measures revenue generated with promos
- ✅ Provides daily usage statistics
- ✅ Shows top-performing promos

#### 4. **Smart Update Logic**
- ✅ **Unused Promos**: Full edit access
- ✅ **Used Promos**: Limited updates to prevent data integrity issues
  - Can update: Description, extend end date, active status
  - Cannot update: Discount values, start date, product list
- ✅ Prevents data corruption from retroactive changes

#### 5. **Safe Deletion**
- ✅ Cannot delete promos that have been used in sales
- ✅ Suggests deactivation instead
- ✅ Shows usage count in error message
- ✅ Transactional deletion to prevent orphaned data

#### 6. **Advanced Features**
- ✅ Bulk activate/deactivate promos
- ✅ Automatic status calculation (active/scheduled/expired/inactive)
- ✅ Days remaining counter
- ✅ Product-specific promo lookup
- ✅ Analytics dashboard with date filtering

### Sales Posting System

#### 1. **Robust Validation**
- ✅ Validates all products exist in database
- ✅ Checks quantity values (positive integers only)
- ✅ Verifies stock availability per branch
- ✅ Validates payment methods
- ✅ Limits to 100 items per sale (performance safeguard)

#### 2. **Automatic Promo Application**
- ✅ Finds best available promo for each product
- ✅ Validates minimum purchase requirements
- ✅ Applies percentage or fixed discounts correctly
- ✅ Respects maximum discount caps
- ✅ Tracks which promo was applied to each item

#### 3. **Price Security**
- ✅ **Server-side price lookup** - Client cannot manipulate prices
- ✅ Uses current product price from database
- ✅ Recalculates all totals server-side
- ✅ Prevents price tampering attacks

#### 4. **Inventory Management**
- ✅ Real-time stock checking before sale
- ✅ Atomic inventory updates (all or nothing)
- ✅ Branch-specific inventory tracking
- ✅ Handles missing inventory records gracefully
- ✅ Transaction rollback on any failure

#### 5. **Transaction Safety**
- ✅ Full database transaction support
- ✅ Automatic rollback on errors
- ✅ Prevents partial sales
- ✅ Maintains data integrity

#### 6. **Comprehensive Receipt Generation**
- ✅ Sale summary with all items
- ✅ Individual item pricing and discounts
- ✅ Promo names applied to each item
- ✅ Subtotal, total discounts, and final total
- ✅ Branch and cashier information
- ✅ Customer information (optional)
- ✅ Sale notes

## 📊 Database Schema Enhancements

### New Columns Added

#### `sales` table:
```sql
- customer_info: TEXT - JSON data of customer information
- notes: TEXT - Additional notes for the sale
- subtotal: DECIMAL(10,2) - Subtotal before discounts
- discount_amount: DECIMAL(10,2) - Total discount amount
```

#### `sale_items` table:
```sql
- subtotal: DECIMAL(10,2) - Item subtotal before discount
- discount_amount: DECIMAL(10,2) - Discount applied to item
- promo_id: VARCHAR(255) - Foreign key to promos table
```

#### `product_promos` table:
```sql
- created_at: DATETIME - When product was added to promo
```

### New Indexes:
```sql
- idx_sale_items_promo - Fast promo lookup in sales
- idx_sales_created_by - Cashier performance tracking
- idx_sales_date - Date-based queries
- idx_promos_dates - Active promo lookups
- idx_promos_active - Filter by active status
```

## 🚀 API Endpoints

### Promotional Endpoints

#### `GET /api/promos/active` (Public)
Get all currently active promotions with usage stats
```typescript
Response: {
  promos: Array<{
    id: string;
    name: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    product_count: number;
    times_used: number;
    avg_discount_amount: number;
    // ... other fields
  }>
}
```

#### `GET /api/promos` (Admin)
Get all promos with comprehensive analytics
```typescript
Response: {
  promos: Array<{
    // Basic promo info
    // Plus:
    times_used: number;
    total_discount_given: number;
    total_revenue_with_promo: number;
    status: "active" | "scheduled" | "expired" | "inactive";
    days_remaining: number;
  }>
}
```

#### `GET /api/promos/:id` (Admin)
Get single promo with products, analytics, and conflicts
```typescript
Response: {
  promo: {
    // Basic promo info
    products: Array<{
      // Product info
      original_price: number;
      discount_amount: number;
      discounted_price: number;
      total_stock: number;
      times_sold_with_promo: number;
    }>;
    conflicts: Array<{
      // Conflicting promos
    }>;
    times_used: number;
    total_discount_given: number;
    total_revenue: number;
    status: string;
  }
}
```

#### `POST /api/promos` (Admin)
Create new promo with validation and conflict detection
```typescript
Request: {
  name: string;
  description?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase?: number;
  max_discount?: number;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  active: boolean;
  product_ids: string[];
}

Response: {
  promo: {...};
  message: string;
}

Error 409 (Conflict): {
  error: "Promo conflicts detected";
  message: string;
  conflicts: Array<{...}>;
}
```

#### `PUT /api/promos/:id` (Admin)
Update promo with smart restrictions
```typescript
// Same request/response as POST
// Special handling for used promos
```

#### `DELETE /api/promos/:id` (Admin)
Delete promo with safety checks
```typescript
Error 400 (Used): {
  error: "Cannot delete promo";
  message: string;
  times_used: number;
}
```

#### `POST /api/promos/bulk` (Admin)
Bulk activate/deactivate promos
```typescript
Request: {
  promo_ids: string[];
  active: boolean;
}

Response: {
  message: string;
  affected: number;
}
```

#### `GET /api/promos/analytics` (Admin)
Get promo performance analytics
```typescript
Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD

Response: {
  overview: {
    total_promos: number;
    active_promos: number;
    total_uses: number;
    total_discounts_given: number;
    revenue_with_promos: number;
    sales_with_promos: number;
  };
  topPromos: Array<{
    id: string;
    name: string;
    times_used: number;
    total_discount_given: number;
    revenue_generated: number;
    sales_count: number;
  }>;
  dailyUsage: Array<{
    date: string;
    uses: number;
    discounts_given: number;
    revenue: number;
  }>;
}
```

### Sales Endpoints

#### `POST /api/sales` (Branch/Admin)
Create new sale with automatic promo application
```typescript
Request: {
  branchId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: "cash" | "card" | "gcash" | "paymaya" | "bank_transfer";
  customerInfo?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  notes?: string;
}

Response: {
  sale: {
    id: string;
    date: string;
    branch_name: string;
    cashier_name: string;
    items: Array<{
      product_name: string;
      product_sku: string;
      quantity: number;
      price: number;
      subtotal: number;
      discount_amount: number;
      total: number;
      promo_id?: string;
      promo_name?: string;
    }>;
    subtotal: number;
    discount_amount: number;
    final_total: number;
    customer_info: {...};
    notes: string;
  };
  message: string;
  summary: {
    items_count: number;
    subtotal: number;
    discount: number;
    total: number;
    promos_applied: number;
  };
}

Error 400 (Insufficient Stock): {
  error: string;
  product: string;
  available: number;
  requested: number;
}
```

## 🔧 Helper Functions

### `calculateDiscount(price, discountType, discountValue, maxDiscount?)`
Calculates the discount amount for a product
- Percentage: `(price * discountValue / 100)`
- Fixed: `discountValue`
- Respects `maxDiscount` cap

### `calculatePromoDiscount(price, quantity, discountType, discountValue, maxDiscount?)`
Calculates discount for a sale item (with quantity)
- Applies discount to subtotal (price × quantity)
- Respects maximum discount limits

### `getValidPromoForProduct(connection, productId, totalAmount)`
Finds the best applicable promo for a product
- Checks promo is active and within date range
- Validates minimum purchase requirement
- Returns highest discount value promo

### `checkPromoConflicts(connection, productIds, startDate, endDate, excludePromoId?)`
Detects overlapping promos on same products
- Checks date range overlaps
- Only checks active promos
- Returns conflicting promo details

## 📝 Usage Examples

### Creating a Promo
```typescript
const promo = await apiClient.createPromo({
  name: "Holiday Sale 2025",
  description: "Special discount for the holidays",
  discount_type: "percentage",
  discount_value: 20,
  min_purchase: 1000,
  max_discount: 500,
  start_date: "2025-12-01",
  end_date: "2025-12-31",
  active: true,
  product_ids: ["prod-1", "prod-2", "prod-3"]
});
```

### Processing a Sale
```typescript
const sale = await apiClient.createSale({
  branchId: "branch-1",
  items: [
    { productId: "prod-1", quantity: 2 },
    { productId: "prod-2", quantity: 1 }
  ],
  paymentMethod: "cash",
  customerInfo: {
    name: "Juan Dela Cruz",
    phone: "09171234567"
  },
  notes: "Customer requests gift wrapping"
});

// Server automatically:
// 1. Validates stock availability
// 2. Looks up current prices
// 3. Finds applicable promos
// 4. Calculates discounts
// 5. Updates inventory
// 6. Generates receipt
```

### Getting Analytics
```typescript
const analytics = await apiClient.getPromoAnalytics(
  "2025-01-01",
  "2025-12-31"
);

console.log(`Total discounts given: ₱${analytics.overview.total_discounts_given}`);
console.log(`Revenue with promos: ₱${analytics.overview.revenue_with_promos}`);
console.log(`Top promo: ${analytics.topPromos[0].name} (${analytics.topPromos[0].times_used} uses)`);
```

## 🔒 Security Features

1. **Price Tampering Prevention**
   - All prices fetched from database server-side
   - Client-provided prices ignored
   - Recalculation of all amounts

2. **Data Integrity**
   - Transaction-based operations
   - Rollback on any failure
   - Foreign key constraints

3. **Authorization**
   - Admin-only promo management
   - Branch-specific sales
   - Role-based access control

4. **Validation**
   - Input sanitization
   - Type checking
   - Range validation
   - Business rule enforcement

## 🎨 Next Steps

1. **Frontend Enhancement** (AdminPromos UI)
   - Add analytics dashboard
   - Show conflict warnings
   - Display usage statistics
   - Add performance charts

2. **POS Interface**
   - Create professional POS page
   - Real-time promo application preview
   - Cart management
   - Receipt printing

3. **Testing**
   - Integration tests
   - Edge case validation
   - Performance testing
   - Load testing

4. **Documentation**
   - User guides
   - Admin training materials
   - API documentation
   - Video tutorials

## 📈 Performance Considerations

- Indexed columns for fast lookups
- Optimized queries with proper joins
- Limited result sets (pagination ready)
- Efficient conflict detection algorithm
- Minimal database round trips

## 🐛 Error Handling

All endpoints include comprehensive error handling:
- 400: Bad Request (validation errors)
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict (promo conflicts)
- 500: Internal Server Error

Error responses include:
- Clear error messages
- Contextual information
- Suggestions for resolution

## 🎯 Business Logic Summary

### Promo Creation
1. Validate all input fields
2. Check date ranges
3. Verify products exist
4. Detect conflicts with existing promos
5. Create promo and associations
6. Return created promo with details

### Promo Updates
1. Check if promo has been used
2. If used: Restrict to safe updates only
3. If unused: Allow full updates
4. Detect new conflicts
5. Update promo and associations
6. Return updated promo

### Sales Processing
1. Validate all products and quantities
2. Check stock availability
3. Fetch current prices (server-side)
4. Find applicable promos for each item
5. Calculate discounts
6. Create sale record
7. Create sale items with promo tracking
8. Update inventory atomically
9. Generate comprehensive receipt

This system ensures data integrity, prevents conflicts, tracks usage, and provides comprehensive analytics for business decision-making.

