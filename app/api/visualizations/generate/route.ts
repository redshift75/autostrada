import { NextRequest, NextResponse } from 'next/server';
import { createAuctionResultsTool } from '../../../../lib/langchain/tools';
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
    
    // Create an HTML file to view the visualizations
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Auction Results Visualizations</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .visualization { margin-bottom: 30px; }
          .visualization h2 { color: #555; }
          img { max-width: 100%; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <h1>Auction Results for ${parsedResult.query.make} ${parsedResult.query.model}</h1>
        
        <div class="summary">
          <h2>Summary</h2>
          <p>Total Results: ${parsedResult.summary.totalResults}</p>
          <p>Average Sold Price: ${parsedResult.summary.averageSoldPrice}</p>
          <p>Highest Sold Price: ${parsedResult.summary.highestSoldPrice}</p>
          <p>Lowest Sold Price: ${parsedResult.summary.lowestSoldPrice}</p>
          <p>Sold Percentage: ${parsedResult.summary.soldPercentage}</p>
        </div>
        
        ${parsedResult.visualizations.timeSeriesChart ? `
        <div class="visualization">
          <h2>Price Trends Over Time</h2>
          <img src="/${parsedResult.visualizations.timeSeriesChart.replace('public/', '')}" alt="Price Trends">
        </div>
        ` : ''}
        
        ${parsedResult.visualizations.priceHistogram ? `
        <div class="visualization">
          <h2>Price Distribution</h2>
          <img src="/${parsedResult.visualizations.priceHistogram.replace('public/', '')}" alt="Price Distribution">
        </div>
        ` : ''}
      </body>
      </html>
    `;
    
    const htmlPath = path.join(process.cwd(), 'public', 'auction_visualizations.html');
    fs.writeFileSync(htmlPath, htmlContent);
    
    // Prepare the response data
    const visualizations = {
      timeSeriesChart: parsedResult.visualizations.timeSeriesChart ? 
        `/${parsedResult.visualizations.timeSeriesChart.replace('public/', '')}` : null,
      priceHistogram: parsedResult.visualizations.priceHistogram ? 
        `/${parsedResult.visualizations.priceHistogram.replace('public/', '')}` : null,
    };
    
    return NextResponse.json({
      message: 'Visualizations generated successfully',
      summary: parsedResult.summary,
      visualizations
    });
  } catch (error) {
    console.error('Error generating visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to generate visualizations' },
      { status: 500 }
    );
  }
} 