import { NextRequest, NextResponse } from 'next/server';
import { createAuctionResultsTool } from '../../../../lib/langchain/tools';
import fs from 'fs';
import path from 'path';

// Helper function to validate Vega-Lite specifications
function validateVegaLiteSpec(spec: any): boolean {
  if (!spec || typeof spec !== 'object') return false;
  
  // Check if it has required Vega-Lite properties
  return !!(spec.mark || spec.layer || spec.facet || spec.hconcat || 
            spec.vconcat || spec.concat || spec.repeat);
}

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
    
    // Create the auction results tool
    const auctionResultsTool = createAuctionResultsTool();
    
    // Generate visualizations
    const result = await auctionResultsTool.invoke({
      make,
      model,
      yearMin: yearMin || 2015,
      yearMax: yearMax || 2023,
      maxPages: maxPages || 10,
      generateVisualizations: true
    });
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    // Check if visualizations were generated
    if (!parsedResult.visualizations) {
      return NextResponse.json(
        { error: 'Failed to generate visualizations' },
        { status: 500 }
      );
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
      results: processedResults
    };
    
    // Log the response structure for debugging
    console.log('Response structure:', Object.keys(response));
    console.log('Visualizations structure:', Object.keys(response.visualizations));
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to generate visualizations' },
      { status: 500 }
    );
  }
} 