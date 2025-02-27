import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as dotenv from 'dotenv';
import postgres from 'postgres';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('Initializing database...');
  
  try {
    // Create a postgres client using the connection string
    const connectionString = process.env.DATABASE_URL!;
    console.log('Using connection string:', connectionString);
    
    const sql = postgres(connectionString, { max: 1 });
    
    // Test database connection
    console.log('Testing database connection...');
    const result = await sql`SELECT version()`;
    console.log(`Successfully connected to the database: ${result[0].version}`);
    
    // Initialize Drizzle ORM
    const db = drizzle(sql);
    
    // Run migrations
    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');
    
    // Close the postgres client
    await sql.end();
    
    console.log('Database initialization completed successfully');
    console.log('Note: You can also use the Supabase dashboard to view and manage your database');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

main(); 