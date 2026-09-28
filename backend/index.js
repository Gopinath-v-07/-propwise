const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- AUTHENTICATION ---
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, password, role] // Note: In production, hash passwords!
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user. Email might exist.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    delete user.password;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- GET STAFF ---
app.get('/api/users/staff', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email FROM users WHERE role = 'staff'");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// --- MAINTENANCE REQUESTS ---
// Tenant creates a request
app.post('/api/requests', async (req, res) => {
  const { tenant_id, title, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO maintenance_requests (tenant_id, title, description) VALUES ($1, $2, $3) RETURNING *',
      [tenant_id, title, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Get all requests (Manager sees all, Tenant sees theirs, Staff sees theirs)
app.get('/api/requests', async (req, res) => {
  const { userId, role } = req.query;
  try {
    let query = 'SELECT m.*, u.name as tenant_name, s.name as staff_name FROM maintenance_requests m LEFT JOIN users u ON m.tenant_id = u.id LEFT JOIN users s ON m.assigned_staff_id = s.id';
    let values = [];

    if (role === 'tenant') {
      query += ' WHERE m.tenant_id = $1';
      values.push(userId);
    } else if (role === 'staff') {
      query += ' WHERE m.assigned_staff_id = $1';
      values.push(userId);
    }
    
    query += ' ORDER BY m.created_at DESC';

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Manager approves and assigns
app.put('/api/requests/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { staff_id } = req.body; // if staff_id is provided, manual assign. Else auto assign or just approve.
  
  try {
    let assigned_id = staff_id;

    // Auto-assign logic (pick a random staff member if not provided)
    if (!assigned_id) {
      const staffRes = await pool.query("SELECT id FROM users WHERE role = 'staff' ORDER BY RANDOM() LIMIT 1");
      if (staffRes.rows.length > 0) {
        assigned_id = staffRes.rows[0].id;
      }
    }

    const status = assigned_id ? 'assigned' : 'approved';

    const result = await pool.query(
      'UPDATE maintenance_requests SET status = $1, assigned_staff_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, assigned_id || null, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign request' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
