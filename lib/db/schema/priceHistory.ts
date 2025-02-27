import { pgTable, serial, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { vehicles } from './vehicles';
import { listings } from './listings';
import { vehicleSourceEnum } from './vehicles';

// Price history table
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  listingId: integer('listing_id').references(() => listings.id),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 10 }).default('USD'),
  date: timestamp('date').defaultNow().notNull(),
  source: vehicleSourceEnum('source'),
  sourceUrl: varchar('source_url', { length: 500 }),
  eventType: varchar('event_type', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertPriceHistorySchema = createInsertSchema(priceHistory, {
  vehicleId: z.number().int().positive("Vehicle ID is required"),
  listingId: z.number().int().positive().optional(),
  price: z.number().int().positive("Price is required"),
  currency: z.string().max(10).optional(),
  date: z.date().optional(),
  source: z.enum(['bring_a_trailer', 'rm_sothebys', 'gooding', 'bonhams', 'dupont_registry', 'autotrader', 'other']).optional(),
  sourceUrl: z.string().url().max(500).optional(),
  eventType: z.string().max(50).optional(),
  notes: z.string().optional(),
});

export const selectPriceHistorySchema = createSelectSchema(priceHistory);

// Type definitions
export type PriceHistory = z.infer<typeof selectPriceHistorySchema>;
export type NewPriceHistory = z.infer<typeof insertPriceHistorySchema>; 