# Enhanced Financial Tracking System

## ✅ Complete Sales, Purchases, and Profit Tracking

### Overview

The system now tracks:
- 📈 **Sales (Income)** - Money coming in from customer sales
- 📉 **Purchases (Expenses)** - Money going out for restocking/inventory
- 💰 **Profit** - Net profit (Sales - Purchases)
- 🏢 **Branch Performance** - Individual branch and consolidated data

---

## API Endpoints

### 1. Sales Trend with Profit Analysis

**Endpoint**: `GET /api/sales/trend`

**Purpose**: Get daily sales, purchases, and profit trend

**Query Parameters**:
- `branchId` (optional) - Filter by specific branch. If omitted, admin sees ALL branches combined
- `days` (optional, default: 7) - Number of days to include

**Response**:
```json
{
  "trend": [
    {
      "date": "2025-11-09",
      "sales": 15000,
      "purchases": 8000,
      "profit": 7000,
      "salesCount": 25,
      "purchasesCount": 3
    },
    {
      "date": "2025-11-10",
      "sales": 18000,
      "purchases": 5000,
      "profit": 13000,
      "salesCount": 30,
      "purchasesCount": 2
    }
  ],
  "totals": {
    "totalSales": 33000,
    "totalPurchases": 13000,
    "totalProfit": 20000,
    "totalTransactions": 60
  }
}
```

**Features**:
- ✅ Shows daily breakdown of sales, purchases, and profit
- ✅ Includes transaction counts
- ✅ Provides grand totals
- ✅ Admin sees ALL branches combined
- ✅ Branch admin sees only their branch
- ✅ Graceful fallback if Firestore index missing

**Usage Example**:
```typescript
// Admin - See all branches
GET /api/sales/trend?days=30

// Branch Admin - See only their branch
GET /api/sales/trend?branchId=branch-001&days=7
```

---

### 2. Sales Statistics with Financial Metrics

**Endpoint**: `GET /api/sales/stats`

**Purpose**: Comprehensive sales and financial statistics

**Query Parameters**:
- `branchId` (optional) - Filter by specific branch
- `startDate` (optional) - Start date (ISO format)
- `endDate` (optional) - End date (ISO format)

**Response**:
```json
{
  "totalSales": 150,
  "totalRevenue": 250000,
  "avgOrderValue": 1666.67,
  
  "totalPurchases": 45,
  "totalExpenses": 120000,
  "avgPurchaseValue": 2666.67,
  
  "totalProfit": 130000,
  "profitMargin": 52.0,
  
  "topProducts": [
    {
      "product_id": "prod-123",
      "name": "Producto A",
      "quantity": 500,
      "revenue": 50000
    }
  ],
  
  "branchBreakdown": [
    {
      "branchId": "branch-001",
      "sales": 50,
      "revenue": 100000,
      "purchases": 15,
      "expenses": 45000,
      "profit": 55000
    },
    {
      "branchId": "branch-002",
      "sales": 100,
      "revenue": 150000,
      "purchases": 30,
      "expenses": 75000,
      "profit": 75000
    }
  ]
}
```

**Features**:
- ✅ Sales metrics (total sales, revenue, average order)
- ✅ Purchase metrics (total purchases, expenses, average cost)
- ✅ Profit calculations (total profit, profit margin %)
- ✅ Top 5 products by revenue
- ✅ Branch-by-branch breakdown (admin only)
- ✅ Date range filtering

**Key Metrics Explained**:
- **Total Revenue** - Sum of all sales amounts
- **Total Expenses** - Sum of all purchase costs (restocking)
- **Total Profit** - Revenue minus Expenses
- **Profit Margin** - (Profit / Revenue) × 100%

---

### 3. Purchase Trend (Expenses Over Time)

**Endpoint**: `GET /api/purchases/trend`

**Purpose**: Track restocking expenses over time

**Query Parameters**:
- `branchId` (optional) - Filter by specific branch
- `days` (optional, default: 7) - Number of days

**Response**:
```json
{
  "trend": [
    {
      "date": "2025-11-09",
      "amount": 8000,
      "count": 3
    },
    {
      "date": "2025-11-10",
      "amount": 5000,
      "count": 2
    }
  ],
  "total": 13000
}
```

**Features**:
- ✅ Daily purchase amounts
- ✅ Number of purchase transactions
- ✅ Total expenses
- ✅ Admin sees all branches
- ✅ Graceful fallback for missing indexes

