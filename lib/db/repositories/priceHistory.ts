import { SQL, and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { BaseRepository } from './base';
import { PriceHistory, NewPriceHistory, priceHistory, insertPriceHistorySchema, selectPriceHistorySchema } from '../schema/priceHistory';
import { vehicles } from '../schema/vehicles';
import { db } from '../index';
import { validateAndFormatErrors } from '../schema/validation';

/**
 * Repository for price history operations
 */
export class PriceHistoryRepository extends BaseRepository<PriceHistory> {
  constructor() {
    super(priceHistory);
  }

  /**
   * Create a new price history entry with validation
   */
  async createPriceHistory(data: NewPriceHistory): Promise<{ success: boolean; data?: PriceHistory; errors?: Record<string, string> }> {
    const validation = validateAndFormatErrors(insertPriceHistorySchema, data);
    
    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors
      };
    }
    
    try {
      const entry = await this.create(validation.data as Partial<PriceHistory>);
      return {
        success: true,
        data: entry
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
   * Find price history for a specific vehicle
   */
  async findByVehicleId(vehicleId: number): Promise<PriceHistory[]> {
    return this.findWhere(eq(priceHistory.vehicleId, vehicleId));
  }

  /**
   * Find price history for a specific listing
   */
  async findByListingId(listingId: number): Promise<PriceHistory[]> {
    return this.findWhere(eq(priceHistory.listingId, listingId));
  }

  /**
   * Find price history within a date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<PriceHistory[]> {
    const whereClause = and(
      gte(priceHistory.date, startDate),
      lte(priceHistory.date, endDate)
    );
    
    return this.findWhere(whereClause as SQL<unknown>);
  }

  /**
   * Get price history with vehicle details
   */
  async getPriceHistoryWithVehicles(limit: number = 100, offset: number = 0): Promise<any[]> {
    return db
      .select({
        priceHistory: priceHistory,
        vehicle: vehicles
      })
      .from(priceHistory)
      .innerJoin(vehicles, eq(priceHistory.vehicleId, vehicles.id))
      .orderBy(desc(priceHistory.date))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get price trends for a specific make/model
   */
  async getPriceTrends(make: string, model: string): Promise<any[]> {
    return db
      .select({
        year: sql<number>`extract(year from ${priceHistory.date})`,
        month: sql<number>`extract(month from ${priceHistory.date})`,
        avgPrice: sql<number>`avg(${priceHistory.price})`,
        count: sql<number>`count(*)`,
      })
      .from(priceHistory)
      .innerJoin(vehicles, eq(priceHistory.vehicleId, vehicles.id))
      .where(
        and(
          eq(vehicles.make, make),
          eq(vehicles.model, model)
        )
      )
      .groupBy(
        sql`extract(year from ${priceHistory.date})`,
        sql`extract(month from ${priceHistory.date})`
      )
      .orderBy(
        asc(sql<number>`extract(year from ${priceHistory.date})`),
        asc(sql<number>`extract(month from ${priceHistory.date})`)
      );
  }

  /**
   * Calculate price appreciation/depreciation for a specific make/model
   */
  async calculateAppreciation(make: string, model: string, years: number = 5): Promise<{
    startPrice: number;
    endPrice: number;
    percentChange: number;
    annualizedReturn: number;
  }> {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - years);
    
    // Get average price at start of period
    const startPriceResult = await db
      .select({
        avgPrice: sql<number>`avg(${priceHistory.price})`,
      })
      .from(priceHistory)
      .innerJoin(vehicles, eq(priceHistory.vehicleId, vehicles.id))
      .where(
        and(
          eq(vehicles.make, make),
          eq(vehicles.model, model),
          gte(priceHistory.date, startDate),
          lte(priceHistory.date, new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000))
        )
      );
    
    // Get average price at end of period
    const endPriceResult = await db
      .select({
        avgPrice: sql<number>`avg(${priceHistory.price})`,
      })
      .from(priceHistory)
      .innerJoin(vehicles, eq(priceHistory.vehicleId, vehicles.id))
      .where(
        and(
          eq(vehicles.make, make),
          eq(vehicles.model, model),
          gte(priceHistory.date, new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000)),
          lte(priceHistory.date, endDate)
        )
      );
    
    const startPrice = Number(startPriceResult[0]?.avgPrice || 0);
    const endPrice = Number(endPriceResult[0]?.avgPrice || 0);
    
    // Calculate percent change
    const percentChange = startPrice > 0 
      ? ((endPrice - startPrice) / startPrice) * 100 
      : 0;
    
    // Calculate annualized return
    const annualizedReturn = startPrice > 0 
      ? (Math.pow((endPrice / startPrice), 1 / years) - 1) * 100 
      : 0;
    
    return {
      startPrice,
      endPrice,
      percentChange,
      annualizedReturn
    };
  }

  /**
   * Get price comparison between different makes/models
   */
  async comparePrices(vehicleList: Array<{ make: string; model: string }>): Promise<Array<{
    make: string;
    model: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    count: number;
  }>> {
    const results = [];
    
    for (const vehicle of vehicleList) {
      const priceData = await db
        .select({
          avgPrice: sql<number>`avg(${priceHistory.price})`,
          minPrice: sql<number>`min(${priceHistory.price})`,
          maxPrice: sql<number>`max(${priceHistory.price})`,
          count: sql<number>`count(*)`,
        })
        .from(priceHistory)
        .innerJoin(vehicles, eq(priceHistory.vehicleId, vehicles.id))
        .where(
          and(
            eq(vehicles.make, vehicle.make),
            eq(vehicles.model, vehicle.model)
          )
        );
      
      results.push({
        make: vehicle.make,
        model: vehicle.model,
        avgPrice: Number(priceData[0]?.avgPrice || 0),
        minPrice: Number(priceData[0]?.minPrice || 0),
        maxPrice: Number(priceData[0]?.maxPrice || 0),
        count: Number(priceData[0]?.count || 0),
      });
    }
    
    return results;
  }
}

// Export singleton instance
export const priceHistoryRepository = new PriceHistoryRepository(); 