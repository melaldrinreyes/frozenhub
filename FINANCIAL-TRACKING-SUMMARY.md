# Financial Tracking System - Quick Reference

## 🎯 Ano ang Ginawa?

### 1. **Sales Trend** - Enhanced with Profit Tracking
- ✅ Shows **Sales** (income/kita)
- ✅ Shows **Purchases** (expenses/gastos sa restock)
- ✅ Shows **Profit** (tubo = sales - purchases)
- ✅ Admin sees **ALL branches combined**
- ✅ Branch admin sees **only their branch**

### 2. **Sales Statistics** - Complete Financial Overview
- ✅ Total Revenue (lahat ng benta)
- ✅ Total Expenses (lahat ng gastos sa restock)
- ✅ Total Profit (net tubo)
- ✅ Profit Margin (profit percentage)
- ✅ Branch-by-branch breakdown (admin only)
- ✅ Top products by revenue

### 3. **Purchase Trend** - Expense Tracking
- ✅ Daily expenses (gastos sa pag-restock)
- ✅ Purchase count per day
- ✅ Total expenses for period

### 4. **Purchase Statistics**
- ✅ Total purchases
- ✅ Total amount spent
- ✅ Average purchase value
- ✅ Branch breakdown (admin only)

---

## 📊 API Endpoints

### For Sales & Profit Tracking

```bash
# ADMIN - View ALL branches consolidated
GET /api/sales/trend?days=30

# BRANCH ADMIN - View only their branch
GET /api/sales/trend?branchId=branch-001&days=7

# ADMIN - Get financial stats for ALL branches
GET /api/sales/stats

# BRANCH ADMIN - Get stats for their branch
GET /api/sales/stats?branchId=branch-001
```

### For Purchase/Expense Tracking

```bash
# View purchase trend (expenses over time)
GET /api/purchases/trend?days=30
GET /api/purchases/trend?branchId=branch-001&days=7

# Get purchase statistics
GET /api/purchases/stats
GET /api/purchases/stats?branchId=branch-001
```

---

## 📈 Response Examples

### Sales Trend Response (with Profit)

```json
{
  "trend": [
    {
      "date": "2025-11-09",
      "sales": 15000,           // Kita
      "purchases": 8000,         // Gastos
      "profit": 7000,            // Tubo
      "salesCount": 25,          // Bilang ng benta
      "purchasesCount": 3        // Bilang ng restock
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

### Sales Statistics Response

```json
{
  // Sales metrics
  "totalSales": 150,
  "totalRevenue": 250000,
  "avgOrderValue": 1666.67,
  
  // Purchase metrics (expenses)
  "totalPurchases": 45,
  "totalExpenses": 120000,
  "avgPurchaseValue": 2666.67,
  
  // Profit metrics
  "totalProfit": 130000,          // Revenue - Expenses
  "profitMargin": 52.0,           // (Profit / Revenue) × 100
  
  // Top products
  "topProducts": [...],
  
  // Branch comparison (admin only)
  "branchBreakdown": [
    {
      "branchId": "branch-001",
      "sales": 50,
      "revenue": 100000,
      "purchases": 15,
      "expenses": 45000,
      "profit": 55000
    }
  ]
}
```

---

## 🏢 How It Works

### For Admin (Lahat ng Branch)

1. **No branchId parameter** = See ALL branches combined
2. Gets data from ALL sales and purchases
3. Shows consolidated company-wide performance
4. Includes branch-by-branch breakdown

**Example**:
```typescript
// Admin dashboard
const response = await fetch('/api/sales/trend?days=30');
const { trend, totals } = await response.json();

// Shows combined data from ALL branches:
// - Total company sales
// - Total company expenses
// - Total company profit
```

### For Branch Admin (Specific Branch Lang)

1. **With branchId parameter** = See only that branch
2. Gets data ONLY from their branch
3. Shows branch-specific performance only

**Example**:
```typescript
// Branch dashboard
const branchId = user.branch_id; // From session
const response = await fetch(`/api/sales/trend?branchId=${branchId}&days=7`);
const { trend, totals } = await response.json();

// Shows ONLY their branch data
```

---

## 💰 Profit Calculation

### Formula:
```
PROFIT = SALES - PURCHASES
```

### Example:
- Sales Today: ₱15,000 (income from customers)
- Purchases Today: ₱8,000 (cost of restocking)
- **Profit Today: ₱7,000** (net gain)

### Profit Margin:
```
PROFIT MARGIN = (PROFIT / SALES) × 100
```

Example:
- Profit: ₱7,000
- Sales: ₱15,000
- **Profit Margin: 46.67%**

---

## 📉 Expense Tracking

### Kapag Nag-restock (Receiving Inventory):

```typescript
// Create purchase
POST /api/purchases
{
  "branchId": "branch-001",
  "items": [
    { "productId": "prod-123", "quantity": 100, "unitCost": 50 }
  ]
}

