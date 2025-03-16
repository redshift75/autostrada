import AIAgent from './AIAgent';
import { auctionFormatter } from '@/lib/scrapers/utils/formatters';

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
  bidders?: number;
  watchers?: number;
  comments?: number;
  transmission?: string;
  price?: number;
};

type AuctionAIAgentProps = {
  auctionResults: AuctionResult[];
};

export default function AuctionAIAgent({ auctionResults }: AuctionAIAgentProps) {
  // Define suggestions for the AI agent
  const suggestions = [
    "what are the cheapest recent mclaren sales?",
    "What are the most expensive manual BMW cars?",
    "What are the top 5 most expensive cars?",
    "Is there a trend in these results?",
    "Summarize these auction results for me"
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