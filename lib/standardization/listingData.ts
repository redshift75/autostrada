/**
 * Listing Data Standardization Utilities
 * 
 * This module provides functions for normalizing and standardizing listing data
 * from different auction platforms and listing sites.
 */

import { z } from 'zod';
import { normalizePrice, normalizeVehicle } from './vehicleAttributes';

// Standard listing sources
export enum ListingSource {
  BRING_A_TRAILER = 'Bring a Trailer',
  RM_SOTHEBYS = 'RM Sotheby\'s',
  GOODING = 'Gooding & Company',
  BONHAMS = 'Bonhams',
  MECUM = 'Mecum',
  BARRETT_JACKSON = 'Barrett-Jackson',
  DUPONT_REGISTRY = 'DuPont Registry',
  AUTOTRADER = 'AutoTrader',
  HEMMINGS = 'Hemmings',
  CLASSIC_CARS = 'ClassicCars.com',
  CLASSIC_DRIVER = 'Classic Driver',
  CARS_AND_BIDS = 'Cars & Bids',
  COLLECTING_CARS = 'Collecting Cars',
  EBAY = 'eBay',
  OTHER = 'Other'
}

// Standard listing status
export enum ListingStatus {
  ACTIVE = 'Active',
  SOLD = 'Sold',
  ENDED_NO_SALE = 'Ended (No Sale)',
  WITHDRAWN = 'Withdrawn',
  COMING_SOON = 'Coming Soon'
}

// Standard auction/sale types
export enum SaleType {
  AUCTION = 'Auction',
  CLASSIFIED = 'Classified',
  DEALER = 'Dealer',
  PRIVATE_PARTY = 'Private Party'
}

/**
 * Normalize listing source to a standard format
 * 
 * @param source - The source to normalize
 * @returns Normalized source name
 */
export function normalizeSource(source: string): string {
  if (!source) return ListingSource.OTHER;
  
  const lowerSource = source.toLowerCase().trim();
  
  // Map common source variations to standard sources
  if (/bring\s*a\s*trailer|bat/i.test(lowerSource)) {
    return ListingSource.BRING_A_TRAILER;
  } else if (/rm\s*sotheby'?s|rms|rm\s*auctions/i.test(lowerSource)) {
    return ListingSource.RM_SOTHEBYS;
  } else if (/gooding|gooding\s*&\s*co/i.test(lowerSource)) {
    return ListingSource.GOODING;
  } else if (/bonhams/i.test(lowerSource)) {
    return ListingSource.BONHAMS;
  } else if (/mecum/i.test(lowerSource)) {
    return ListingSource.MECUM;
  } else if (/barrett[\s-]*jackson|barrett/i.test(lowerSource)) {
    return ListingSource.BARRETT_JACKSON;
  } else if (/dupont|du\s*pont/i.test(lowerSource)) {
    return ListingSource.DUPONT_REGISTRY;
  } else if (/autotrader|auto\s*trader/i.test(lowerSource)) {
    return ListingSource.AUTOTRADER;
  } else if (/hemmings/i.test(lowerSource)) {
    return ListingSource.HEMMINGS;
  } else if (/classiccars\.com|classic\s*cars/i.test(lowerSource)) {
    return ListingSource.CLASSIC_CARS;
  } else if (/classic\s*driver/i.test(lowerSource)) {
    return ListingSource.CLASSIC_DRIVER;
  } else if (/cars\s*&\s*bids|cars\s*and\s*bids|carsandbids/i.test(lowerSource)) {
    return ListingSource.CARS_AND_BIDS;
  } else if (/collecting\s*cars/i.test(lowerSource)) {
    return ListingSource.COLLECTING_CARS;
  } else if (/ebay/i.test(lowerSource)) {
    return ListingSource.EBAY;
  }
  
  return ListingSource.OTHER;
}

/**
 * Normalize listing status to a standard format
 * 
 * @param status - The status to normalize
 * @returns Normalized status
 */
