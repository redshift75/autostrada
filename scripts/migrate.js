const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Drizzle ORM
const db = drizzle(pool);

// Run migrations
async function main() {
  console.log('Running migrations...');
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main(); 