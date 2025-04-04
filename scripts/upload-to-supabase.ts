/**
 * Upload to Supabase Script
 * 
 * This script uploads both completed auction results and active auction listings to Supabase.
 * It reads the JSON files from the results directory and inserts the data into Supabase tables.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { BaTCompletedListing } from '../lib/scrapers/BringATrailerResultsScraper';
import { BaTActiveListing } from '../lib/scrapers/BringATrailerActiveListingScraper';
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

// Table names
const COMPLETED_AUCTIONS_TABLE = 'bat_completed_auctions';
const ACTIVE_AUCTIONS_TABLE = 'bat_active_auctions';

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
        end_date: listing.end_date ? new Date(listing.end_date) : (listing.timestamp_end ? new Date(listing.timestamp_end * 1000) : null),
        bid_amount: listing.bid_amount ? parseInt(listing.bid_amount) : null,
        bid_date: listing.bid_date ? new Date(listing.bid_date) : null,
        status: listing.status,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        mileage: listing.mileage,
        exterior_color: listing.color,
        source_file: file,
        created_at: new Date(),
        updated_at: new Date(),
        country_code: listing.country_code,
        comments: listing.comments,
        watchers: listing.watchers,
        bidders: listing.bidders,
        transmission: listing.transmission
      }));
      
      // Upload in batches to avoid hitting Supabase limits
      const BATCH_SIZE = 100;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < dbListings.length; i += BATCH_SIZE) {
        const batch = dbListings.slice(i, i + BATCH_SIZE);
        console.log(`Uploading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(dbListings.length / BATCH_SIZE)}...`);
        
        try {
     
          // Insert data with upsert (update if exists, insert if not)
          const { data, error } = await supabase
            .from(COMPLETED_AUCTIONS_TABLE)
            .upsert(batch, { 
              onConflict: 'listing_id',
              ignoreDuplicates: false // Changed to false to update existing records
            });
          
          if (error) {
            console.error(`Error uploading batch: ${error.message}`);
            errorCount += batch.length;
          } else {
            console.log(`Successfully uploaded batch of ${batch.length} listings`);
            successCount += batch.length;
          }
        } catch (error: any) {
          console.error(`Exception during batch upload: ${error.message}`);
          
          // If batch upload fails, try uploading one by one
          console.log('Attempting to upload listings one by one...');
          for (const listing of batch) {
            try {
              const { error } = await supabase
                .from(COMPLETED_AUCTIONS_TABLE)
                .upsert([listing], { 
                  onConflict: 'listing_id',
                  ignoreDuplicates: false // Changed to false to update existing records
                });
              
              if (error) {
                console.error(`Error uploading listing ${listing.listing_id}: ${error.message}`);
                errorCount++;
              } else {
                successCount++;
              }
            } catch (itemError: any) {
              console.error(`Exception uploading listing ${listing.listing_id}: ${itemError.message}`);
              errorCount++;
            }
            
            // Add a small delay between individual uploads
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`Finished processing ${file}`);
      moveProcessedFiles([file], 'results/');
      console.log(`Successfully uploaded ${successCount} listings, ${errorCount} errors`);
    }
    
    console.log('Completed uploading auction results to Supabase');
  } catch (error) {
    console.error('Error uploading completed auctions to Supabase:', error);
    throw error;
  }
}

/**
 * Upload active auction listings to Supabase
 */
