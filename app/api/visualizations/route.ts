import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const make = searchParams.get('make');
    const model = searchParams.get('model');
    
    if (!make || !model) {
      return NextResponse.json(
        { error: 'Make and model parameters are required' },
        { status: 400 }
      );
    }
    
    // Get the public directory path
    const publicDir = path.join(process.cwd(), 'public');
    const chartsDir = path.join(publicDir, 'charts');
    
    // Check if the charts directory exists
    if (!fs.existsSync(chartsDir)) {
      return NextResponse.json(
        { error: 'No visualizations found' },
        { status: 404 }
      );
    }
    
    // Read the auction_visualizations.html file to extract summary data
    const visualizationsHtmlPath = path.join(publicDir, 'auction_visualizations.html');
    
    if (!fs.existsSync(visualizationsHtmlPath)) {
      return NextResponse.json(
        { error: 'No visualizations HTML found' },
        { status: 404 }
      );
    }
    
    const htmlContent = fs.readFileSync(visualizationsHtmlPath, 'utf-8');
    
    // Check if the HTML contains data for the requested make and model
    const makeModelRegex = new RegExp(`<h1>Auction Results for ${make} ${model}</h1>`, 'i');
    if (!makeModelRegex.test(htmlContent)) {
      return NextResponse.json(
        { error: `No visualizations found for ${make} ${model}` },
        { status: 404 }
      );
    }
    
    // Extract summary data using regex
    const totalResultsMatch = htmlContent.match(/<p>Total Results: (\d+)<\/p>/);
    const averageSoldPriceMatch = htmlContent.match(/<p>Average Sold Price: (\$[\d,]+)<\/p>/);
    const highestSoldPriceMatch = htmlContent.match(/<p>Highest Sold Price: (\$[\d,]+)<\/p>/);
    const lowestSoldPriceMatch = htmlContent.match(/<p>Lowest Sold Price: (\$[\d,]+)<\/p>/);
    const soldPercentageMatch = htmlContent.match(/<p>Sold Percentage: (\d+%)<\/p>/);
    
    // Extract visualization paths
    const timeSeriesMatch = htmlContent.match(/src="\/charts\/(auction_prices_\d+\.svg)"/);
    const priceHistogramMatch = htmlContent.match(/src="\/charts\/(price_histogram_\d+\.svg)"/);
    
    // Prepare the response data
    const summary = {
      totalResults: totalResultsMatch ? parseInt(totalResultsMatch[1], 10) : null,
      averageSoldPrice: averageSoldPriceMatch ? averageSoldPriceMatch[1] : null,
      highestSoldPrice: highestSoldPriceMatch ? highestSoldPriceMatch[1] : null,
      lowestSoldPrice: lowestSoldPriceMatch ? lowestSoldPriceMatch[1] : null,
      soldPercentage: soldPercentageMatch ? soldPercentageMatch[1] : null,
    };
    
    const visualizations = {
      timeSeriesChart: timeSeriesMatch ? `/charts/${timeSeriesMatch[1]}` : null,
      priceHistogram: priceHistogramMatch ? `/charts/${priceHistogramMatch[1]}` : null,
    };
    
    // Try to find auction results data for this make and model
    let results = [];
    try {
      // Look for auction results files
      const files = fs.readdirSync(publicDir);
      const jsonFiles = files.filter(file => file.endsWith('.json') && file.includes('auction_results_'));
      
      if (jsonFiles.length > 0) {
        // Sort by timestamp (newest first)
        jsonFiles.sort((a, b) => {
          const timestampA = parseInt(a.split('_').pop()?.replace('.json', '') || '0', 10);
          const timestampB = parseInt(b.split('_').pop()?.replace('.json', '') || '0', 10);
          return timestampB - timestampA;
        });
        
        // Try each file until we find results for this make and model
        for (const jsonFile of jsonFiles) {
          const resultsPath = path.join(publicDir, jsonFile);
          const resultsData = fs.readFileSync(resultsPath, 'utf-8');
          const parsedResults = JSON.parse(resultsData);
          
          // Check if this file has the right make and model
          if (parsedResults && 
              parsedResults.query && 
              parsedResults.query.make && 
              parsedResults.query.model && 
              parsedResults.query.make.toLowerCase() === make.toLowerCase() && 
              parsedResults.query.model.toLowerCase() === model.toLowerCase() && 
              parsedResults.results && 
              Array.isArray(parsedResults.results)) {
            
            results = parsedResults.results;
            break;
          }
        }
      }
    } catch (err) {
      console.error('Error reading auction results:', err);
      // Continue without results if there's an error
    }
    
    return NextResponse.json({ summary, visualizations, results });
  } catch (error) {
    console.error('Error fetching visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visualizations' },
      { status: 500 }
    );
  }
} 