import { ChatOpenAI } from "@langchain/openai";

// Initialize OpenAI client
export const initOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  
  return new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: "gpt-4o",
    temperature: 0,
  });
};

// Initialize any other external API clients
export const initExternalClients = () => {
  // Add other API clients as needed
  return {
    // Example: auctionClient: new AuctionAPIClient(process.env.AUCTION_API_KEY),
  };
}; 