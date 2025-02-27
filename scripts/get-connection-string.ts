import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  process.exit(1);
}

async function main() {
  console.log('Getting Supabase connection info...');
  
  // Initialize Supabase client with service role key for admin privileges
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get connection info
    const { data, error } = await supabase.rpc('get_connection_info');
    
    if (error) {
      throw error;
    }
    
    console.log('Connection info:', data);
    
    // Construct connection string
    const connectionString = `postgres://${data.user}:${data.password}@${data.host}:${data.port}/${data.database}`;
    console.log('Connection string:', connectionString);
    
  } catch (error) {
    console.error('Failed to get connection info:', error);
    
    // Fallback: print the current DATABASE_URL
    console.log('Current DATABASE_URL:', process.env.DATABASE_URL);
    
    // Print instructions for getting the connection string manually
    console.log('\nTo get the correct connection string:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to Project Settings > Database');
    console.log('3. Find the "Connection string" section');
    console.log('4. Select "URI" format and copy the connection string');
    console.log('5. Replace [YOUR-PASSWORD] with your database password');
    console.log('6. Update the DATABASE_URL in your .env.local file');
  }
}

main(); 