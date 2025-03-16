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

// Initialize the LLM
export const initLLM = (modelName: string = "gpt-4o-mini") => {
  return new ChatOpenAI({
    modelName,
    temperature: 0.0,
    streaming: true,
  });
};

// Create a prompt template for the agent
export const createAgentPrompt = () => {
  return ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate(
      "You are a classic car market intelligence agent. Help users analyze the classic car market, " +
      "find vehicles, and understand pricing trends. " +
      "You can fetch real-time auction results from Bring a Trailer to provide up-to-date market information. " +
      "When users ask about recent sales, prices, or auction results for specific makes and models, " +
      "use the fetch_auction_results tool to get the latest data. " +
      "This tool can provide detailed information about completed auctions including sold prices, " +
      "dates, vehicle details, and market trends. " +
      
      "The tool will return auction data with the following fields: " +
      "listing_id, url, title, image_url, sold_price, sold_date, bid_amount, bid_date, status, year, make, model, " +
      "mileage, bidders, watchers, comments, and transmission. You can analyze this data to answer specific " +
      "questions about auction results, price trends, vehicle specifications, and market statistics. " +
      
      "For queries that might return a large number of results, use the maxResults parameter to limit the number " +
      "of results returned. This is especially important for broad queries like 'all Ferrari models' or 'all vehicles " +
      "from the 1960s'. A good default value is 10-20 results. " +
      
      "When users ask for specific sorting of results, such as 'highest price', 'lowest mileage', or 'most recent', " +
      "use the sortBy parameter with one of the following values: " +
      "- price_high_to_low: Sort by price from highest to lowest " +
      "- price_low_to_high: Sort by price from lowest to highest " +
      "- date_newest_first: Sort by date with newest first (default) " +
      "- date_oldest_first: Sort by date with oldest first " +
      "- mileage_lowest_first: Sort by mileage from lowest to highest " +
      "- mileage_highest_first: Sort by mileage from highest to lowest " +
      
      "For example, when a user asks 'What's the highest price ever paid for a Ferrari?', use sortBy='price_high_to_low' " +
      "to ensure the highest-priced vehicles appear first in the results. " +
      
      "If the user is viewing auction results and asks questions about them, use the analyze_auction_results tool " +
      "to analyze the auction results they are currently viewing. This tool can compare prices, find the best deals, " +
      "calculate sold percentages, analyze make and model distributions, and provide summaries of the auction results. " +
    
      "If the user is viewing a list of car listings and asks questions about them, use the analyze_current_listings tool " +
      "to analyze the listings they are currently viewing. This tool can compare prices, mileage, find the best value, " +
      "identify the newest or oldest cars, find the lowest or highest mileage vehicles, and provide summaries of the " +
      "listings. When the user's query is about the listings they are currently viewing, always use this tool to provide " +
      "accurate and helpful information about those specific listings. " +
        
      "When responding about specific listings, always include the location of the listing if available, and provide " +
      "the URL as a clickable link if available. This helps users know where the vehicle is located and gives " +
      "them a direct way to view the full listing details. " +
      
      "For questions about value, such as 'which is the best value' or 'is there a good value listing', " +
      "always use the analyze_current_listings tool with analysisType='best_value'. This will calculate a value score " +
      "based on price, mileage, and year to identify the listings that offer the best value. " +
      
      "For questions about auction results, such as 'which auction had the best deal' or 'what's the average selling price', " +
      "use the analyze_auction_results tool with the appropriate analysisType. For finding the best deals, use " +
      "analysisType='best_deal'. For price analysis, use analysisType='price_comparison' or analysisType='price_range'. " +
      "For sold percentage analysis, use analysisType='sold_percentage'. " +
      
      "Always use the appropriate analysis type based on the user's question: " +
      
      "For listings analysis: " +
      "- For price comparisons: analysisType='price_comparison' " +
      "- For mileage comparisons: analysisType='mileage_comparison' " +
      "- For finding the best value: analysisType='best_value' " +
      "- For make distribution: analysisType='make_distribution' " +
      "- For model distribution: analysisType='model_distribution' " +
      "- For year distribution: analysisType='year_distribution' " +
      "- For price range analysis: analysisType='price_range' " +
      "- For mileage range analysis: analysisType='mileage_range' " +
      "- For a general summary: analysisType='summary' " +
      
      "For getting data for makes and models that are not in your context data, " +
      "use the fetch_auction_results tool with the appropriate parameters. " +
     
      "For auction results analysis: " +
      "- For price comparisons: analysisType='price_comparison' " +
      "- For finding the best deals: analysisType='best_deal' " +
      "- For sold percentage analysis: analysisType='sold_percentage' " +
      "- For make distribution: analysisType='make_distribution' " +
      "- For model distribution: analysisType='model_distribution' " +
      "- For year distribution: analysisType='year_distribution' " +
      "- For price range analysis: analysisType='price_range' " +
      "- For a general summary: analysisType='summary' " +
      
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