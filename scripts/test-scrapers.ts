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
const delayBetweenRequests = argv.delay || 1000; // Default 1 seconds between requests
const longPauseInterval = argv.pauseInterval || 10; // Default pause every 10 pages
const longPauseDelay = argv.pauseDelay || 30000; // Default 30 seconds for long pause

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if Supabase environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.warn('Warning: Supabase environment variables are not set. Model suggestions will not be available.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testResultsScraper() {
  try {
    console.log('Testing BringATrailerResultsScraper...');
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create scraper instance
    const scraper = new BringATrailerResultsScraper();
    
    // Fetch model suggestions if make is provided
    let modelSuggestions: string[] = [];
    if (make) {
      modelSuggestions = await fetchModelSuggestions(make);
      console.log(`Using ${modelSuggestions.length} model suggestions for ${make}`);
    }
    
    // Scrape listings with the provided parameters
    const allListings = await scraper.scrape({
      make,
      model,
      maxPages,
      delayBetweenRequests,
      longPauseInterval,
      longPauseDelay,
      modelSuggestions, // Pass model suggestions to the scraper
    });
    
    console.log(`\nFound ${allListings.length} completed auctions`);
    
    // If make and model are provided, filter the results
    if (make) {
      const filteredListings = allListings.filter(listing => {
        const listingMake = listing.make?.toLowerCase() || '';
        const searchMake = make.toLowerCase();
        
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
      
      console.log(`\nFound ${filteredListings.length} completed ${make} ${model || ''} auctions`);
      
      if (filteredListings.length > 0) {
        // Save filtered results to file
        const makeForFilename = make ? make.toLowerCase() : 'all';
        const modelForFilename = model ? model.toLowerCase() : 'all';
        const filteredFile = path.join(resultsDir, `${makeForFilename}_${modelForFilename ? modelForFilename + '_' : ''}filter_completed_results.json`);
        fs.writeFileSync(filteredFile, JSON.stringify(filteredListings, null, 2));
        console.log(`Saved ${filteredListings.length} completed ${make} ${model || ''} auctions to ${filteredFile}`);
      }
      
      return filteredListings;
    }
    
    return allListings;
  } catch (error) {
    console.error('Error in testResultsScraper:', error);
    return [];
  }
}

async function testActiveScraper() {
  console.log('Testing BringATrailerActiveListingScraper...');
  
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
  if (make && model) {
    const filteredListings = allListings.filter(listing => {
      const listingMake = listing.make?.toLowerCase() || '';
      const listingModel = listing.model?.toLowerCase() || '';
      const searchMake = make.toLowerCase();
      const searchModel = model.toLowerCase();
      
      return listingMake === searchMake && listingModel.includes(searchModel);
    });
    
    console.log(`\nFound ${filteredListings.length} active ${make} ${model} auctions`);
    
    if (filteredListings.length > 0) {
      // Save filtered results to file
      const makeForFilename = make ? make.toLowerCase() : 'all';
      const modelForFilename = model ? model.toLowerCase() : 'all';
      const filteredFile = path.join(resultsDir, `${makeForFilename}_${modelForFilename}_active_results.json`);
      fs.writeFileSync(filteredFile, JSON.stringify(filteredListings, null, 2));
      console.log(`Saved ${filteredListings.length} active ${make} ${model} auctions to ${filteredFile}`);
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
      .select('Model')
      .eq('Make', make)
      .order('Model');
    
    if (error) {
      console.error('Error fetching model suggestions:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log(`No models found for make: ${make}`);
      return [];
    }
    
    // Extract model names from the data
    const models = data.map(item => item.Model);
    console.log(`Found ${models.length} models for ${make}`);
    
    return models;
  } catch (error) {
    console.error('Error in fetchModelSuggestions:', error);
    return [];
  }
}

// Main function to run the selected test mode
async function runTest() {
  try {
    console.log(`Running scraper test in ${mode} mode`);
    
    if (mode === 'completed' || mode === 'both') {
      await testResultsScraper();
    }
    
    if (mode === 'active' || mode === 'both') {
      await testActiveScraper();
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error running scraper test:', error);
    process.exit(1);
  }
}

// Run the test
runTest(); 