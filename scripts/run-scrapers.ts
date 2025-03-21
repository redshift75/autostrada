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
const make = argv.make || 'Porsche';
const model = String(argv.model || ''); // Convert model to string
const maxPages = argv.maxPages || 3;
const recency = argv.recency || '';
const delayBetweenRequests = argv.delay || 100; // Default 1 seconds between requests
const longPauseInterval = argv.pauseInterval || 10; // Default pause every 10 pages
const longPauseDelay = argv.pauseDelay || 30000; // Default 10 seconds for long pause
const makesFile = argv.makesFile || ''; // File containing list of makes to process

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
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL_DEV}/api/cars?type=makes`);
  const data = await response.json()
  const makesToScrape = Array.from(new Set(data.map((item: CarMake) => item.make)))

  return makesToScrape;

  } catch (error) {
    console.error(`Error reading makes from DB: ${error}`);
    return [];
  }
}

// Function to process a single make
async function processMake(currentMake: string) {
  console.log(`\n========== Processing make: ${currentMake} ==========`);
  
  // Create a temporary argv object with the current make
  const tempArgv = { ...argv, make: currentMake };
  
  if (mode === 'completed' || mode === 'both') {
    await runResultsScraper(currentMake);
  }
  
  if (mode === 'active' || mode === 'both') {
    await runActiveScraper(currentMake);
  }
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
    
    // Fetch model suggestions if make is provided
    let modelSuggestions: string[] = [];
    if (currentMake) {
      modelSuggestions = await fetchModelSuggestions(currentMake);
    }
    
    // Scrape listings with the provided parameters
    const allListings = await scraper.scrape({
      make: currentMake,
      model,
      maxPages,
      delayBetweenRequests,
      longPauseInterval,
      longPauseDelay,
      recency,
      modelSuggestions, // Pass model suggestions to the scraper
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

async function runActiveScraper(currentMake: string = make) {
  console.log(`Testing BringATrailerActiveListingScraper for ${currentMake}...`);
  
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
    console.log('First result:', {
      title: allListings[0].title,
      make: allListings[0].make,
      model: allListings[0].model,
      current_bid: allListings[0].current_bid_formatted,
      end_date: new Date(allListings[0].endDate).toLocaleString(),
      url: allListings[0].url
    });
  }
  
  // If make and model are provided, filter the results
  if (currentMake && model) {
    const filteredListings = allListings.filter(listing => {
      const listingMake = listing.make?.toLowerCase() || '';
      const listingModel = listing.model?.toLowerCase() || '';
      const searchMake = currentMake.toLowerCase();
      const searchModel = model.toLowerCase();
      
      return listingMake === searchMake && listingModel.includes(searchModel);
    });
    
    console.log(`\nFound ${filteredListings.length} active ${currentMake} ${model} auctions`);
    
    if (filteredListings.length > 0) {
      // Save filtered results to file
      const makeForFilename = currentMake ? currentMake.toLowerCase() : 'all';
      const modelForFilename = model ? model.toLowerCase() : 'all';
      const filteredFile = path.join(resultsDir, `${makeForFilename}_${modelForFilename}_active_results.json`);
      fs.writeFileSync(filteredFile, JSON.stringify(filteredListings, null, 2));
      console.log(`Saved ${filteredListings.length} active ${currentMake} ${model} auctions to ${filteredFile}`);
    }
    
    return filteredListings;
  }
  
  return allListings;
}

// Add a function to fetch model suggestions from Supabase
async function fetchModelSuggestions(make: string): Promise<string[]> {
  try {
    // If Supabase environment variables are not set, return empty array
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase environment variables are not set. Cannot fetch model suggestions.');
      return [];
    }
    
    console.log(`Fetching model suggestions for make: ${make}`);
    
    // Query Supabase for models matching the make
    const { data, error } = await supabase
      .from('allcars')
      .select('model')
      .eq('make', make)
      .order('model');
    
    if (error) {
      console.error('Error fetching model suggestions:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log(`No models found for make: ${make}`);
      return [];
    }
    
    // Extract model names from the data
    const models = data.map(item => item.model);
    console.log(`Found ${models.length} models for ${make}`);
    
    return models;
  } catch (error) {
    console.error('Error in fetchModelSuggestions:', error);
    return [];
  }
}

// Main function to run the selected test mode
async function runScrape() {
  try {
    console.log(`Running scraper in ${mode} mode`);
    
    // get all makes from supabase
    const makes = await readMakesFromDB();
    
    if (makes.length === 0) {
      console.log('No makes found in the specified file. Using default make.');
      process.exit(1);
    } else {
      // Process each make in the list
      for (const currentMake of makes) {
        await processMake(currentMake);
        
        // Add a pause between processing different makes to avoid rate limiting
        if (makes.indexOf(currentMake) < makes.length - 1) {
          console.log(`Pausing before processing next make...`);
          await new Promise(resolve => setTimeout(resolve, longPauseDelay/10));
        }
      }
    }
  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

// Run the test
runScrape(); 