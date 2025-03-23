import { NextRequest, NextResponse } from 'next/server';
import { validateVegaLiteSpec } from '../../../../lib/utils/visualization';
import { generatePriceTimeSeriesChart, generateHistogram, generateScatterPlot } from '../../../../lib/utils/visualization';
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
    let timeSeriesChartSpec = null;
    let priceHistogramSpec = null;
    let priceMileageScatterSpec = null;
    
    // Generate visualizations
    console.log('Generating visualization specifications...');
    try {
      // Generate time series chart Vega-Lite specification
      timeSeriesChartSpec = await generatePriceTimeSeriesChart(results);
      
      // Generate price histogram Vega-Lite specification using the new generateHistogram function
      priceHistogramSpec = generateHistogram(results, {
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

      // Generate price vs mileage scatter plot
      console.log('Preparing data for price vs mileage scatter plot...');
      console.log('Total results:', results.length);
      
      // First filter: sold items with price and mileage
      const soldItems = results.filter(item => item.status === 'sold' && item.sold_price && item.mileage);
      console.log('Items with sold status, price, and mileage:', soldItems.length);
      
      // Transform and validate the data
      const scatterData = soldItems
        .map(item => {
          // Parse price
          const price = typeof item.sold_price === 'number' 
            ? item.sold_price 
            : parseInt(item.sold_price?.replace(/[^0-9]/g, '') || '0');
          
          // Parse mileage (ensure it's a number)
          const mileage = typeof item.mileage === 'number' 
            ? item.mileage 
            : parseInt(String(item.mileage).replace(/[^0-9]/g, '') || '0');
          
          return {
            mileage,
            sold_price: price,
            title: item.title,
            url: item.url,
            end_date: item.end_date
          };
        })
        .filter(item => {
          const isValid = item.sold_price > 0 && item.mileage > 0;
          if (!isValid) {
            console.log('Filtered out invalid item:', {
              title: item.title,
              price: item.sold_price,
              mileage: item.mileage
            });
          }
          return isValid;
        });
      
      console.log('Final valid items for scatter plot:', scatterData.length);
      
      if (scatterData.length === 0) {
        console.log('No valid data points for scatter plot');
        throw new Error('No valid price vs mileage data points');
      }

      priceMileageScatterSpec = generateScatterPlot(
        scatterData,
        'mileage',
        'sold_price',
        {
          description: 'Price vs. Mileage',
          xAxisTitle: 'Mileage',
          yAxisTitle: 'Price ($)',
          tooltipFields: [
            { field: 'title', title: 'Vehicle', type: 'nominal' },
            { field: 'sold_price', title: 'Price', format: '$,.0f', type: 'quantitative' },
            { field: 'mileage', title: 'Mileage', format: ',.0f', type: 'quantitative' },
            { field: 'end_date', title: 'Date', type: 'temporal', format: '%b %d, %Y' }
          ]
        }
      );
      
      // Create a result object with visualizations
      parsedResult = {
        summary,
        visualizations: {
          timeSeriesChart: timeSeriesChartSpec,
          priceHistogram: priceHistogramSpec,
          priceMileageScatter: priceMileageScatterSpec
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
          timeSeriesChart: timeSeriesChartSpec || null,
          priceHistogram: priceHistogramSpec || null,
          priceMileageScatter: null // Always null if there's an error with scatter plot
        },
        results,
        source
      };
      console.log('Returning results with partial visualizations due to error');
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
    let priceMileageScatter = parsedResult.visualizations.priceMileageScatter;
    
    // Log the raw specifications for debugging
    console.log('Raw time series chart spec type:', typeof timeSeriesChart);
    console.log('Raw price histogram spec type:', typeof priceHistogram);
    console.log('Raw price vs mileage scatter spec type:', typeof priceMileageScatter);
    
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

    if (typeof priceMileageScatter === 'string') {
      try {
        priceMileageScatter = JSON.parse(priceMileageScatter);
        console.log('Parsed price vs mileage scatter from string');
      } catch (error) {
        console.error('Error parsing price vs mileage scatter:', error);
        priceMileageScatter = null;
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

    // Validate the price vs mileage scatter specification
    if (!validateVegaLiteSpec(priceMileageScatter)) {
      console.error('Invalid price vs mileage scatter specification:', priceMileageScatter);
      priceMileageScatter = null;
    }
    
    // Pass the validated Vega-Lite specifications to the client
    const visualizations = {
      timeSeriesChart,
      priceHistogram,
      priceMileageScatter
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