/**
 * Scraper Manager
 * 
 * This class manages all the different scrapers and provides a unified interface
 * for scraping data from multiple sources.
 */

import { ScraperConfig } from './BaseBATScraper';
import { BringATrailerResultsScraper, BaTResultsScraperParams as BaTScraperParams } from './BringATrailerResultsScraper';

// Types for scraper manager configuration
export interface ScraperManagerConfig {
  globalConfig?: ScraperConfig;
  sourceConfigs?: Partial<Record<string, ScraperConfig>>;
}

// Types for search parameters
export interface SearchParams {
  query?: string;
  make?: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  limit?: number;
}

export class ScraperManager {
  private scraper: BringATrailerResultsScraper = new BringATrailerResultsScraper();
  private config: ScraperManagerConfig;
  
  constructor(config: ScraperManagerConfig = {}) {
    this.config = config;
  }
  
  /**
   * Get the configuration for the scraper
   */
  private getScraperConfig(): ScraperConfig {
    return {
      ...this.config.globalConfig,
      ...this.config.sourceConfigs?.['bringATrailer']
    };
  }
  
  /**
   * Search for listings
   */
  public async search(params: SearchParams): Promise<any[]> {
    try {
      // Convert generic search params to BaT-specific params
      const batParams: BaTScraperParams = {
        make: params.make,
        model: params.model,
        yearMin: params.yearFrom,
        yearMax: params.yearTo
      };
      
      // Scrape Bring a Trailer
      const results = await this.scraper.scrape(batParams);
      
      // For now, just return the results as-is
      // In the future, we can add standardization here
      return results;
    } catch (error) {
      console.error('Error scraping Bring a Trailer:', error);
      return [];
    }
  }
  
  /**
   * Clean up the scraper
   */
  public async cleanup(): Promise<void> {
    await this.scraper.cleanup();
  }
} 