import { logger, schedules, wait } from "@trigger.dev/sdk/v3";
import { BringATrailerResultsScraper } from '../scrapers/BringATrailerResultsScraper';
import { supabase } from '../supabase/client';

type CarMake = {
  make: string;
};

export const batScheduledTask = schedules.task({
  id: "Scrape BAT Results",
  // Every day at 1:00 AM
  cron: "0 18 * * *",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 1200, // Stop executing after 1200 secs (20 mins) of compute
  run: async (payload, { ctx }) => {
    try {
      // Get query parameters
      const maxPages = 10; // Default to 10 pages
      const recency = '7D';
      
      logger.log(`Cron job triggered for scraping all makes`);
      
      // Get all makes from Supabase
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cars?type=makes`);
      const data = await response.json()
      const makesToScrape = Array.from(new Set(data.map((item: CarMake) => item.make)))
  
      if (!response.ok) {
        return logger.error('Failed to fetch makes');
      }
  
      // Process each make sequentially to avoid overwhelming the server
      const results = [];
      
      for (const currentMake of makesToScrape) {
        try {
          logger.log(`Starting scrape for ${currentMake}`);
          
          // Create a new instance of the scraper
          const scraper = new BringATrailerResultsScraper();
          
          // Scrape the results with forceScrape = true
          const scrapedResults = await scraper.scrape({
            make: currentMake as string,
            maxPages,
            recency
          });
          
          logger.log(`Scraped ${scrapedResults.length} results for ${currentMake}`);
          
          // Store the results in Supabase
          // First, prepare the data for insertion
          const dataToInsert = scrapedResults.map(item => ({
            listing_id: item.id,
            url: item.url,
            title: item.title,
            image_url: item.image_url,
            status: item.status,
            sold_price: item.sold_price ? parseInt(item.sold_price) : null,
            sold_date: item.sold_date ? new Date(item.sold_date) : null,
            bid_amount: item.bid_amount ? parseInt(item.bid_amount) : null,
            bid_date: item.bid_date ? new Date(item.bid_date) : null,
            year: item.year,
            make: item.make,
            model: item.model,
            mileage: item.mileage,
            source_file: 'cron job',
            created_at: new Date(),
            updated_at: new Date(),
            bidders: item.bidders,
            watchers: item.watchers,
            comments: item.comments,
            transmission: item.transmission
          }));
          
          // Insert the data into Supabase
          // Using upsert to update existing records and insert new ones
          logger.log(`Inserting ${dataToInsert.length} results into Supabase for ${currentMake}`);
          
          if (dataToInsert.length > 0) {
            const { error } = await supabase
              .from('bat_completed_auctions')
              .upsert(dataToInsert, { 
                onConflict: 'listing_id', // Assuming listing_id is unique for each auction
                ignoreDuplicates: false // set to false to update existing records
              });
            
            if (error) {
              logger.error(`Error storing results for ${currentMake} ` + error.message);
            } else {
              results.push({
                make: currentMake,
                success: true,
                count: dataToInsert.length
              });
            }
          } else {
            logger.log(`No results to insert for ${currentMake}`);
            results.push({
              make: currentMake,
              success: true,
              count: 0
            });
          }
        } catch (error: any) {
          logger.error(`Error scraping ${currentMake}:`, error);
        }
      }
      return results;
    } catch (error: any) {
      logger.error('Error in cron job for scraping auction results:', error);
      return error;
    }
  },
});
