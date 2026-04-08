const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

(async function(){
  try {
    const barcode = process.argv[2] || '4800552888615';
    console.log('Searching products for barcode:', barcode);
    const snapshot = await db.collection('products').where('barcode','==',barcode).get();
    if (snapshot.empty) {
      console.log('No products found with that barcode');
      process.exit(0);
    }
    snapshot.forEach(doc => {
      console.log('Found product:', doc.id);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
    process.exit(0);
  } catch (err) {
    console.error('Error querying Firestore:', err);
    process.exit(2);
  }
})();
