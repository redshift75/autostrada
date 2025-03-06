import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase/client';
import { BringATrailerResultsScraper } from '../../../../lib/scrapers/BringATrailerResultsScraper';

// Helper functions for calculating statistics from results
function calculateAverageSoldPrice(results: any[]): string {
  const soldResults = results.filter(r => r.status === 'sold' && r.sold_price);
  if (soldResults.length === 0) return 'N/A';
  
  const total = soldResults.reduce((sum, r) => sum + (r.sold_price || 0), 0);
  return `$${Math.round(total / soldResults.length).toLocaleString()}`;
}

function findHighestSoldPrice(results: any[]): string {
  const soldResults = results.filter(r => r.status === 'sold' && r.sold_price);
  if (soldResults.length === 0) return 'N/A';
  
  const highest = Math.max(...soldResults.map(r => r.sold_price || 0));
  return `$${highest.toLocaleString()}`;
}

function findLowestSoldPrice(results: any[]): string {
  const soldResults = results.filter(r => r.status === 'sold' && r.sold_price);
  if (soldResults.length === 0) return 'N/A';
  
  const lowest = Math.min(...soldResults.map(r => r.sold_price || 0));
  return `$${lowest.toLocaleString()}`;
}

function calculateSoldPercentage(results: any[]): string {
  if (results.length === 0) return '0%';
  
  const soldCount = results.filter(r => r.status === 'sold').length;
  return `${Math.round((soldCount / results.length) * 100)}%`;
}

function calculateAverageMileage(results: any[]): string {
  const resultsWithMileage = results.filter(r => r.mileage !== null && r.mileage !== undefined);
  if (resultsWithMileage.length === 0) return 'N/A';
  
  const total = resultsWithMileage.reduce((sum, r) => sum + (r.mileage || 0), 0);
  return `${Math.round(total / resultsWithMileage.length).toLocaleString()} miles`;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { make, model, yearMin, yearMax, maxPages } = body;

    // First, try to fetch results from Supabase
    console.log(`Checking Supabase for ${make} ${model} (${yearMin || 'any'}-${yearMax || 'any'})`);
    
    let query = supabase
      .from('bat_completed_auctions')
      .select('*')
      .ilike('make', `%${make}%`)
      .order('sold_date', { ascending: false });
    
    // Add model filter if provided
    if (model && model !== 'Any') {
      query = query.ilike('title', `%${model}%`);
    }
    
    // Add year range filters if provided
    if (yearMin) {
      query = query.gte('year', yearMin);
    }
    
    if (yearMax) {
      query = query.lte('year', yearMax);
    }
    
    // Execute the query
    const { data: supabaseResults, error: supabaseError } = await query;
    
    let results = [];
    let parsedResult: any = null;
    
    // Check if we got results from Supabase
    if (!supabaseError && supabaseResults && supabaseResults.length > 0) {
      console.log(`Found ${supabaseResults.length} results in Supabase database`);
      
      // Format the results to match the expected structure
      results = supabaseResults.map(item => ({
        title: item.title,
        year: item.year,
        make: item.make,
        model: item.model,
        sold_price: item.sold_price ? `$${item.sold_price}` : 'Not sold',
        bid_amount: item.bid_amount ? `$${item.bid_amount}` : 'No bids',
        sold_date: item.sold_date,
        status: item.status,
        url: item.url,
        mileage: item.mileage,
        bidders: item.bidders,
        watchers: item.watchers,
        comments: item.comments,
        image_url: item.image_url
      }));
      
      // Create a result object
      parsedResult = {
        query: {
          make,
          model: model || 'Any',
          yearRange: `${yearMin || 'Any'}-${yearMax || 'Any'}`
        },
        summary: {
          totalResults: supabaseResults.length,
          averageSoldPrice: calculateAverageSoldPrice(supabaseResults),
          highestSoldPrice: findHighestSoldPrice(supabaseResults),
          lowestSoldPrice: findLowestSoldPrice(supabaseResults),
          soldPercentage: calculateSoldPercentage(supabaseResults),
          averageMileage: calculateAverageMileage(supabaseResults)
        },
        results: results,
        source: 'supabase'
      };
    } else {
      if (supabaseError) {
        console.error('Error fetching from Supabase:', supabaseError);
      }
    }
    
    // If we don't have results from Supabase, use the scraper
    if (!parsedResult) {
      console.log('No results found in Supabase, scraping ', make, model, maxPages);
      
      try {
        // Create a new instance of the scraper and use it directly
        const scraper = new BringATrailerResultsScraper();
        
        // Scrape the results
        const scrapedResults = await scraper.scrape({
          make,
          model,
          yearMin,
          yearMax,
          maxPages: maxPages || 1
        });
        
        console.log(`Scraped ${scrapedResults.length} results directly`);
        
        // Format the results to match the expected structure
        results = scrapedResults.map(item => ({
          title: item.title,
          year: item.year,
          make: item.make,
          model: item.model,
          sold_price: item.sold_price,
          bid_amount: item.bid_amount,
          sold_date: item.sold_date,
          status: item.status,
          url: item.url,
          mileage: item.mileage,
          bidders: item.bidders,
          watchers: item.watchers,
          comments: item.comments,
          image_url: item.image_url
        }));
        
        // Create a result object
        parsedResult = {
          query: {
            make,
            model: model || 'Any',
            yearRange: `${yearMin || 'Any'}-${yearMax || 'Any'}`
          },
          summary: {
            totalResults: scrapedResults.length,
            averageSoldPrice: calculateAverageSoldPrice(scrapedResults),
            highestSoldPrice: findHighestSoldPrice(scrapedResults),
            lowestSoldPrice: findLowestSoldPrice(scrapedResults),
            soldPercentage: calculateSoldPercentage(scrapedResults),
            averageMileage: calculateAverageMileage(scrapedResults)
          },
          results: results,
          source: 'scraper'
        };
      } catch (error) {
        console.error('Error in direct scraper:', error);
        
        // Fallback to empty results if scraping fails
        parsedResult = {
          query: {
            make,
            model: model || 'Any',
            yearRange: `${yearMin || 'Any'}-${yearMax || 'Any'}`
          },
          summary: {
            totalResults: 0,
            averageSoldPrice: 'N/A',
            highestSoldPrice: 'N/A',
            lowestSoldPrice: 'N/A',
            soldPercentage: '0%',
            averageMileage: 'N/A'
          },
          results: [],
          source: 'scraper_fallback'
        };
      }
    }
    
    // Process results to add price field for filtering
    const processedResults = (parsedResult?.results || []).map((result: any) => {
      const priceStr = result.status === 'sold' ? result.sold_price : result.bid_amount;
      const numericPrice = priceStr ? priceStr.replace(/[^0-9.]/g, '') : '0';
      return {
        ...result,
        price: parseFloat(numericPrice)
      };
    });
    
    // Create a response with the processed data
    const response = {
      message: 'Auction results fetched successfully',
      summary: parsedResult?.summary || {
        totalResults: 0,
        averageSoldPrice: 'N/A',
        highestSoldPrice: 'N/A',
        lowestSoldPrice: 'N/A',
        soldPercentage: '0%',
        averageMileage: 'N/A'
      },
      results: processedResults,
      source: parsedResult?.source || 'unknown'
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching auction results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction results' },
      { status: 500 }
    );
  }
} 