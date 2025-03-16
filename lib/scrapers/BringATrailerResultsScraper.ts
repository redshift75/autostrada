import axios from 'axios';
import '../server-only';
import { BaseBATScraper } from './BaseBATScraper';
import { extractMileageFromTitle, fetchDetailsFromListingPage } from '../utils/BATDetailsExtractor';
import { parseTitle } from '../utils/BaTScraperUtils';

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
  mileage?: number;
  bidders?: number;
  watchers?: number;
  comments?: number;
  transmission?: string;
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
  recency?: string;
  delayBetweenRequests?: number; // Delay between requests in milliseconds
  longPauseInterval?: number; // Number of pages after which to take a longer pause
  longPauseDelay?: number; // Duration of the longer pause in milliseconds
  modelSuggestions?: string[]; // List of model suggestions for the specified make
  transmission?: string; // Add transmission parameter
}

export class BringATrailerResultsScraper extends BaseBATScraper {
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
      const delayBetweenRequests = params.delayBetweenRequests || 100; // 0.1seconds between requests
      const longPauseInterval = params.longPauseInterval || 100; // Pause every 100 pages
      const longPauseDelay = params.longPauseDelay || 10000; // 10 seconds for long pause
      
      // Prepare search term based on make and model
      let searchTerm = make;
      if (params.model) {
        searchTerm += ` ${params.model}`;
      }
      
      console.log(`Rate limiting: ${delayBetweenRequests}ms between requests, ${longPauseDelay}ms pause every ${longPauseInterval} pages`);
      
      // Fetch all requested pages
      for (let page = 1; page <= maxPages; page++) {
        console.log(`Fetching page ${page}/${maxPages}...`);
        
        try {
          // Prepare request data
          const requestData: any = {
            page: page,
            per_page: perPage,
            get_items: 1,
            get_stats: 0,
            include_s: searchTerm,
            minimum_year: params.yearMin,
            maximum_year: params.yearMax
          };

          // Add recency filter if provided
          if (params.recency) {
            requestData.recency = params.recency;
          }
          
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
          const pageListings = await this.extractCompletedListingsFromApiData(response.data, make, modelSuggestions);
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
            await new Promise(resolve => setTimeout(resolve, longPauseDelay));
            
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
      
      return filteredListings;
    } catch (error) {
      console.error('Error scraping BaT completed auctions:', error);
      return [];
    }
  }

  private async extractCompletedListingsFromApiData(data: any, make: string = 'Porsche', modelSuggestions: string[] = []): Promise<BaTCompletedListing[]> {
    try {
      if (!data || !data.items || !Array.isArray(data.items)) {
        return [];
      }
      
      // Process items in batches to avoid overwhelming the server
      const batchSize = 50; // Process 5 items at a time
      const delayBetweenBatches = 50; // between batches
      const results: BaTCompletedListing[] = [];
      
      // Group items into batches
      const batches: any[][] = [];
      for (let i = 0; i < data.items.length; i += batchSize) {
        batches.push(data.items.slice(i, i + batchSize));
      }
      
      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);
        
        // Process all items in the current batch in parallel
        const batchPromises = batch.map(async (item: any) => {
          // Extract year, make, model from title if available
          let itemYear: number | undefined = undefined;
          let itemMake: string | undefined = undefined;
          let itemModel: string | undefined = undefined;
          
          if (item.title) {
            // Use the shared parseTitle method to extract year, make, and model
            const titleInfo = parseTitle(item.title, make, modelSuggestions);
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
          
          // Extract mileage from title
          let mileage = undefined;
          if (item.title) {
            mileage = extractMileageFromTitle(item.title);
          }
          
          // If mileage not found in title and we have a URL, try to fetch it from the listing page
          if (item.url) {
            try {
              const listingData = await fetchDetailsFromListingPage(item.url);
              mileage = listingData.mileage;
              
              // Store the additional details
              item.bidders = listingData.bidders;
              item.watchers = listingData.watchers;
              item.comments = listingData.comments;
              item.transmission = listingData.transmission;
            } catch (error) {
              console.error(`Error fetching details for ${item.title}:`, error);
            }
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
            mileage: mileage,
            transmission: item.transmission || undefined,
            bidders: item.bidders || 0,
            watchers: item.watchers || 0,
            comments: item.comments || 0,
            images: images
          };
        });
        
        // Wait for all items in the current batch to be processed
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add a delay between batches (except for the last batch)
        if (batchIndex < batches.length - 1) {
          console.log(`Waiting ${delayBetweenBatches/1000} seconds before processing next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error extracting listings from API data:', error);
      return [];
    }
  }

  private filterListings(listings: BaTCompletedListing[], params: BaTResultsScraperParams): BaTCompletedListing[] {
    return listings.filter(listing => {
      // Extract year, make, and model from the title if not already present
      const { year, make, model } = parseTitle(listing.title);
      
      // Apply year filter if provided
      if (params.yearMin && year && year < params.yearMin) return false;
      if (params.yearMax && year && year > params.yearMax) return false;
      
      // Apply make filter if provided
      if (params.make && make && !make.toLowerCase().includes(params.make.toLowerCase())) return false;
      
      // Apply model filter if provided
      if (params.model && model && !model.toLowerCase().includes(params.model.toLowerCase())) return false;
      
      // Apply transmission filter if provided
      if (params.transmission && params.transmission !== 'Any') {
        const transmissionLower = params.transmission.toLowerCase();
        const listingTrans = listing.transmission?.toLowerCase() || '';
        if (!listingTrans.includes(transmissionLower)) return false;
      }
      
      return true;
    });
  }
} 