const fetch = require('node-fetch'); // Note: needs npm i node-fetch if missing

async function testAPI() {
  const BASE = 'https://taskease-app.vercel.app';
  
  console.log('🧪 Testing TaskEase API...\n');
  
  // Test 1: Login dev user
  try {
    const loginRes = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: 'test', password: 'password'})
    });
    const login = await loginRes.json();
    console.log('✅ LOGIN:', login.token ? 'SUCCESS' : 'FAILED', login);
    if (login.token) {
      // Test 2: Get tasks (should be [])
      const tasksRes = await fetch(`${BASE}/tasks`, {
        headers: {'Authorization': `Bearer ${login.token}`}
      });
      const tasks = await tasksRes.json();
      console.log('✅ TASKS GET:', tasks.length, 'tasks');
      
      // Test 3: Create task
      const newTask = await fetch(`${BASE}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${login.token}`
        },
        body: JSON.stringify({title: 'Test Task', description: 'API test'})
      });
      const task = await newTask.json();
      console.log('✅ CREATE TASK:', task.id);
      
      // Test 4: Delete task
      await fetch(`${BASE}/tasks/${task.id}`, {
        method: 'DELETE',
        headers: {'Authorization': `Bearer ${login.token}`}
      });
      console.log('✅ DELETE TASK:', task.id, 'success\n');
      
      console.log('🎉 ALL TESTS PASSED!');
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

testAPI();
