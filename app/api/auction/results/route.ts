import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase/client';
import { BringATrailerResultsScraper } from '../../../../lib/scrapers/BringATrailerResultsScraper';
import { decodeHtmlEntities } from '@/components/shared/utils';

// Types for aggregation
interface AggregationConfig {
  function: 'count' | 'avg' | 'sum';
  field: string;
}

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
    const { 
      make, 
      model, 
      yearMin, 
      yearMax, 
      sold_date_min,
      sold_date_max,
      maxPages, 
      sortBy, 
      sortOrder, 
      status, 
      transmission, 
      forceScrape = false,
      // New aggregation parameters
      groupBy,
      aggregation
    }: {
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
    } = body;

    // Early return for group by queries
    if (groupBy && aggregation) {
      const selectQuery = `${groupBy}, ${aggregation.map(agg => 
        `${agg.field}.${agg.function}()`
      ).join(', ')}`;

      let query = supabase
        .from('bat_completed_auctions')
        .select(selectQuery);

      // Add base filters
      if (make) {
        query = query.ilike('make', `%${make}%`);
      }

      if (model && model !== 'Any') {
        query = query.ilike('title', `%${model}%`);
      }

      if (yearMin) {
        query = query.gte('year', yearMin);
      }

      if (yearMax) {
        query = query.lte('year', yearMax);
      }

      if (transmission && transmission !== 'Any') {
        query = query.ilike('transmission', `%${transmission}%`);
      }
      
      if (sold_date_min) {
        query = query.gte('sold_date', sold_date_min);
      }

      if (sold_date_max) {
        query = query.lte('sold_date', sold_date_max);
      }

      if (status) {
        if (status === 'sold') {
          query = query.eq('status', 'sold');
        } else if (status === 'unsold') {
          query = query.neq('status', 'sold');
        }
      }

      // Execute the query with group by in the select statement
      const { data: aggregatedResults, error: aggregationError } = await query;

      if (aggregationError) {
        console.error('Error performing aggregation:', aggregationError);
        return NextResponse.json(
          { error: 'Failed to perform aggregation' },
          { status: 500 }
        );
      }

      // Sort aggregated results if sortBy and sortOrder are provided
      let sortedResults = [...aggregatedResults];
      const sortFunction = aggregation[0].function;
        
      sortedResults.sort((a: any, b: any) => {
        const ascending = sortOrder === 'asc' ? 1 : -1;
        
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

      return NextResponse.json({
        message: 'Aggregation completed successfully',
        groupBy,
        aggregation,
        sortBy,
        sortOrder,
        results: sortedResults,
        filters: {
          make,
          model: model || 'Any',
          yearMin: yearMin || 'Any',
          yearMax: yearMax || 'Any',
          status: status || 'all',
          transmission: transmission || 'Any'
        }
      });
    }

    // Determine sort field and direction
    const sortField = sortBy || 'sold_date';
    const ascending = sortOrder === 'asc';
    let results = [];
    let parsedResult: any = null;

    // If forceScrape is false, try to fetch results from Supabase
    if (!forceScrape) {
      let query = supabase
        .from('bat_completed_auctions')
        .select('*')
        .ilike('make', `%${make}%`);
        
      // Apply sorting based on parameters
      if (sortField) {
        query = query.order(sortField, { ascending });
      } else {
        // Default sort
        query = query.order('sold_date', { ascending: false });
      }
      
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
      
      // Add transmission filter if provided
      if (transmission && transmission !== 'Any') {
        query = query.ilike('transmission', `%${transmission}%`);
      }
      
      // Add status filter if provided
      if (status) {
        if (status === 'sold') {
          query = query.eq('status', 'sold');
        } else if (status === 'unsold') {
          query = query.neq('status', 'sold');
        }
      }

      // Execute the query
      const { data: supabaseResults, error: supabaseError } = await query;

      // Check if we got results from Supabase
      if (!supabaseError && supabaseResults && supabaseResults.length > 0) {
        console.log(`Found ${supabaseResults.length} results in Supabase database`);
        
        // Format the results to match the expected structure
        
        results = supabaseResults.map(item => ({
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
    }
    
    // If we don't have results from Supabase, use the scraper
    if (!parsedResult || forceScrape) {
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
          maxPages: maxPages || 1,
          transmission
        });
        
        console.log(`Scraped ${scrapedResults.length} results directly`);
        
        // Format the results to match the expected structure
        results = scrapedResults.map(item => ({
          title: decodeHtmlEntities(item.title),
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
          image_url: item.image_url,
          transmission: item.transmission
        }));
        
        // Apply status filter if provided
        if (status) {
          if (status === 'sold') {
            results = results.filter(item => item.status === 'sold');
          } else if (status === 'unsold') {
            results = results.filter(item => item.status !== 'sold');
          }
        }
        
        // Apply transmission filter if provided (for scraped results)
        if (transmission && transmission !== 'Any') {
          results = results.filter(item => 
            item.transmission?.toLowerCase().includes(transmission.toLowerCase())
          );
        }
        
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
    
    // Sort processed results if needed (for scraped results or additional sorting)
    if (sortBy) {
      const ascending = sortOrder === 'asc' ? 1 : -1;
      
      processedResults.sort((a: any, b: any) => {
        if (sortBy === 'sold_date') {
          const dateA = new Date(a.sold_date || 0);
          const dateB = new Date(b.sold_date || 0);
          return ascending * (dateA.getTime() - dateB.getTime());
        } else if (sortBy === 'mileage') {
          const mileageA = a.mileage || 0;
          const mileageB = b.mileage || 0;
          return ascending * (mileageA - mileageB);
        } else if (sortBy === 'sold_price') {
          const priceA = a.status === 'sold' ? a.price || 0 : 0;
          const priceB = b.status === 'sold' ? b.price || 0 : 0;
          return ascending * (priceA - priceB);
        }
        return 0;
      });
    }
    
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
      source: parsedResult?.source || 'unknown',
      sorting: {
        sortBy: sortBy || 'sold_date',
        sortOrder: sortOrder || 'desc'
      },
      filters: {
        make,
        model: model || 'Any',
        yearMin: yearMin || 'Any',
        yearMax: yearMax || 'Any',
        status: status || 'all',
        transmission: transmission || 'Any'
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