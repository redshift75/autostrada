/**
 * Test Scraper Script
 * 
 * This script tests the scraper infrastructure by scraping a few listings
 * from Bring a Trailer and displaying the results.
 */

import { ScraperManager } from '../lib/scrapers/ScraperManager';
import { ListingSource } from '../lib/standardization/listingData';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Testing scraper infrastructure...');
  
  // Create a scraper manager
  const manager = new ScraperManager({
    globalConfig: {
      cacheEnabled: true,
      cacheDir: '.cache',
      logLevel: 'debug'
    }
  });
  
  try {
    // Test searching for Porsche 911s
    console.log('\n--- Searching for Porsche 911s ---');
    const porscheResults = await manager.search({
      make: 'Porsche',
      model: '911',
      limit: 5,
      sources: [ListingSource.BRING_A_TRAILER]
    });
    
    console.log(`Found ${porscheResults.length} Porsche 911 listings`);
    
    // Display the results
    for (const result of porscheResults) {
      console.log(`- ${result.title} (${result.status}): ${result.price ? '$' + result.price.toLocaleString() : 'No price'}`);
    }
    
    // Save the results to a file
    const resultsDir = path.join(process.cwd(), 'results');
    await fs.mkdir(resultsDir, { recursive: true });
    await fs.writeFile(
      path.join(resultsDir, 'porsche_911_results.json'),
      JSON.stringify(porscheResults, null, 2)
    );
    console.log(`Results saved to results/porsche_911_results.json`);
    
    // Test searching for Ferrari listings
    console.log('\n--- Searching for Ferrari listings ---');
    const ferrariResults = await manager.search({
      make: 'Ferrari',
      limit: 5,
      sources: [ListingSource.BRING_A_TRAILER]
    });
    
    console.log(`Found ${ferrariResults.length} Ferrari listings`);
    
    // Display the results
    for (const result of ferrariResults) {
      console.log(`- ${result.title} (${result.status}): ${result.price ? '$' + result.price.toLocaleString() : 'No price'}`);
    }
    
    // Save the results to a file
    await fs.writeFile(
      path.join(resultsDir, 'ferrari_results.json'),
      JSON.stringify(ferrariResults, null, 2)
    );
    console.log(`Results saved to results/ferrari_results.json`);
    
    // Test searching for Mercedes-Benz 300SL
    console.log('\n--- Searching for Mercedes-Benz 300SL ---');
    const mercedesResults = await manager.search({
      make: 'Mercedes-Benz',
      model: '300SL',
      limit: 5,
      sources: [ListingSource.BRING_A_TRAILER]
    });
    
    console.log(`Found ${mercedesResults.length} Mercedes-Benz 300SL listings`);
    
    // Display the results
    for (const result of mercedesResults) {
      console.log(`- ${result.title} (${result.status}): ${result.price ? '$' + result.price.toLocaleString() : 'No price'}`);
    }
    
    // Save the results to a file
    await fs.writeFile(
      path.join(resultsDir, 'mercedes_300sl_results.json'),
      JSON.stringify(mercedesResults, null, 2)
    );
    console.log(`Results saved to results/mercedes_300sl_results.json`);
    
  } catch (error) {
    console.error('Error testing scrapers:', error);
  } finally {
    // Clean up
    await manager.cleanup();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 