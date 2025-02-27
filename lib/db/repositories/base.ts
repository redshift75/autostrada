import { SQL, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { z } from 'zod';

/**
 * Base repository class with common CRUD operations
 */
export class BaseRepository<T> {
  constructor(
    protected table: any
  ) {}

  /**
   * Find all records in the table
   */
  async findAll(limit: number = 100, offset: number = 0): Promise<T[]> {
    const results = await db.select().from(this.table).limit(limit).offset(offset);
    return results as T[];
  }

  /**
   * Find a record by ID
   */
  async findById(id: number): Promise<T | null> {
    const results = await db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    
    if (!results || (Array.isArray(results) && results.length === 0)) {
      return null;
    }
    
    return Array.isArray(results) ? results[0] as T : null;
  }

  /**
   * Find records by a custom where clause
   */
  async findWhere(whereClause: SQL<unknown>, limit: number = 100, offset: number = 0): Promise<T[]> {
    const results = await db
      .select()
      .from(this.table)
      .where(whereClause)
      .limit(limit)
      .offset(offset);
    
    return results as T[];
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    const results = await db.insert(this.table).values(data).returning();
    
    if (!results || (Array.isArray(results) && results.length === 0)) {
      throw new Error('Failed to create record');
    }
    
    return Array.isArray(results) ? results[0] as T : results as unknown as T;
  }

  /**
   * Update a record by ID
   */
  async update(id: number, data: Partial<T>): Promise<T> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    
    const results = await db
      .update(this.table)
      .set(updateData)
      .where(eq(this.table.id, id))
      .returning();
    
    if (!results || (Array.isArray(results) && results.length === 0)) {
      throw new Error(`Record with ID ${id} not found`);
    }
    
    return Array.isArray(results) ? results[0] as T : results as unknown as T;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: number): Promise<boolean> {
    const results = await db
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning({ id: this.table.id });
    
    return results && (Array.isArray(results) ? results.length > 0 : true);
  }

  /**
   * Count records in the table
   */
  async count(whereClause?: SQL<unknown>): Promise<number> {
    const query = db.select({ count: sql<number>`count(*)` }).from(this.table);
    
    if (whereClause) {
      query.where(whereClause);
    }
    
    const result = await query;
    return Number(result[0]?.count || 0);
  }
} 