---

### 4. Purchase Statistics

**Endpoint**: `GET /api/purchases/stats`

**Purpose**: Purchase/expense summary statistics

**Query Parameters**:
- `branchId` (optional)
- `startDate` (optional)
- `endDate` (optional)

**Response**:
```json
{
  "totalPurchases": 45,
  "totalAmount": 120000,
  "avgPurchaseValue": 2666.67,
  
  "branchBreakdown": [
    {
      "branchId": "branch-001",
      "purchases": 15,
      "amount": 45000
    },
    {
      "branchId": "branch-002",
      "purchases": 30,
      "amount": 75000
    }
  ]
}
```

**Features**:
- ✅ Total purchase count and amount
- ✅ Average purchase value
- ✅ Branch-by-branch breakdown (admin only)

---

## Dashboard Integration

### Admin Dashboard (All Branches)

**Overview Cards**:
```typescript
// Fetch consolidated data for all branches
const statsResponse = await fetch('/api/sales/stats');
const stats = await statsResponse.json();

// Display:
- Total Revenue: ₱{stats.totalRevenue}
- Total Expenses: ₱{stats.totalExpenses}
- Net Profit: ₱{stats.totalProfit}
- Profit Margin: {stats.profitMargin}%
```

**Trend Chart**:
```typescript
// Fetch 30-day trend for all branches
const trendResponse = await fetch('/api/sales/trend?days=30');
const { trend, totals } = await trendResponse.json();

// Chart Data:
- Line 1: Sales (green) - trend[].sales
- Line 2: Purchases (red) - trend[].purchases
- Line 3: Profit (blue) - trend[].profit
```

**Branch Performance Table**:
```typescript
// Already included in stats response
stats.branchBreakdown.forEach(branch => {
  // Display:
  - Branch ID
  - Sales Count
  - Revenue
  - Purchase Count
  - Expenses
  - Profit
});
```

---

### Branch Dashboard (Single Branch)

**Overview Cards**:
```typescript
// Fetch data for specific branch
const branchId = user.branch_id; // From user session
const statsResponse = await fetch(`/api/sales/stats?branchId=${branchId}`);
const stats = await statsResponse.json();

// Display:
- Branch Revenue: ₱{stats.totalRevenue}
- Branch Expenses: ₱{stats.totalExpenses}
- Branch Profit: ₱{stats.totalProfit}
- Profit Margin: {stats.profitMargin}%
```

**Trend Chart**:
```typescript
// Fetch 7-day trend for this branch
const trendResponse = await fetch(`/api/sales/trend?branchId=${branchId}&days=7`);
const { trend } = await trendResponse.json();

// Chart shows branch-specific data only
```

---

## Data Flow Examples

### Example 1: Admin Views Overall Performance

**Request**:
```
GET /api/sales/trend?days=30
```

**What Happens**:
1. Server queries ALL sales from all branches (last 30 days)
2. Server queries ALL purchases from all branches (last 30 days)
3. Groups data by date
4. Calculates daily profit (sales - purchases)
5. Returns consolidated trend data

**Result**: Admin sees company-wide financial performance

---

### Example 2: Branch Admin Views Their Performance

**Request**:
```
GET /api/sales/trend?branchId=branch-001&days=7
```

**What Happens**:
1. Server queries sales ONLY from branch-001 (last 7 days)
2. Server queries purchases ONLY from branch-001 (last 7 days)
3. Groups data by date
4. Calculates daily profit for this branch
5. Returns branch-specific trend data

**Result**: Branch admin sees only their branch performance

---

### Example 3: Tracking Expenses (Restocking)

**Scenario**: Branch receives inventory from supplier

**Request**:
```
POST /api/purchases
{
  "branchId": "branch-001",
  "supplierId": "supplier-123",
  "items": [
    { "productId": "prod-123", "quantity": 100, "unitCost": 50 }
  ]
}
```

**What Happens**:
1. Purchase record created with total_amount = ₱5,000
2. Inventory increased by 100 units
3. Purchase shows up in:
   - `/api/purchases/trend` - Daily expenses chart
   - `/api/sales/trend` - Reduces profit for that day
   - `/api/sales/stats` - Included in totalExpenses

**Result**: Expense is tracked and reflected in profit calculations

---

## Chart Visualization Examples

