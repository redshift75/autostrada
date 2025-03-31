import { logger, schedules, wait } from "@trigger.dev/sdk/v3";
import { supabase } from '../supabase/client';
import { BaTActiveListing, BringATrailerActiveListingScraper } from "../scrapers/BringATrailerActiveListingScraper";

type CarMake = {
  make: string;
};

async function uploadActiveAuctionsToSupabase(listings: BaTActiveListing[]) {

console.log('Starting upload of active auction listings to Supabase...');
      
// Transform listings to database format
const dbListings = listings.map(listing => ({
  listing_id: listing.listing_id,
  url: listing.url,
  title: listing.title,
  image_url: listing.image_url,
  current_bid: listing.current_bid,
  current_bid_formatted: listing.current_bid_formatted,
  endDate: listing.endDate,
  status: listing.status || 'active',
  year: listing.year,
  make: listing.make,
  model: listing.model,
  location: listing.location,
  no_reserve: listing.no_reserve || false,
  premium: listing.premium || false,
  source_file: 'cron job',
  created_at: new Date(),
  updated_at: new Date(),
  mileage: listing.mileage || null,
  bidders: listing.bidders || null,
  watchers: listing.watchers || null,
  comments: listing.comments || null,
  transmission: listing.transmission || null,
  exterior_color: listing.color || null
}));

// Upload in batches to avoid hitting Supabase limits
const BATCH_SIZE = 100;
let successCount = 0;
let errorCount = 0;
  
for (let i = 0; i < dbListings.length; i += BATCH_SIZE) {
  const batch = dbListings.slice(i, i + BATCH_SIZE);
  console.log(`Uploading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(dbListings.length / BATCH_SIZE)}...`);
  
    // Insert data with upsert (update if exists, insert if not)
    const { data, error } = await supabase
      .from('bat_active_auctions')
      .upsert(batch, { 
        onConflict: 'listing_id',
        ignoreDuplicates: true // Changed to true to ignore duplicates
      });
    
    if (error) {
      console.error(`Error uploading batch: ${error.message}`);
      errorCount += batch.length;
    } else {
      console.log(`Successfully uploaded batch of ${batch.length} listings`);
      successCount += batch.length;
    }
  
  // Add a small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}
console.log('Completed uploading active auction listings to Supabase');
}

export const batScheduledTask = schedules.task({
  id: "Scrape BAT Active",
  // Every day at 5:00UTC
  cron: "0 6 * * *",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 1200, // Stop executing after 1200 secs (20 mins) of compute
  run: async (payload, { ctx }) => {
      
  logger.log(`Cron job triggered for scraping active auctions`);

  try {
      
      // Create a new instance of the scraper
      const scraper = new BringATrailerActiveListingScraper();
      
      // Scrape the results with forceScrape = true
      const scrapedResults = await scraper.scrape();
      
      logger.log(`Scraped ${scrapedResults.length} live auctions`);
      
      if (scrapedResults.length > 0) {
        const response = await supabase
        .from('bat_active_auctions')
        .delete()
        .eq('status', 'active');

        if (response.error) {
          logger.error('Error deleting active auctions');
        }
        
        await uploadActiveAuctionsToSupabase(scrapedResults);
      }            
  } catch (error) {
    logger.error('Error in cron job for scraping auction results');
  }
  },
});
