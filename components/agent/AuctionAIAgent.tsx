import AIAgent from './AIAgent';

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
  images?: {
    small?: {
      url: string;
      width: number;
      height: number;
    };
    large?: {
      url: string;
      width: number;
      height: number;
    };
  };
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

  // Format auction results for the API
  const formatAuctionData = (data: AuctionResult[]) => {
    return {
      auctionResults: data.map(result => {
        // Extract numeric price values if available
        let price: string | number | null = null;
        
        if (result.status === 'sold' && result.sold_price) {
          // Extract numeric value from sold_price string
          const numericPrice = result.sold_price.replace(/[^0-9.]/g, '');
          price = numericPrice ? parseFloat(numericPrice) : null;
        } else if (result.bid_amount) {
          // Extract numeric value from bid_amount string
          const numericPrice = result.bid_amount.replace(/[^0-9.]/g, '');
          price = numericPrice ? parseFloat(numericPrice) : null;
        } else if (result.price) {
          // Use price field if available
          price = result.price;
        }
        
        return {
          title: result.title,
          price: price,
          sold_price: result.status === 'sold' ? result.sold_price : null,
          bid_amount: result.status !== 'sold' ? result.bid_amount : null,
          status: result.status,
          sold_date: result.sold_date || null,
          url: result.url,
          make: result.make || result.title.split(' ')[0] || '',
          model: result.model || result.title.split(' ')[1] || '',
          image_url: result.image_url || (result.images?.small?.url || null)
        };
      })
    };
  };

  return (
    <AIAgent
      title="Auction Results AI Assistant"
      subtitle="Ask questions about the auction results"
      initialSuggestions={suggestions}
      formatData={formatAuctionData}
      data={auctionResults}
    />
  );
} 