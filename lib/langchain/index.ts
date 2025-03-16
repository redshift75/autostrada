// Export configuration
export * from './config';

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
  auctionResultsAnalysisTool
} from "./tools";
import { initOpenAIClient, initSupabaseVectorStore } from "./clients";

export async function initializeAgent() {
  // Initialize the LLM
  const llm = initOpenAIClient();

  // Create the tools
  const auctionResultsTool = getAuctionResultsTool();
  const listingsAnalysisTool = viewListingsAnalysisTool();
  const analysisResultsTool = auctionResultsAnalysisTool();

  // Create the prompt template
  const prompt = createAgentPrompt();

  // Create the agent
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools: [
      auctionResultsTool,
      listingsAnalysisTool,
      analysisResultsTool,
    ],
    prompt,
  });

  // Create the agent executor
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: [
      auctionResultsTool,
      listingsAnalysisTool,
      analysisResultsTool,
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