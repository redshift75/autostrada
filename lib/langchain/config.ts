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
      "The tool can be called with groupBy to get summarized results by a specific field. " +
      "Tool usage guidelines:" +
      "• For broad queries, use maxResults=15-20 to limit results." +
      "• When queries mention prices paid, use status=sold." +
      "• For unsold queries use bid_amount to get the highest bid amount instead of sold_price." +
      "• When queries mention vehicle colors use the normalized_color parameter in your search." +
      "• You can call the tool multiple times to get multiple results if needed to answer the question, " +
      "  for example if the user asks about a percentage of sold cars, you can call the tool twice with groupBy set to make: once with status = sold and a second time with status = unsold." +
      "• Use appropriate sorting parameters:" +
        " - sortField: Specify which field to sort by (e.g., 'sold_price', 'sold_date', 'mileage', 'bidders')." +
        " - sortBy: Specify the sort direction:" +
        "   * 'high_to_low': For descending sorts (highest values first)" +
        "   * 'low_to_high': For ascending sorts (lowest values first)" +
        "   * For aggregation queries, use 'aggregation_high_to_low' or 'aggregation_low_to_high'" +
        " - Examples:" +
        "   * For expensive cars first: sortField='sold_price', sortBy='high_to_low'" + 
        "   * For newest auctions: sortField='sold_date', sortBy='high_to_low'" +
        "   * For lowest mileage: sortField='mileage', sortBy='low_to_high'" +
        "   * For most popular: sortField='bidders', sortBy='high_to_low'" +
      "• For aggregation queries:" +
        " - When using aggregation, the sortBy parameter should be set to either 'aggregation_high_to_low' or 'aggregation_low_to_high'" +
        " - When using aggregation, only use the following fields for groupBy: status, make, model, year, normalized_color, transmission" +
        " - When using aggregation, only specify a single aggregation function." +
      "For users viewing specific content:" +
      "• For auction results questions: Use analyze_auction_results with appropriate analysisType." +
      "• For car listings questions: Use analyze_current_listings with appropriate analysisType." +
      "• Always include location and clickable URL when discussing specific listings." +
      
      "Analysis types:" +
      "• Value analysis: best_value, best_deal." +
      "• General analysis: summary." +
      
      "For data not in your context, use fetch_auction_results with appropriate parameters." +
      "Your response should be in both markdown and a JSON array format. Delineate the JSON response with JSON Format: before the JSON array." +
      "Do not include any tables or formulas in your markdown response, keep it simple." +
      "Today's date is " + new Date().toISOString().split('T')[0] + "." +
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