// Total cost: 100 × ₱50 = ₱5,000
```

**What Happens**:
1. ✅ Purchase recorded with amount = ₱5,000
2. ✅ Inventory increased by 100 units
3. ✅ Expense appears in `/api/purchases/trend`
4. ✅ Reduces profit in `/api/sales/trend`
5. ✅ Included in statistics

---

## 🎨 Dashboard Integration

### Admin Dashboard

```typescript
// Get overall stats
const stats = await fetch('/api/sales/stats').then(r => r.json());

// Display cards:
<Card>Total Revenue: ₱{stats.totalRevenue}</Card>
<Card>Total Expenses: ₱{stats.totalExpenses}</Card>
<Card>Net Profit: ₱{stats.totalProfit}</Card>
<Card>Profit Margin: {stats.profitMargin}%</Card>

// Show trend chart
const trend = await fetch('/api/sales/trend?days=30').then(r => r.json());

<LineChart data={trend.trend}>
  <Line dataKey="sales" stroke="green" />
  <Line dataKey="purchases" stroke="red" />
  <Line dataKey="profit" stroke="blue" />
</LineChart>

// Branch comparison table
<Table data={stats.branchBreakdown}>
  <Column header="Branch" field="branchId" />
  <Column header="Revenue" field="revenue" />
  <Column header="Expenses" field="expenses" />
  <Column header="Profit" field="profit" />
</Table>
```

### Branch Dashboard

```typescript
const branchId = user.branch_id;

// Get branch stats
const stats = await fetch(`/api/sales/stats?branchId=${branchId}`)
  .then(r => r.json());

// Display branch-specific metrics
<Card>Branch Revenue: ₱{stats.totalRevenue}</Card>
<Card>Branch Expenses: ₱{stats.totalExpenses}</Card>
<Card>Branch Profit: ₱{stats.totalProfit}</Card>

// Show branch trend
const trend = await fetch(`/api/sales/trend?branchId=${branchId}&days=7`)
  .then(r => r.json());

<LineChart data={trend.trend}>
  <Line dataKey="sales" stroke="green" />
  <Line dataKey="purchases" stroke="red" />
  <Line dataKey="profit" stroke="blue" />
</LineChart>
```

---

## 🔍 Testing Examples

### Test 1: Admin View (All Branches)
```bash
# Admin user (no branchId)
curl "http://localhost:8080/api/sales/trend?days=30"

# Should return:
# - Combined sales from ALL branches
# - Combined purchases from ALL branches
# - Combined profit
```

### Test 2: Branch View (Specific Branch)
```bash
# Branch admin user (with branchId)
curl "http://localhost:8080/api/sales/trend?branchId=branch-001&days=7"

# Should return:
# - Sales from branch-001 only
# - Purchases from branch-001 only
# - Profit for branch-001 only
```

### Test 3: Expense Tracking
```bash
# 1. Check current trend
curl "http://localhost:8080/api/sales/trend?days=1"

# 2. Create purchase (restock)
curl -X POST "http://localhost:8080/api/purchases" \
  -H "Content-Type: application/json" \
  -d '{"branchId":"branch-001","items":[{"productId":"prod-123","quantity":50,"unitCost":100}]}'

# 3. Check trend again
curl "http://localhost:8080/api/sales/trend?days=1"

# Should show:
# - Purchases increased by ₱5,000
# - Profit decreased by ₱5,000
```

---

## ✅ Summary

### New Features:
1. **Sales Trend** - Shows sales, purchases, and profit together
2. **Profit Calculation** - Automatic: sales - purchases
3. **Admin View** - See ALL branches consolidated
4. **Branch View** - See only specific branch
5. **Expense Tracking** - All purchases/restocking tracked
6. **Financial Metrics** - Profit, profit margin, branch breakdown

### Key Endpoints:
- `/api/sales/trend` - Sales, purchases, profit over time
- `/api/sales/stats` - Complete financial statistics
- `/api/purchases/trend` - Expense trend
- `/api/purchases/stats` - Purchase statistics

### Key Benefits:
✅ **Complete Financial Visibility** - See income, expenses, and profit
✅ **Multi-Branch Support** - Admin sees all, branches see theirs
✅ **Real-Time Calculations** - No cached/stale data
✅ **Profit Tracking** - Automatic profit calculation
✅ **Expense Monitoring** - Track restocking costs
✅ **Performance Comparison** - Compare branches

**Status**: 🟢 Ready to Use!
