// Export configuration
export * from './config';

// Export utility functions
export * from './utils';

// Export tools
export * from './tools';

// Export clients
export * from './clients';

// Create a convenience function to initialize the entire agent system
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { createAgentPrompt } from "./config";
import {
  getAuctionResultsTool,
  viewListingsAnalysisTool,
  viewAuctionResultsAnalysisTool
} from "./tools";
import { initOpenAIClient, initSupabaseVectorStore } from "./clients";

export async function initializeAgent() {
  // Initialize the LLM
  const llm = initOpenAIClient();

  // Create the tools
  const auctionResultsTool = getAuctionResultsTool();
  const listingsAnalysisTool = viewListingsAnalysisTool();
  const auctionResultsAnalysisTool = viewAuctionResultsAnalysisTool();

  // Create the prompt template
  const prompt = createAgentPrompt();

  // Create the agent
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools: [
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
      auctionResultsTool,
      listingsAnalysisTool,
      auctionResultsAnalysisTool,
    ],
    verbose: false,
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