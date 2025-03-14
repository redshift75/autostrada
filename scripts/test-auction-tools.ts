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
const mode = argv.mode || 'basic'; // basic, agent
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
      case 'agent':
        await testSimpleAgent();
        break;
      default:
        console.error(`Unknown mode: ${mode}`);
        console.log('Available modes: basic, agent');
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