### Multi-Line Chart (Sales vs Purchases vs Profit)

```typescript
import { Line } from 'recharts';

<LineChart data={trend}>
  <Line 
    type="monotone" 
    dataKey="sales" 
    stroke="#10b981" 
    name="Sales (Income)"
  />
  <Line 
    type="monotone" 
    dataKey="purchases" 
    stroke="#ef4444" 
    name="Purchases (Expenses)"
  />
  <Line 
    type="monotone" 
    dataKey="profit" 
    stroke="#3b82f6" 
    name="Profit"
  />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Legend />
</LineChart>
```

---

### Bar Chart (Branch Comparison)

```typescript
import { Bar } from 'recharts';

<BarChart data={branchBreakdown}>
  <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
  <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
  <XAxis dataKey="branchId" />
  <YAxis />
  <Tooltip />
  <Legend />
</BarChart>
```

---

## Key Features Summary

### ✅ For Admin (System-Wide View)
- View consolidated sales, purchases, and profit for ALL branches
- Compare branch performance side-by-side
- Track company-wide financial health
- Identify top-performing and underperforming branches
- Monitor overall expenses and profit margins

### ✅ For Branch Admin (Branch-Specific View)
- View sales, purchases, and profit for their branch only
- Track daily financial performance
- Monitor restocking expenses
- Calculate branch profitability
- Access top products for their branch

### ✅ Financial Tracking
- **Income**: All sales transactions are tracked
- **Expenses**: All purchase/restocking transactions are tracked
- **Profit**: Automatically calculated (Income - Expenses)
- **Profit Margin**: Percentage-based profitability metric
- **Trends**: Daily breakdown over configurable time periods

### ✅ Data Accuracy
- Transaction-based operations ensure data integrity
- Real-time calculations (no cached/stale data)
- Graceful error handling for missing Firestore indexes
- Comprehensive logging for debugging

---

## Testing Checklist

### Admin Tests
- [ ] View sales trend without branchId (should show all branches)
- [ ] Verify totals match sum of all branch data
- [ ] Check branchBreakdown in stats response
- [ ] Confirm profit = revenue - expenses
- [ ] Test with different date ranges

### Branch Admin Tests
- [ ] View sales trend with branchId (should show only their branch)
- [ ] Verify no access to other branch data
- [ ] Check that purchases affect profit calculations
- [ ] Test 7-day and 30-day trends
- [ ] Confirm top products are branch-specific

### Data Accuracy Tests
- [ ] Create sale → Check revenue increases
- [ ] Create purchase → Check expenses increases
- [ ] Verify profit = revenue - expenses
- [ ] Test with multiple branches
- [ ] Verify transaction counts are correct

---

## Performance Considerations

### Firestore Indexes
Create these composite indexes for optimal performance:

```
Collection: sales
Fields: branch_id (Ascending), sale_date (Ascending)

Collection: purchases
Fields: branch_id (Ascending), purchase_date (Ascending)
```

**Note**: System includes graceful fallbacks, so it works without indexes (just slower with large datasets)

### Optimization Tips
1. Use date range filters to limit data volume
2. Implement caching for frequently accessed stats
3. Consider pre-aggregating daily totals for large datasets
4. Use pagination for large result sets

---

## Summary

### What's New:
✅ **Sales Trend** - Now includes purchases and profit, not just sales
✅ **Admin View** - See ALL branches consolidated
✅ **Branch View** - See only specific branch data
✅ **Expense Tracking** - All purchases (restocking) are tracked
✅ **Profit Calculation** - Automatic profit = sales - purchases
✅ **Profit Margin** - Percentage-based profitability metric
✅ **Branch Breakdown** - Compare performance across branches
✅ **Purchase Trend** - Dedicated endpoint for expense tracking

### API Routes:
- `GET /api/sales/trend` - Sales, purchases, profit over time
- `GET /api/sales/stats` - Comprehensive financial statistics
- `GET /api/purchases/trend` - Expense trend over time
- `GET /api/purchases/stats` - Purchase/expense statistics

### Key Metrics:
- **Total Revenue** - Income from sales
- **Total Expenses** - Cost of purchases/restocking
- **Total Profit** - Net profit (revenue - expenses)
- **Profit Margin** - Profitability percentage
- **Daily Trends** - Day-by-day financial performance
- **Branch Performance** - Individual branch comparison

**Status**: 🟢 Production Ready
