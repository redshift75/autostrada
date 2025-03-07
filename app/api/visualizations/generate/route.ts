import { NextRequest, NextResponse } from 'next/server';
import { validateVegaLiteSpec } from '../../../../lib/utils/visualization';
import { generatePriceTimeSeriesChart, generateHistogram } from '../../../../lib/utils/visualization';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { results, summary, source } = body;
    
    // Validate required fields
    if (!results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Results array is required' },
        { status: 400 }
      );
    }

    let parsedResult = null;
    
    // Generate visualizations
    console.log('Generating visualization specifications...');
    try {
      // Generate time series chart Vega-Lite specification
      const timeSeriesChartSpec = await generatePriceTimeSeriesChart(results);
      
      // Generate price histogram Vega-Lite specification using the new generateHistogram function
      const priceHistogramSpec = generateHistogram(results, {
        field: 'sold_price',
        description: 'Auction Price Distribution',
        xAxisTitle: 'Price Range ($)',
        yAxisTitle: 'Number of Vehicles',
        filter: (item) => Boolean(item.status === 'sold' && item.sold_price),
        transform: (item) => ({
          sold_price: typeof item.sold_price === 'number' 
            ? item.sold_price 
            : parseInt(item.sold_price?.replace(/[^0-9]/g, '') || '0'),
          title: item.title,
          url: item.url
        }),
        interactive: true
      });
      
      // Create a result object with visualizations
      parsedResult = {
        summary,
        visualizations: {
          timeSeriesChart: timeSeriesChartSpec,
          priceHistogram: priceHistogramSpec
        },
        results,
        source
      };
      
      console.log('Visualization specifications generated successfully');
    } catch (error) {
      console.error('Error generating visualizations:', error);
      
      // Even if visualization generation fails, we can still return the results with empty visualizations
      parsedResult = {
        summary,
        visualizations: {
          timeSeriesChart: null,
          priceHistogram: null
        },
        results,
        source
      };
      console.log('Returning results without visualizations due to error');
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
    
    // Create a response with the processed data
    const response = {
      message: 'Visualizations generated successfully',
      summary: parsedResult.summary,
      visualizations,
      results: parsedResult.results,
      source: parsedResult.source
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