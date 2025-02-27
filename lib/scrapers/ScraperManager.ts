/**
 * Scraper Manager
 * 
 * This class manages all the different scrapers and provides a unified interface
 * for scraping data from multiple sources.
 */

import { BaseScraper, ScraperConfig } from './BaseScraper';
import { BringATrailerScraper, BaTScraperParams } from './BringATrailerScraperNew';
import { BaTListing } from './BringATrailerScraperNew';
import { ListingSource } from '../standardization/listingData';

// Types for scraper manager configuration
export interface ScraperManagerConfig {
  globalConfig?: ScraperConfig;
  sourceConfigs?: Partial<Record<ListingSource, ScraperConfig>>;
}

// Types for search parameters
export interface SearchParams {
  query?: string;
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  limit?: number;
  sources?: ListingSource[];
}

export class ScraperManager {
  private scrapers: Map<ListingSource, BaseScraper> = new Map();
  private config: ScraperManagerConfig;
  
  constructor(config: ScraperManagerConfig = {}) {
    this.config = config;
    this.initializeScrapers();
  }
  
  /**
   * Initialize all scrapers
   */
  private initializeScrapers(): void {
    // Initialize Bring a Trailer scraper
    this.registerScraper(
      ListingSource.BRING_A_TRAILER,
      new BringATrailerScraper()
    );
    
    // Add more scrapers here as they are implemented
    // this.registerScraper(ListingSource.RM_SOTHEBYS, new RMSothebyScraper(...));
    // this.registerScraper(ListingSource.GOODING, new GoodingScraper(...));
    // etc.
  }
  
  /**
   * Register a scraper for a specific source
   */
  public registerScraper(source: ListingSource, scraper: BaseScraper): void {
    this.scrapers.set(source, scraper);
  }
  
  /**
   * Get a scraper for a specific source
   */
  public getScraper(source: ListingSource): BaseScraper | undefined {
    return this.scrapers.get(source);
  }
  
  /**
   * Get the configuration for a specific scraper
   */
  private getScraperConfig(source: ListingSource): ScraperConfig {
    return {
      ...this.config.globalConfig,
      ...this.config.sourceConfigs?.[source]
    };
  }
  
  /**
   * Search for listings across all sources or specific sources
   */
  public async search(params: SearchParams): Promise<any[]> {
    const results: any[] = [];
    const sources = params.sources || Array.from(this.scrapers.keys());
    
    // Create an array of promises for each source
    const promises = sources.map(async (source) => {
      const scraper = this.scrapers.get(source);
      if (!scraper) return [];
      
      try {
        // Convert generic search params to source-specific params
        const sourceParams = this.convertToSourceParams(source, params);
        
        // Scrape the source
        const sourceResults = await scraper.scrape(sourceParams);
        
        // For now, just return the results as-is
        // In the future, we can add standardization here
        return sourceResults;
      } catch (error) {
        console.error(`Error scraping ${source}:`, error);
        return [];
      }
    });
    
    // Wait for all promises to resolve
    const resultsArrays = await Promise.all(promises);
    
    // Flatten the results
    for (const resultsArray of resultsArrays) {
      results.push(...resultsArray);
    }
    
    return results;
  }
  
  /**
   * Convert generic search params to source-specific params
   */
  private convertToSourceParams(source: ListingSource, params: SearchParams): any {
    switch (source) {
      case ListingSource.BRING_A_TRAILER:
        // Convert to BaT-specific params
        const batParams: BaTScraperParams = {
          make: params.make,
          model: params.model,
          yearMin: params.yearFrom,
          yearMax: params.yearTo
        };
        return batParams;
      
      // Add more cases for other sources as they are implemented
      
      default:
        // Return the params as-is for unknown sources
        return params;
    }
  }
  
  /**
   * Clean up all scrapers
   */
  public async cleanup(): Promise<void> {
    const promises = Array.from(this.scrapers.values()).map(scraper => scraper.cleanup());
    await Promise.all(promises);
  }
} 