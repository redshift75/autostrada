/**
 * Type definition for a Bring a Trailer listing
 */
export interface BaTListing {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  url: string;
  imageUrl: string;
  description: string;
  price: number;
  currency: string;
  location: string;
  endDate: Date;
  source: string;
  status: string;
  
  // Additional fields used in the codebase
  currentBid?: number;
  soldPrice?: number;
  isEnded?: boolean;
  isSold?: boolean;
  bidCount?: number;
  sellerUsername?: string;
  comments?: number;
  views?: number;
  watches?: number;
  
  additionalInfo: {
    sold: boolean;
    soldPrice: number;
    noReserve: boolean;
    premium: boolean;
    featured: boolean;
  };
} 