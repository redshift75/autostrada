/**
 * Upload Results to Supabase Script
 * 
 * This script uploads the scraped completed auction results to Supabase.
 * It reads the JSON files from the results directory and inserts the data into Supabase tables.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { BaTCompletedListing } from '../lib/scrapers/BringATrailerResultsScraper';
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

// Table name for completed auctions
const COMPLETED_AUCTIONS_TABLE = 'bat_completed_auctions';

/**
 * Upload completed auction results to Supabase
 */
async function uploadCompletedAuctionsToSupabase() {
  try {
    console.log('Starting upload of completed auction results to Supabase...');
    
    // Path to results directory
    const resultsDir = path.join(process.cwd(), 'results');
    
    // Check if results directory exists
    if (!fs.existsSync(resultsDir)) {
      console.error(`Error: Results directory not found at ${resultsDir}`);
      process.exit(1);
    }
    
    // Get all JSON files in the results directory that contain completed results
    const resultFiles = fs.readdirSync(resultsDir)
      .filter(file => file.endsWith('_completed_results.json'));
    
    if (resultFiles.length === 0) {
      console.log('No completed auction result files found');
      return;
    }
    
    console.log(`Found ${resultFiles.length} completed auction result files`);
    
    // Process each file
    for (const file of resultFiles) {
      const filePath = path.join(resultsDir, file);
      console.log(`Processing ${file}...`);
      
      // Read the file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const listings = JSON.parse(fileContent) as BaTCompletedListing[];
      
      if (listings.length === 0) {
        console.log(`No listings found in ${file}, skipping`);
        continue;
      }
      
      console.log(`Found ${listings.length} listings in ${file}`);
      
      // Transform listings to database format
      const dbListings = listings.map(listing => ({
        listing_id: listing.id,
        url: listing.url,
        title: listing.title,
        image_url: listing.image_url,
        sold_price: listing.sold_price ? parseInt(listing.sold_price) : null,
        sold_date: listing.sold_date ? new Date(listing.sold_date) : null,
        bid_amount: listing.bid_amount ? parseInt(listing.bid_amount) : null,
        bid_date: listing.bid_date ? new Date(listing.bid_date) : null,
        status: listing.status,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        source_file: file,
        created_at: new Date(),
        updated_at: new Date()
      }));
      
      // Upload in batches to avoid hitting Supabase limits
      const BATCH_SIZE = 100;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < dbListings.length; i += BATCH_SIZE) {
        const batch = dbListings.slice(i, i + BATCH_SIZE);
        console.log(`Uploading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(dbListings.length / BATCH_SIZE)}...`);
        
        // Insert data with upsert (update if exists, insert if not)
        const { data, error } = await supabase
          .from(COMPLETED_AUCTIONS_TABLE)
          .upsert(batch, { 
            onConflict: 'listing_id',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error(`Error uploading batch: ${error.message}`);
          errorCount += batch.length;
        } else {
          console.log(`Successfully uploaded batch of ${batch.length} listings`);
          successCount += batch.length;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`Finished processing ${file}`);
      console.log(`Successfully uploaded ${successCount} listings, ${errorCount} errors`);
    }
    
    console.log('Completed uploading auction results to Supabase');
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    process.exit(1);
  }
}

// Run the upload function
uploadCompletedAuctionsToSupabase().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 