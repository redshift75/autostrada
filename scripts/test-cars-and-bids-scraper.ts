/**
 * Test script for Cars & Bids scraper
 * 
 * This script tests the CarsAndBidsActiveScraper by fetching active auction listings
 * from Cars & Bids and displaying the results.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CarsAndBidsActiveScraper } from '../lib/scrapers/CarsAndBidsActiveScraper';
import minimist from 'minimist';

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const make = argv.make || '';
const model = String(argv.model || '');
const yearMin = argv.yearMin || 0;
const yearMax = argv.yearMax || 0;
const debug = argv.debug === 'true' || argv.debug === true;

async function testCarsAndBidsScraper() {
  try {
    console.log('Testing CarsAndBidsActiveScraper...');
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(process.cwd(), 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create scraper instance
    const scraper = new CarsAndBidsActiveScraper();
    
    // Scrape listings with the provided parameters
    const params = {
      make,
      model,
      yearMin,
      yearMax,
      debug
    };
    
    console.log(`Scraping Cars & Bids with params:`, params);
    const listings = await scraper.scrape(params);
    
    console.log(`Found ${listings.length} listings`);
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cars-and-bids-listings-${timestamp}.json`;
    const filePath = path.join(resultsDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(listings, null, 2));
    console.log(`Results saved to ${filePath}`);
    
    // Display a sample of the results
    if (listings.length > 0) {
      console.log('\nSample listings:');
      const sampleSize = Math.min(5, listings.length);
      for (let i = 0; i < sampleSize; i++) {
        const listing = listings[i];
        console.log(`\n[${i + 1}] ${listing.title}`);
        console.log(`  URL: ${listing.url}`);
        console.log(`  Current Bid: ${listing.current_bid_formatted}`);
        console.log(`  Time Left: ${listing.time_left}`);
        console.log(`  Location: ${listing.location}`);
        console.log(`  No Reserve: ${listing.no_reserve ? 'Yes' : 'No'}`);
      }
    }
    
    return listings;
  } catch (error) {
    console.error('Error testing Cars & Bids scraper:', error);
    return [];
  }
}

// Run the test
testCarsAndBidsScraper()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  }); 