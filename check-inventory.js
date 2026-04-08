import 'dotenv/config';
import admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
  await import('fs').then(fs => fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './firebase-service-account.json', 'utf8'))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkInventory() {
  console.log('\n🔍 Checking Firestore collections...\n');
  
  // Check branches
  const branchesSnapshot = await db.collection('branches').get();
  console.log(`📍 Branches: ${branchesSnapshot.size} documents`);
  branchesSnapshot.docs.forEach(doc => {
    console.log(`   - ${doc.id}: ${doc.data().name}`);
  });
  
  // Check products
  const productsSnapshot = await db.collection('products').get();
  console.log(`\n📦 Products: ${productsSnapshot.size} documents`);
  productsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}: ${data.name} (SKU: ${data.sku})`);
  });
  
  // Check inventory
  const inventorySnapshot = await db.collection('inventory').get();
  console.log(`\n📊 Inventory: ${inventorySnapshot.size} documents`);
  inventorySnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${doc.id}:`);
    console.log(`     Product: ${data.product_name} (${data.product_sku})`);
    console.log(`     Branch: ${data.branch_name}`);
    console.log(`     Quantity: ${data.quantity}`);
    console.log(`     Reorder Level: ${data.reorder_level}`);
  });
  
  if (inventorySnapshot.size === 0) {
    console.log('\n⚠️  No inventory entries found!');
    console.log('\n💡 Tips:');
    console.log('   1. Make sure branches exist (you should have 3 branches)');
    console.log('   2. Try creating a new product to trigger auto-inventory creation');
    console.log('   3. Check server logs for any errors');
  }
  
  process.exit(0);
}

checkInventory().catch(console.error);
