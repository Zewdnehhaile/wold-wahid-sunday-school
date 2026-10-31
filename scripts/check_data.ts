import { db } from '../backend/src/services/firebase.ts';

async function checkAdmins() {
  console.log('Checking admins collection...');
  const snap = await db.collection('admins').get();
  console.log(`Found ${snap.size} admins.`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}, Phone: ${data.phone}, Role: ${data.role}`);
  });

  console.log('\nChecking students collection for admin roles...');
  const studentSnap = await db.collection('students').get();
  studentSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.role === 'admin' || data.role === 'super_admin') {
      console.log(`- ID: ${doc.id}, Phone: ${data.phone}, Role: ${data.role} (In Students collection)`);
    }
  });
}

checkAdmins().catch(console.error);
