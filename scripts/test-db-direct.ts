/**
 * Direct Database Test Script
 * 
 * This script directly tests the Supabase database connection and queries
 * without going through the agent.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

// Validate Supabase configuration
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDirectDatabaseQuery() {
  console.log('Testing direct database queries...');
  
  try {
    // Test 1: Query Porsche 911s from 2015-2020
    console.log('\nTest 1: Query Porsche 911s from 2015-2020');
    const { data: porscheData, error: porscheError } = await supabase
      .from('bat_completed_auctions')
      .select('*')
      .eq('make', 'Porsche')
      .eq('model', '911')
      .gte('year', 2015)
      .lte('year', 2020)
      .limit(5);
    
    if (porscheError) {
      console.error('Error querying Porsche data:', porscheError.message);
    } else {
      console.log(`Found ${porscheData.length} Porsche 911s from 2015-2020`);
      if (porscheData.length > 0) {
        console.log('Sample record:', {
          title: porscheData[0].title,
          year: porscheData[0].year,
          make: porscheData[0].make,
          model: porscheData[0].model,
          sold_price: porscheData[0].sold_price,
          sold_date: porscheData[0].sold_date
        });
      }
    }
    
    // Test 2: Find highest price Ferrari
    console.log('\nTest 2: Find highest price Ferrari');
    const { data: ferrariData, error: ferrariError } = await supabase
      .from('bat_completed_auctions')
      .select('*')
      .eq('make', 'Ferrari')
      .order('sold_price', { ascending: false })
      .limit(1);
    
    if (ferrariError) {
      console.error('Error querying Ferrari data:', ferrariError.message);
    } else if (ferrariData.length === 0) {
      console.log('No Ferrari data found');
    } else {
      console.log('Highest price Ferrari:', {
        title: ferrariData[0].title,
        year: ferrariData[0].year,
        make: ferrariData[0].make,
        model: ferrariData[0].model,
        sold_price: ferrariData[0].sold_price,
        sold_date: ferrariData[0].sold_date
      });
    }
    
    // Test 3: Find lowest mileage BMW M3
    console.log('\nTest 3: Find lowest mileage BMW M3');
    const { data: bmwData, error: bmwError } = await supabase
      .from('bat_completed_auctions')
      .select('*')
      .eq('make', 'BMW')
      .eq('model', 'M3')
      .order('mileage', { ascending: true })
      .limit(1);
    
    if (bmwError) {
      console.error('Error querying BMW data:', bmwError.message);
    } else if (bmwData.length === 0) {
      console.log('No BMW M3 data found');
    } else {
      console.log('Lowest mileage BMW M3:', {
        title: bmwData[0].title,
        year: bmwData[0].year,
        make: bmwData[0].make,
        model: bmwData[0].model,
        mileage: bmwData[0].mileage,
        sold_price: bmwData[0].sold_price
      });
    }
    
    // Test 4: Count transmission types for Corvettes
    console.log('\nTest 4: Count transmission types for Corvettes');
    const { data: corvetteData, error: corvetteError } = await supabase
      .from('bat_completed_auctions')
      .select('transmission')
      .eq('make', 'Chevrolet')
      .eq('model', 'Corvette')
      .not('transmission', 'is', null);
    
    if (corvetteError) {
      console.error('Error querying Corvette data:', corvetteError.message);
    } else if (corvetteData.length === 0) {
      console.log('No Corvette data found');
    } else {
      // Count transmission types
      const transmissionCounts: Record<string, number> = {};
      corvetteData.forEach(item => {
        const transmission = item.transmission.toLowerCase();
        transmissionCounts[transmission] = (transmissionCounts[transmission] || 0) + 1;
      });
      
      console.log('Corvette transmission types:', transmissionCounts);
    }
    
    console.log('\nDirect database tests completed');
  } catch (error) {
    console.error('Unhandled error during database tests:', error);
    process.exit(1);
  }
}

// Run the test
testDirectDatabaseQuery(); 