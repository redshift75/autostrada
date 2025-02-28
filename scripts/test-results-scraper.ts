/**
 * Test Results Scraper Script
 * 
 * This script tests the BringATrailerResultsScraper by fetching completed auction listings
 * from Bring a Trailer and displaying the results.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BringATrailerResultsScraper } from '../lib/scrapers/BringATrailerResultsScraper';

async function testResultsScraper() {
  console.log('Testing BringATrailerResultsScraper...');
  
  // Create results directory if it doesn't exist
  const resultsDir = path.join(process.cwd(), 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }
  
  const scraper = new BringATrailerResultsScraper();
  
  // Test with Porsche
  console.log('\nSearching for completed Porsche auctions...');
  const porscheResults = await scraper.scrape({
    make: 'Porsche',
  //  model: '911',
    maxPages: 100
  });
  
  console.log(`Found ${porscheResults.length} completed auctions for Porsche`);
  if (porscheResults.length > 0) {
    console.log('First result:', {
      title: porscheResults[0].title,
      status: porscheResults[0].status,
      price: porscheResults[0].sold_price || porscheResults[0].bid_amount,
      url: porscheResults[0].url
    });
  }
  
  // Save results to file
  const porscheResultsFile = path.join(resultsDir, 'porsche_911_completed_results.json');
  fs.writeFileSync(porscheResultsFile, JSON.stringify(porscheResults, null, 2));
  console.log(`Saved ${porscheResults.length} Porsche 911 completed auctions to ${porscheResultsFile}`); 
 }

// Run the test
testResultsScraper().catch(error => {
  console.error('Error testing results scraper:', error);
  process.exit(1);
}); 