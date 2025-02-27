/**
 * Bring a Trailer Scraper
 * 
 * This scraper collects data from Bring a Trailer (bringatrailer.com),
 * a popular auction platform for classic and enthusiast vehicles.
 */

import { BaseScraper, ScraperConfig } from './BaseScraper';
import { ListingSource } from '../standardization/listingData';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaTListing } from '../types/BaTListing';

// Types for scraper parameters
export interface BaTScraperParams {
  // Search parameters
  query?: string;
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  categoryId?: string;
  
  // Pagination
  page?: number;
  limit?: number;
  
  // Sorting
  sort?: 'ending-soon' | 'ending-latest' | 'newest-listings' | 'most-bids' | 'most-comments' | 'price-highest' | 'price-lowest';
  
  // Filtering
  status?: 'active' | 'ended' | 'all';
  
  // Specific listing ID to fetch details
  listingId?: string;
}

interface BaTAuction {
  id: number;
  title: string;
  year: string;
  make?: string;
  model?: string;
  url: string;
  thumbnail_url: string;
  current_bid: number;
  current_bid_formatted: string;
  timestamp_end: number;
  sold_text: string;
  excerpt: string;
  country: string;
  active: boolean;
  image_url_thumb?: string;
  location?: string;
  seller_username?: string;
  seller_id?: string;
  sold_price?: number;
  reserve_met?: boolean;
  reserve_not_met?: boolean;
  no_reserve?: boolean;
  premium?: boolean;
  featured?: boolean;
  status?: string;
}

interface BaTAuctionsData {
  auctions: BaTAuction[];
  locations: { id: string; title: string }[];
}

export class BringATrailerScraper extends BaseScraper {
  private readonly BASE_URL = 'https://bringatrailer.com';
  private readonly API_URL = 'https://bringatrailer.com/wp-json/bat/v1';
  
  constructor(config: ScraperConfig = {}) {
    super({
      // Override default config with BaT-specific settings
      requestsPerMinute: 20, // Be conservative with BaT
      cacheDir: '.cache/bring-a-trailer',
      ...config
    });
  }
  
  /**
   * Main scrape method - entry point for scraping BaT
   */
  async scrape(params: BaTScraperParams = {}): Promise<BaTListing[]> {
    // If a specific listing ID is provided, fetch just that listing
    if (params.listingId) {
      const listing = await this.scrapeListing(params.listingId);
      return listing ? [listing] : [];
    }
    
    // Otherwise, search for listings
    return this.searchListings(params);
  }
  