export function normalizeStatus(status: string): string {
  if (!status) return '';
  
  const lowerStatus = status.toLowerCase().trim();
  
  if (/active|live|current|ongoing|open/i.test(lowerStatus)) {
    return ListingStatus.ACTIVE;
  } else if (/sold|completed|finished|ended.*sold|success/i.test(lowerStatus)) {
    return ListingStatus.SOLD;
  } else if (/no\s*sale|not\s*sold|ended.*no.*sale|reserve\s*not\s*met|rnm/i.test(lowerStatus)) {
    return ListingStatus.ENDED_NO_SALE;
  } else if (/withdrawn|canceled|cancelled|removed/i.test(lowerStatus)) {
    return ListingStatus.WITHDRAWN;
  } else if (/coming\s*soon|scheduled|upcoming|preview/i.test(lowerStatus)) {
    return ListingStatus.COMING_SOON;
  }
  
  return ListingStatus.ACTIVE; // Default to active if unknown
}

/**
 * Normalize sale type to a standard format
 * 
 * @param saleType - The sale type to normalize
 * @returns Normalized sale type
 */
export function normalizeSaleType(saleType: string): string {
  if (!saleType) return '';
  
  const lowerType = saleType.toLowerCase().trim();
  
  if (/auction/i.test(lowerType)) {
    return SaleType.AUCTION;
  } else if (/classified|listing/i.test(lowerType)) {
    return SaleType.CLASSIFIED;
  } else if (/dealer|dealership/i.test(lowerType)) {
    return SaleType.DEALER;
  } else if (/private|individual|owner/i.test(lowerType)) {
    return SaleType.PRIVATE_PARTY;
  }
  
  return SaleType.CLASSIFIED; // Default to classified if unknown
}

/**
 * Extract auction/listing date from various date formats
 * 
 * @param dateStr - The date string to parse
 * @returns Normalized Date object, or null if invalid
 */
export function normalizeListingDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try parsing the date directly
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Try various date formats
  const formats = [
    // MM/DD/YYYY
    {
      regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      fn: (m: RegExpMatchArray) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]))
    },
    // MM-DD-YYYY
    {
      regex: /(\d{1,2})-(\d{1,2})-(\d{4})/,
      fn: (m: RegExpMatchArray) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]))
    },
    // YYYY/MM/DD
    {
      regex: /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
      fn: (m: RegExpMatchArray) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    },
    // YYYY-MM-DD
    {
      regex: /(\d{4})-(\d{1,2})-(\d{1,2})/,
      fn: (m: RegExpMatchArray) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    },
    // Month DD, YYYY
    {
      regex: /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})/,
      fn: (m: RegExpMatchArray) => {
        const months: Record<string, number> = {
          'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
          'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7,
          'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        const month = months[m[1].toLowerCase()];
        return month !== undefined ? new Date(parseInt(m[3]), month, parseInt(m[2])) : null;
      }
    }
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format.regex);
    if (match) {
      const parsedDate = format.fn(match);
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
  }
  
  return null;
}

/**
 * Extract bid count from various formats
 * 
 * @param bidCountStr - The bid count string to parse
 * @returns Normalized bid count as a number, or null if invalid
 */
export function normalizeBidCount(bidCountStr: string | number): number | null {
  if (bidCountStr === null || bidCountStr === undefined) return null;
  
  // If it's already a number, just return it
  if (typeof bidCountStr === 'number') {
    return bidCountStr >= 0 ? Math.floor(bidCountStr) : null;
  }
  
  // Convert to string and clean up
  const cleanStr = bidCountStr.trim().toLowerCase()
    .replace(/,/g, '')
    .replace(/bids?/i, '')
    .replace(/offers?/i, '')
    .trim();
  
  // Try to parse as a number
  const count = parseInt(cleanStr, 10);
  
  return !isNaN(count) && count >= 0 ? count : null;
}

/**
 * Normalize a complete listing object by standardizing all attributes
 * 
 * @param listing - The listing object to normalize
 * @returns A new object with normalized attributes
 */
