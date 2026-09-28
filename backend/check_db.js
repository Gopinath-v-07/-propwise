const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDatabase() {
  try {
    console.log('Connecting to the database...');
    // Get all tables in the public schema
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tablesRes = await pool.query(tablesQuery);
    
    if (tablesRes.rows.length === 0) {
      console.log('The database connection was successful, but there are no tables in the database yet.');
      return;
    }

    console.log(`\nFound ${tablesRes.rows.length} table(s):`);
    
    // Check data in each table
    for (let row of tablesRes.rows) {
      const tableName = row.table_name;
      console.log(`\n--- Data in table: ${tableName} ---`);
      
      const dataQuery = `SELECT * FROM "${tableName}" LIMIT 5`;
      const dataRes = await pool.query(dataQuery);
      
      if (dataRes.rows.length === 0) {
        console.log(`The table '${tableName}' is empty.`);
      } else {
        console.table(dataRes.rows);
      }
    }
  } catch (err) {
    console.error('Error querying the database:', err.message);
  } finally {
    pool.end();
  }
}

checkDatabase();
