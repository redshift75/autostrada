import { initializeAgent } from '../lib/langchain';
import * as fs from 'fs';
import * as path from 'path';

// Function to convert Markdown links to HTML links
function convertMarkdownLinksToHtml(text: string): string {
  // Replace Markdown links [text](url) with HTML links <a href="url">text</a>
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

// Function to convert Markdown image syntax to HTML img tags
function convertMarkdownImagesToHtml(text: string): string {
  // Replace Markdown images ![alt text](url) with HTML img tags <img src="url" alt="alt text">
  // Make sure to escape the exclamation mark in the regex pattern
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;">');
}

// Function to extract visualization paths from the response
function extractVisualizationPaths(response: string): { 
  timeSeriesChart: string, 
  priceHistogram: string, 
  priceYearScatter: string 
} {
  const result = {
    timeSeriesChart: '/charts/auction_prices_1740713648149.svg',
    priceHistogram: '/charts/price_histogram_1740713648163.svg',
    priceYearScatter: '/charts/price_year_scatter_1740713648174.svg'
  };
  
  // Extract paths using regex
  const timeSeriesMatch = response.match(/auction_prices_(\d+)\.svg/);
  const histogramMatch = response.match(/price_histogram_(\d+)\.svg/);
  const scatterMatch = response.match(/price_year_scatter_(\d+)\.svg/);
  
  if (timeSeriesMatch) result.timeSeriesChart = `/charts/auction_prices_${timeSeriesMatch[1]}.svg`;
  if (histogramMatch) result.priceHistogram = `/charts/price_histogram_${histogramMatch[1]}.svg`;
  if (scatterMatch) result.priceYearScatter = `/charts/price_year_scatter_${scatterMatch[1]}.svg`;
  
  return result;
}

async function testAgentWithAuctionTool() {
  try {
    console.log('Initializing agent with auction results tool...');
    
    // Initialize the agent
    const agent = await initializeAgent();
    
    // Test query with visualization request
    const query = "Generate visualizations of auction results for Porsche 911 models from 2015 to 2023 and tell me about the average selling price and price trends.";
    console.log(`\nTesting query: "${query}"`);
    
    // Invoke the agent
    const result = await agent.invoke({
      input: query
    });
    
    // Display the result
    console.log('\nAgent response:');
    console.log(result.output);
    
    // Fix image paths in the agent response if needed
    let fixedOutput = result.output;
    if (fixedOutput.includes('sandbox:/public/')) {
      fixedOutput = fixedOutput.replace(/sandbox:\/public\//g, '/');
    }
    
    // Extract visualization paths from the response
    const visualizationPaths = extractVisualizationPaths(fixedOutput);
    
    // First convert Markdown images to HTML img tags (do this before links to avoid conflicts)
    fixedOutput = convertMarkdownImagesToHtml(fixedOutput);
    
    // Then convert Markdown links to HTML links
    fixedOutput = convertMarkdownLinksToHtml(fixedOutput);
    
    // Create a simple HTML file with the fixed output
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Agent Response with Visualizations</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          img { max-width: 100%; border: 1px solid #ddd; margin: 20px 0; }
          a { color: #0066cc; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .visualization { margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <h1>Agent Response with Visualizations</h1>
        <div>${fixedOutput.replace(/\n/g, '<br>')}</div>
        
        <!-- Directly embed the visualizations -->
        <div class="visualizations">
          <h2>Visualizations</h2>
          <div class="visualization">
            <h3>Price Trends Over Time</h3>
            <img src="${visualizationPaths.timeSeriesChart || '/charts/auction_prices_1740713648149.svg'}" alt="Price Trends">
          </div>
          
          <div class="visualization">
            <h3>Price Distribution</h3>
            <img src="${visualizationPaths.priceHistogram || '/charts/price_histogram_1740713648163.svg'}" alt="Price Distribution">
          </div>
          
          <div class="visualization">
            <h3>Prices by Year</h3>
            <img src="${visualizationPaths.priceYearScatter || '/charts/price_year_scatter_1740713648174.svg'}" alt="Prices by Year">
          </div>
        </div>
      </body>
      </html>
    `;
    
    const htmlPath = path.join('public', 'agent_response.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`\nHTML viewer created at: ${htmlPath}`);
    console.log(`View at: http://localhost:3000/agent_response.html`);
    
  } catch (error) {
    console.error('Error testing agent with auction tool:', error);
  }
}

// Run the test
testAgentWithAuctionTool(); 