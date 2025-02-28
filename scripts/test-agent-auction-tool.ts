import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder, 
  HumanMessagePromptTemplate 
} from "@langchain/core/prompts";
import { createAuctionResultsTool } from '../lib/langchain/tools';

async function testAgentWithAuctionTool() {
  try {
    console.log('Initializing a simplified agent with auction results tool...');
    
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
    
    // Test query
    const query = "What are the recent auction results for Ferrari 458 models? What's the average selling price?";
    console.log(`\nTesting query: "${query}"`);
    
    // Invoke the agent
    const result = await agentExecutor.invoke({
      input: query
    });
    
    // Display the result
    console.log('\nAgent response:');
    console.log(result.output);
    
  } catch (error) {
    console.error('Error testing agent with auction tool:', error);
  }
}

// Run the test
testAgentWithAuctionTool(); 