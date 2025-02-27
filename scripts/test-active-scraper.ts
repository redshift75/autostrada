/**
 * Test Active Listings Scraper Script
 * 
 * This script tests the BringATrailerActiveListingScraper by fetching active auction listings
 * from Bring a Trailer and displaying the results.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BringATrailerActiveListingScraper } from '../lib/scrapers/BringATrailerActiveListingScraper';

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
  
}

// Run the test
testActiveScraper().catch(error => {
  console.error('Error testing active scraper:', error);
  process.exit(1);
}); 