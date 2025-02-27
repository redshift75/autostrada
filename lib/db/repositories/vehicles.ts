import { SQL, and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { BaseRepository } from './base';
import { Vehicle, NewVehicle, vehicles, insertVehicleSchema, selectVehicleSchema } from '../schema/vehicles';
import { db } from '../index';
import { validateAndFormatErrors } from '../schema/validation';

/**
 * Repository for vehicle operations
 */
export class VehicleRepository extends BaseRepository<Vehicle> {
  constructor() {
    super(vehicles);
  }

  /**
   * Create a new vehicle with validation
   */
  async createVehicle(data: NewVehicle): Promise<{ success: boolean; data?: Vehicle; errors?: Record<string, string> }> {
    const validation = validateAndFormatErrors(insertVehicleSchema, data);
    
    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors
      };
    }
    
    try {
      const vehicle = await this.create(validation.data as Partial<Vehicle>);
      return {
        success: true,
        data: vehicle
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
   * Update a vehicle with validation
   */
  async updateVehicle(id: number, data: Partial<NewVehicle>): Promise<{ success: boolean; data?: Vehicle; errors?: Record<string, string> }> {
    const validation = validateAndFormatErrors(insertVehicleSchema.partial(), data);
    
    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors
      };
    }
    
    try {
      const vehicle = await this.update(id, validation.data as Partial<Vehicle>);
      return {
        success: true,
        data: vehicle
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
   * Search for vehicles with various filters
   */
  async searchVehicles({
    make,
    model,
    yearStart,
    yearEnd,
    condition,
    priceMin,
    priceMax,
    limit = 20,
    offset = 0,
    sortBy = 'year',
    sortDirection = 'desc'
  }: {
    make?: string;
    model?: string;
    yearStart?: number;
    yearEnd?: number;
    condition?: string;
    priceMin?: number;
    priceMax?: number;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): Promise<{ vehicles: Vehicle[]; total: number }> {
    // Build the where clause
    const whereConditions = [];
    
    if (make) {
      whereConditions.push(ilike(vehicles.make, `%${make}%`));
    }
    
    if (model) {
      whereConditions.push(ilike(vehicles.model, `%${model}%`));
    }
    
    if (yearStart) {
      whereConditions.push(gte(vehicles.year, yearStart));
    }
    
    if (yearEnd) {
      whereConditions.push(lte(vehicles.year, yearEnd));
    }
    
    if (condition) {
      whereConditions.push(eq(vehicles.condition, condition as any));
    }
    
    // Create the where clause
    const whereClause = whereConditions.length > 0
      ? and(...whereConditions)
      : undefined;
    
    // Determine sort column and direction
    let orderBy;
    if (sortBy === 'year') {
      orderBy = sortDirection === 'asc' ? asc(vehicles.year) : desc(vehicles.year);
    } else if (sortBy === 'make') {
      orderBy = sortDirection === 'asc' ? asc(vehicles.make) : desc(vehicles.make);
    } else if (sortBy === 'model') {
      orderBy = sortDirection === 'asc' ? asc(vehicles.model) : desc(vehicles.model);
    } else {
      orderBy = sortDirection === 'asc' ? asc(vehicles.id) : desc(vehicles.id);
    }
    
    // Execute the query
    const query = db.select().from(vehicles);
    
    if (whereClause) {
      query.where(whereClause);
    }
    
    const results = await query.orderBy(orderBy).limit(limit).offset(offset);
    
    // Get total count for pagination
    const total = await this.count(whereClause);
    
    return {
      vehicles: results as Vehicle[],
      total
    };
  }

  /**
   * Find vehicles by make and model
   */
  async findByMakeAndModel(make: string, model: string): Promise<Vehicle[]> {
    const whereClause = and(
      ilike(vehicles.make, `%${make}%`),
      ilike(vehicles.model, `%${model}%`)
    );
    
    return this.findWhere(whereClause as SQL<unknown>);
  }

  /**
   * Find vehicles by year range
   */
  async findByYearRange(startYear: number, endYear: number): Promise<Vehicle[]> {
    const whereClause = and(
      gte(vehicles.year, startYear),
      lte(vehicles.year, endYear)
    );
    
    return this.findWhere(whereClause as SQL<unknown>);
  }

  /**
   * Find vehicles by VIN
   */
  async findByVin(vin: string): Promise<Vehicle | null> {
    const results = await this.findWhere(eq(vehicles.vin, vin));
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get vehicle statistics
   */
  async getStatistics(): Promise<{
    totalVehicles: number;
    vehiclesByMake: { make: string; count: number }[];
    vehiclesByYear: { year: number; count: number }[];
    vehiclesByCondition: { condition: string; count: number }[];
  }> {
    // Get total count
    const totalVehicles = await this.count();
    
    // Get counts by make
    const vehiclesByMake = await db
      .select({
        make: vehicles.make,
        count: sql<number>`count(*)`,
      })
      .from(vehicles)
      .groupBy(vehicles.make)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);
    
    // Get counts by year
    const vehiclesByYear = await db
      .select({
        year: vehicles.year,
        count: sql<number>`count(*)`,
      })
      .from(vehicles)
      .groupBy(vehicles.year)
      .orderBy(desc(vehicles.year))
      .limit(20);
    
    // Get counts by condition
    const vehiclesByCondition = await db
      .select({
        condition: vehicles.condition,
        count: sql<number>`count(*)`,
      })
      .from(vehicles)
      .groupBy(vehicles.condition)
      .orderBy(desc(sql<number>`count(*)`));
    
    return {
      totalVehicles,
      vehiclesByMake,
      vehiclesByYear,
      vehiclesByCondition: vehiclesByCondition.map(item => ({
        condition: item.condition || 'unknown',
        count: Number(item.count)
      }))
    };
  }
}

// Export singleton instance
export const vehicleRepository = new VehicleRepository(); 