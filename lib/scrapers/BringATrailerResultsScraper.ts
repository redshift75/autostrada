import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { BaseScraper } from './BaseScraper';

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
}

// Interface for scraper parameters
export interface BaTResultsScraperParams {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  maxPages?: number; // Maximum number of pages to fetch
}

export class BringATrailerResultsScraper extends BaseScraper {
  private baseUrl = 'https://bringatrailer.com/auctions/results/';
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
      const searchUrl = this.buildSearchUrl(params);
      console.log(`Searching for completed auctions at: ${searchUrl}`);
      
      // Fetch first page to get pagination info
      const firstPageHtml = await this.fetchHtml(searchUrl);
      
      // Save debug HTML for first page
      const debugFilePath = path.join(this.debugDir, `bat_results_debug_${Date.now()}.html`);
      fs.writeFileSync(debugFilePath, firstPageHtml);
      console.log(`Debug HTML saved to: ${debugFilePath}`);
      
      // Extract pagination info
      const paginationInfo = this.extractPaginationInfo(firstPageHtml);
      console.log(`Found ${paginationInfo.totalItems} total auctions across ${paginationInfo.totalPages} pages`);
      
      // Determine how many pages to fetch
      const maxPages = params.maxPages || 1;
      const pagesToFetch = Math.min(maxPages, paginationInfo.totalPages);
      
      // Extract listings from first page
      let allListings: BaTCompletedListing[] = this.extractCompletedListings(firstPageHtml, params.make, params.model, params.yearMin);
      
