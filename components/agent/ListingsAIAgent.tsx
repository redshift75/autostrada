import { Listing } from '../listings/ListingCard';
import AIAgent from './AIAgent';
import { listingsFormatter } from '@/lib/utils/formatters';

type ListingsAIAgentProps = {
  listings: Listing[];
};

export default function ListingsAIAgent({ listings }: ListingsAIAgentProps) {
  // Define suggestions for the AI agent
  const suggestions = [
    "How does the best value listing compare to auction results?",
    "Is there a low mileage car that's particularly well priced?",
    "Summarize these listings for me"
  ];

  return (
    <AIAgent
      title="Listings AI Assistant"
      subtitle="Ask questions about the current listings"
      initialSuggestions={suggestions}
      formatData={listingsFormatter.formatData}
      data={listings}
    />
  );
} 