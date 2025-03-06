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

async function testDatabaseQuery() {
  console.log('Testing database query functionality...');
  
  // Initialize the agent
  const agent = await initializeAgent();
  
  // Test queries
  const queries = [
    "What's the average price of Porsche 911s from 2015 to 2020?",
    "What's the highest price ever paid for a Ferrari? Please limit the results to 50 to avoid context length issues.",
    "Show me the lowest mileage BMW M3s with a maximum of 30 results.",
    "What are the most common transmission types for Corvettes? Limit to 40 results.",
    "How many Mercedes-Benz vehicles were sold in the last year?"
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

// Run the test
testDatabaseQuery().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 