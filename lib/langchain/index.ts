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
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createAgentPrompt } from "./config";
import {
  createVehicleSearchTool,
  createPriceHistoryTool,
  createVehicleDetailTool,
  createMarketAnalysisTool,
  createAuctionResultsTool,
  createListingsAnalysisTool,
  createAuctionResultsAnalysisTool
} from "./tools";
import { initOpenAIClient, initSupabaseVectorStore } from "./clients";

export async function initializeAgent() {
  // Initialize the LLM
  const llm = initOpenAIClient();

  // Create the tools
  const vehicleSearchTool = createVehicleSearchTool();
  const priceHistoryTool = createPriceHistoryTool();
  const vehicleDetailTool = createVehicleDetailTool();
  const marketAnalysisTool = createMarketAnalysisTool();
  const auctionResultsTool = createAuctionResultsTool();
  const listingsAnalysisTool = createListingsAnalysisTool();
  const auctionResultsAnalysisTool = createAuctionResultsAnalysisTool();

  // Create the prompt template
  const prompt = createAgentPrompt();

  // Create the agent
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools: [
      vehicleSearchTool,
      priceHistoryTool,
      vehicleDetailTool,
      marketAnalysisTool,
      auctionResultsTool,
      listingsAnalysisTool,
      auctionResultsAnalysisTool,
    ],
    prompt,
  });

  // Create the agent executor
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: [
      vehicleSearchTool,
      priceHistoryTool,
      vehicleDetailTool,
      marketAnalysisTool,
      auctionResultsTool,
      listingsAnalysisTool,
      auctionResultsAnalysisTool,
    ],
    verbose: true,
  });

  return agentExecutor;
}

export async function initializeVectorStore() {
  try {
    // Initialize the vector store
    const vectorStore = initSupabaseVectorStore();
    return vectorStore;
  } catch (error) {
    console.error("Error initializing vector store:", error);
    return null;
  }
} 