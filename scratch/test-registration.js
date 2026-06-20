import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://localhost:27017/dolphin_db';
const REGISTER_URL = 'http://localhost:3000/api/auth/register';
const TEST_EMAIL = 'test_unique_email_' + Date.now() + '@example.com';

async function runTests() {
  console.log('Connecting to MongoDB to clean up...');
  await mongoose.connect(MONGO_URI);
  
  // Drop user if exists (using Mongoose connection directly)
  await mongoose.connection.db.collection('users').deleteMany({ email: TEST_EMAIL });
  console.log('Cleaned up old test users.');
  await mongoose.disconnect();

  console.log('\n--- Test 1: First Registration ---');
  const res1 = await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: 'Password@123' })
  });
  
  const status1 = res1.status;
  const data1 = await res1.json();
  console.log('Status:', status1);
  console.log('Response:', JSON.stringify(data1, null, 2));

  console.log('\n--- Test 2: Duplicate Registration ---');
  const res2 = await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: 'Password@456' })
  });

  const status2 = res2.status;
  const data2 = await res2.json();
  console.log('Status:', status2);
  console.log('Response:', JSON.stringify(data2, null, 2));

  if (status1 === 200 && data1.success === true && status2 === 400 && data2.success === false && data2.error === 'Email already registered') {
    console.log('\n✅ SUCCESS: Duplicate email registration was successfully rejected with a 400 error!');
    process.exit(0);
  } else {
    console.error('\n❌ FAILURE: Test assertions did not match expectations.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
