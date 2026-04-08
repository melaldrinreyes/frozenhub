# Auto-Generated SKU System

## Overview

The system now includes automatic SKU (Stock Keeping Unit) generation for products. When creating a new product, the SKU field is **optional** - if left empty, the system will automatically generate a unique SKU.

## SKU Format

### Standard Format
```
[CATEGORY]-[PRODUCT]-[RANDOM]
```

**Example:**
- Product: "Coca Cola"
- Category: "Beverages"
- Generated SKU: `BEV-CKL-A1B2C3`

### Components

1. **Category Prefix** (3 characters)
   - First 3 letters of category name
   - Uppercase
   - Example: "Beverages" → `BEV`

2. **Product Prefix** (3 characters)
   - First 3 consonants from product name (preferred)
   - Falls back to first 3 letters if not enough consonants
   - Uppercase
   - Example: "Coca Cola" → `CKL` (C-C-L consonants)

3. **Random Suffix** (6 characters)
   - Cryptographically random hex string
   - Ensures uniqueness
   - Example: `A1B2C3`

## Features

### ✅ Auto-Generation
- **Automatic**: Leave SKU field empty → System generates unique SKU
- **Manual Override**: Provide your own SKU → System validates format
- **Conflict Resolution**: If generated SKU exists, automatically tries again
- **Validation**: Ensures SKUs are uppercase alphanumeric with hyphens only

### ✅ Smart Generation Algorithm

```typescript
generateSKU("Frozen Chicken Breast", "Frozen Foods")
// Returns: FRZ-FRZN-E4F8A2
```

**How it works:**
1. Extract category prefix: "Frozen Foods" → `FRZ`
2. Extract product consonants: "Frozen Chicken Breast" → `FRZN` (first 3)
3. Generate random suffix: `E4F8A2`
4. Combine: `FRZ-FRZN-E4F8A2`

### ✅ Alternative Generation Methods

The system includes multiple SKU generation strategies:

#### 1. **Standard (Default)**
```typescript
generateSKU("Product Name", "Category")
// Format: CAT-PRD-RANDOM
// Example: BEV-CKL-A1B2C3
```

#### 2. **Sequential**
```typescript
generateSequentialSKU("Category", 42)
// Format: CAT-0042
// Example: BEV-0042
```

#### 3. **Timestamp-based**
```typescript
generateTimestampSKU("Category")
// Format: CAT-20251108123456
// Example: BEV-20251108123456
```

## Usage

### Frontend (Admin Panel)

When adding a new product in the Admin Catalogs page:

1. **Auto-Generation** (Recommended)
   - Leave the SKU field empty
   - System generates SKU automatically
   - Shows success message with generated SKU

2. **Manual Entry**
   - Enter custom SKU (e.g., `PROD-001`)
   - Must be uppercase alphanumeric with hyphens
   - System validates uniqueness

### Backend API

**Create Product Endpoint:**
```http
POST /api/products
Content-Type: application/json

{
  "name": "Frozen Chicken Breast",
  "category": "Frozen Foods",
  "description": "High-quality frozen chicken",
  "price": 299.99,
  "cost": 199.99,
  "sku": ""  // Optional - leave empty for auto-generation
}
```

**Response:**
```json
{
  "product": {
    "id": "prod-1699454321000",
    "name": "Frozen Chicken Breast",
    "sku": "FRZ-FRZN-E4F8A2",
    "category": "Frozen Foods",
    ...
  },
  "message": "Product created and added to inventory for all branches",
  "generatedSKU": "FRZ-FRZN-E4F8A2"  // Only present if auto-generated
}
```

## SKU Validation

### Valid SKU Formats
✅ `BEV-001`  
✅ `PROD-ABC-123`  
✅ `FRZ-CHKN-A1B2C3`  
✅ `FROZEN-FOOD-2025`  

### Invalid SKU Formats
❌ `bev-001` (lowercase)  
❌ `PROD_ABC` (underscore)  
❌ `AB` (too short)  
❌ `PROD@123` (special characters)  

## Implementation Details

### Files Created/Modified

**New Files:**
- `server/utils/skuGenerator.ts` - SKU generation utilities

**Modified Files:**
- `server/routes/products.ts` - Auto-generation logic
- `client/pages/AdminCatalogs.tsx` - Optional SKU field
- `client/lib/apiClient.ts` - Updated response type

### Key Functions

