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
};

type AuctionAIAgentProps = {
  auctionResults: AuctionResult[];
};

export default function AuctionAIAgent({ auctionResults }: AuctionAIAgentProps) {
  // Define suggestions for the AI agent
  const suggestions = [
    "What makes have the highest sold percentage?",
    "What are the most common transmission types for Porsches?",
    "Which of these cars is the best deal?",
    "Is there a trend in these results?",
    "What are the best value manual ferrari from the early 90s"
  ];

  return (
    <AIAgent
      title="Auction AI Assistant"
      subtitle="Ask questions about auction results"
      initialSuggestions={suggestions}
      formatData={auctionFormatter.formatData}
      data={auctionResults}
    />
  );
} 