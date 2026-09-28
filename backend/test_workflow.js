const axios = require('axios');

const API = 'http://localhost:5000/api';

async function testWorkflow() {
  try {
    console.log('--- STARTING WORKFLOW TEST ---\n');

    // 1. Sign Up Users
    console.log('1. Signing up users (Tenant, Manager, Staff)...');
    const tenant = await axios.post(`${API}/auth/signup`, { name: 'Tom Tenant', email: `tenant${Date.now()}@test.com`, password: 'password', role: 'tenant' });
    const manager = await axios.post(`${API}/auth/signup`, { name: 'Mary Manager', email: `manager${Date.now()}@test.com`, password: 'password', role: 'manager' });
    const staff = await axios.post(`${API}/auth/signup`, { name: 'Sam Staff', email: `staff${Date.now()}@test.com`, password: 'password', role: 'staff' });
    console.log('✅ Users created successfully.\n');

    // 2. Tenant creates a maintenance request
    console.log('2. Tenant reporting a problem...');
    const request = await axios.post(`${API}/requests`, {
      tenant_id: tenant.data.id,
      title: 'Leaky Faucet',
      description: 'The kitchen faucet is leaking constantly.'
    });
    console.log('✅ Request created by tenant:', request.data.title, '| Status:', request.data.status, '\n');

    // 3. Manager views requests
    console.log('3. Manager viewing requests...');
    const allRequests = await axios.get(`${API}/requests?role=manager&userId=${manager.data.id}`);
    const pendingRequest = allRequests.data.find(r => r.id === request.data.id);
    console.log('✅ Manager sees request:', pendingRequest.title, '| Status:', pendingRequest.status, '\n');

    // 4. Manager Approves and Assigns request
    console.log('4. Manager approving and assigning request to Staff (Manual Assign)...');
    const assignedRequest = await axios.put(`${API}/requests/${pendingRequest.id}/assign`, {
      staff_id: staff.data.id // Manual assign
    });
    console.log('✅ Request approved & assigned! New Status:', assignedRequest.data.status, '| Staff ID:', assignedRequest.data.assigned_staff_id, '\n');

    // 5. Staff views their assigned requests
    console.log('5. Staff viewing their tasks...');
    const staffTasks = await axios.get(`${API}/requests?role=staff&userId=${staff.data.id}`);
    console.log('✅ Staff assigned tasks count:', staffTasks.data.length);
    console.log('✅ First task title:', staffTasks.data[0].title, '\n');

    console.log('--- WORKFLOW VERIFIED AND WORKING PROPERLY ---');
    console.log('Ready to connect to the React frontend UI!');

  } catch (error) {
    console.error('❌ Workflow Test Failed:', error.response ? error.response.data : error.message);
  }
}

testWorkflow();
