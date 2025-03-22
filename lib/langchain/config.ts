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
      "This tool returns comprehensive auction data including: url, title, sold_price, sold_date, bid_amount, " +
      "bid_date, status, year, make, model, mileage, bidders, watchers, comments, and transmission. " +
      "The tool can be called with groupBy to get summarized results by a specific field. " +
      "Tool usage guidelines:" +
      "• For broad queries, use maxResults=10-20 to limit results." +
      "• You can call the tool multiple times to get multiple results if needed to answer the question, " +
      "  for example if the user asks about a percentage of sold cars, you can call the tool twice with groupBy set to make: once with status = sold and a second time with status = unsold." +
      "• Use appropriate sortBy parameters:" +
        " - price_high_to_low/price_low_to_high: For price sorting." +
        " - date_newest_first/date_oldest_first: For date sorting." +  
        " - mileage_lowest_first/mileage_highest_first: For mileage sorting." +
        " - bidders_highest_first/bidders_lowest_first: For popularity sorting." +
        " - aggregation_lowest_first/aggregation_highest_first: For aggregation sorting." +
        " - when using by aggregation, the sortBy parameter should be set to aggregation." +
        " - when using by aggregation, the field parameter should be set to the field you want to aggregate by " + 
           "and only use the following fields: status, make, model, year, price, mileage, bidders, watchers, comments, transmission" +
        " - when using by aggregation, only specify a single aggregation function." +
      "For users viewing specific content:" +
      "• For auction results questions: Use analyze_auction_results with appropriate analysisType." +
      "• For car listings questions: Use analyze_current_listings with appropriate analysisType." +
      "• Always include location and clickable URL when discussing specific listings." +
      "• Do not include image_url in your response." +
      
      "Analysis types:" +
      "• Value analysis: best_value, best_deal." +
      "• General analysis: summary." +
      
      "For data not in your context, use fetch_auction_results with appropriate parameters." +
      "Your response should be in markdown format." +
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
    tools,
    verbose: false,
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

// Default model configuration
export const defaultModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.2,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Model for creative tasks (higher temperature)
export const creativeModel = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Model for precise analysis (lower temperature)
export const analyticalModel = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
}); 