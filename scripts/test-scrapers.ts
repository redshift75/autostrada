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

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const mode = argv.mode || 'both'; // completed, active, both
const make = argv.make || 'Porsche';
const model = argv.model || '911';
const maxPages = argv.maxPages || 3;

async function testResultsScraper() {
  console.log(`Testing BringATrailerResultsScraper for ${make} ${model}...`);
  
  // Create results directory if it doesn't exist
  const resultsDir = path.join(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }
  
  const scraper = new BringATrailerResultsScraper();
  
  // Test with provided make and model
  console.log(`\nSearching for completed ${make} ${model} auctions...`);
  const results = await scraper.scrape({
    make: make,
    model: model,
    maxPages: maxPages
  });
  
  console.log(`Found ${results.length} completed auctions for ${make} ${model}`);
  if (results.length > 0) {
    console.log('First result:', {
      title: results[0].title,
      status: results[0].status,
      price: results[0].sold_price || results[0].bid_amount,
      url: results[0].url
    });
  }
  
  // Save results to file with make and model in the filename
  const resultsFile = path.join(resultsDir, `${make.toLowerCase()}_${model.toLowerCase()}_completed_results.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`Saved ${results.length} ${make} ${model} completed auctions to ${resultsFile}`);
  
  return results;
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
  
  // Save results to file
  const allListingsFile = path.join(resultsDir, 'active_listings.json');
  fs.writeFileSync(allListingsFile, JSON.stringify(allListings, null, 2));
  console.log(`Saved ${allListings.length} active listings to ${allListingsFile}`);
  
  // If make and model are provided, filter the results
  if (make && model) {
    const filteredListings = allListings.filter(listing => {
      return listing.make?.toLowerCase() === make.toLowerCase() && 
             listing.model?.toLowerCase().includes(model.toLowerCase());
    });
    
    console.log(`\nFound ${filteredListings.length} active ${make} ${model} auctions`);
    
    if (filteredListings.length > 0) {
      // Save filtered results to file
      const filteredFile = path.join(resultsDir, `${make.toLowerCase()}_${model.toLowerCase()}_active_results.json`);
      fs.writeFileSync(filteredFile, JSON.stringify(filteredListings, null, 2));
      console.log(`Saved ${filteredListings.length} active ${make} ${model} auctions to ${filteredFile}`);
    }
    
    return filteredListings;
  }
  
  return allListings;
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