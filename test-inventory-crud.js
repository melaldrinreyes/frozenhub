/**
 * Test script for Inventory CRUD operations
 * Tests: Create, Read, Update, Delete
 */

const BASE_URL = "http://localhost:8081/api";
let authToken = "";
let testInventoryId = "";

// Helper function to make requests
async function request(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(authToken && { Cookie: authToken }),
  };

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const data = await response.json();
  return { status: response.status, data };
}

// Test 1: Login as admin
async function testLogin() {
  console.log("\n🔐 Test 1: Admin Login");
  const { status, data } = await request(`${BASE_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      email: "admin@gmail.com",
      password: "Admin123",
    }),
  });

  if (status === 200 && data.user) {
    console.log("✅ Login successful");
    console.log(`   User: ${data.user.email} (${data.user.role})`);
    return true;
  } else {
    console.log("❌ Login failed:", data);
    return false;
  }
}

// Test 2: Get all inventory
async function testGetInventory() {
  console.log("\n📦 Test 2: Get All Inventory");
  const { status, data } = await request(`${BASE_URL}/inventory`);

  if (status === 200 && data.inventory) {
    console.log(`✅ Retrieved ${data.inventory.length} inventory items`);
    if (data.inventory.length > 0) {
      console.log(`   Sample: ${data.inventory[0].product_name} at ${data.inventory[0].branch_name}`);
    }
    return true;
  } else {
    console.log("❌ Failed to get inventory:", data);
    return false;
  }
}

// Test 3: Get products and branches for create test
async function getTestData() {
  console.log("\n🔍 Test 3: Get Products and Branches");
  
  const productsRes = await request(`${BASE_URL}/products`);
  const branchesRes = await request(`${BASE_URL}/branches`);

  if (productsRes.status === 200 && branchesRes.status === 200) {
    const products = productsRes.data.products;
    const branches = branchesRes.data.branches;
    
    console.log(`✅ Found ${products.length} products and ${branches.length} branches`);
    
    if (products.length > 0 && branches.length > 0) {
      return {
        productId: products[0].id,
        branchId: branches[0].id,
        productName: products[0].name,
        branchName: branches[0].name,
      };
    }
  }
  
  console.log("❌ Not enough test data available");
  return null;
}

// Test 4: Create new inventory entry
async function testCreateInventory(productId, branchId, productName, branchName) {
  console.log("\n➕ Test 4: Create Inventory Entry");
  console.log(`   Product: ${productName}`);
  console.log(`   Branch: ${branchName}`);
  
  const { status, data } = await request(`${BASE_URL}/inventory`, {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      branch_id: branchId,
      quantity: 100,
      reorder_level: 25,
    }),
  });

  if (status === 201 && data.inventory) {
    testInventoryId = data.inventory.id;
    console.log("✅ Inventory entry created successfully");
    console.log(`   ID: ${testInventoryId}`);
    console.log(`   Quantity: ${data.inventory.quantity}`);
    console.log(`   Reorder Level: ${data.inventory.reorder_level}`);
    return true;
  } else if (status === 409) {
    console.log("⚠️  Inventory already exists for this product-branch combination");
    // Get existing inventory to test update/delete
    const existingRes = await request(`${BASE_URL}/inventory`);
    if (existingRes.data.inventory && existingRes.data.inventory.length > 0) {
      testInventoryId = existingRes.data.inventory[0].id;
      console.log(`   Using existing inventory ID: ${testInventoryId}`);
      return true;
    }
    return false;
  } else {
    console.log("❌ Failed to create inventory:", data);
    return false;
  }
}

// Test 5: Update inventory
async function testUpdateInventory() {
  if (!testInventoryId) {
    console.log("\n⚠️  Test 5: Skipped (No inventory ID)");
    return false;
  }

  console.log("\n✏️  Test 5: Update Inventory");
  console.log(`   Updating inventory ID: ${testInventoryId}`);
  
  const { status, data } = await request(`${BASE_URL}/inventory/${testInventoryId}`, {
    method: "PUT",
    body: JSON.stringify({
      quantity: 150,
      reorder_level: 30,
    }),
  });

  if (status === 200 && data.inventory) {
    console.log("✅ Inventory updated successfully");
    console.log(`   New Quantity: ${data.inventory.quantity}`);
    console.log(`   New Reorder Level: ${data.inventory.reorder_level}`);
    return true;
  } else {
    console.log("❌ Failed to update inventory:", data);
    return false;
  }
}

// Test 6: Get low stock items
async function testGetLowStock() {
  console.log("\n⚠️  Test 6: Get Low Stock Items");
  
  const { status, data } = await request(`${BASE_URL}/inventory/low-stock`);

  if (status === 200 && data.inventory) {
    console.log(`✅ Retrieved ${data.inventory.length} low stock items`);
    return true;
  } else {
    console.log("❌ Failed to get low stock items:", data);
    return false;
  }
}

// Test 7: Delete inventory
async function testDeleteInventory() {
  if (!testInventoryId) {
    console.log("\n⚠️  Test 7: Skipped (No inventory ID)");
    return false;
  }

  console.log("\n🗑️  Test 7: Delete Inventory");
  console.log(`   Deleting inventory ID: ${testInventoryId}`);
  
  const { status, data } = await request(`${BASE_URL}/inventory/${testInventoryId}`, {
    method: "DELETE",
  });

  if (status === 200 && data.message) {
    console.log("✅ Inventory deleted successfully");
    console.log(`   Message: ${data.message}`);
    return true;
  } else {
    console.log("❌ Failed to delete inventory:", data);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log("═══════════════════════════════════════════");
  console.log("  INVENTORY CRUD BACKEND TEST SUITE");
  console.log("═══════════════════════════════════════════");

  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Test 1: Login
    if (await testLogin()) {
      results.passed++;
    } else {
      results.failed++;
      console.log("\n❌ Cannot proceed without authentication");
      return results;
    }

    // Test 2: Get inventory
    if (await testGetInventory()) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Test 3: Get test data
    const testData = await getTestData();
    if (testData) {
      results.passed++;

      // Test 4: Create inventory
      if (await testCreateInventory(
        testData.productId,
        testData.branchId,
        testData.productName,
        testData.branchName
      )) {
        results.passed++;

        // Test 5: Update inventory
        if (await testUpdateInventory()) {
          results.passed++;
        } else {
          results.failed++;
        }

        // Test 6: Get low stock
        if (await testGetLowStock()) {
          results.passed++;
        } else {
          results.failed++;
        }

        // Test 7: Delete inventory
        if (await testDeleteInventory()) {
          results.passed++;
        } else {
          results.failed++;
        }
      } else {
        results.failed++;
        results.skipped += 3; // Skip update, low stock, and delete
      }
    } else {
      results.failed++;
      results.skipped += 4; // Skip create, update, low stock, and delete
    }

  } catch (error) {
    console.error("\n💥 Test suite error:", error.message);
    results.failed++;
  }

  // Print summary
  console.log("\n═══════════════════════════════════════════");
  console.log("  TEST SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`✅ Passed:  ${results.passed}`);
  console.log(`❌ Failed:  ${results.failed}`);
  console.log(`⚠️  Skipped: ${results.skipped}`);
  console.log("═══════════════════════════════════════════\n");

  return results;
}

// Run the tests
runTests().then((results) => {
  process.exit(results.failed > 0 ? 1 : 0);
});
