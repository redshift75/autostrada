import { NextRequest, NextResponse } from 'next/server';
import { createAuctionResultsTool } from '../../../../lib/langchain/tools';
import { validateVegaLiteSpec } from '../../../../lib/utils/visualization';
import { supabase } from '../../../../lib/supabase/client';
import { generatePriceTimeSeriesChart, generatePriceHistogram } from '../../../../lib/utils/visualization';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { make, model, yearMin, yearMax, maxPages } = body;
    
    // Validate required fields
    if (!make || !model) {
      return NextResponse.json(
        { error: 'Make and model are required fields' },
        { status: 400 }
      );
    }

    // First, try to fetch results from Supabase
    console.log(`Checking Supabase for ${make} ${model} (${yearMin || 'any'}-${yearMax || 'any'})`);
    
    let query = supabase
      .from('bat_completed_auctions')
      .select('*')
      .ilike('make', `%${make}%`);
    
    // Add model filter if provided
    if (model && model !== 'Any') {
      query = query.ilike('model', `%${model}%`);
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
      
      // Generate visualizations
      console.log('Generating visualization specifications from Supabase data...');
      try {
        // Generate time series chart Vega-Lite specification
        const timeSeriesChartSpec = await generatePriceTimeSeriesChart(supabaseResults);
        
        // Generate price histogram Vega-Lite specification
        const priceHistogramSpec = await generatePriceHistogram(supabaseResults);
        
        // Create a result object similar to what the scraper would return
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
          visualizations: {
            timeSeriesChart: timeSeriesChartSpec,
            priceHistogram: priceHistogramSpec
          },
          results: results,
          source: 'supabase'
        };
        
        console.log('Visualization specifications generated successfully from Supabase data');
      } catch (error) {
        console.error('Error generating visualizations from Supabase data:', error);
        
        // Even if visualization generation fails, we can still return the results with empty visualizations
        if (supabaseResults && supabaseResults.length > 0) {
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
            visualizations: {
              timeSeriesChart: null,
              priceHistogram: null
            },
            results: results,
            source: 'supabase'
          };
          console.log('Returning Supabase results without visualizations due to error');
        } else {
          // If visualization generation fails and we don't have enough results, we'll fall back to the scraper
          parsedResult = null;
        }
      }
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
      
      // Generate visualizations
      const result = await auctionResultsTool.invoke({
        make,
        model,
        yearMin: yearMin || 2015,
        yearMax: yearMax || 2023,
        maxPages: maxPages || 2,
        generateVisualizations: true
      });
      
      // Parse the result
      parsedResult = JSON.parse(result);
      
      // Add source information
      parsedResult.source = 'scraper';
      
      // Check if visualizations were generated
      if (!parsedResult.visualizations) {
        return NextResponse.json(
          { error: 'Failed to generate visualizations' },
          { status: 500 }
        );
      }
    }
    
    // Only write files in development environment
    if (process.env.NODE_ENV !== 'production') {
      // Save the auction results data to a JSON file
      const timestamp = Date.now();
      const resultsPath = path.join(process.cwd(), 'public', `auction_results_${timestamp}.json`);
      fs.writeFileSync(resultsPath, JSON.stringify(parsedResult, null, 2));
    }
    
    // Validate and prepare the Vega-Lite specifications
    let timeSeriesChart = parsedResult.visualizations.timeSeriesChart;
    let priceHistogram = parsedResult.visualizations.priceHistogram;
    
    // Log the raw specifications for debugging
    console.log('Raw time series chart spec type:', typeof timeSeriesChart);
    console.log('Raw price histogram spec type:', typeof priceHistogram);
    
    // If the specifications are strings, try to parse them
    if (typeof timeSeriesChart === 'string') {
      try {
        timeSeriesChart = JSON.parse(timeSeriesChart);
        console.log('Parsed time series chart from string');
      } catch (error) {
        console.error('Error parsing time series chart:', error);
        timeSeriesChart = null;
      }
    }
    
    if (typeof priceHistogram === 'string') {
      try {
        priceHistogram = JSON.parse(priceHistogram);
        console.log('Parsed price histogram from string');
      } catch (error) {
        console.error('Error parsing price histogram:', error);
        priceHistogram = null;
      }
    }
    
    // Validate the time series chart specification
    if (!validateVegaLiteSpec(timeSeriesChart)) {
      console.error('Invalid time series chart specification:', timeSeriesChart);
      timeSeriesChart = null;
    }
    
    // Validate the price histogram specification
    if (!validateVegaLiteSpec(priceHistogram)) {
      console.error('Invalid price histogram specification:', priceHistogram);
      priceHistogram = null;
    }
    
    // Pass the validated Vega-Lite specifications to the client
    const visualizations = {
      timeSeriesChart,
      priceHistogram
    };
    
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
      message: 'Visualizations generated successfully',
      summary: parsedResult.summary,
      visualizations,
      results: processedResults,
      source: parsedResult.source || 'scraper' // Add source information
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to generate visualizations' },
      { status: 500 }
    );
  }
}

// Helper functions for calculating statistics from Supabase results
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