/**
 * Add sample branches to Firestore
 * Run this once to add branches to existing database
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config();

console.log('🏢 Adding sample branches to Firestore...\n');

async function addBranches() {
  try {
    // Initialize Firebase
    const keyPath = resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS || './firebase-service-account.json');
    const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    
    const app = initializeApp({
      credential: cert(serviceAccount),
    });

    const db = getFirestore(app);
    console.log('✅ Firebase initialized\n');

    // Check if branches already exist
    const branchesSnapshot = await db.collection('branches').limit(1).get();
    
    if (!branchesSnapshot.empty) {
      console.log('⚠️  Branches already exist. Listing current branches:\n');
      const allBranches = await db.collection('branches').get();
      allBranches.docs.forEach(doc => {
        const branch = doc.data();
        console.log(`  📍 ${branch.name}`);
        console.log(`     Location: ${branch.location}`);
        console.log(`     Manager: ${branch.manager}`);
        console.log(`     Phone: ${branch.phone}\n`);
      });
      
      console.log('✅ No need to add branches - already configured!');
      process.exit(0);
    }

    // Add sample branches
    const sampleBranches = [
      {
        id: "branch-001",
        name: "Main Branch - Manila",
        location: "123 Rizal Avenue, Manila, Metro Manila",
        phone: "+63-2-8123-4567",
        manager: "Juan Dela Cruz",
        created_at: Timestamp.now(),
      },
      {
        id: "branch-002",
        name: "Cebu Branch",
        location: "456 Colon Street, Cebu City, Cebu",
        phone: "+63-32-234-5678",
        manager: "Maria Santos",
        created_at: Timestamp.now(),
      },
      {
        id: "branch-003",
        name: "Davao Branch",
        location: "789 J.P. Laurel Avenue, Davao City, Davao del Sur",
        phone: "+63-82-345-6789",
        manager: "Jose Rizal",
        created_at: Timestamp.now(),
      },
    ];

    console.log('🏢 Creating branches...\n');

    const batch = db.batch();
    sampleBranches.forEach((branch) => {
      const ref = db.collection('branches').doc(branch.id);
      batch.set(ref, branch);
      console.log(`  ✅ ${branch.name}`);
    });

    await batch.commit();

    console.log('\n✅ All branches created successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Restart your server (pnpm dev)');
    console.log('  2. Login as admin (admin@gmail.com / admin123)');
    console.log('  3. Create a product - inventory will auto-create for all 3 branches!');
    console.log('  4. Check Firebase Console to see the inventory entries\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error adding branches:', error);
    process.exit(1);
  }
}

addBranches();
