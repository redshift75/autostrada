/**
 * Test Database Query Script
 * 
 * This script tests the agent's ability to query the Supabase database
 * using the enhanced auction results tool.
 */

import { initializeAgent } from '../lib/langchain';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testDatabaseQuery(specificQuery?: string) {
  // Initialize the agent
  const agent = await initializeAgent();
  
  // If a specific query is provided, only run that one
  if (specificQuery) {
    console.log(`\nTesting query: "${specificQuery}"`);
    try {
      const result = await agent.invoke({
        input: specificQuery
      });
      console.log('\nAgent response:');
      console.log(result.output);
    } catch (error) {
      console.error(`Error processing query:`, error);
    }
    return;
  }

  // Otherwise run all predefined queries
  const queries = [
    "What is the average selling price of auctions with more than 50 bidders?",
    "Compare the average selling prices of manual and automatic Ferraris",
    "What are the most popular manual transmission cars sold in this year?",
    "What's the highest price ever paid for a Ferrari?",
    "What Porsche models are most likely to be sold?",
    "What makes have the highest sold percentage?",
    "What makes have the lowest sold percentage?",
    "Which model year Porsche has the lowest sold percentage?",
    "What Porsche models are most likely to be sold?",
    "What Bentley models have the lowest mileage?",
    "Compare the average price of manual and automatic Porsche GT3s",
    "What models have the highest average mileage?",
    "How many Mercedes-Benz were sold in the last year?",
    "What are the most popular cars in the last 30 days?",
    "What are the highest priced 90s models from Ferrari?",
    "Whats the best deal on a 2018-2019 Porsche GT3 Touring?",
    "How many 2020-2023 McLarens were sold in the last year?",
    "What's the average price of manual Porsche 911s from 2015 to 2020?",
    "Show me the lowest mileage BMW M3s with a maximum of 3 results.",
    "What are the most common transmission types for Corvettes?"
  ];
  
  // Run each query
  for (const query of queries) {
    console.log(`\nTesting query: "${query}"`);
    
    try {
      // Invoke the agent
      const result = await agent.invoke({
        input: query
      });
      
      // Display the result
      console.log('\nAgent response:');
      console.log(result.output);
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
  
  console.log('\nDatabase query tests completed');
}

// Get command line argument if provided
const queryArg = process.argv[2];

// Run the test with optional command line argument
testDatabaseQuery(queryArg).catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 