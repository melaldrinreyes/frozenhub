import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './firebase-service-account.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function syncInventory() {
  console.log('\n🔄 Syncing inventory for all products and branches...\n');
  
  try {
    // Get all branches
    const branchesSnapshot = await db.collection('branches').get();
    console.log(`📍 Found ${branchesSnapshot.size} branches:`);
    branchesSnapshot.docs.forEach(doc => {
      console.log(`   - ${doc.id}: ${doc.data().name}`);
    });
    
    // Get all products
    const productsSnapshot = await db.collection('products').get();
    console.log(`\n📦 Found ${productsSnapshot.size} products:`);
    productsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: ${data.name} (${data.sku})`);
    });
    
    // Check existing inventory
    const inventorySnapshot = await db.collection('inventory').get();
    console.log(`\n📊 Current inventory entries: ${inventorySnapshot.size}`);
    
    const existingInventory = new Set();
    inventorySnapshot.docs.forEach(doc => {
      const data = doc.data();
      existingInventory.add(`${data.product_id}-${data.branch_id}`);
    });
    
    // Create missing inventory entries
    console.log('\n🔍 Checking for missing inventory entries...\n');
    const batch = db.batch();
    let createdCount = 0;
    
    for (const productDoc of productsSnapshot.docs) {
      const product = productDoc.data();
      
      for (const branchDoc of branchesSnapshot.docs) {
        const branch = branchDoc.data();
        const key = `${productDoc.id}-${branchDoc.id}`;
        
        if (!existingInventory.has(key)) {
          const inventoryId = `inv-${productDoc.id}-${branchDoc.id}-${Date.now()}-${createdCount}`;
          const inventoryRef = db.collection('inventory').doc(inventoryId);
          
          batch.set(inventoryRef, {
            id: inventoryId,
            product_id: productDoc.id,
            product_name: product.name,
            product_sku: product.sku,
            branch_id: branchDoc.id,
            branch_name: branch.name,
            quantity: 0,
            reorder_level: 10,
            last_updated: admin.firestore.Timestamp.now(),
            created_at: admin.firestore.Timestamp.now(),
          });
          
          console.log(`  ➕ Creating inventory: ${product.name} @ ${branch.name}`);
          createdCount++;
        }
      }
    }
    
    if (createdCount > 0) {
      await batch.commit();
      console.log(`\n✅ Created ${createdCount} missing inventory entries!`);
    } else {
      console.log('\n✅ All inventory entries already exist - nothing to create!');
    }
    
    // Show final stats
    const finalInventorySnapshot = await db.collection('inventory').get();
    console.log(`\n📊 Final inventory count: ${finalInventorySnapshot.size} entries`);
    
    // Group by branch
    const byBranch = {};
    finalInventorySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!byBranch[data.branch_name]) {
        byBranch[data.branch_name] = 0;
      }
      byBranch[data.branch_name]++;
    });
    
    console.log('\n📍 Inventory by branch:');
    Object.entries(byBranch).forEach(([branch, count]) => {
      console.log(`   - ${branch}: ${count} products`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
  
  process.exit(0);
}

syncInventory();
