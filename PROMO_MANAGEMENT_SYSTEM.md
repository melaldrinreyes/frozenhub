# Promo Management System

## Overview
The Promo Management System allows administrators to create, manage, and apply promotional discounts to products. This comprehensive system supports percentage-based and fixed-amount discounts with advanced features like minimum purchase requirements, maximum discount caps, and date-based validity.

## Features

### 1. **Promo Types**
- **Percentage Discount**: Apply a percentage off (e.g., 20% OFF)
- **Fixed Amount Discount**: Apply a fixed peso discount (e.g., ₱100 OFF)

### 2. **Advanced Controls**
- **Minimum Purchase**: Set a minimum order value to qualify for the promo
- **Maximum Discount**: Cap the maximum discount amount (for percentage promos)
- **Validity Period**: Set start and end dates for the promotion
- **Active/Inactive**: Toggle promos on or off without deleting them

### 3. **Product Assignment**
- Apply promos to specific products
- Multi-select interface for easy product selection
- View all products associated with a promo
- Update product assignments anytime

## Database Schema

### Promos Table
```sql
CREATE TABLE promos (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type ENUM('percentage', 'fixed') NOT NULL,
  discount_value DECIMAL(10, 2) NOT NULL,
  min_purchase DECIMAL(10, 2) DEFAULT 0,
  max_discount DECIMAL(10, 2) DEFAULT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL,
  created_by VARCHAR(255),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Product Promos Junction Table
```sql
CREATE TABLE product_promos (
  id VARCHAR(255) PRIMARY KEY,
  promo_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  UNIQUE KEY unique_promo_product (promo_id, product_id),
  FOREIGN KEY (promo_id) REFERENCES promos(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

## API Endpoints

### Admin Endpoints (Requires admin role)

#### Get All Promos
```
GET /api/promos
```
**Response:**
```json
{
  "promos": [
    {
      "id": "promo-1234567890",
      "name": "Black Friday Sale",
      "description": "Huge discounts for Black Friday",
      "discount_type": "percentage",
      "discount_value": 30.00,
      "min_purchase": 500.00,
      "max_discount": 1000.00,
      "start_date": "2025-11-24T00:00:00.000Z",
      "end_date": "2025-11-30T23:59:59.000Z",
      "active": true,
      "product_count": 15,
      "creator_name": "Admin User"
    }
  ]
}
```

#### Get Single Promo with Products
```
GET /api/promos/:id
```
**Response:**
```json
{
  "promo": {
    "id": "promo-1234567890",
    "name": "Black Friday Sale",
    "products": [
      {
        "id": "prod-123",
        "name": "Premium Ice Cream",
        "sku": "SKU-001",
        "price": 299.00,
        "category": "Desserts",
        "image": "/uploads/products/..."
      }
    ]
  }
}
```

#### Create Promo
```
POST /api/promos
```
**Request Body:**
```json
{
  "name": "Weekend Special",
  "description": "Weekend discount on selected items",
  "discount_type": "percentage",
  "discount_value": 15.00,
  "min_purchase": 300.00,
  "max_discount": 500.00,
  "start_date": "2025-12-01",
  "end_date": "2025-12-03",
  "active": true,
  "product_ids": ["prod-123", "prod-456", "prod-789"]
}
```

#### Update Promo
```
PUT /api/promos/:id
```
**Request Body:** Same as Create Promo

#### Delete Promo
```
DELETE /api/promos/:id
```
**Response:**
```json
{
  "message": "Promo deleted successfully"
}
```

### Public Endpoint

#### Get Active Promos for a Product
```
GET /api/products/:productId/promos
```
**Response:**
```json
{
  "promos": [
    {
      "id": "promo-1234567890",
      "name": "Black Friday Sale",
      "discount_type": "percentage",
      "discount_value": 30.00,
      "min_purchase": 500.00
    }
  ]
}
```

## Usage Examples

### Example 1: Create a Percentage Discount Promo
```typescript
const promo = {
  name: "Summer Sale",
  description: "Cool down with icy discounts!",
  discount_type: "percentage",
  discount_value: 25.00,
  min_purchase: 500.00,
  max_discount: 1000.00,
  start_date: "2025-06-01",
  end_date: "2025-08-31",
  active: true,
  product_ids: ["prod-123", "prod-456"]
};

await apiClient.createPromo(promo);
```

**Result**: 25% OFF on selected products with:
- Minimum purchase of ₱500
- Maximum discount capped at ₱1,000
- Valid from June 1 to August 31

### Example 2: Create a Fixed Amount Discount Promo
```typescript
const promo = {
  name: "Holiday Special",
  description: "Get ₱200 OFF on your purchase!",
  discount_type: "fixed",
  discount_value: 200.00,
  min_purchase: 1000.00,
  max_discount: null, // Not applicable for fixed discounts
  start_date: "2025-12-15",
  end_date: "2025-12-31",
  active: true,
  product_ids: ["prod-789"]
};

await apiClient.createPromo(promo);
```

**Result**: ₱200 OFF on purchase of ₱1,000 or more

### Example 3: Buy More, Save More
```typescript
const promo = {
  name: "Bulk Buy Discount",
  description: "Save more when you buy more!",
  discount_type: "percentage",
  discount_value: 40.00,
  min_purchase: 2000.00,
  max_discount: 2000.00,
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  active: true,
  product_ids: ["prod-001", "prod-002", "prod-003"]
};

await apiClient.createPromo(promo);
```

**Result**: 40% OFF on purchases above ₱2,000 (max ₱2,000 discount)

## Admin UI Features

### Promo List View
- **Visual Status Indicators**:
  - 🟢 **Active**: Promo is currently running
  - 🟡 **Scheduled**: Promo will start in the future
  - ⚪ **Inactive**: Promo is disabled

- **Quick Actions**:
  - Edit promo details
  - View associated products
  - Delete promo
  - Toggle active status

### Create/Edit Promo Dialog
- **Form Fields**:
  - Promo Name (required)
  - Description (optional)
  - Discount Type (percentage/fixed)
  - Discount Value (required)
  - Minimum Purchase
  - Maximum Discount (for percentage only)
  - Start Date (required)
  - End Date (required)
  - Active Status (toggle)
  - Product Selection (multi-select with images)

- **Validation**:
  - Percentage discounts must be between 0-100
  - End date must be after start date
  - Discount value must be positive

### Product Selection Interface
- **Features**:
  - Visual product cards with images
  - Product name, SKU, and price display
  - Checkbox selection
  - Search/filter capabilities
  - Selected count indicator

## Business Logic

### Promo Application Rules

1. **Date Validation**:
   - Promo must be active (`active = true`)
   - Current date must be between `start_date` and `end_date`

2. **Minimum Purchase**:
   - Cart total must meet or exceed `min_purchase` value

3. **Discount Calculation**:
   ```typescript
   // Percentage Discount
   discount = price * (discount_value / 100)
   if (max_discount && discount > max_discount) {
     discount = max_discount
   }
   
   // Fixed Discount
   discount = discount_value
   ```

4. **Multiple Promos**:
   - Products can have multiple promos
   - API returns promos ordered by discount value (descending)
   - Frontend/POS can choose which promo to apply

## Integration with POS

### Display Product Promos
```typescript
// Fetch active promos for a product
const { promos } = await apiClient.getProductPromos(productId);

if (promos.length > 0) {
  const bestPromo = promos[0]; // Highest discount first
  displayPromoBadge(bestPromo);
}
```

### Calculate Discounted Price
```typescript
function calculateDiscount(price: number, promo: Promo, cartTotal: number) {
  // Check minimum purchase
  if (cartTotal < promo.min_purchase) {
    return 0;
  }
  
  if (promo.discount_type === 'percentage') {
    let discount = price * (promo.discount_value / 100);
    
    // Apply max discount cap
    if (promo.max_discount && discount > promo.max_discount) {
      discount = promo.max_discount;
    }
    
    return discount;
  } else {
    return promo.discount_value;
  }
}

const discountedPrice = price - calculateDiscount(price, promo, cartTotal);
```

## Best Practices

### Creating Effective Promos

1. **Clear Naming**: Use descriptive names (e.g., "Black Friday Sale", "Weekend Special")
2. **Set Realistic Limits**: Don't set discounts too high (consider profit margins)
3. **Strategic Timing**: Align promos with holidays, weekends, or slow periods
4. **Targeted Products**: Apply promos to specific products to move inventory
5. **Minimum Purchase**: Encourage larger orders with minimum purchase requirements

### Promo Strategy Examples

#### Clearance Sale
```typescript
{
  name: "Clearance Sale",
  discount_type: "percentage",
  discount_value: 50.00,
  min_purchase: 0, // No minimum
  start_date: "2025-12-26",
  end_date: "2025-12-31"
}
```

#### First Purchase Discount
```typescript
{
  name: "New Customer Discount",
  discount_type: "fixed",
  discount_value: 100.00,
  min_purchase: 500.00,
  start_date: "2025-01-01",
  end_date: "2025-12-31"
}
```

#### Bulk Order Incentive
```typescript
{
  name: "Bulk Order Discount",
  discount_type: "percentage",
  discount_value: 30.00,
  min_purchase: 3000.00,
  max_discount: 3000.00,
  start_date: "2025-01-01",
  end_date: "2025-12-31"
}
```

## Troubleshooting

### Promo Not Showing on Product
1. Check promo is `active = true`
2. Verify current date is within start/end dates
3. Confirm product is assigned to the promo
4. Clear cache and refresh

### Discount Not Applying
1. Verify cart total meets `min_purchase` requirement
2. Check promo validity dates
3. Ensure promo is active
4. Review discount calculation logic

### Multiple Promos Conflict
- System returns all applicable promos
- POS/Frontend should implement logic to choose best promo
- Consider customer preference or highest discount

## Future Enhancements

Potential features to add:
- **Category-wide promos**: Apply to all products in a category
- **Buy X Get Y**: BOGO deals
- **Tiered discounts**: Different discounts at different quantity levels
- **Coupon codes**: Customer-entered codes
- **Usage limits**: Limit how many times a promo can be used
- **Customer segments**: Target specific customer groups
- **Analytics**: Track promo performance and ROI

