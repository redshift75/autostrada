import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase/client';
import { BringATrailerResultsScraper } from '../../../../lib/scrapers/BringATrailerResultsScraper';
import { decodeHtmlEntities } from '@/components/shared/utils';

// Types for aggregation
interface AggregationConfig {
  function: 'count' | 'avg' | 'sum';
  field: string;
}

interface AuctionQueryParams {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  sold_date_min?: string;
  sold_date_max?: string;
  maxPages?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  transmission?: string;
  forceScrape?: boolean;
  groupBy?: string;
  aggregation?: AggregationConfig[];
}

// Helper functions for calculating statistics
const calculateStatistics = {
  averageSoldPrice: (results: any[]): string => {
    const soldResults = results.filter(r => r.status === 'sold' && r.sold_price);
    if (soldResults.length === 0) return 'N/A';
    
    const total = soldResults.reduce((sum, r) => sum + (r.sold_price || 0), 0);
    return `$${Math.round(total / soldResults.length).toLocaleString()}`;
  },

  highestSoldPrice: (results: any[]): string => {
    const soldResults = results.filter(r => r.status === 'sold' && r.sold_price);
    if (soldResults.length === 0) return 'N/A';
    
    const highest = Math.max(...soldResults.map(r => r.sold_price || 0));
    return `$${highest.toLocaleString()}`;
  },

  lowestSoldPrice: (results: any[]): string => {
    const soldResults = results.filter(r => r.status === 'sold' && r.sold_price);
    if (soldResults.length === 0) return 'N/A';
    
    const lowest = Math.min(...soldResults.map(r => r.sold_price || 0));
    return `$${lowest.toLocaleString()}`;
  },

  soldPercentage: (results: any[]): string => {
    if (results.length === 0) return '0%';
    
    const soldCount = results.filter(r => r.status === 'sold').length;
    return `${Math.round((soldCount / results.length) * 100)}%`;
  },

  averageMileage: (results: any[]): string => {
    const resultsWithMileage = results.filter(r => r.mileage !== null && r.mileage !== undefined);
    if (resultsWithMileage.length === 0) return 'N/A';
    
    const total = resultsWithMileage.reduce((sum, r) => sum + (r.mileage || 0), 0);
    return `${Math.round(total / resultsWithMileage.length).toLocaleString()} miles`;
  }
};

// Builds a Supabase query with common filters
function buildSupabaseQuery(params: AuctionQueryParams, table = 'bat_completed_auctions') {
  let query = supabase.from(table).select('*');
  
  if (params.make) {
    query = query.ilike('make', `%${params.make}%`);
  }
  
  if (params.model && params.model !== 'Any') {
    query = query.ilike('title', `%${params.model}%`);
  }
  
  if (params.yearMin) {
    query = query.gte('year', params.yearMin);
  }
  
  if (params.yearMax) {
    query = query.lte('year', params.yearMax);
  }
  
  if (params.transmission && params.transmission !== 'Any') {
    query = query.ilike('transmission', `%${params.transmission}%`);
  }
  
  if (params.sold_date_min) {
    query = query.gte('sold_date', params.sold_date_min);
  }
  
  if (params.sold_date_max) {
    query = query.lte('sold_date', params.sold_date_max);
  }
  
  if (params.status) {
    if (params.status === 'sold') {
      query = query.eq('status', 'sold');
    } else if (params.status === 'unsold') {
      query = query.neq('status', 'sold');
    }
  }
  
  return query;
}

// Process auction results for response
function formatAuctionResults(items: any[]) {
  return items.map(item => ({
    title: decodeHtmlEntities(item.title),
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
    image_url: item.image_url,
    transmission: item.transmission
  }));
}

