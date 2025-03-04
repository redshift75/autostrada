import { ChatOpenAI } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";

// Initialize OpenAI client
export const initOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  
  return new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: "gpt-4o",
    temperature: 0.2,
  });
};

// Initialize Supabase client for vector storage
export const initSupabaseVectorStore = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are required");
  }
  
  const client = createClient(supabaseUrl, supabaseKey);
  
  return new SupabaseVectorStore(
    new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    }),
    {
      client,
      tableName: "vehicle_embeddings",
      queryName: "match_vehicle_embeddings",
    }
  );
};

// Initialize any other external API clients
export const initExternalClients = () => {
  // Add other API clients as needed
  return {
    // Example: auctionClient: new AuctionAPIClient(process.env.AUCTION_API_KEY),
  };
}; 