export function normalizeListing(listing: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...listing };
  
  // Apply normalization to each field if present
  if ('source' in listing) {
    normalized.source = normalizeSource(listing.source);
  }
  
  if ('status' in listing) {
    normalized.status = normalizeStatus(listing.status);
  }
  
  if ('saleType' in listing) {
    normalized.saleType = normalizeSaleType(listing.saleType);
  }
  
  if ('listingDate' in listing) {
    normalized.listingDate = normalizeListingDate(listing.listingDate);
  }
  
  if ('endDate' in listing) {
    normalized.endDate = normalizeListingDate(listing.endDate);
  }
  
  if ('price' in listing) {
    normalized.price = normalizePrice(listing.price);
  }
  
  if ('bidCount' in listing) {
    normalized.bidCount = normalizeBidCount(listing.bidCount);
  }
  
  if ('title' in listing && typeof listing.title === 'string') {
    normalized.title = listing.title.trim();
  }
  
  if ('description' in listing && typeof listing.description === 'string') {
    normalized.description = listing.description.trim();
  }
  
  if ('url' in listing && typeof listing.url === 'string') {
    normalized.url = listing.url.trim();
  }
  
  // If the listing contains vehicle data, normalize it too
  if ('vehicle' in listing && typeof listing.vehicle === 'object') {
    normalized.vehicle = normalizeVehicle(listing.vehicle);
  }
  
  return normalized;
}

/**
 * Zod schema for validating listing data
 */
export const listingValidationSchema = z.object({
  source: z.string(),
  status: z.string(),
  saleType: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  url: z.string().url("Invalid URL").optional(),
  listingDate: z.date().optional(),
  endDate: z.date().optional(),
  price: z.number().min(0).optional(),
  bidCount: z.number().int().min(0).optional(),
  vehicleId: z.number().int().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Validate and normalize listing data
 * 
 * @param listing - The listing data to validate and normalize
 * @returns Object with success status, normalized data, and any validation errors
 */
export function validateAndNormalizeListing(listing: Record<string, any>): {
  success: boolean;
  data?: Record<string, any>;
  errors?: Record<string, string>;
} {
  try {
    // First normalize the data
    const normalizedListing = normalizeListing(listing);
    
    // Then validate using Zod schema
    const result = listingValidationSchema.safeParse(normalizedListing);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      // Format validation errors
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        errors[err.path.join('.')] = err.message;
      });
      
      return {
        success: false,
        errors
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: {
        general: (error as Error).message
      }
    };
  }
}

/**
 * Extract structured data from unstructured listing descriptions
 * 
 * @param description - The listing description text
 * @returns Object with extracted attributes
 */