// Handle aggregation requests
async function handleAggregation(params: AuctionQueryParams) {
  if (!params.groupBy || !params.aggregation) {
    return null;
  }
  
  const selectQuery = `${params.groupBy}, ${params.aggregation.map(agg => 
    `${agg.function}(${agg.field})`
  ).join(', ')}`;
  
  const query = supabase
    .from('bat_completed_auctions')
    .select(selectQuery);
    
  // Apply filters from buildSupabaseQuery
  if (params.make) {
    query.ilike('make', `%${params.make}%`);
  }
  
  if (params.model && params.model !== 'Any') {
    query.ilike('title', `%${params.model}%`);
  }
  
  if (params.yearMin) {
    query.gte('year', params.yearMin);
  }
  
  if (params.yearMax) {
    query.lte('year', params.yearMax);
  }
  
  if (params.transmission && params.transmission !== 'Any') {
    query.ilike('transmission', `%${params.transmission}%`);
  }
  
  if (params.sold_date_min) {
    query.gte('sold_date', params.sold_date_min);
  }
  
  if (params.sold_date_max) {
    query.lte('sold_date', params.sold_date_max);
  }
  
  if (params.status) {
    if (params.status === 'sold') {
      query.eq('status', 'sold');
    } else if (params.status === 'unsold') {
      query.neq('status', 'sold');
    }
  }
  
  const { data: aggregatedResults, error: aggregationError } = await query;
  
  if (aggregationError) {
    console.error('Error performing aggregation:', aggregationError);
    throw new Error('Failed to perform aggregation');
  }
  
  // Sort aggregated results if sort parameters are provided
  if (params.sortBy && params.sortOrder && params.aggregation.length > 0) {
    const sortedResults = [...aggregatedResults];
    const sortFunction = params.aggregation[0].function;
      
    sortedResults.sort((a: any, b: any) => {
      const ascending = params.sortOrder === 'asc' ? 1 : -1;
      
      // Get the aggregated values to compare
      const valueA = a[`${sortFunction}`];
      const valueB = b[`${sortFunction}`];
      
      // Handle numeric values (most common for aggregations)
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return ascending * (valueA - valueB);
      }
      
      // Handle string values
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return ascending * valueA.localeCompare(valueB);
      }
      
      return 0;
    });
    
    return sortedResults;
  }
  
  return aggregatedResults;
}

// Fetch data from Supabase database
async function fetchFromDatabase(params: AuctionQueryParams) {
  let query = buildSupabaseQuery(params);
  
  // Apply sorting
  const sortField = params.sortBy || 'sold_date';
  const ascending = params.sortOrder === 'asc';
  query = query.order(sortField, { ascending });
  
  const { data: supabaseResults, error: supabaseError } = await query;
  
  if (supabaseError) {
    console.error('Error fetching from Supabase:', supabaseError);
    return null;
  }
  
  if (!supabaseResults || supabaseResults.length === 0) {
    return null;
  }
  
  console.log(`Found ${supabaseResults.length} results in Supabase database`);
  
  return {
    results: formatAuctionResults(supabaseResults),
    rawResults: supabaseResults,
    source: 'supabase'
  };
}

// Fetch data using the scraper
async function fetchFromScraper(params: AuctionQueryParams) {
  try {
    const scraper = new BringATrailerResultsScraper();
    
    const scrapedResults = await scraper.scrape({
      make: params.make,
      model: params.model,
      yearMin: params.yearMin,
      yearMax: params.yearMax,
      maxPages: params.maxPages || 1,
      transmission: params.transmission
    });
    
    console.log(`Scraped ${scrapedResults.length} results directly`);
    
    let results = formatAuctionResults(scrapedResults);
    
    // Apply status filter if provided
    if (params.status) {
      if (params.status === 'sold') {
        results = results.filter(item => item.status === 'sold');
      } else if (params.status === 'unsold') {
        results = results.filter(item => item.status !== 'sold');
      }
    }
    
    // Apply transmission filter if provided (for scraped results)
    if (params.transmission && params.transmission !== 'Any') {
      results = results.filter(item => 
        item.transmission?.toLowerCase().includes(params.transmission!.toLowerCase())
      );
    }
    
    return {
      results,
      rawResults: scrapedResults,
      source: 'scraper'
    };
  } catch (error) {
    console.error('Error in direct scraper:', error);
    return null;
  }
}

