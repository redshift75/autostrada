/**
 * Consolidated Scraper Test Script
 * 
 * This script tests both the BringATrailerResultsScraper and BringATrailerActiveListingScraper
 * by fetching auction listings from Bring a Trailer and displaying the results.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BringATrailerResultsScraper } from '../lib/scrapers/BringATrailerResultsScraper';
import { BringATrailerActiveListingScraper } from '../lib/scrapers/BringATrailerActiveListingScraper';
import minimist from 'minimist';
import { createClient } from '@supabase/supabase-js';

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const mode = argv.mode || 'both'; // completed, active, both
const make = argv.make;
const model = String(argv.model || ''); // Convert model to string
const maxPages = argv.maxPages || 3;
const recency = argv.recency || '';
const delayBetweenRequests = argv.delay || 100; // Default 1 seconds between requests
const longPauseInterval = argv.pauseInterval || 10; // Default pause every 10 pages
const longPauseDelay = argv.pauseDelay || 30000; // Default 10 seconds for long pause

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type CarMake = {
  make: string;
};

// Check if Supabase environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.warn('Warning: Supabase environment variables are not set. Model suggestions will not be available.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to read makes from a file
async function readMakesFromDB(): Promise<any[]> {
  try {
  // Get all makes from Supabase
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cars?type=makes`);
  const data = await response.json()
  const makesToScrape = Array.from(new Set(data.map((item: CarMake) => item.make)))

  return makesToScrape;

  } catch (error) {
    console.error(`Error reading makes from DB: ${error}`);
    process.exit(1);
  }
}

// Function to process a single make
async function processMake(currentMake: string) {
  console.log(`\n========== Processing make: ${currentMake} ==========`);
  
  // Create a temporary argv object with the current make
  const tempArgv = { ...argv, make: currentMake };

  await runResultsScraper(currentMake);
}

async function runResultsScraper(currentMake: string = make) {
  try {
    console.log(`Testing BringATrailerResultsScraper for ${currentMake}...`);
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create scraper instance
    const scraper = new BringATrailerResultsScraper();
    
    // Scrape listings with the provided parameters
    const allListings = await scraper.scrape({
      make: currentMake,
      model,
      maxPages,
      delayBetweenRequests,
      longPauseInterval,
      longPauseDelay,
      recency
    });
    
    console.log(`\nFound ${allListings.length} completed auctions`);
    
    // If make and model are provided, filter the results
    if (currentMake) {
      const filteredListings = allListings.filter(listing => {
        const listingMake = listing.make?.toLowerCase() || '';
        const searchMake = currentMake.toLowerCase();
        
        // Check if make matches
        if (!listingMake.includes(searchMake)) {
          return false;
        }
        
        // If model is provided, check if model matches
        if (model) {
          const listingModel = listing.model?.toLowerCase() || '';
          const searchModel = model.toLowerCase();
          return listingModel.includes(searchModel);
        }
        
        return true;
      });
      
      console.log(`\nFound ${filteredListings.length} completed ${currentMake} ${model || ''} auctions`);
      
      if (filteredListings.length > 0) {
        // Save filtered results to file
        const makeForFilename = currentMake ? currentMake.toLowerCase() : 'allmakes';
        const modelForFilename = model ? model.toLowerCase() : 'allmodels';
        const recencyForFilename = recency ? recency.toLowerCase() : 'alldates';
        const filteredFile = path.join(resultsDir, `${makeForFilename}_${modelForFilename ? modelForFilename  : ''}_${recencyForFilename ? recencyForFilename : ''}_completed_results.json`);
        fs.writeFileSync(filteredFile, JSON.stringify(filteredListings, null, 2));
        console.log(`Saved ${filteredListings.length} completed ${currentMake} ${model || ''} auctions to ${filteredFile}`);
      }
      
      return filteredListings;
    }
    
    return allListings;
  } catch (error) {
    console.error('Error in testResultsScraper:', error);
    return [];
  }
}

async function runActiveScraper() {
  
  // Create results directory if it doesn't exist
  const resultsDir = path.join(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }
  
  const scraper = new BringATrailerActiveListingScraper();
  
  // Test with all active listings
  console.log('\nFetching all active listings...');
  const allListings = await scraper.scrape();
  
  console.log(`Found ${allListings.length} active auctions`);
  
  if (allListings.length > 0) {
    // Save filtered results to file
    const file = path.join(resultsDir, `bat_active_results.json`);
    fs.writeFileSync(file, JSON.stringify(allListings, null, 2));
    console.log(`Saved ${allListings.length} active auctions to ${file}`);
  }
  
  return allListings;
}

// Main function to run the selected test mode
async function runScrape() {
  try {
    console.log(`Running scraper in ${mode} mode`);
    
    if (mode === 'active') {
      // Run active scraper
      console.log(`Running BringATrailerActiveListingScraper for all makes...`);
      await runActiveScraper();
      return;
    }

    // For completed auctions, get makes from DB if no specific make is provided
    let makes = [];
    if (make) {
      makes = [make];
    } else {
      makes = await readMakesFromDB();
    }

    // Run completed scraper for each make in the list
    for (const currentMake of makes) {
      await processMake(currentMake);
      
      // Add a pause between processing different makes to avoid rate limiting
      if (makes.indexOf(currentMake) < makes.length - 1) {
        console.log(`Pausing before processing next make...`);
        await new Promise(resolve => setTimeout(resolve, longPauseDelay/10));
      }
    }
  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

// Run the scraper
runScrape(); 