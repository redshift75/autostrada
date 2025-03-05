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
    "What's the average selling price?",
    "Which auction sold for the highest price?",
    "What percentage of auctions resulted in a sale?",
    "Is there a trend in prices over time?",
    "Summarize these auction results for me"
  ];

  return (
    <AIAgent
      title="Auction Results AI Assistant"
      subtitle="Ask questions about the auction results"
      initialSuggestions={suggestions}
      formatData={auctionFormatter.formatData}
      data={auctionResults}
    />
  );
} 