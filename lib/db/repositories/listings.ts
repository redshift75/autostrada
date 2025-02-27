import { SQL, and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { BaseRepository } from './base';
import { Listing, NewListing, listings, insertListingSchema, selectListingSchema } from '../schema/listings';
import { vehicles } from '../schema/vehicles';
import { db } from '../index';
import { validateAndFormatErrors } from '../schema/validation';

/**
 * Repository for listing operations
 */
export class ListingRepository extends BaseRepository<Listing> {
  constructor() {
    super(listings);
  }

  /**
   * Create a new listing with validation
   */
  async createListing(data: NewListing): Promise<{ success: boolean; data?: Listing; errors?: Record<string, string> }> {
    const validation = validateAndFormatErrors(insertListingSchema, data);
    
    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors
      };
    }
    
    try {
      const listing = await this.create(validation.data as Partial<Listing>);
      return {
        success: true,
        data: listing
      };
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
   * Update a listing with validation
   */
  async updateListing(id: number, data: Partial<NewListing>): Promise<{ success: boolean; data?: Listing; errors?: Record<string, string> }> {
    const validation = validateAndFormatErrors(insertListingSchema.partial(), data);
    
    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors
      };
    }
    
    try {
      const listing = await this.update(id, validation.data as Partial<Listing>);
      return {
        success: true,
        data: listing
      };
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
   * Find listings with vehicle details
   */
  async findListingsWithVehicles(limit: number = 20, offset: number = 0): Promise<any[]> {
    return db
      .select({
        listing: listings,
        vehicle: vehicles
      })
      .from(listings)
      .innerJoin(vehicles, eq(listings.vehicleId, vehicles.id))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find listings by source
   */
  async findBySource(source: string, limit: number = 20, offset: number = 0): Promise<Listing[]> {
    return this.findWhere(eq(listings.source, source as any), limit, offset);
  }

  /**
   * Find listings by price range
   */
  async findByPriceRange(minPrice: number, maxPrice: number, limit: number = 20, offset: number = 0): Promise<Listing[]> {
    const whereClause = and(
      gte(listings.price, minPrice),
      lte(listings.price, maxPrice)
    );
    
    return this.findWhere(whereClause as SQL<unknown>, limit, offset);
  }

  /**
   * Find sold listings
   */
  async findSoldListings(limit: number = 20, offset: number = 0): Promise<Listing[]> {
    return this.findWhere(eq(listings.isSold, true), limit, offset);
  }

  /**
   * Find active (unsold) listings
   */
  async findActiveListings(limit: number = 20, offset: number = 0): Promise<Listing[]> {
    return this.findWhere(eq(listings.isSold, false), limit, offset);
  }

  /**
   * Search listings with various filters
   */
  async searchListings({
    vehicleId,
    source,
    title,
    minPrice,
    maxPrice,
    isSold,
    limit = 20,
    offset = 0,
    sortBy = 'createdAt',
    sortDirection = 'desc'
  }: {
    vehicleId?: number;
    source?: string;
    title?: string;
    minPrice?: number;
    maxPrice?: number;
    isSold?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): Promise<{ listings: Listing[]; total: number }> {
    // Build the where clause
    const whereConditions = [];
    
    if (vehicleId) {
      whereConditions.push(eq(listings.vehicleId, vehicleId));
    }
    
    if (source) {
      whereConditions.push(eq(listings.source, source as any));
    }
    
    if (title) {
      whereConditions.push(ilike(listings.title, `%${title}%`));
    }
    
    if (minPrice) {
      whereConditions.push(gte(listings.price, minPrice));
    }
    
    if (maxPrice) {
      whereConditions.push(lte(listings.price, maxPrice));
    }
    
    if (isSold !== undefined) {
      whereConditions.push(eq(listings.isSold, isSold));
    }
    
    // Create the where clause
    const whereClause = whereConditions.length > 0
      ? and(...whereConditions)
      : undefined;
    
    // Determine sort column and direction
    let orderBy;
    if (sortBy === 'price') {
      orderBy = sortDirection === 'asc' ? asc(listings.price) : desc(listings.price);
    } else if (sortBy === 'createdAt') {
      orderBy = sortDirection === 'asc' ? asc(listings.createdAt) : desc(listings.createdAt);
    } else if (sortBy === 'listingDate') {
      orderBy = sortDirection === 'asc' ? asc(listings.listingDate) : desc(listings.listingDate);
    } else {
      orderBy = sortDirection === 'asc' ? asc(listings.id) : desc(listings.id);
    }
    
    // Execute the query
    const query = db.select().from(listings);
    
    if (whereClause) {
      query.where(whereClause);
    }
    
    const results = await query.orderBy(orderBy).limit(limit).offset(offset);
    
    // Get total count for pagination
    const total = whereClause ? await this.count(whereClause) : await this.count();
    
    return {
      listings: results as Listing[],
      total
    };
  }

  /**
   * Get listing statistics
   */
  async getStatistics(): Promise<{
    totalListings: number;
    soldListings: number;
    activeListings: number;
    averagePrice: number;
    listingsBySource: { source: string; count: number }[];
  }> {
    // Get total count
    const totalListings = await this.count();
    
    // Get sold count
    const soldListings = await this.count(eq(listings.isSold, true));
    
    // Get active count
    const activeListings = await this.count(eq(listings.isSold, false));
    
    // Get average price
    const avgPriceResult = await db
      .select({
        avgPrice: sql<number>`avg(${listings.price})`,
      })
      .from(listings)
      .where(sql`${listings.price} is not null`);
    
    const averagePrice = Number(avgPriceResult[0]?.avgPrice || 0);
    
    // Get counts by source
    const listingsBySource = await db
      .select({
        source: listings.source,
        count: sql<number>`count(*)`,
      })
      .from(listings)
      .groupBy(listings.source)
      .orderBy(desc(sql<number>`count(*)`));
    
    return {
      totalListings,
      soldListings,
      activeListings,
      averagePrice,
      listingsBySource: listingsBySource.map(item => ({
        source: item.source || 'unknown',
        count: Number(item.count)
      }))
    };
  }
}

// Export singleton instance
export const listingRepository = new ListingRepository(); 