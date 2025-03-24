import { ChatOpenAI } from "@langchain/openai";
import { StructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { RunnableSequence } from "@langchain/core/runnables";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder, 
  HumanMessagePromptTemplate 
} from "@langchain/core/prompts";
import { z } from "zod";

// Environment validation
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
});

try {
  envSchema.parse(process.env);
} catch (error) {
  console.error("Environment validation failed:", error);
  throw new Error("Missing required environment variables for LangChain");
}

// Create a prompt template for the agent
export const createAgentPrompt = () => {
  return ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate(
      "You are a classic car market intelligence agent. Help users analyze the market, find vehicles, and understand pricing trends. " +
      "The user may be reviewing auction results, car listings, asking about a specific car, or asking about the market in general. " +
      "Listing results will be provided in the context and can include price, mileage, year, exterior and interior color as well as other details. " +
      "Use the fetch_auction_results tool to get real-time data from Bring a Trailer when asked about sales, prices, or auction results. " +
      "The tool can be called with groupBy to get summarized results by a specific field. \n" +
      "Response Requirements: \n" +
      "Your response should have a summary in markdown and a JSON array containing all the results. \n" +
      "ALWAYS separate the JSON from the markdown using JSON: before the JSON array. \n" +
      "Do not respond with any tables or formulas in your markdown and keep it concise, but always provide the complete results details in the JSON array.\n" +
      "Tool usage guidelines: \n" +
      "• For broad queries, use maxResults=10-20 to limit results. \n" +
      "• When queries mention prices paid, se status=sold. \n" +
      "• For unsold queries use bid_amount to get the highest bid amount instead of sold_price. \n" +
      "• When queries mention vehicle colors use the normalized_color parameter in your search. \n" +
      "• You can call the tool multiple times to get multiple results if needed to answer the question, " +
      "  for example if the user asks about a percentage of sold cars, you can call the tool twice with groupBy set to make: once with status = sold and a second time with status = unsold. \n" +
      "• Use appropriate sorting parameters: \n" +
        " - sortField: Specify which field to sort by (e.g., 'sold_price', 'end_date', 'mileage', 'bidders'). \n" +
        " - sortBy: Specify the sort direction: \n" +
        "   * 'high_to_low': For descending sorts (highest values first) \n" +
        "   * 'low_to_high': For ascending sorts (lowest values first) \n" +
        "   * For aggregation queries, use 'aggregation_high_to_low' or 'aggregation_low_to_high' \n" +
        " - Examples: \n" +
        "   * For expensive cars first: sortField='sold_price', sortBy='high_to_low' \n" + 
        "   * For newest auctions: sortField='end_date', sortBy='high_to_low' \n" +
        "   * For lowest mileage: sortField='mileage', sortBy='low_to_high' \n" +
        "   * For most popular: sortField='bidders', sortBy='high_to_low' \n" +
      "• For aggregation queries: \n" +
        " - When using aggregation, the sortBy parameter should be set to either 'aggregation_high_to_low' or 'aggregation_low_to_high' \n" +
        " - When using aggregation, only use the following fields for groupBy: status, make, model, year, normalized_color, transmission \n" +
        " - When using aggregation, only specify a single aggregation function. \n" +
      "For users viewing specific content: \n" +
      "• For auction results questions: Use analyze_auction_results with appropriate analysisType. \n" +
      "• For car listings questions: Use analyze_current_listings with appropriate analysisType. \n" +
      "• Always include location and clickable URL when discussing specific listings. \n" +
      
      "Analysis types: \n" +
      "• Value analysis: best_value, best_deal. \n" +
      "• General analysis: summary. \n" +
      
      "For data not in your context, use fetch_auction_results with appropriate parameters. \n" +
      "Today's date is " + new Date().toISOString().split('T')[0] + ". \n" +
      "Answer the following question: {input}"
    ),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
};

// Create an agent with tools
export const createAgent = async (
  llm: ChatOpenAI,
  tools: StructuredTool[],
  prompt: ChatPromptTemplate
) => {
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });

  return AgentExecutor.fromAgentAndTools({
    agent,
    tools
  });
};

// Create a runnable sequence for processing user queries
export const createRunnableSequence = (
  llm: ChatOpenAI,
  tools: StructuredTool[]
) => {
  const prompt = createAgentPrompt();
  
  return RunnableSequence.from([
    {
      input: (input: string) => input,
      agent_scratchpad: async () => [],
    },
    prompt,
    llm,
  ]);
};