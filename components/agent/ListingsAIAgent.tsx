import { Listing } from '../listings/ListingCard';
import AIAgent from './AIAgent';

type ListingsAIAgentProps = {
  listings: Listing[];
};

export default function ListingsAIAgent({ listings }: ListingsAIAgentProps) {
  // Define suggestions for the AI agent
  const suggestions = [
    "Which car has the lowest mileage?",
    "What's the average price of these listings?",
    "Which listing offers the best value?",
    "Is there a low mileage car that's particularly good value?",
    "Summarize these listings for me"
  ];

  // Format listings data for the API
  const formatListingsData = (data: Listing[]) => {
    return {
      listings: data.map(listing => ({
        title: listing.title,
        price: listing.price,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        mileage: listing.mileage,
        vin: listing.vin,
        location: listing.location || (listing.dealer ? `${listing.dealer.city}, ${listing.dealer.state}` : null),
        clickoffURL: listing.clickoffURL || listing.url || null
      }))
    };
  };

  return (
    <AIAgent
      title="Listings AI Assistant"
      subtitle="Ask questions about the current listings"
      initialSuggestions={suggestions}
      formatData={formatListingsData}
      data={listings}
    />
  );
} 