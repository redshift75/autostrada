import { Listing } from '../listings/ListingCard';
import AIAgent from './AIAgent';
import { listingsFormatter } from '@/lib/scrapers/utils/formatters';

type ListingsAIAgentProps = {
  listings: Listing[];
};

export default function ListingsAIAgent({ listings }: ListingsAIAgentProps) {
  // Define suggestions for the AI agent
  const suggestions = [
    "How do the best value listings compare to recent auction results?",
    "Which listing offers the best value?",
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