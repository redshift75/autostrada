import { createAuctionResultsTool } from '../lib/langchain/tools';
import * as fs from 'fs';
import * as path from 'path';

async function testAuctionVisualizations() {
  try {
    console.log('Initializing auction results tool with visualization...');
    const auctionResultsTool = createAuctionResultsTool();
    
    // Test with Porsche 911
    console.log('Testing auction results for Porsche 911 with visualizations...');
    const result = await auctionResultsTool.invoke({
      make: 'Porsche',
      model: '911',
      yearMin: 2015,
      yearMax: 2023,
      maxPages: 1,
      generateVisualizations: true
    });
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    console.log('\nQuery:', parsedResult.query);
    console.log('\nSummary:');
    console.log('- Total Results:', parsedResult.summary.totalResults);
    console.log('- Average Sold Price:', parsedResult.summary.averageSoldPrice);
    console.log('- Highest Sold Price:', parsedResult.summary.highestSoldPrice);
    console.log('- Lowest Sold Price:', parsedResult.summary.lowestSoldPrice);
    console.log('- Sold Percentage:', parsedResult.summary.soldPercentage);
    
    // Check if visualizations were generated
    if (parsedResult.visualizations) {
      console.log('\nVisualizations:');
      
      if (parsedResult.visualizations.timeSeriesChart) {
        console.log('- Time Series Chart:', parsedResult.visualizations.timeSeriesChart);
        console.log('  File exists:', fs.existsSync(parsedResult.visualizations.timeSeriesChart));
      }
      
      if (parsedResult.visualizations.priceHistogram) {
        console.log('- Price Histogram:', parsedResult.visualizations.priceHistogram);
        console.log('  File exists:', fs.existsSync(parsedResult.visualizations.priceHistogram));
      }
      
      if (parsedResult.visualizations.priceYearScatter) {
        console.log('- Price-Year Scatter Plot:', parsedResult.visualizations.priceYearScatter);
        console.log('  File exists:', fs.existsSync(parsedResult.visualizations.priceYearScatter));
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
          
          ${parsedResult.visualizations.priceYearScatter ? `
          <div class="visualization">
            <h2>Prices by Year</h2>
            <img src="/${parsedResult.visualizations.priceYearScatter.replace('public/', '')}" alt="Prices by Year">
          </div>
          ` : ''}
        </body>
        </html>
      `;
      
      const htmlPath = path.join('public', 'auction_visualizations.html');
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`\nHTML viewer created at: ${htmlPath}`);
    } else {
      console.log('\nNo visualizations were generated.');
    }
    
  } catch (error) {
    console.error('Error testing auction visualizations:', error);
  }
}

// Run the test
testAuctionVisualizations(); 