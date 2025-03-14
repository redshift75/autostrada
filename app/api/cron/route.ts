import { NextRequest, NextResponse } from 'next/server';
import { BringATrailerResultsScraper } from '../../../lib/scrapers/BringATrailerResultsScraper';
import { supabase } from '../../../lib/supabase/client';

// This endpoint is designed to be called by a cron job to trigger scraping of BAT auction results
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make') || 'porsche'; // Default to porsche if not specified
    const model = searchParams.get('model') || '';
    const maxPages = parseInt(searchParams.get('maxPages') || '10'); // Default to 5 pages
    const recency = searchParams.get('recency') || '7D';
    console.log(`Cron job triggered for scraping ${make} ${model}})`);
    
    // Create a new instance of the scraper
    const scraper = new BringATrailerResultsScraper();
    
    // Scrape the results with forceScrape = true
    const scrapedResults = await scraper.scrape({
      make,
      model,
      maxPages,
      recency
    });
    
    console.log(`Scraped ${scrapedResults.length} results`);
    
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
    console.log(`Inserting ${dataToInsert.length} results into Supabase`);
    const { error } = await supabase
      .from('bat_completed_auctions')
      .upsert(dataToInsert, { 
        onConflict: 'listing_id', // Assuming URL is unique for each auction
        ignoreDuplicates: false // set to false to update existing records
      });
    
    if (error) {
      console.error('Error storing results in Supabase:', error);
      return NextResponse.json(
        { 
          error: 'Failed to store results in database',
          details: error.message
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Auction results scraped and stored successfully',
      count: scrapedResults.length,
      make,
      model: model || 'Any',
      maxPages
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