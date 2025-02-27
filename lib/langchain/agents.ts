import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { defaultModel } from "./config";

// Base agent class
export class BaseAgent {
  protected model: ChatOpenAI;
  
  constructor(model: ChatOpenAI = defaultModel) {
    this.model = model;
  }
  
  protected async runChain(
    templateString: string,
    inputs: Record<string, any>
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(templateString);
    const chain = RunnableSequence.from([
      prompt,
      this.model,
      new StringOutputParser(),
    ]);
    
    return chain.invoke(inputs);
  }
}

// Market analysis agent
export class MarketAnalysisAgent extends BaseAgent {
  async analyzePriceTrend(
    make: string,
    model: string,
    yearStart: number,
    yearEnd: number
  ): Promise<string> {
    const templateString = `
    You are a classic car market expert. Analyze the price trends for the following vehicle:
    
    Make: {make}
    Model: {model}
    Year range: {yearStart} to {yearEnd}
    
    Provide insights on:
    1. Overall price trend
    2. Factors affecting valuation
    3. Market outlook
    
    Base your analysis on general market knowledge.
    `;
    
    return this.runChain(templateString, {
      make,
      model,
      yearStart,
      yearEnd,
    });
  }
  
  async compareVehicles(
    vehicle1: string,
    vehicle2: string
  ): Promise<string> {
    const templateString = `
    Compare these two classic vehicles as investment opportunities:
    
    Vehicle 1: {vehicle1}
    Vehicle 2: {vehicle2}
    
    Consider:
    - Historical price trends
    - Collectibility factors
    - Maintenance considerations
    - Market demand
    
    Provide a balanced comparison highlighting the pros and cons of each.
    `;
    
    return this.runChain(templateString, {
      vehicle1,
      vehicle2,
    });
  }
}

// Vehicle identification agent
export class VehicleIdentificationAgent extends BaseAgent {
  async extractVehicleDetails(description: string): Promise<string> {
    const templateString = `
    Extract key vehicle details from the following description:
    
    {description}
    
    Identify:
    - Make and model
    - Year
    - Engine/powertrain details
    - Special features or options
    - Condition indicators
    
    Format the information in a structured way.
    `;
    
    return this.runChain(templateString, {
      description,
    });
  }
  
  async identifyRareFeatures(vehicleDetails: string): Promise<string> {
    const templateString = `
    Analyze the following vehicle details and identify any rare or valuable features:
    
    {vehicleDetails}
    
    Consider:
    - Limited production options
    - Special editions
    - Factory modifications
    - Period-correct rare accessories
    - Original features that are often replaced
    
    Explain why these features add value to the vehicle.
    `;
    
    return this.runChain(templateString, {
      vehicleDetails,
    });
  }
} 