// Apply final processing and sorting to results
function processResults(results: any[], params: AuctionQueryParams) {
  // Add numeric price field for filtering and sorting
  const processedResults = results.map((result: any) => {
    const priceStr = result.status === 'sold' ? result.sold_price : result.bid_amount;
    const numericPrice = priceStr ? priceStr.replace(/[^0-9.]/g, '') : '0';
    return {
      ...result,
      price: parseFloat(numericPrice)
    };
  });
  
  // Sort processed results if needed
  if (params.sortBy) {
    const ascending = params.sortOrder === 'asc' ? 1 : -1;
    
    processedResults.sort((a: any, b: any) => {
      if (params.sortBy === 'sold_date') {
        const dateA = new Date(a.sold_date || 0);
        const dateB = new Date(b.sold_date || 0);
        return ascending * (dateA.getTime() - dateB.getTime());
      } else if (params.sortBy === 'mileage') {
        const mileageA = a.mileage || 0;
        const mileageB = b.mileage || 0;
        return ascending * (mileageA - mileageB);
      } else if (params.sortBy === 'sold_price') {
        const priceA = a.status === 'sold' ? a.price || 0 : 0;
        const priceB = b.status === 'sold' ? b.price || 0 : 0;
        return ascending * (priceA - priceB);
      }
      return 0;
    });
  }
  
  return processedResults;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const params: AuctionQueryParams = await request.json();
    
    // Handle aggregation requests separately
    if (params.groupBy && params.aggregation) {
      const aggregatedResults = await handleAggregation(params);
      
      return NextResponse.json({
        message: 'Aggregation completed successfully',
        groupBy: params.groupBy,
        aggregation: params.aggregation,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        results: aggregatedResults,
        filters: {
          make: params.make,
          model: params.model || 'Any',
          yearMin: params.yearMin || 'Any',
          yearMax: params.yearMax || 'Any',
          status: params.status || 'all',
          transmission: params.transmission || 'Any'
        }
      });
    }
    
    // Regular data fetching logic
    let dataSource;
    
    // Try database first unless forced to scrape
    if (!params.forceScrape) {
      dataSource = await fetchFromDatabase(params);
    }
    
    // Fall back to scraper if no database results or forced to scrape
    if (!dataSource || params.forceScrape) {
      console.log('No results found in Supabase, scraping...');
      dataSource = await fetchFromScraper(params);
    }
    
    // Fallback to empty results if both sources fail
    if (!dataSource) {
      dataSource = {
        results: [],
        rawResults: [],
        source: 'fallback'
      };
    }
    
    // Process and sort results
    const processedResults = processResults(dataSource.results, params);
    
    // Calculate summary statistics
    const summary = {
      totalResults: dataSource.rawResults.length,
      averageSoldPrice: calculateStatistics.averageSoldPrice(dataSource.rawResults),
      highestSoldPrice: calculateStatistics.highestSoldPrice(dataSource.rawResults),
      lowestSoldPrice: calculateStatistics.lowestSoldPrice(dataSource.rawResults),
      soldPercentage: calculateStatistics.soldPercentage(dataSource.rawResults),
      averageMileage: calculateStatistics.averageMileage(dataSource.rawResults)
    };
    
    // Create response object
    const response = {
      message: 'Auction results fetched successfully',
      summary,
      results: processedResults,
      source: dataSource.source,
      sorting: {
        sortBy: params.sortBy || 'sold_date',
        sortOrder: params.sortOrder || 'desc'
      },
      filters: {
        make: params.make,
        model: params.model || 'Any',
        yearMin: params.yearMin || 'Any',
        yearMax: params.yearMax || 'Any',
        status: params.status || 'all',
        transmission: params.transmission || 'Any'
      }
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