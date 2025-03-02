/**
 * Consolidated Auction Tools Test Script
 * 
 * This script provides a unified way to test various auction-related tools:
 * 1. Basic auction results tool
 * 2. Auction results with visualizations
 * 3. Agent with auction tool
 * 4. Agent with auction tool and visualizations
 */

import { createAuctionResultsTool } from '../lib/langchain/tools';
import { initializeAgent } from '../lib/langchain';
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder, 
  HumanMessagePromptTemplate 
} from "@langchain/core/prompts";
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';

// Parse command line arguments
const argv = minimist(process.argv.slice(2));
const mode = argv.mode || 'basic'; // basic, viz, agent, agent-viz
const make = argv.make || 'Porsche';
const model = argv.model || '911';
const yearMin = argv.yearMin || 2015;
const yearMax = argv.yearMax || 2023;
const maxPages = argv.maxPages || 2;
const query = argv.query || `What are the recent auction results for ${make} ${model} models? What's the average selling price?`;

// Function to convert Markdown links to HTML links
function convertMarkdownLinksToHtml(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

// Function to convert Markdown image syntax to HTML img tags
function convertMarkdownImagesToHtml(text: string): string {
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;">');
}

// Function to extract visualization paths from the response
function extractVisualizationPaths(response: string): { 
  timeSeriesChart: string, 
  priceHistogram: string
} {
  const result = {
    timeSeriesChart: '/charts/auction_prices_default.svg',
    priceHistogram: '/charts/price_histogram_default.svg'
  };
  
  // Extract paths using regex
  const timeSeriesMatch = response.match(/auction_prices_(\d+)\.svg/);
  const histogramMatch = response.match(/price_histogram_(\d+)\.svg/);
  
  if (timeSeriesMatch) result.timeSeriesChart = `/charts/auction_prices_${timeSeriesMatch[1]}.svg`;
  if (histogramMatch) result.priceHistogram = `/charts/price_histogram_${histogramMatch[1]}.svg`;
  
  return result;
}

// Test the basic auction results tool
async function testBasicAuctionTool() {
  console.log('Testing basic auction results tool...');
  const auctionResultsTool = createAuctionResultsTool();
  
  console.log(`Testing auction results for ${make} ${model}...`);
  const result = await auctionResultsTool.invoke({
    make,
    model,
    yearMin,
    yearMax,
    maxPages
  });
  
  // Parse the result and display a summary
  const parsedResult = JSON.parse(result);
  
  console.log('\nQuery:', parsedResult.query);
  console.log('\nSummary:');
  console.log('- Total Results:', parsedResult.summary.totalResults);
  console.log('- Average Sold Price:', parsedResult.summary.averageSoldPrice);
  console.log('- Highest Sold Price:', parsedResult.summary.highestSoldPrice);
  console.log('- Lowest Sold Price:', parsedResult.summary.lowestSoldPrice);
  console.log('- Sold Percentage:', parsedResult.summary.soldPercentage);
  
  console.log('\nFirst 5 Results:');
  parsedResult.results.slice(0, 5).forEach((item: any, index: number) => {
    console.log(`\n${index + 1}. ${item.title}`);
    console.log(`   Price: ${item.sold_price}`);
    console.log(`   Date: ${item.sold_date}`);
    console.log(`   URL: ${item.url}`);
  });
}

// Test auction results with visualizations
async function testAuctionVisualization() {
  console.log('Testing auction results with visualizations...');
  const auctionResultsTool = createAuctionResultsTool();
  
  console.log(`Testing auction results for ${make} ${model} with visualizations...`);
  const result = await auctionResultsTool.invoke({
    make,
    model,
    yearMin,
    yearMax,
    maxPages,
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
    
    const htmlPath = path.join('public', 'auction_visualizations.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`\nHTML viewer created at: ${htmlPath}`);
    console.log(`View at: http://localhost:3000/auction_visualizations.html`);
  } else {
    console.log('\nNo visualizations were generated.');
  }
}

// Test simple agent with auction tool
async function testSimpleAgent() {
  console.log('Testing simple agent with auction tool...');
  
  // Initialize the LLM
  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.2,
  });
  
  // Create the auction results tool
  const auctionResultsTool = createAuctionResultsTool();
  
  // Create a simple prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate(
      "You are a classic car market intelligence agent. " +
      "You can fetch real-time auction results from Bring a Trailer to provide up-to-date market information. " +
      "When asked about recent sales, prices, or auction results for specific makes and models, " +
      "use the fetch_auction_results tool to get the latest data. " +
      "Answer the following question: {input}"
    ),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
  
  // Create the agent
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools: [auctionResultsTool],
    prompt,
  });
  
  // Create the agent executor
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: [auctionResultsTool],
    verbose: true,
  });
  
  console.log(`\nTesting query: "${query}"`);
  
  // Invoke the agent
  const result = await agentExecutor.invoke({
    input: query
  });
  
  // Display the result
  console.log('\nAgent response:');
  console.log(result.output);
}

// Test agent with auction tool and visualizations
async function testAgentWithVisualizations() {
  console.log('Testing agent with auction tool and visualizations...');
  
  // Initialize the agent
  const agent = await initializeAgent();
  
  // Test query with visualization request
  const vizQuery = `Generate visualizations of auction results for ${make} ${model} models from ${yearMin} to ${yearMax} and tell me about the average selling price and price trends.`;
  console.log(`\nTesting query: "${vizQuery}"`);
  
  // Invoke the agent
  const result = await agent.invoke({
    input: vizQuery
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
          <img src="${visualizationPaths.timeSeriesChart}" alt="Price Trends">
        </div>
        
        <div class="visualization">
          <h3>Price Distribution</h3>
          <img src="${visualizationPaths.priceHistogram}" alt="Price Distribution">
        </div>
      </div>
    </body>
    </html>
  `;
  
  const htmlPath = path.join('public', 'agent_response.html');
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`\nHTML viewer created at: ${htmlPath}`);
  console.log(`View at: http://localhost:3000/agent_response.html`);
}

// Main function to run the selected test mode
async function runTest() {
  try {
    // Create public directory if it doesn't exist
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }
    
    // Create charts directory if it doesn't exist
    const chartsDir = path.join(publicDir, 'charts');
    if (!fs.existsSync(chartsDir)) {
      fs.mkdirSync(chartsDir);
    }
    
    console.log(`Running test in ${mode} mode for ${make} ${model} (${yearMin}-${yearMax})`);
    
    switch (mode) {
      case 'basic':
        await testBasicAuctionTool();
        break;
      case 'viz':
        await testAuctionVisualization();
        break;
      case 'agent':
        await testSimpleAgent();
        break;
      case 'agent-viz':
        await testAgentWithVisualizations();
        break;
      default:
        console.error(`Unknown mode: ${mode}`);
        console.log('Available modes: basic, viz, agent, agent-viz');
        process.exit(1);
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error running test:', error);
    process.exit(1);
  }
}

// Run the test
runTest(); 