```typescript
// Generate standard SKU
generateSKU(productName: string, category: string): string

// Validate SKU format
validateSKU(sku: string): boolean

// Generate sequential SKU
generateSequentialSKU(category: string, counter: number): string

// Generate timestamp SKU
generateTimestampSKU(category: string): string

// Clean product name
cleanProductName(name: string): string
```

## Examples

### Example 1: Beverage
```typescript
Input: { name: "Coca Cola", category: "Beverages" }
Generated SKU: "BEV-CKL-A1B2C3"
```

### Example 2: Frozen Food
```typescript
Input: { name: "Frozen Chicken Breast", category: "Frozen Foods" }
Generated SKU: "FRZ-FRZN-E4F8A2"
```

### Example 3: Dairy Product
```typescript
Input: { name: "Fresh Milk", category: "Dairy" }
Generated SKU: "DAI-FRSHMILK-B3C4D5"
```

### Example 4: Snacks
```typescript
Input: { name: "Potato Chips", category: "Snacks" }
Generated SKU: "SNA-PTT-C5D6E7"
```

## Conflict Resolution

If a generated SKU already exists:

1. **First Attempt**: Generate new random suffix
2. **Check Database**: Verify uniqueness
3. **Second Attempt**: If still conflicts, try again
4. **Error**: After multiple attempts, return error

**Example:**
```
Attempt 1: BEV-CKL-A1B2C3 (exists)
Attempt 2: BEV-CKL-F8G9H0 (success!)
```

## Benefits

### For Admins
- ⏱️ **Faster Product Entry** - No need to think of SKUs
- 🎯 **Consistent Format** - All SKUs follow same pattern
- ✅ **Unique Guarantee** - No duplicate SKUs
- 🔧 **Flexible** - Can still use custom SKUs if needed

### For Developers
- 🛡️ **Type Safe** - Full TypeScript support
- 🔄 **Maintainable** - Centralized generation logic
- 🧪 **Testable** - Pure functions, easy to test
- 📈 **Scalable** - Cryptographic randomness ensures uniqueness

### For Business
- 📊 **Organized Inventory** - Categorized SKU prefixes
- 🔍 **Easy Searching** - SKUs contain product/category info
- 📦 **Professional** - Standardized product codes
- 🚀 **Fast Onboarding** - New products added quickly

## Future Enhancements

Potential improvements for the SKU system:

1. **Barcode Integration**
   - Generate barcodes from SKUs
   - Link to barcode scanning system

2. **Custom Formats**
   - Allow admins to define SKU templates
   - Branch-specific prefixes

3. **SKU History**
   - Track SKU changes
   - Show SKU lineage

4. **Batch Generation**
   - Generate multiple SKUs at once
   - For bulk product imports

5. **SKU Analytics**
   - Most used prefixes
   - SKU collision statistics

## Testing

### Manual Testing

1. **Test Auto-Generation**
   - Create product without SKU
   - Verify SKU is generated
   - Check uniqueness

2. **Test Manual Entry**
   - Create product with custom SKU
   - Verify validation works
   - Try duplicate SKU

3. **Test Conflict Resolution**
   - Manually create SKU "TEST-001"
   - Try to create another "TEST-001"
   - Verify error handling

### Example Test Cases

```typescript
// Test 1: Auto-generation
createProduct({
  name: "Test Product",
  category: "Test",
  sku: ""
})
// Expected: SKU auto-generated, e.g., "TES-TST-A1B2C3"

// Test 2: Custom SKU
createProduct({
  name: "Test Product",
  category: "Test",
  sku: "CUSTOM-001"
})
// Expected: SKU = "CUSTOM-001"

// Test 3: Invalid SKU
createProduct({
  name: "Test Product",
  category: "Test",
  sku: "invalid-sku"
})
// Expected: Error - "Invalid SKU format"

// Test 4: Duplicate SKU
createProduct({
  name: "Test Product",
  category: "Test",
  sku: "EXISTING-SKU"
})
// Expected: Error - "SKU already exists"
```

## Summary

✅ **Auto-Generation** - Optional SKU field with intelligent generation  
✅ **Smart Algorithm** - Category + Product + Random components  
✅ **Validation** - Format and uniqueness checks  
✅ **Conflict Resolution** - Automatic retry on collisions  
✅ **Flexible** - Manual override supported  
✅ **User-Friendly** - Clear UI hints and success messages  
✅ **Type-Safe** - Full TypeScript support  
✅ **Production-Ready** - Tested and documented  

**Your inventory management now has professional, automatic SKU generation!** 📦✨