      // Fetch additional pages if needed
      if (pagesToFetch > 1) {
        console.log(`Fetching ${pagesToFetch - 1} additional pages...`);
        
        for (let page = 2; page <= pagesToFetch; page++) {
          console.log(`Fetching page ${page}/${pagesToFetch}...`);
          const pageUrl = this.buildPageUrl(searchUrl, page);
          const pageHtml = await this.fetchHtml(pageUrl);
          
          // Extract listings from this page
          const pageListings = this.extractCompletedListings(pageHtml, params.make, params.model, params.yearMin);
          allListings = [...allListings, ...pageListings];
          
          // Optional: add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
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

  private buildSearchUrl(params: BaTResultsScraperParams): string {
    let url = this.baseUrl;
    
    // Add search parameters
    const searchParams = [];
    if (params.make) {
      searchParams.push(params.make);
    }
    if (params.model) {
      searchParams.push(params.model);
    }
    
    if (searchParams.length > 0) {
      url += `?s=${encodeURIComponent(searchParams.join(' '))}`;
    }
    
    return url;
  }
  
  private buildPageUrl(baseUrl: string, page: number): string {
    // Check if the URL already has query parameters
    const hasParams = baseUrl.includes('?');
    
    // Add page parameter
    if (hasParams) {
      return `${baseUrl}&page=${page}`;
    } else {
      return `${baseUrl}?page=${page}`;
    }
  }
  
  private extractPaginationInfo(html: string): { currentPage: number; totalPages: number; itemsPerPage: number; totalItems: number } {
    try {
      // Extract the auctionsCompletedInitialData from the HTML
      const auctionsDataMatch = html.match(/var\s+auctionsCompletedInitialData\s*=\s*({.*?});/);
      
      if (auctionsDataMatch && auctionsDataMatch[1]) {
        try {
          // Parse the JSON data
          const auctionsData = JSON.parse(auctionsDataMatch[1]);
          
          return {
            currentPage: auctionsData.page_current || 1,
            totalPages: auctionsData.pages_total || 1,
            itemsPerPage: auctionsData.items_per_page || 24,
            totalItems: auctionsData.items_total || 0
          };
        } catch (error) {
          console.error('Error parsing pagination info:', error);
        }
      }
      
      // Default values if we couldn't extract pagination info
      return {
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: 24,
        totalItems: 0
      };
    } catch (error) {
      console.error('Error extracting pagination info:', error);
      return {
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: 24,
        totalItems: 0
      };
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching HTML:', error);
      throw error;
    }
  }

  private extractCompletedListings(html: string, make?: string, model?: string, year?: number): BaTCompletedListing[] {
    try {
      // First, try to extract the auctionsCompletedInitialData from the HTML
      const auctionsDataMatch = html.match(/var\s+auctionsCompletedInitialData\s*=\s*({.*?});/);
      
      if (auctionsDataMatch && auctionsDataMatch[1]) {
        try {
          // Parse the JSON data
          const auctionsData = JSON.parse(auctionsDataMatch[1]);
          
          if (auctionsData && auctionsData.items && Array.isArray(auctionsData.items)) {
            return auctionsData.items.map((item: any) => {
              // Extract year, make, model from title if available
              let itemYear: number | undefined = undefined;
              let itemMake = make;
              let itemModel = model;
              
              if (item.title) {
                // Try to extract year from title (e.g., "2016 Porsche 911 GT3 RS")
                const yearMatch = item.title.match(/^(\d{4})/);
                if (yearMatch) {
                  itemYear = parseInt(yearMatch[1], 10);
                }
              }
              
              // Extract sold price and date from sold_text
              let soldPrice = '';
              let soldDate = '';
              
              if (item.sold_text) {
                const priceMatch = item.sold_text.match(/USD\s+\$([0-9,]+)/);
                if (priceMatch) {
                  soldPrice = priceMatch[1].replace(/,/g, '');
                }
                
                const dateMatch = item.sold_text.match(/on\s+(\d+\/\d+\/\d+)/);
                if (dateMatch) {
                  soldDate = dateMatch[1];
                }
              }
              
              // Determine status (sold or bid to)
              let status = 'unsold';
              if (item.sold_text && item.sold_text.includes('Sold for')) {
                status = 'sold';
              }
              
              return {
                id: item.id?.toString() || '',
                url: item.url || '',
                title: item.title || '',
                image_url: item.thumbnail_url || '',
                sold_price: soldPrice,
                sold_date: soldDate,
                bid_amount: item.current_bid ? item.current_bid.toString() : '',
                bid_date: '',  // Bid date is not directly available in the data
                status: status,
                year: itemYear || (item.year ? parseInt(item.year, 10) : undefined),
                make: itemMake,
                model: itemModel
              };
            });
          }
        } catch (error) {
          console.error('Error parsing auctionsCompletedInitialData:', error);
        }
      }
      
      // If we couldn't extract from the JavaScript data, fall back to HTML parsing
      console.log('Falling back to HTML parsing');
      const $ = cheerio.load(html);
      const listings: BaTCompletedListing[] = [];
      
      // Find all listing cards
      $('.auctions-completed-item').each((_, element) => {
        const $element = $(element);
        const url = $element.find('a.auctions-item-title').attr('href') || '';
        const title = $element.find('a.auctions-item-title').text().trim();
        const id = url.split('/').filter(Boolean).pop() || '';
        const imageUrl = $element.find('img').attr('src') || '';
        
        // Extract sold price and date
        const soldText = $element.find('.sold-text').text().trim();
        let soldPrice = '';
        let soldDate = '';
        let status = 'unsold';
        
        if (soldText) {
          const priceMatch = soldText.match(/USD\s+\$([0-9,]+)/);
          if (priceMatch) {
            soldPrice = priceMatch[1].replace(/,/g, '');
          }
          
          const dateMatch = soldText.match(/on\s+(\d+\/\d+\/\d+)/);
          if (dateMatch) {
            soldDate = dateMatch[1];
          }
          
          if (soldText.includes('Sold for')) {
            status = 'sold';
          }
        }
        
        // Extract bid amount
        const bidText = $element.find('.current-bid').text().trim();
        let bidAmount = '';
        
        if (bidText) {
          const bidMatch = bidText.match(/\$([0-9,]+)/);
          if (bidMatch) {
            bidAmount = bidMatch[1].replace(/,/g, '');
          }
        }
        
        // Extract year from title
        let itemYear: number | undefined = undefined;
        const yearMatch = title.match(/^(\d{4})/);
        if (yearMatch) {
          itemYear = parseInt(yearMatch[1], 10);
        }
        
        // Filter by year if provided
        if (year && itemYear !== year) {
          return;
        }
        
        listings.push({
          id,
          url,
          title,
          image_url: imageUrl,
          sold_price: soldPrice,
          sold_date: soldDate,
          bid_amount: bidAmount,
          bid_date: '',
          status,
          year: itemYear,
          make,
          model
        });
      });
      
      return listings;
    } catch (error) {
      console.error('Error extracting completed listings:', error);
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