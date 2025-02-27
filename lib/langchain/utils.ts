import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

/**
 * Creates a simple chain that processes a prompt with a model and returns a string
 */
export function createSimpleChain(
  model: ChatOpenAI,
  templateString: string
) {
  const prompt = PromptTemplate.fromTemplate(templateString);
  const outputParser = new StringOutputParser();
  
  return RunnableSequence.from([
    prompt,
    model,
    outputParser,
  ]);
}

/**
 * Extracts structured data from text using an LLM
 */
export async function extractStructuredData<T>(
  model: ChatOpenAI,
  text: string,
  schema: Record<string, any>,
  instructions: string
): Promise<T> {
  const templateString = `
  You are a data extraction assistant. Extract the following information from the text below.
  
  Instructions: ${instructions}
  
  Schema:
  \`\`\`
  ${JSON.stringify(schema, null, 2)}
  \`\`\`
  
  Text:
  \`\`\`
  ${text}
  \`\`\`
  
  Return ONLY a valid JSON object matching the schema. Do not include any explanations.
  `;
  
  const chain = createSimpleChain(model, templateString);
  const result = await chain.invoke({});
  
  try {
    return JSON.parse(result) as T;
  } catch (error) {
    throw new Error(`Failed to parse structured data: ${error}`);
  }
}

/**
 * Summarizes text using an LLM
 */
export async function summarizeText(
  model: ChatOpenAI,
  text: string,
  maxLength: number = 200
): Promise<string> {
  const templateString = `
  Summarize the following text in a concise manner, using no more than ${maxLength} characters:
  
  \`\`\`
  ${text}
  \`\`\`
  
  Provide only the summary, no additional commentary.
  `;
  
  const chain = createSimpleChain(model, templateString);
  return chain.invoke({});
}

// Function to extract key details from vehicle descriptions
export async function extractVehicleDetails(
  description: string,
  llm: ChatOpenAI
) {
  const parser = new StringOutputParser();
  
  const prompt = PromptTemplate.fromTemplate(`
    Extract the following details from the vehicle description if present:
    - Make
    - Model
    - Year
    - Engine
    - Transmission
    - Mileage
    - Condition
    - Special features
    
    Format the output as a JSON object with these fields.
    
    Description: {description}
  `);
  
  const chain = RunnableSequence.from([prompt, llm, parser]);
  
  const result = await chain.invoke({
    description,
  });
  
  try {
    return JSON.parse(result);
  } catch (error) {
    console.error("Failed to parse LLM output as JSON:", error);
    return { error: "Failed to extract vehicle details" };
  }
}

// Function to analyze market trends
export async function analyzeMarketTrend(
  vehicleData: string,
  llm: ChatOpenAI
) {
  const parser = new StringOutputParser();
  
  const prompt = PromptTemplate.fromTemplate(`
    Analyze the following vehicle sales data and provide insights on market trends:
    - Is the market for this type of vehicle appreciating or depreciating?
    - What factors might be influencing the price?
    - How does this compare to similar vehicles?
    - What is the future outlook for this market segment?
    
    Vehicle data: {vehicleData}
  `);
  
  const chain = RunnableSequence.from([prompt, llm, parser]);
  
  return chain.invoke({
    vehicleData,
  });
}

// Function to generate a vehicle comparison
export async function compareVehicles(
  vehicle1: string,
  vehicle2: string,
  llm: ChatOpenAI
) {
  const parser = new StringOutputParser();
  
  const prompt = PromptTemplate.fromTemplate(`
    Compare the following two vehicles in terms of:
    - Market value
    - Investment potential
    - Collectibility
    - Maintenance considerations
    - Overall desirability
    
    Vehicle 1: {vehicle1}
    Vehicle 2: {vehicle2}
  `);
  
  const chain = RunnableSequence.from([prompt, llm, parser]);
  
  return chain.invoke({
    vehicle1,
    vehicle2,
  });
} 