  /**
   * Search for listings based on parameters
   */
  private async searchListings(params: BaTScraperParams): Promise<BaTListing[]> {
    // Build the search URL
    const searchUrl = this.buildSearchUrl(params);
    
    try {
      // Fetch the search results page
      const response = await this.fetch(searchUrl);
      const html = await response.text();
      
      // Extract the auctionsCurrentInitialData JavaScript variable
      const auctionsData = this.extractAuctionsData(html);
      
      if (!auctionsData || !auctionsData.auctions || !Array.isArray(auctionsData.auctions)) {
        this.log('error', 'Failed to extract auctions data from the page');
        return [];
      }
      
      // Convert the auctions data to BaTListing objects
      const listings: BaTListing[] = auctionsData.auctions.map(auction => this.convertAuctionToBaTListing(auction));
      
      // Apply limit if specified
      if (params.limit && listings.length > params.limit) {
        return listings.slice(0, params.limit);
      }
      
      return listings;
    } catch (error) {
      this.log('error', `Failed to search listings: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Extract the auctionsCurrentInitialData JavaScript variable from the HTML
   */
  private extractAuctionsData(html: string): BaTAuctionsData | null {
    try {
      // Save the HTML for debugging
      const debugDir = path.join(process.cwd(), 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const debugFilePath = path.join(debugDir, `bat_debug_${Date.now()}.json`);
      
      // Look for the JSON data in the HTML
      // The data appears to be directly embedded in the HTML as a JavaScript object
      // We need to extract it and parse it as JSON
      
      // First, let's try to find the JSON data by looking for a pattern like:
      // auctions:[{...}],locations:[{...}]
      const jsonRegex = /\{[\s\S]*?"auctions":\s*?\[([\s\S]*?)\],\s*?"locations":\s*?\[([\s\S]*?)\]\}/;
      const match = html.match(jsonRegex);
      
      if (match) {
        // We found the JSON data
        // Now we need to reconstruct it into a valid JSON object
        const jsonStr = `{"auctions":[${match[1]}],"locations":[${match[2]}]}`;
        
        try {
          // Parse the JSON
          const data = JSON.parse(jsonStr);
          
          // Save the extracted JSON for debugging
          fs.writeFileSync(debugFilePath, JSON.stringify(data, null, 2));
          
          return data as BaTAuctionsData;
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          
          // Save the extracted string for debugging
          fs.writeFileSync(debugFilePath, jsonStr);
          
          return null;
        }
      }
      
      // If we couldn't find the data with the regex, try using cheerio to parse the HTML
      const $ = cheerio.load(html);
      
      // Look for script tags that might contain the data
      let scriptContent = '';
      $('script').each((i: number, script: any) => {
        const content = $(script).html() || '';
        if (content && content.includes('"auctions":') && content.includes('"locations":')) {
          scriptContent = content;
          return false; // Break the loop
        }
      });
      
      if (scriptContent) {
        // Try to extract the JSON object from the script content
        const jsonMatch = scriptContent.match(/\{[\s\S]*?"auctions":\s*?\[([\s\S]*?)\],\s*?"locations":\s*?\[([\s\S]*?)\]\}/);
        
        if (jsonMatch) {
          const jsonStr = `{"auctions":[${jsonMatch[1]}],"locations":[${jsonMatch[2]}]}`;
          
          try {
            // Parse the JSON
            const data = JSON.parse(jsonStr);
            
            // Save the extracted JSON for debugging
            fs.writeFileSync(debugFilePath, JSON.stringify(data, null, 2));
            
            return data as BaTAuctionsData;
          } catch (parseError) {
            console.error('Error parsing JSON from script tag:', parseError);
            
            // Save the extracted string for debugging
            fs.writeFileSync(debugFilePath, jsonStr);
            
            return null;
          }
        }
      }
      
      // If we still couldn't find the data, save the HTML for debugging
      fs.writeFileSync(debugFilePath.replace('.json', '.html'), html);
      console.log(`Saved HTML to ${debugFilePath.replace('.json', '.html')} for debugging`);
      
      return null;
    } catch (error) {
      this.log('error', `Failed to extract auctions data: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Convert an auction object from auctionsCurrentInitialData to a BaTListing
   */
  private convertAuctionToBaTListing(auction: BaTAuction): BaTListing {
    // Extract make and model from title if not provided
    let make = auction.make || '';
    let model = auction.model || '';
    
    if (!make || !model) {
      const titleParts = auction.title.split(' ');
      if (titleParts.length >= 3) {
        // Assuming format is "YEAR MAKE MODEL"
        make = titleParts[1];
        model = titleParts.slice(2).join(' ');
      }
    }
    
    // Convert timestamp to date
    const endDate = new Date(auction.timestamp_end * 1000);
    
    // Parse current bid
    const currentBid = typeof auction.current_bid === 'number' ? auction.current_bid : 0;
    
    return {
      id: auction.id.toString(),
      title: auction.title,
      make: make,
      model: model,
      year: parseInt(auction.year) || 0,
      url: auction.url.startsWith('http') ? auction.url : `${this.BASE_URL}${auction.url}`,
      imageUrl: auction.thumbnail_url,
      description: auction.excerpt || '',
      price: currentBid,
      currency: 'USD',
      location: auction.country || 'United States',
      endDate: endDate,
      source: 'bring-a-trailer',
      status: auction.active ? 'active' : 'ended',
      
      // Additional fields
      currentBid,
      soldPrice: auction.sold_price || 0,
      isEnded: !auction.active,
      isSold: !!auction.sold_text,
      bidCount: 0,
      sellerUsername: auction.seller_username || '',
      comments: 0,
      views: 0,
      watches: 0,
      
      additionalInfo: {
        sold: !!auction.sold_text,
        soldPrice: auction.sold_price || 0,
        noReserve: auction.no_reserve || false,
        premium: auction.premium || false,
        featured: auction.featured || false
      }
    };
  }
  
  /**
   * Scrape a specific listing by ID
   */
  private async scrapeListing(listingId: string): Promise<BaTListing | null> {
    const url = `${this.BASE_URL}/listing/${listingId}/`;
    
    try {
      // Fetch the listing page
      const response = await this.fetch(url);
      const html = await response.text();
      
      // Try to extract from auctionsCurrentInitialData first
      const auctionsData = this.extractAuctionsData(html);
      if (auctionsData && auctionsData.auctions && auctionsData.auctions.length > 0) {
        return this.convertAuctionToBaTListing(auctionsData.auctions[0]);
      }
      
      // Fallback to extracting from HTML
      const document = this.parseHTML(html);
      return this.extractListingDetails(document, listingId, url);
    } catch (error) {
      this.log('error', `Failed to scrape listing ${listingId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Build the search URL based on parameters
   */
  private buildSearchUrl(params: BaTScraperParams): string {
    const url = new URL(`${this.BASE_URL}/auctions/`);
    
    // Add search parameters
    if (params.query) {
      url.searchParams.append('s', params.query);
    }
    
    if (params.make) {
      url.searchParams.append('make', params.make);
    }
    
    if (params.model) {
      url.searchParams.append('model', params.model);
    }
    
    if (params.yearFrom) {
      url.searchParams.append('year_min', params.yearFrom.toString());
    }
    
    if (params.yearTo) {
      url.searchParams.append('year_max', params.yearTo.toString());
    }
    
    if (params.categoryId) {
      url.searchParams.append('category', params.categoryId);
    }
    
    if (params.page && params.page > 1) {
      url.searchParams.append('paged', params.page.toString());
    }
    
    if (params.sort) {
      url.searchParams.append('sort', params.sort);
    }
    
    if (params.status && params.status !== 'all') {
      url.searchParams.append('status', params.status);
    }
    
    return url.toString();
  }
  
  /**
   * Extract detailed listing information from a listing page
   * This is a fallback method if we can't extract from auctionsCurrentInitialData
   */
  private extractListingDetails(document: Document, listingId: string, url: string): BaTListing | null {
    try {
      // Extract title
      const titleElement = document.querySelector('.post-title');
      const title = titleElement?.textContent?.trim() || '';
      
      // Extract main image URL
      const imageElement = document.querySelector('.post-image img');
      const imageUrl = imageElement?.getAttribute('src') || '';
      
      // Extract year, make, model from title
      const { year, make, model } = this.extractVehicleInfoFromTitle(title);
      
      // Extract bid information
      const bidElement = document.querySelector('.listing-available-bid-value, .listing-bid-value');
      const bidText = bidElement?.textContent?.trim() || '';
      const currentBid = this.extractBidAmount(bidText);
      
      // Extract bid count
      const bidCountElement = document.querySelector('.listing-bid-count');
      const bidCountText = bidCountElement?.textContent?.trim() || '';
      const bidCount = bidCountText ? parseInt(bidCountText.replace(/\D/g, ''), 10) : undefined;
      
      // Extract end date
      const timeElement = document.querySelector('.listing-available-countdown, .listing-ended-date');
      const timeText = timeElement?.textContent?.trim() || '';
      const endDate = this.parseEndDate(timeText);
      
      // Determine if the listing has ended
      const isEnded = document.querySelector('.listing-ended-date') !== null;
      
      // Determine if the listing was sold
      const soldElement = document.querySelector('.listing-available-sold, .listing-essentials-price');
      const isSold = soldElement !== null;
      
      // Extract sold price if available
      let soldPrice: number | undefined;
      if (isSold) {
        const soldText = soldElement?.textContent?.trim() || '';
        soldPrice = this.extractBidAmount(soldText);
      }
      
      // Extract location
      const locationElement = document.querySelector('.listing-essentials-item-location');
      const location = locationElement?.textContent?.trim() || undefined;
      
      // Extract seller username
      const sellerElement = document.querySelector('.listing-essentials-item-seller');
      const sellerUsername = sellerElement?.textContent?.trim() || undefined;
      
      // Extract description
      const descriptionElement = document.querySelector('.listing-description-content');
      const description = descriptionElement?.textContent?.trim() || undefined;
      
      // Extract comment count
      const commentsElement = document.querySelector('.listing-stats-comments');
      const commentsText = commentsElement?.textContent?.trim() || '';
      const comments = commentsText ? parseInt(commentsText.replace(/\D/g, ''), 10) : undefined;
      
      // Extract view count
      const viewsElement = document.querySelector('.listing-stats-views');
      const viewsText = viewsElement?.textContent?.trim() || '';
      const views = viewsText ? parseInt(viewsText.replace(/\D/g, ''), 10) : undefined;
      
      // Extract watch count
      const watchesElement = document.querySelector('.listing-stats-watches');
      const watchesText = watchesElement?.textContent?.trim() || '';
      const watches = watchesText ? parseInt(watchesText.replace(/\D/g, ''), 10) : undefined;
      
      return {
        id: listingId,
        title,
        url,
        imageUrl,
        year,
        make,
        model,
        currentBid,
        bidCount,
        endDate,
        isEnded,
        isSold,
        soldPrice,
        location,
        sellerUsername,
        description,
        comments,
        views,
        watches,
        source: 'bring-a-trailer',
        status: isEnded ? (isSold ? 'sold' : 'ended_no_sale') : 'active',
        additionalInfo: {
          sold: isSold,
          soldPrice: soldPrice || 0,
          noReserve: false,
          premium: false,
          featured: false
        }
      };
    } catch (error) {
      this.log('warn', `Failed to extract listing details: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Extract year, make, and model from a listing title
   */
  private extractVehicleInfoFromTitle(title: string): { year?: number; make?: string; model?: string } {
    // Common pattern: "YEAR Make Model"
    const match = title.match(/^(\d{4})\s+([A-Za-z\-]+)(?:\s+(.+))?/);
    
    if (match) {
      const year = parseInt(match[1], 10);
      const make = match[2].trim();
      const model = match[3]?.trim();
      
      return {
        year: isNaN(year) ? undefined : year,
        make: make || undefined,
        model: model || undefined
      };
    }
    
    return {};
  }
  
  /**
   * Extract bid amount from a string
   */
  private extractBidAmount(text: string): number | undefined {
    // Remove non-numeric characters except for decimal point
    const numericText = text.replace(/[^0-9.]/g, '');
    const amount = parseFloat(numericText);
    
    return isNaN(amount) ? undefined : amount;
  }
  
  /**
   * Parse end date from a string
   */
  private parseEndDate(text: string): Date | undefined {
    if (!text) return undefined;
    
    // Handle "Ends in X days, Y hours" format
    const endsInMatch = text.match(/Ends in (\d+) days?, (\d+) hours?/i);
    if (endsInMatch) {
      const days = parseInt(endsInMatch[1], 10);
      const hours = parseInt(endsInMatch[2], 10);
      
      const date = new Date();
      date.setDate(date.getDate() + days);
      date.setHours(date.getHours() + hours);
      
      return date;
    }
    
    // Handle "Ends in X hours, Y minutes" format
    const endsInHoursMatch = text.match(/Ends in (\d+) hours?, (\d+) minutes?/i);
    if (endsInHoursMatch) {
      const hours = parseInt(endsInHoursMatch[1], 10);
      const minutes = parseInt(endsInHoursMatch[2], 10);
      
      const date = new Date();
      date.setHours(date.getHours() + hours);
      date.setMinutes(date.getMinutes() + minutes);
      
      return date;
    }
    
    // Handle "Ended Month Day, Year" format
    const endedMatch = text.match(/Ended ([A-Za-z]+ \d+, \d{4})/i);
    if (endedMatch) {
      return new Date(endedMatch[1]);
    }
    
    // Handle "Sold on Month Day, Year" format
    const soldMatch = text.match(/Sold on ([A-Za-z]+ \d+, \d{4})/i);
    if (soldMatch) {
      return new Date(soldMatch[1]);
    }
    
    return undefined;
  }
  
  /**
   * Convert BaT listing to standardized format
   */
  public convertToStandardFormat(listing: BaTListing): any {
    return {
      source: ListingSource.BRING_A_TRAILER,
      sourceId: listing.id,
      sourceUrl: listing.url,
      title: listing.title,
      price: listing.currentBid,
      soldPrice: listing.soldPrice,
      currency: 'USD',
      listingDate: undefined, // BaT doesn't provide listing start date
      endDate: listing.endDate,
      status: listing.isEnded ? (listing.isSold ? 'sold' : 'ended_no_sale') : 'active',
      bidCount: listing.bidCount,
      description: listing.description,
      location: listing.location,
      sellerUsername: listing.sellerUsername,
      vehicle: {
        year: listing.year,
        make: listing.make,
        model: listing.model
      },
      images: listing.imageUrl ? [{ url: listing.imageUrl, isPrimary: true }] : [],
      metadata: {
        comments: listing.comments,
        views: listing.views,
        watches: listing.watches
      }
    };
  }
} 