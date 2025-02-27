// Export configuration
export * from './config';

// Export utility functions
export * from './utils';

// Export tools
export * from './tools';

// Export clients
export * from './clients';

// Create a convenience function to initialize the entire agent system
import { ChatOpenAI } from "@langchain/openai";
import { initOpenAIClient, initSupabaseVectorStore } from './clients';
import { createAgent, createAgentPrompt } from './config';
import { 
  createVehicleSearchTool, 
  createPriceHistoryTool,
  createVehicleDetailTool,
  createMarketAnalysisTool
} from './tools';

export const initClassicCarAgent = async () => {
  // Initialize the LLM
  const llm = initOpenAIClient();
  
  // Initialize vector store
  const vectorStore = initSupabaseVectorStore();
  
  // Create tools
  const tools = [
    createVehicleSearchTool(),
    createPriceHistoryTool(),
    createVehicleDetailTool(),
    createMarketAnalysisTool(),
  ];
  
  // Create prompt
  const prompt = createAgentPrompt();
  
  // Create and return the agent
  return createAgent(llm, tools, prompt);
}; 