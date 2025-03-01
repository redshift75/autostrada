/**
 * Test Results Scraper Script
 * 
 * This script tests the BringATrailerResultsScraper by fetching completed auction listings
 * from Bring a Trailer and displaying the results.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BringATrailerResultsScraper } from '../lib/scrapers/BringATrailerResultsScraper';
import minimist from 'minimist';

async function testResultsScraper() {
  // Parse command line arguments
  const argv = minimist(process.argv.slice(2));
  const make = argv.make || 'Porsche';
  const model = argv.model || '911';
  const maxPages = argv.maxPages || 3;

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
}

// Run the test
testResultsScraper().catch(error => {
  console.error('Error testing results scraper:', error);
  process.exit(1);
}); 