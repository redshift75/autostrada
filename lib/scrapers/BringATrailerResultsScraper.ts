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
  delayBetweenRequests?: number; // Delay between requests in milliseconds
  longPauseInterval?: number; // Number of pages after which to take a longer pause
  longPauseDelay?: number; // Duration of the longer pause in milliseconds
  modelSuggestions?: string[]; // List of model suggestions for the specified make
}

export class BringATrailerResultsScraper extends BaseScraper {
  private baseUrl = 'https://bringatrailer.com/auctions/results/';
  private apiBaseUrl = 'https://bringatrailer.com/wp-json/bringatrailer/1.0/data/listings-filter';
  private debugDir: string;

  constructor() {
    super();
    
    // Initialize debugDir asynchronously to ensure modules are loaded
    this.initializeDebugDir();
    
    // Set a default value for debugDir to prevent immediate errors
    this.debugDir = '/tmp';
  }
  
  private async initializeDebugDir(): Promise<void> {
    try {
      // Only create debug directory in development environment
      if (process.env.NODE_ENV !== 'production') {
        // Import modules dynamically if needed
        const fs = await import('fs');
        const path = await import('path');
        
        this.debugDir = path.join(process.cwd(), 'debug');
        if (!fs.existsSync(this.debugDir)) {
          fs.mkdirSync(this.debugDir, { recursive: true });
        }
      } else {
        // In production, set to a temporary directory
        this.debugDir = '/tmp';
      }
    } catch (error) {
      console.error('Failed to initialize debug directory:', error);
      // Fallback to /tmp
      this.debugDir = '/tmp';
    }
  }

