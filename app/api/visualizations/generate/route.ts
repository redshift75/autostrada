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
    
    // Convert SVG strings to base64 for embedding in HTML
    let timeSeriesBase64 = null;
    let priceHistogramBase64 = null;
    
    if (parsedResult.visualizations) {
      try {
        if (parsedResult.visualizations.timeSeriesChart) {
          timeSeriesBase64 = Buffer.from(parsedResult.visualizations.timeSeriesChart).toString('base64');
        }
        
        if (parsedResult.visualizations.priceHistogram) {
          priceHistogramBase64 = Buffer.from(parsedResult.visualizations.priceHistogram).toString('base64');
        }
      } catch (error) {
        console.error('Error converting SVG to base64:', error);
      }
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
          .results-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
          }
          .result-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .result-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border: none;
            border-bottom: 1px solid #ddd;
          }
          .result-info {
            padding: 15px;
          }
          .result-title {
            font-weight: bold;
            margin-bottom: 8px;
          }
          .result-price {
            color: #2c7c2c;
            font-weight: bold;
            font-size: 1.2em;
            margin-bottom: 8px;
          }
          .result-details {
            font-size: 0.9em;
            color: #666;
          }
          .result-link {
            display: block;
            text-align: center;
            margin-top: 10px;
            background: #f0f0f0;
            padding: 8px;
            text-decoration: none;
            color: #333;
            border-radius: 4px;
          }
          .result-link:hover {
            background: #e0e0e0;
          }
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
        
        ${timeSeriesBase64 ? `
        <div class="visualization">
          <h2>Price Trends Over Time</h2>
          <img src="data:image/svg+xml;base64,${timeSeriesBase64}" alt="Price Trends">
        </div>
        ` : ''}
        
        ${priceHistogramBase64 ? `
        <div class="visualization">
          <h2>Price Distribution</h2>
          <img src="data:image/svg+xml;base64,${priceHistogramBase64}" alt="Price Distribution">
        </div>
        ` : ''}

        <h2>Recent Auction Results</h2>
        <div class="results-grid">
          ${parsedResult.results.slice(0, 20).map((result: any) => `
            <div class="result-card">
              ${result.image_url ? `<img src="${result.image_url}" alt="${result.title || 'Auction Item'}">` : ''}
              <div class="result-info">
                <div class="result-title">${result.title || `${result.year} ${result.make} ${result.model}`}</div>
                <div class="result-price">${result.sold_price}</div>
                <div class="result-details">
                  <div>Status: ${result.status}</div>
                  <div>Sold Date: ${result.sold_date}</div>
                  ${result.noreserve ? `<div>Reserve: ${result.noreserve}</div>` : ''}
                </div>
                <a href="${result.url}" target="_blank" class="result-link">View Listing</a>
              </div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;
    
    // Only write files in development environment
    if (process.env.NODE_ENV !== 'production') {
      const htmlPath = path.join(process.cwd(), 'public', 'auction_visualizations.html');
      fs.writeFileSync(htmlPath, htmlContent);
      
      // Save the auction results data to a JSON file
      const timestamp = Date.now();
      const resultsPath = path.join(process.cwd(), 'public', `auction_results_${timestamp}.json`);
      fs.writeFileSync(resultsPath, JSON.stringify(parsedResult, null, 2));
    }
    
    // Prepare the response data with direct SVG strings or base64 encoded SVGs
    const visualizations = {
      timeSeriesChart: parsedResult.visualizations.timeSeriesChart 
        ? `data:image/svg+xml;base64,${timeSeriesBase64}` 
        : null,
      priceHistogram: parsedResult.visualizations.priceHistogram 
        ? `data:image/svg+xml;base64,${priceHistogramBase64}` 
        : null,
    };
    
    return NextResponse.json({
      message: 'Visualizations generated successfully',
      summary: parsedResult.summary,
      visualizations,
      results: parsedResult.results
    });
  } catch (error) {
    console.error('Error generating visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to generate visualizations' },
      { status: 500 }
    );
  }
} 