async function uploadActiveAuctionsToSupabase() {
  try {
    console.log('Starting upload of active auction listings to Supabase...');
    
    // Path to results directory
    const resultsDir = path.join(process.cwd(), 'results');
    
    // Check if results directory exists
    if (!fs.existsSync(resultsDir)) {
      console.error(`Error: Results directory not found at ${resultsDir}`);
      process.exit(1);
    }
    
    // Get all JSON files in the results directory that contain active listings
    const resultFiles = fs.readdirSync(resultsDir)
      .filter(file => file.endsWith('_active_results.json') || file === 'active_results.json');
    
    if (resultFiles.length === 0) {
      console.log('No active auction listing files found');
      return;
    }
    
    console.log(`Found ${resultFiles.length} active auction listing files`);
    
    // Process each file
    for (const file of resultFiles) {
      const filePath = path.join(resultsDir, file);
      console.log(`Processing ${file}...`);
      
      // Read the file
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const listings = JSON.parse(fileContent) as BaTActiveListing[];
      
      if (listings.length === 0) {
        console.log(`No listings found in ${file}, skipping`);
        continue;
      }
      
      console.log(`Found ${listings.length} listings in ${file}`);
      
      // Transform listings to database format
      const dbListings = listings.map(listing => ({
        listing_id: listing.listing_id,
        url: listing.url,
        title: listing.title,
        image_url: listing.image_url,
        current_bid: listing.current_bid,
        endDate: listing.endDate,
        status: listing.status || 'active',
        year: listing.year,
        make: listing.make,
        model: listing.model,
        location: listing.location,
        no_reserve: listing.no_reserve || false,
        premium: listing.premium || false,
        source_file: file,
        created_at: new Date(),
        updated_at: new Date(),
        mileage: listing.mileage || null,
        bidders: listing.bidders || null,
        watchers: listing.watchers || null,
        comments: listing.comments || null,
        transmission: listing.transmission || null,
        exterior_color: listing.color || null
      }));
      
      // Upload in batches to avoid hitting Supabase limits
      const BATCH_SIZE = 100;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < dbListings.length; i += BATCH_SIZE) {
        const batch = dbListings.slice(i, i + BATCH_SIZE);
        console.log(`Uploading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(dbListings.length / BATCH_SIZE)}...`);
        
        try {
          // Insert data with upsert (update if exists, insert if not)
          const { data, error } = await supabase
            .from(ACTIVE_AUCTIONS_TABLE)
            .upsert(batch, { 
              onConflict: 'listing_id',
              ignoreDuplicates: true // Changed to true to ignore duplicates
            });
          
          if (error) {
            console.error(`Error uploading batch: ${error.message}`);
            errorCount += batch.length;
          } else {
            console.log(`Successfully uploaded batch of ${batch.length} listings`);
            successCount += batch.length;
          }
        } catch (error: any) {
          console.error(`Exception during batch upload: ${error.message}`);
          
          // If batch upload fails, try uploading one by one
          console.log('Attempting to upload listings one by one...');
          for (const listing of batch) {
            try {
              const { error } = await supabase
                .from(ACTIVE_AUCTIONS_TABLE)
                .upsert([listing], { 
                  onConflict: 'listing_id',
                  ignoreDuplicates: true
                });
              
              if (error) {
                console.error(`Error uploading listing ${listing.listing_id}: ${error.message}`);
                errorCount++;
              } else {
                successCount++;
              }
            } catch (itemError: any) {
              console.error(`Exception uploading listing ${listing.listing_id}: ${itemError.message}`);
              errorCount++;
            }
            
            // Add a small delay between individual uploads
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`Finished processing ${file}`);
      console.log(`Successfully uploaded ${successCount} listings, ${errorCount} errors`);
    }
    
    console.log('Completed uploading active auction listings to Supabase');
  
  } catch (error) {
    console.error('Error uploading active auctions to Supabase:', error);
    throw error;
  }
}

/**
 * Main function to upload all data to Supabase
 */
async function uploadToSupabase() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    const uploadCompleted = args.includes('--completed') || args.includes('-c') || args.length === 0;
    const uploadActive = args.includes('--active') || args.includes('-a') || args.length === 0;
    
    console.log(`Upload options: completed=${uploadCompleted}, active=${uploadActive}`);
    
    if (uploadCompleted) {
      await uploadCompletedAuctionsToSupabase();
    }
    
    if (uploadActive) {
      await uploadActiveAuctionsToSupabase();
    }
    
    console.log('All uploads completed successfully');
    
  } catch (error) {
    console.error('Error during upload process:', error);
    process.exit(1);
  }
}

// Run the upload function
uploadToSupabase().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 

  function moveProcessedFiles(resultFiles: string[], resultsDir: string) {
    // Path to processed directory
    const processedDir = path.join(process.cwd(), 'results', 'processed');
    
    // Check if processed directory exists, if not create it
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }
    
    // Move each processed file to the processed directory
    for (const file of resultFiles) {
      const oldPath = path.join(resultsDir, file);
      const newPath = path.join(processedDir, file);
      fs.renameSync(oldPath, newPath);
    }
  }