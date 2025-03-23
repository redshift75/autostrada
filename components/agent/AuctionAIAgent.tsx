import { useState, useEffect, useRef } from 'react';
import AIAgent from './AIAgent';
import { auctionFormatter } from '@/lib/utils/formatters';

// Define the AuctionResult type
export type AuctionResult = {
  title: string;
  sold_price: string;
  bid_amount: string;
  sold_date: string;
  status: string;
  url: string;
  image_url?: string;
  make?: string;
  model?: string;
  mileage?: number;
  normalized_color?: string;
  bidders?: number;
  watchers?: number;
  comments?: number;
  transmission?: string;
  price?: number;
};

type AuctionAIAgentProps = {
  auctionResults: AuctionResult[];
  onAIResultsChange?: (results: AuctionResult[]) => void;
};

export default function AuctionAIAgent({ auctionResults, onAIResultsChange }: AuctionAIAgentProps) {
  const [aiResults, setAiResults] = useState<AuctionResult[]>([]);
  // Track the last processed message to avoid reprocessing
  const lastProcessedMessageRef = useRef<string | null>(null);

  // Define suggestions for the AI agent
  const suggestions = [
    "Compare the prices of yellow and black BMW M3s",
    "What makes have the highest sold percentage?",
    "What color Ferraris achieve the highest prices?",
    "What are the most common transmission types for Porsches?",
    "Which of these cars is the best deal?",
    "What are the best value manual ferrari from the early 90s"
  ];

  // Extract JSON results from AI response
  const handleAIResponse = (response: string) => {
    try {
      // If we've already processed this exact message, don't process it again
      if (lastProcessedMessageRef.current === response) {
        return null;
      }
      
      // Look for JSON array in the response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);

      if (jsonMatch && jsonMatch[1]) {
        const parsedResults = JSON.parse(jsonMatch[1]) as AuctionResult[];
        
        // Update the last processed message
        lastProcessedMessageRef.current = response;
        
        // Update state and call the callback
        setAiResults(parsedResults);
        
        // Pass results to parent component if callback exists
        if (onAIResultsChange) {
          onAIResultsChange(parsedResults);
        }
        
        return parsedResults;
      }
      
      // Still mark this message as processed even if no JSON data was found
      lastProcessedMessageRef.current = response;
      return null;
    } catch (error) {
      console.error('Error extracting JSON results from AI response:', error);
      // Still mark this message as processed even if there was an error
      lastProcessedMessageRef.current = response;
      return null;
    }
  };

  // Custom wrapper around formatData to process responses
  const processAIResponse = (messages: any) => {
    // Process the last assistant message if it exists
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        handleAIResponse(lastMessage.content);
      }
    }
  };

  return (
    <AIAgent
      title="Auction AI Assistant"
      subtitle="Ask questions about auction results"
      initialSuggestions={suggestions}
      formatData={auctionFormatter.formatData}
      data={auctionResults}
      onMessageUpdate={processAIResponse}
    />
  );
} 