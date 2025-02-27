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
export const initLLM = (modelName: string = "gpt-4o") => {
  return new ChatOpenAI({
    modelName,
    temperature: 0.2,
    streaming: true,
  });
};

// Create a prompt template for the agent
export const createAgentPrompt = () => {
  return ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate(
      "You are a classic car market intelligence agent. Help users analyze the classic car market, " +
      "find vehicles, and understand pricing trends. Answer the following question: {input}"
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
  modelName: "gpt-4o",
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