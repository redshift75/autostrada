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
  
  // Test with Porsche 911
  console.log('\nSearching for active Porsche 911 auctions...');
  const porscheResults = await scraper.searchListings({
    make: 'Porsche',
    model: '911'
  });
  
  console.log(`Found ${porscheResults.length} active auctions for Porsche 911`);
  if (porscheResults.length > 0) {
    console.log('First result:', {
      title: porscheResults[0].title,
      make: porscheResults[0].make,
      model: porscheResults[0].model,
      current_bid: porscheResults[0].current_bid_formatted,
      end_date: new Date(porscheResults[0].endDate).toLocaleString(),
      url: porscheResults[0].url
    });
  }
  
  // Save results to file
  const porscheResultsFile = path.join(resultsDir, 'porsche_911_active_listings.json');
  fs.writeFileSync(porscheResultsFile, JSON.stringify(porscheResults, null, 2));
  console.log(`Saved ${porscheResults.length} Porsche 911 active listings to ${porscheResultsFile}`);
  
  // Test with Ferrari
  console.log('\nSearching for active Ferrari auctions...');
  const ferrariResults = await scraper.searchListings({
    make: 'Ferrari'
  });
  
  console.log(`Found ${ferrariResults.length} active auctions for Ferrari`);
  if (ferrariResults.length > 0) {
    console.log('First result:', {
      title: ferrariResults[0].title,
      make: ferrariResults[0].make,
      model: ferrariResults[0].model,
      current_bid: ferrariResults[0].current_bid_formatted,
      end_date: new Date(ferrariResults[0].endDate).toLocaleString(),
      url: ferrariResults[0].url
    });
  }
  
  // Save results to file
  const ferrariResultsFile = path.join(resultsDir, 'ferrari_active_listings.json');
  fs.writeFileSync(ferrariResultsFile, JSON.stringify(ferrariResults, null, 2));
  console.log(`Saved ${ferrariResults.length} Ferrari active listings to ${ferrariResultsFile}`);
}

// Run the test
testActiveScraper().catch(error => {
  console.error('Error testing active scraper:', error);
  process.exit(1);
}); 