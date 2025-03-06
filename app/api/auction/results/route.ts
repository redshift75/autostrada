import { NextRequest, NextResponse } from 'next/server';
import { createAuctionResultsTool } from '../../../../lib/langchain/tools';
import { supabase } from '../../../../lib/supabase/client';

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
    
    // Validate required fields
    if (!make) {
      return NextResponse.json(
        { error: 'Make is required field' },
        { status: 400 }
      );
    }

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
    let parsedResult = null;
    
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
      } else {
        console.log('No results found in Supabase, falling back to scraper');
      }
    }
    
    // If we don't have results from Supabase, use the scraper
    if (!parsedResult) {
      console.log('Fetching data using BringATrailerResultsScraper...');
      
      // Create the auction results tool
      const auctionResultsTool = createAuctionResultsTool();
      
      // Fetch results
      const result = await auctionResultsTool.invoke({
        make,
        model,
        yearMin: yearMin || 2015,
        yearMax: yearMax || 2023,
        maxPages: maxPages || 2,
        generateVisualizations: false // Don't generate visualizations here
      });
      
      // Parse the result
      parsedResult = JSON.parse(result);
      
      // Add source information
      parsedResult.source = 'scraper';
    }
    
    // Process results to add price field for filtering
    const processedResults = (parsedResult.results || []).map((result: any) => {
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
      summary: parsedResult.summary,
      results: processedResults,
      source: parsedResult.source
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