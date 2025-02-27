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
  
  // Test with Porsche 911
  console.log('\nSearching for completed Porsche 911 auctions...');
  const porscheResults = await scraper.scrape({
    make: 'Porsche',
    model: '911'
  });
  
  console.log(`Found ${porscheResults.length} completed auctions for Porsche 911`);
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
  
  // Test with Ferrari
  console.log('\nSearching for completed Ferrari auctions...');
  const ferrariResults = await scraper.scrape({
    make: 'Ferrari'
  });
  
  console.log(`Found ${ferrariResults.length} completed auctions for Ferrari`);
  if (ferrariResults.length > 0) {
    console.log('First result:', {
      title: ferrariResults[0].title,
      status: ferrariResults[0].status,
      price: ferrariResults[0].sold_price || ferrariResults[0].bid_amount,
      url: ferrariResults[0].url
    });
  }
  
  // Save results to file
  const ferrariResultsFile = path.join(resultsDir, 'ferrari_completed_results.json');
  fs.writeFileSync(ferrariResultsFile, JSON.stringify(ferrariResults, null, 2));
  console.log(`Saved ${ferrariResults.length} Ferrari completed auctions to ${ferrariResultsFile}`);
  
  // Test with Mercedes-Benz 300SL
  console.log('\nSearching for completed Mercedes-Benz 300SL auctions...');
  const mercedesResults = await scraper.scrape({
    make: 'Mercedes-Benz',
    model: '300SL'
  });
  
  console.log(`Found ${mercedesResults.length} completed auctions for Mercedes-Benz 300SL`);
  if (mercedesResults.length > 0) {
    console.log('First result:', {
      title: mercedesResults[0].title,
      status: mercedesResults[0].status,
      price: mercedesResults[0].sold_price || mercedesResults[0].bid_amount,
      url: mercedesResults[0].url
    });
  }
  
  // Save results to file
  const mercedesResultsFile = path.join(resultsDir, 'mercedes_300sl_completed_results.json');
  fs.writeFileSync(mercedesResultsFile, JSON.stringify(mercedesResults, null, 2));
  console.log(`Saved ${mercedesResults.length} Mercedes-Benz 300SL completed auctions to ${mercedesResultsFile}`);
}

// Run the test
testResultsScraper().catch(error => {
  console.error('Error testing results scraper:', error);
  process.exit(1);
}); 