import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('Checking database connection...');
  
  try {
    // Create a postgres client using the connection string
    const connectionString = process.env.DATABASE_URL!;
    console.log('Using connection string:', connectionString);
    
    const pgClient = postgres(connectionString, { max: 1 });
    
    // Test database connection
    console.log('Testing database connection...');
    const versionResult = await pgClient`SELECT version()`;
    console.log(`✅ Successfully connected to the database: ${versionResult[0].version}`);
    
    // Initialize Drizzle ORM
    const db = drizzle(pgClient);
    
    // Check if tables exist
    console.log('Checking database tables...');
    
    // Query to get all tables in the public schema
    const tablesResult = await pgClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    if (tablesResult.length === 0) {
      console.log('❌ No tables found in the database. Run the initialization script:');
      console.log('npm run db:init');
    } else {
      console.log('✅ Found the following tables:');
      tablesResult.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
      
      // Check if there's data in the vehicles table
      try {
        // Use raw SQL query instead of table reference
        const vehicleCount = await db.execute(sql`SELECT COUNT(*) FROM vehicles`);
        console.log(`✅ Vehicle count: ${vehicleCount[0].count}`);
        
        if (Number(vehicleCount[0].count) === 0) {
          console.log('ℹ️ No vehicles found. You may want to seed the database:');
          console.log('npm run db:seed');
        }
      } catch (error) {
        console.log('❌ Error checking vehicle count:', error);
      }
    }
    
    // Close the postgres client
    await pgClient.end();
    
    console.log('\nDatabase check completed');
    console.log('You can also check your database in the Supabase dashboard:');
    if (process.env.SUPABASE_URL) {
      console.log(`${process.env.SUPABASE_URL}/project/default/database/tables`);
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('\nTroubleshooting steps:');
    console.log('1. Check that your database is accessible');
    console.log('2. Verify your DATABASE_URL in .env.local is correct');
    console.log('3. Make sure your IP is allowed in network restrictions');
    console.log('4. Check that your database user has the necessary permissions');
    process.exit(1);
  }
}

main(); 