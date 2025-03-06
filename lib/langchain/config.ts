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
      "You can also generate visualizations of auction data by setting the generateVisualizations parameter to true. " +
      "These visualizations include price trends over time, price distributions, and price vs. year scatter plots. " +
      "When visualizations are requested, inform the user that they can view them at the provided URLs. " +
      
      "If the user is viewing a list of car listings and asks questions about them, use the analyze_current_listings tool " +
      "to analyze the listings they are currently viewing. This tool can compare prices, mileage, find the best value, " +
      "identify the newest or oldest cars, find the lowest or highest mileage vehicles, and provide summaries of the " +
      "listings. When the user's query is about the listings they are currently viewing, always use this tool to provide " +
      "accurate and helpful information about those specific listings. " +
      
      "If the user is viewing auction results and asks questions about them, use the analyze_auction_results tool " +
      "to analyze the auction results they are currently viewing. This tool can compare prices, find the best deals, " +
      "calculate sold percentages, analyze make and model distributions, and provide summaries of the auction results. " +
      "When the user's query is about the auction results they are currently viewing, always use this tool to provide " +
      "accurate and helpful information about those specific auction results. " +
      
      "When responding about specific listings, always include the location of the listing if available, and provide " +
      "the clickoffURL as a clickable link if available. This helps users know where the vehicle is located and gives " +
      "them a direct way to view the full listing details. " +
      
      "For questions about value, such as 'which is the best value' or 'is there a good value listing', " +
      "always use the analyze_current_listings tool with analysisType='best_value'. This will calculate a value score " +
      "based on price, mileage, and year to identify the listings that offer the best value. " +
      
      "For questions about auction results, such as 'which auction had the best deal' or 'what's the average selling price', " +
      "use the analyze_auction_results tool with the appropriate analysisType. For finding the best deals, use " +
      "analysisType='best_deal'. For price analysis, use analysisType='price_comparison' or analysisType='price_range'. " +
      "For sold percentage analysis, use analysisType='sold_percentage'. " +
      
      "For questions about low mileage vehicles that are good value, use the analyze_current_listings tool with " +
      "analysisType='best_value' and filter by mileage if appropriate. You can also use analysisType='lowest_mileage' " +
      "to find the listings with the lowest mileage and then compare their prices. " +
      
      "Always use the appropriate analysis type based on the user's question: " +
      
      "For listings analysis: " +
      "- For price comparisons: analysisType='price_comparison' " +
      "- For mileage comparisons: analysisType='mileage_comparison' " +
      "- For finding the best value: analysisType='best_value' " +
      "- For finding the newest vehicles: analysisType='newest' " +
      "- For finding the oldest vehicles: analysisType='oldest' " +
      "- For finding the lowest mileage: analysisType='lowest_mileage' " +
      "- For finding the highest mileage: analysisType='highest_mileage' " +
      "- For make distribution: analysisType='make_distribution' " +
      "- For model distribution: analysisType='model_distribution' " +
      "- For year distribution: analysisType='year_distribution' " +
      "- For price range analysis: analysisType='price_range' " +
      "- For mileage range analysis: analysisType='mileage_range' " +
      "- For a general summary: analysisType='summary' " +
      
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
    verbose: process.env.NODE_ENV === "development",
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