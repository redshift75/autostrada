import { initClassicCarAgent } from '../lib/langchain';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAgent() {
  console.log('Initializing Classic Car Market Intelligence Agent...');
  
  try {
    // Initialize the agent
    const agent = await initClassicCarAgent();
    
    // Test queries
    const testQueries = [
      "What's the current market value of a 1973 Porsche 911 Carrera RS?",
      "How have Ferrari Testarossa prices changed over the last 5 years?",
      "Compare the investment potential of a Mercedes 300SL Gullwing versus an Aston Martin DB5"
    ];
    
    // Run a test query
    const selectedQuery = testQueries[0]; // You can change the index to test different queries
    console.log(`\nRunning test query: "${selectedQuery}"`);
    
    const result = await agent.invoke({
      input: selectedQuery
    });
    
    console.log('\nAgent Response:');
    console.log(result.output);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing agent:', error);
  }
}

// Run the test
testAgent()
  .then(() => {
    console.log('Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  }); 