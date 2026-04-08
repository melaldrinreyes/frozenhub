// Usage: node scripts/check-barcode-inventory.cjs <barcode> <branch_id>
// Example: node scripts/check-barcode-inventory.cjs 4800552888615 branch-1763683760747

const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://sia-20pos-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function checkBarcodeInventory(barcode, branchId) {
  if (!barcode || !branchId) {
    console.error('Usage: node scripts/check-barcode-inventory.cjs <barcode> <branch_id>');
    process.exit(1);
  }
  // 1. Find product by barcode
  const productsRef = db.collection('products');
  const productSnap = await productsRef.where('barcode', '==', barcode).limit(1).get();
  if (productSnap.empty) {
    console.log('❌ No product found with barcode:', barcode);
    process.exit(0);
  }
  const product = productSnap.docs[0].data();
  const productId = productSnap.docs[0].id;
  console.log('✅ Product found:', product.name, '| ID:', productId);

  // 2. Check inventory for this product in the branch
  const invId = `inv-${productId}-${branchId}`;
  const invDoc = await db.collection('inventory').doc(invId).get();
  if (!invDoc.exists) {
    console.log('❌ No inventory entry for this product in branch:', branchId);
    process.exit(0);
  }
  const inv = invDoc.data();
  console.log('✅ Inventory found for branch:', branchId, '| Quantity:', inv.quantity);
}

const [,, barcode, branchId] = process.argv;
checkBarcodeInventory(barcode, branchId).then(() => process.exit(0));
