import axios from 'axios';
import '../server-only';
import { BaseScraper } from './BaseScraper';

// Import Node.js modules conditionally
let fs: any;
let path: any;

// Only import Node.js modules on the server
if (typeof window === 'undefined') {
  import('fs').then(module => { fs = module });
  import('path').then(module => { path = module });
}

// Define interface for completed auction listings
export interface BaTCompletedListing {
  id: string;
  url: string;
  title: string;
  image_url: string;
  sold_price: string;
  sold_date: string;
  bid_amount: string;
  bid_date: string;
  status: string;
  year?: number;
  make?: string;
  model?: string;
  country?: string;
  country_code?: string;
  noreserve?: boolean;
  premium?: boolean;
  timestamp_end?: number;
  excerpt?: string;
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
}

// Interface for scraper parameters
export interface BaTResultsScraperParams {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  maxPages?: number; // Maximum number of pages to fetch
  perPage?: number; // Number of items per page
}

export class BringATrailerResultsScraper extends BaseScraper {
  private baseUrl = 'https://bringatrailer.com/auctions/results/';
  private apiBaseUrl = 'https://bringatrailer.com/wp-json/bringatrailer/1.0/data/listings-filter';
  private debugDir: string;

  constructor() {
    super();
    this.debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  async scrape(params: BaTResultsScraperParams = {}): Promise<BaTCompletedListing[]> {
    try {
      // Set default values
      const perPage = params.perPage || 50;
      let maxPages = params.maxPages || 1;
      let allListings: BaTCompletedListing[] = [];
      const seenIds = new Set<string>();
      
      // Prepare search term for McLaren (can be customized based on params)
      let searchTerm = 'McLaren';
      if (params.make) {
        searchTerm = params.make;
        if (params.model) {
          searchTerm += ` ${params.model}`;
        }
      }
      
      console.log(`Searching for: ${searchTerm}`);
      
      // Fetch all requested pages
      for (let page = 1; page <= maxPages; page++) {
        console.log(`Fetching page ${page}/${maxPages}...`);
        
        try {
          // Prepare request data
          const requestData = {
            page: page,
            per_page: perPage,
            get_items: 1,
            get_stats: 0,
            include_s: searchTerm,
            minimum_year: params.yearMin,
            maximum_year: params.yearMax
          };
          
          // Make POST request to the API
          const response = await axios.post(this.apiBaseUrl, requestData, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.5',
              'Connection': 'keep-alive',
              'Referer': 'https://bringatrailer.com/auctions/results/'
            }
          });
          
          // Save debug response
          const debugFilePath = path.join(this.debugDir, `bat_api_response_page_${page}_${Date.now()}.json`);
          fs.writeFileSync(debugFilePath, JSON.stringify(response.data, null, 2));
          
          if (!response.data || !response.data.items || !Array.isArray(response.data.items)) {
            console.error(`Failed to get valid data for page ${page}`);
            continue;
          }
          
          // If it's the first page, get the total pages info and adjust maxPages if needed
          if (page === 1) {
            const totalPages = response.data.pages_total || 1;
            const totalItems = response.data.items_total || 0;
            console.log(`Found ${totalItems} total auctions across ${totalPages} pages`);
            
            // Adjust maxPages if it's more than the total available pages
            if (maxPages > totalPages) {
              console.log(`Adjusting requested pages from ${maxPages} to ${totalPages} (total available)`);
              maxPages = totalPages;
            }
          }
          
          // Extract listings from the API response
          const pageListings = this.extractCompletedListingsFromApiData(response.data);
          console.log(`Page ${page}: Found ${pageListings.length} listings`);
          
          // Only add listings that we haven't seen before
          const newListings = pageListings.filter(listing => !seenIds.has(listing.id));
          console.log(`Page ${page}: Adding ${newListings.length} new unique listings (${pageListings.length - newListings.length} duplicates filtered out)`);
          
          // Update the set of seen IDs
          newListings.forEach(listing => seenIds.add(listing.id));
          
          // Add new listings to our results
          allListings = [...allListings, ...newListings];
          
          // If we didn't get any new listings, we might have reached the end
          if (newListings.length === 0) {
            console.log('No new listings found, stopping pagination');
            break;
          }
        } catch (error) {
          console.error(`Error fetching page ${page}:`, error);
          console.warn(`Failed to fetch page ${page}, stopping pagination`);
          break;
        }
        
        // Add a small delay to avoid rate limiting (except for the last page)
        if (page < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Filter by make, model, and year if provided
      const filteredListings = this.filterListings(allListings, params);
      
      console.log(`Found ${filteredListings.length} completed auctions after filtering`);
      if (filteredListings.length > 0) {
        console.log(`First result: ${filteredListings[0].title}`);
      }
      
      return filteredListings;
    } catch (error) {
      console.error('Error scraping BaT completed auctions:', error);
      return [];
    }
  }

  private extractCompletedListingsFromApiData(data: any): BaTCompletedListing[] {
    try {
      if (!data || !data.items || !Array.isArray(data.items)) {
        return [];
      }
      
      return data.items.map((item: any) => {
        // Extract year, make, model from title if available
        let itemYear: number | undefined = undefined;
        let itemMake: string | undefined = undefined;
        let itemModel: string | undefined = undefined;
        
        if (item.title) {
          // Try to extract year from title (e.g., "2016 Porsche 911 GT3 RS")
          const yearMatch = item.title.match(/^(\d{4})/);
          if (yearMatch) {
            itemYear = parseInt(yearMatch[1], 10);
          }
          
          // Extract make and model from title
          const titleInfo = this.parseTitle(item.title);
          itemMake = titleInfo.make;
          itemModel = titleInfo.model;
        }
        
        // Extract sold price and date from sold_text
        let soldPrice = '';
        let soldDate = '';
        let status = 'unsold';
        let bidAmount = '';
        
        if (item.sold_text) {
          // Example: "Sold for USD $28,050 on 2/27/25" or "Bid to USD $12,750 on 2/27/25"
          const soldMatch = item.sold_text.match(/Sold for USD \$([0-9,]+) <span> on (\d+\/\d+\/\d+)/);
          const bidMatch = item.sold_text.match(/Bid to USD \$([0-9,]+) <span> on (\d+\/\d+\/\d+)/);
          
          if (soldMatch) {
            soldPrice = soldMatch[1].replace(/,/g, '');
            soldDate = soldMatch[2];
            bidAmount = soldPrice; // For sold items, bid amount equals sold price
            status = 'sold';
          } else if (bidMatch) {
            bidAmount = bidMatch[1].replace(/,/g, '');
            soldDate = bidMatch[2];
            status = 'unsold';
          }
        }
        
        // Use current_bid if available
        if (item.current_bid && !bidAmount) {
          bidAmount = item.current_bid.toString();
        }
        
        // Extract images if available
        let images = undefined;
        if (item.images) {
          images = {
            small: item.images.small,
            large: item.images.large
          };
        }
        
        return {
          id: item.id?.toString() || '',
          url: item.url || '',
          title: item.title || '',
          image_url: item.thumbnail_url || '',
          sold_price: soldPrice,
          sold_date: soldDate,
          bid_amount: bidAmount,
          bid_date: soldDate, // Using sold date as bid date since they're the same in the API
          status: status,
          year: itemYear,
          make: itemMake,
          model: itemModel,
          country: item.country || '',
          country_code: item.country_code || '',
          noreserve: item.noreserve || false,
          premium: item.premium || false,
          timestamp_end: item.timestamp_end || 0,
          excerpt: item.excerpt || '',
          images: images
        };
      });
    } catch (error) {
      console.error('Error extracting listings from API data:', error);
      return [];
    }
  }

  private parseTitle(title: string): { year?: number; make?: string; model?: string } {
    // Extract year, make, and model from title
    const yearMatch = title.match(/^(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    
    // Simple extraction of make and model
    // This is a basic implementation and might need refinement
    if (yearMatch) {
      const remainingTitle = title.substring(yearMatch[0].length).trim();
      const parts = remainingTitle.split(' ');
      
      if (parts.length > 0) {
        const make = parts[0];
        const model = parts.length > 1 ? parts[1] : undefined;
        
        return { year, make, model };
      }
    }
    
    return { year, make: undefined, model: undefined };
  }

  private filterListings(listings: BaTCompletedListing[], params: BaTResultsScraperParams): BaTCompletedListing[] {
    return listings.filter(listing => {
      // Filter by year range
      if (params.yearMin && listing.year && listing.year < params.yearMin) {
        return false;
      }
      if (params.yearMax && listing.year && listing.year > params.yearMax) {
        return false;
      }
      
      // Filter by make (case-insensitive)
      if (params.make && listing.make && !listing.make.toLowerCase().includes(params.make.toLowerCase())) {
        return false;
      }
      
      // Filter by model (case-insensitive)
      if (params.model && listing.model && !listing.model.toLowerCase().includes(params.model.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }
} 