  async scrape(params: BaTResultsScraperParams = {}): Promise<BaTCompletedListing[]> {
    try {
      // Set default values
      const perPage = params.perPage || 50;
      let maxPages = params.maxPages || 3;
      let allListings: BaTCompletedListing[] = [];
      const seenIds = new Set<string>();
      const make = params.make || 'Porsche'; // Default to Porsche if not specified
      const modelSuggestions = params.modelSuggestions || []; // Get model suggestions from params
      
      // Set rate limiting parameters with defaults
      const delayBetweenRequests = params.delayBetweenRequests || 2000; // 2 seconds between requests
      const longPauseInterval = params.longPauseInterval || 10; // Pause every 10 pages
      const longPauseDelay = params.longPauseDelay || 30000; // 30 seconds for long pause
      
      // Prepare search term based on make and model
      let searchTerm = make;
      if (params.model) {
        searchTerm += ` ${params.model}`;
      }
      
      // Log model suggestions if available
      if (modelSuggestions.length > 0) {
        console.log(`Using ${modelSuggestions.length} model suggestions for ${make}`);
      }
      
      console.log(`Searching for: ${searchTerm}`);
      console.log(`Rate limiting: ${delayBetweenRequests}ms between requests, ${longPauseDelay}ms pause every ${longPauseInterval} pages`);
      
      // Fetch all requested pages
      for (let page = 1; page <= maxPages; page++) {
        console.log(`Fetching page ${page}/${maxPages}...`);
        
        // Check if we need to take a longer pause
        if (page > 1 && (page - 1) % longPauseInterval === 0) {
          console.log(`Taking a longer pause of ${longPauseDelay/1000} seconds after ${longPauseInterval} pages...`);
          await new Promise(resolve => setTimeout(resolve, longPauseDelay));
        }
        
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
          
          // Save debug response only in development environment
          if (process.env.NODE_ENV === 'development') {
            try {
              const debugFilePath = path.join(this.debugDir, `bat_api_response_page_${page}_${Date.now()}.json`);
              fs.writeFileSync(debugFilePath, JSON.stringify(response.data, null, 2));
            } catch (error) {
              console.error('Error saving debug file:', error);
              // Continue execution even if debug file saving fails
            }
          }
          
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
          const pageListings = this.extractCompletedListingsFromApiData(response.data, make, modelSuggestions);
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
          if (axios.isAxiosError(error) && error.response?.status === 429) {
            console.error(`Rate limit exceeded (429 Too Many Requests) on page ${page}`);
            console.log('Taking a longer pause before retrying...');
            
            // Take a longer pause when we hit rate limits
            await new Promise(resolve => setTimeout(resolve, longPauseDelay * 2));
            
            // Retry the current page
            page--;
            continue;
          }
          
          console.error(`Error fetching page ${page}:`, error);
          console.warn(`Failed to fetch page ${page}, stopping pagination`);
          break;
        }
        
        // Add a delay between requests (except for the last page)
        if (page < maxPages) {
          console.log(`Waiting ${delayBetweenRequests/1000} seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
      }
      
      // Filter by make, model, and year if provided
      const filteredListings = this.filterListings(allListings, params);
      console.log(`All listings ${allListings.length} and filtered ${filteredListings.length} completed auctions`);
      
      if (filteredListings.length > 0) {
        console.log(`First result: ${filteredListings[0].title}`);
      }
      
      return filteredListings;
    } catch (error) {
      console.error('Error scraping BaT completed auctions:', error);
      return [];
    }
  }

  private extractCompletedListingsFromApiData(data: any, make: string = 'Porsche', modelSuggestions: string[] = []): BaTCompletedListing[] {
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
          // Use the improved parseTitle method to extract year, make, and model
          const titleInfo = this.parseTitle(item.title, make, modelSuggestions);
          itemYear = titleInfo.year;
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

  private parseTitle(title: string, make: string = 'Porsche', modelSuggestions: string[] = []): { year?: number; make?: string; model?: string } {
    // Look for a 4-digit year anywhere in the title
    const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
    
    // If no year found, return early
    if (!year) {
      console.log(`Listing ${title} does not have a year`);
      return { year: undefined, make: undefined, model: undefined };
    }
    
    // Look for the make in the title
    const makeIndex = title.indexOf(make);
    if (makeIndex !== -1) {
      // Extract the text after the make
      const afterMake = title.substring(makeIndex + make.length).trim();
      
      // If we have model suggestions, try to find the best match
      if (modelSuggestions.length > 0) {
        // Sort model suggestions by length (descending) to prioritize longer matches
        const sortedSuggestions = [...modelSuggestions].sort((a, b) => b.length - a.length);
        
        // Try to find a model suggestion in the text after the make
        for (const modelSuggestion of sortedSuggestions) {
          if (afterMake.includes(modelSuggestion) || modelSuggestion.includes(afterMake)) {
            return { year, make, model: modelSuggestion };
          } 
        }
      }
      
      // If no model suggestion matched or none were provided, fall back to the original logic
      console.log(`Parsing ${title} cant find model : ${afterMake}`);

      const parts = afterMake.split(/\s+/);
      
      // The model is typically the next word or two after the make
      let model: string | undefined;
      
      if (parts.length > 0) {
        // For Porsche, handle common models with special logic
        if (make === 'Porsche') {
          // Check for common Porsche models
          if (parts[0] === '911' || parts[0] === '356' || parts[0] === '944' || 
              parts[0] === '928' || parts[0] === '968' || parts[0] === '914' || 
              parts[0] === '718' || parts[0] === 'Cayenne' || parts[0] === 'Macan' || 
              parts[0] === 'Panamera' || parts[0] === 'Cayman' || parts[0] === 'Boxster' || 
              parts[0] === 'Taycan') {
            
            // For 911, often include the variant (Carrera, Turbo, etc.)
            if (parts[0] === '911' && parts.length > 1) {
              if (['Carrera', 'Turbo', 'GT3', 'GT2', 'Targa'].includes(parts[1])) {
                // Include the variant in the model
                model = parts[0] + ' ' + parts[1];
                
                // Sometimes there's more specificity (Carrera 4, Turbo S, etc.)
                if (parts.length > 2 && ['4', 'S', 'RS', '4S'].includes(parts[2])) {
                  model += ' ' + parts[2];
                }
              } else {
                model = parts[0];
              }
            } else {
              // For other models, just use the first word
              model = parts[0];
              
              // Add S, Turbo, etc. if present
              if (parts.length > 1 && ['S', 'Turbo', 'GTS', 'GT4'].includes(parts[1])) {
                model += ' ' + parts[1];
              }
            }
          } else {
            // If not a recognized Porsche model, just use the first word
            model = parts[0];
          }
        } else {
          // For other makes, just use the first word as the model
          model = parts[0];
        }
      }
      
      return { year, make, model };
    }
    
    // If we couldn't find the make in the title, just return the year
    return { year, make: undefined, model: undefined };
  }

  private filterListings(listings: BaTCompletedListing[], params: BaTResultsScraperParams): BaTCompletedListing[] {
    // Handle undefined or empty params
    const make = params.make || '';
    const model = params.model || '';
    const yearMin = params.yearMin;
    const yearMax = params.yearMax;
    
    console.log('Filtering listings with params:', { make, model, yearMin, yearMax });
    console.log('First listing before filtering:', listings.length > 0 ? {
      title: listings[0].title,
      make: listings[0].make,
      model: listings[0].model,
      year: listings[0].year
    } : 'No listings');
    
    try {
      return listings.filter(listing => {
        // Filter by year range
        if (yearMin && listing.year && listing.year < yearMin) {
          console.log(`Listing ${listing.title} does not have a year`);
          return false;
        }
        if (yearMax && listing.year && listing.year > yearMax) {
          console.log(`Listing ${listing.title} does not have a year`);
          return false;
        }
        
        // Filter by make (case-insensitive)
        if (make && listing.make) {
          const listingMake = listing.make.toLowerCase();
          const searchMake = make.toLowerCase();
          if (!listingMake.includes(searchMake)) {
            console.log(`Listing ${listing.title} does not match make ${make}`);
            return false;
          }
        } else if (make) {
          console.log(`Listing ${listing.title} does not have a make`);
          // If make is specified but the listing doesn't have a make, exclude it
          return false;
        }
        
        // Filter by model (case-insensitive)
        if (model && listing.model) {
          const listingModel = listing.model.toLowerCase();
          const searchModel = model.toLowerCase();
          if (!listingModel.includes(searchModel) && !searchModel.includes(listingModel)) {
            console.log(`Filtering ${listing.title} does not match model ${model}`);
            return false;
          }
        } else if (model) {
          // If model is specified but the listing doesn't have a model, exclude it
          return false;
        }
        
        return true;
      });
    } catch (error) {
      console.error('Error filtering listings:', error);
      console.error('Error occurred with params:', { make, model, yearMin, yearMax });
      return [];
    }
  }
} 