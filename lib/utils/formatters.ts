import { Listing } from "@/components/listings/ListingCard";
import { AuctionResult } from "@/components/agent/AuctionAIAgent";
import { DataFormatter } from "@/components/agent/AIAgent";

/**
 * Formatter for listings data to be used with the AI Agent
 */
export const listingsFormatter: DataFormatter<Listing> = {
  formatData: (listings: Listing[]) => {
    return {
      listings: listings.map(listing => ({
        title: listing.title,
        price: listing.price,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        trim: listing.trim,
        exterior_color: listing.exterior_color,
        interior_color: listing.interior_color,
        drive_train: listing.drive_train,
        transmission: listing.transmission,
        engine: listing.engine,
        body_style: listing.body_style,
        mileage: listing.mileage,
        vin: listing.vin,
        location: listing.location || (listing.dealer ? `${listing.dealer.city}, ${listing.dealer.state}` : null),
        clickoffURL: listing.clickoffURL || listing.url || null
      }))
    };
  }
};

/**
 * Formatter for auction results data to be used with the AI Agent
 */
export const auctionFormatter: DataFormatter<AuctionResult> = {
  formatData: (results: AuctionResult[]) => {
    return {
      auctionResults: results.map(result => {
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
          mileage: result.mileage || null,
          normalized_color: result.normalized_color || null,
          bidders: result.bidders || null,
          watchers: result.watchers || null,
          comments: result.comments || null,
          transmission: result.transmission || null
        };
      })
    };
  }
};