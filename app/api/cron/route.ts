import { NextRequest, NextResponse } from 'next/server';
import { BringATrailerResultsScraper } from '../../../lib/scrapers/BringATrailerResultsScraper';
import { supabase } from '../../../lib/supabase/client';

export const runtime = 'edge';

type CarMake = {
    Make: string;
  };
  
// This endpoint is designed to be called by a cron job to trigger scraping of BAT auction results
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make') || ''; // All makes if not defined
    const maxPages = parseInt(searchParams.get('maxPages') || '10'); // Default to 10 pages
    const recency = searchParams.get('recency') || '7D';
    
    console.log(`Cron job triggered for scraping ${make ? make : 'all makes'}`);
    
    // Get all makes from Supabase
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cars?type=makes`);
    const data = await response.json()
    const makes = Array.from(new Set(data.map((item: CarMake) => item.Make)))

    if (!response.ok) {
      console.error('Failed to fetch makes:', response.statusText);
      return NextResponse.json({ error: 'Failed to fetch makes' }, { status: 500 });
    }

    // If a specific make is provided, only scrape that one
    const makesToScrape = make ? [make] : makes;

    // Process each make sequentially to avoid overwhelming the server
    const results = [];
    
    for (const currentMake of makesToScrape) {
      try {
        console.log(`Starting scrape for ${currentMake}`);
        
        // Create a new instance of the scraper
        const scraper = new BringATrailerResultsScraper();
        
        // Scrape the results with forceScrape = true
        const scrapedResults = await scraper.scrape({
          make: currentMake as string,
          maxPages,
          recency
        });
        
        console.log(`Scraped ${scrapedResults.length} results for ${currentMake}`);
        
        // Store the results in Supabase
        // First, prepare the data for insertion
        const dataToInsert = scrapedResults.map(item => ({
          listing_id: item.id,
          url: item.url,
          title: item.title,
          image_url: item.image_url,
          status: item.status,
          sold_price: item.sold_price ? parseFloat(item.sold_price.replace(/[^0-9.]/g, '')) : null,
          sold_date: item.sold_date,
          bid_amount: item.bid_amount ? parseFloat(item.bid_amount.replace(/[^0-9.]/g, '')) : null,
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
        console.log(`Inserting ${dataToInsert.length} results into Supabase for ${currentMake}`);
        
        if (dataToInsert.length > 0) {
          const { error } = await supabase
            .from('bat_completed_auctions')
            .upsert(dataToInsert, { 
              onConflict: 'listing_id', // Assuming listing_id is unique for each auction
              ignoreDuplicates: false // set to false to update existing records
            });
          
          if (error) {
            console.error(`Error storing results for ${currentMake} in Supabase:`, error);
            results.push({
              make: currentMake,
              success: false,
              count: 0,
              error: error.message
            });
          } else {
            results.push({
              make: currentMake,
              success: true,
              count: dataToInsert.length
            });
          }
        } else {
          console.log(`No results to insert for ${currentMake}`);
          results.push({
            make: currentMake,
            success: true,
            count: 0
          });
        }
      } catch (error: any) {
        console.error(`Error scraping ${currentMake}:`, error);
        results.push({
          make: currentMake,
          success: false,
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      message: 'Auction results scraping completed',
      results: results
    });
    
  } catch (error: any) {
    console.error('Error in cron job for scraping auction results:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape auction results',
        details: error.message
      },
      { status: 500 }
    );
  }
} 