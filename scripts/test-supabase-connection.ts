/**
 * Test Supabase Connection Script
 * 
 * This script tests the connection to Supabase and verifies that authentication is working.
 */

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

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey.substring(0, 5) + '...' + supabaseKey.substring(supabaseKey.length - 5));

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Test Supabase connection
 */
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: Simple health check
    console.log('\nTest 1: Health check');
    const { data: healthData, error: healthError } = await supabase.from('_health').select('*').limit(1);
    
    if (healthError) {
      console.error('Health check failed:', healthError.message);
    } else {
      console.log('Health check successful');
    }
    
    // Test 2: Get Supabase version
    console.log('\nTest 2: Get Supabase version');
    const { data: versionData, error: versionError } = await supabase.rpc('get_supabase_version');
    
    if (versionError) {
      console.error('Failed to get Supabase version:', versionError.message);
      console.log('Note: This test might fail if the get_supabase_version function is not available.');
    } else {
      console.log('Supabase version:', versionData);
    }
    
    // Test 3: List tables
    console.log('\nTest 3: List tables');
    const { data: tablesData, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (tablesError) {
      console.error('Failed to list tables:', tablesError.message);
    } else {
      console.log('Tables in public schema:');
      tablesData.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.table_name}`);
      });
    }
    
    // Test 4: Try a simple SQL query using PostgreSQL connection
    console.log('\nTest 4: Execute a simple SQL query');
    try {
      const { data, error } = await supabase.from('pg_tables')
        .select('schemaname, tablename')
        .eq('schemaname', 'public')
        .order('tablename');
      
      if (error) {
        console.error('Failed to execute SQL query:', error.message);
      } else {
        console.log('Query successful. Found', data.length, 'tables');
        data.forEach((table, index) => {
          console.log(`  ${index + 1}. ${table.tablename} (schema: ${table.schemaname})`);
        });
      }
    } catch (error) {
      console.error('Error executing SQL query:', error);
    }
    
    console.log('\nConnection tests completed');
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
    process.exit(1);
  }
}

// Run the test function
testSupabaseConnection().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 