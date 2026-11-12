import { db } from '../backend/src/services/firebase.ts';

async function seedData() {
  console.log('Ensuring admin 0988286610 exists in Firestore...');
  
  // 1. Check if exists
  const adminsSnap = await db.collection('admins').get();
  const exists = adminsSnap.docs.some(doc => {
    const p = (doc.data().phone || '').replace(/\D/g, '').slice(-9);
    return p === '988286610';
  });

  if (!exists) {
    console.log('Admin not found in admins collection. Adding now...');
    await db.collection('admins').add({
      phone: '0988286610',
      password: 'Nehzewd0988',
      nameAm: 'አስተዳዳሪ 0988286610',
      nameEn: 'Admin 0988286610',
      role: 'super_admin',
      department: 'education',
      status: 'active',
      createdAt: new Date().toISOString()
    });
    console.log('Admin added successfully.');
  } else {
    console.log('Admin already exists in admins collection.');
  }

  // 2. Also ensure they are in students collection as an active student
  const studentsSnap = await db.collection('students').get();
  const studentExists = studentsSnap.docs.some(doc => {
    const p = (doc.data().phone || '').replace(/\D/g, '').slice(-9);
    return p === '988286610';
  });

  if (!studentExists) {
    console.log('Admin not found in students collection. Adding as student...');
    await db.collection('students').add({
      code: 'WW-2026-0988',
      fullNameAm: 'አስተዳዳሪ (ተማሪ)',
      fullNameEn: 'Admin (Student)',
      phone: '0988286610',
      department: 'education',
      gradeLevel: 'leaders',
      status: 'active',
      role: 'super_admin',
      registeredDate: new Date().toISOString().split('T')[0]
    });
    console.log('Student record added.');
  }
}

seedData().catch(console.error);