export function extractDataFromDescription(description: string): Record<string, any> {
  if (!description) return {};
  
  const extracted: Record<string, any> = {};
  
  // Extract VIN
  const vinMatch = description.match(/\bVIN\s*[:# ]?\s*([A-HJ-NPR-Z0-9]{8,17})\b/i);
  if (vinMatch) {
    extracted.vin = vinMatch[1].toUpperCase();
  }
  
  // Extract mileage
  const mileageMatch = description.match(/\b(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?\s*(?:miles|mi)\b/i);
  if (mileageMatch) {
    extracted.mileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
  }
  
  // Extract engine size
  const engineSizeMatch = description.match(/\b(\d+(?:\.\d+)?)\s*(?:liter|L)\b/i) || 
                          description.match(/\b(\d+)\s*(?:cc)\b/i) ||
                          description.match(/\b(\d+(?:\.\d+)?)\s*(?:cubic inch|ci|cu in)\b/i);
  if (engineSizeMatch) {
    // Will be normalized by the vehicle normalizer
    extracted.engineSize = engineSizeMatch[0];
  }
  
  // Extract transmission type
  const transmissionMatch = description.match(/\b((?:\d-)?speed\s+manual|manual|automatic|auto|dual-clutch|dct|pdk|sequential)\b/i);
  if (transmissionMatch) {
    extracted.transmission = transmissionMatch[1];
  }
  
  // Extract exterior color
  const exteriorColorMatch = description.match(/\bexterior\s*(?:color|finish|paint)?\s*(?:in|is)?\s*:?\s*([A-Za-z\s]+)(?:,|\.|with|and|on|\()/i);
  if (exteriorColorMatch) {
    extracted.exteriorColor = exteriorColorMatch[1].trim();
  }
  
  // Extract interior color
  const interiorColorMatch = description.match(/\binterior\s*(?:color|finish|upholstery|leather)?\s*(?:in|is)?\s*:?\s*([A-Za-z\s]+)(?:,|\.|with|and|on|\()/i);
  if (interiorColorMatch) {
    extracted.interiorColor = interiorColorMatch[1].trim();
  }
  
  // Extract horsepower
  const horsepowerMatch = description.match(/\b(\d{2,4})\s*(?:hp|horsepower)\b/i);
  if (horsepowerMatch) {
    extracted.horsepower = parseInt(horsepowerMatch[1], 10);
  }
  
  // Extract original price/MSRP
  const msrpMatch = description.match(/\boriginal\s*(?:price|msrp)\s*(?:of|was|:)?\s*(?:\$|USD|EUR|£|€)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
  if (msrpMatch) {
    extracted.originalMsrp = parseFloat(msrpMatch[1].replace(/,/g, ''));
  }
  
  // Extract production number
  const productionMatch = description.match(/\b(?:number|#)\s*(\d+)\s*(?:of|\/)\s*(\d+)\b/i);
  if (productionMatch) {
    extracted.productionNumber = parseInt(productionMatch[1], 10);
    extracted.totalProduction = parseInt(productionMatch[2], 10);
  }
  
  return extracted;
}

/**
 * Merge listing data from multiple sources, prioritizing more reliable sources
 * 
 * @param listings - Array of listings for the same vehicle from different sources
 * @returns Merged listing with the most reliable data
 */
export function mergeListings(listings: Record<string, any>[]): Record<string, any> {
  if (!listings || listings.length === 0) {
    return {};
  }
  
  if (listings.length === 1) {
    return listings[0];
  }
  
  // Define source reliability ranking (higher index = more reliable)
  const sourceReliability: Record<string, number> = {
    [ListingSource.BRING_A_TRAILER]: 9,
    [ListingSource.RM_SOTHEBYS]: 10,
    [ListingSource.GOODING]: 10,
    [ListingSource.BONHAMS]: 9,
    [ListingSource.MECUM]: 8,
    [ListingSource.BARRETT_JACKSON]: 8,
    [ListingSource.CARS_AND_BIDS]: 7,
    [ListingSource.COLLECTING_CARS]: 7,
    [ListingSource.CLASSIC_DRIVER]: 6,
    [ListingSource.DUPONT_REGISTRY]: 5,
    [ListingSource.HEMMINGS]: 5,
    [ListingSource.CLASSIC_CARS]: 4,
    [ListingSource.AUTOTRADER]: 3,
    [ListingSource.EBAY]: 2,
    [ListingSource.OTHER]: 1
  };
  
  // Sort listings by reliability (most reliable first)
  const sortedListings = [...listings].sort((a, b) => {
    const sourceA = normalizeSource(a.source || '');
    const sourceB = normalizeSource(b.source || '');
    return (sourceReliability[sourceB] || 0) - (sourceReliability[sourceA] || 0);
  });
  
  // Start with the most reliable listing as the base
  const merged = { ...sortedListings[0] };
  
  // Merge in data from other listings if missing in the base
  for (let i = 1; i < sortedListings.length; i++) {
    const listing = sortedListings[i];
    
    // Merge simple fields if they're missing in the merged result
    for (const key of Object.keys(listing)) {
      // Skip the source field and vehicle object (handled separately)
      if (key === 'source' || key === 'vehicle') continue;
      
      // If the field is missing or null in the merged result, use the value from this listing
      if (merged[key] === undefined || merged[key] === null) {
        merged[key] = listing[key];
      }
    }
    
    // Merge vehicle data if present
    if (listing.vehicle && typeof listing.vehicle === 'object') {
      if (!merged.vehicle) {
        merged.vehicle = { ...listing.vehicle };
      } else {
        // For each vehicle field, use the value from the more reliable source if missing
        for (const key of Object.keys(listing.vehicle)) {
          if (merged.vehicle[key] === undefined || merged.vehicle[key] === null) {
            merged.vehicle[key] = listing.vehicle[key];
          }
        }
      }
    }
  }
  
  return merged;
} 