/**
 * Create Supabase Tables Script
 * 
 * This script executes the SQL file to create the necessary tables in Supabase.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Validate Supabase configuration
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Execute SQL file in Supabase
 */
async function createSupabaseTables() {
  try {
    console.log('Creating tables in Supabase...');
    
    // Path to SQL file
    const sqlFilePath = path.join(process.cwd(), 'sql', 'create_bat_tables.sql');
    
    // Check if SQL file exists
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`Error: SQL file not found at ${sqlFilePath}`);
      process.exit(1);
    }
    
    // Read SQL file
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    
    // Split SQL content into individual statements
    const sqlStatements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`Found ${sqlStatements.length} SQL statements to execute`);
    
    // Execute each SQL statement
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      console.log(`Executing statement ${i + 1}/${sqlStatements.length}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`Error executing SQL statement: ${error.message}`);
        console.error(`Statement: ${statement}`);
      } else {
        console.log(`Successfully executed statement ${i + 1}`);
      }
    }
    
    console.log('Completed creating tables in Supabase');
  } catch (error) {
    console.error('Error creating tables in Supabase:', error);
    process.exit(1);
  }
}

// Run the create tables function
createSupabaseTables().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 