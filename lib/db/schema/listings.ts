import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { vehicles } from './vehicles';
import { vehicleSourceEnum } from './vehicles';

// Expanded listings table
export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  source: vehicleSourceEnum('source').notNull(),
  sourceId: varchar('source_id', { length: 100 }),
  sourceUrl: varchar('source_url', { length: 500 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  price: integer('price'),
  currency: varchar('currency', { length: 10 }).default('USD'),
  location: varchar('location', { length: 255 }),
  sellerType: varchar('seller_type', { length: 50 }),
  sellerName: varchar('seller_name', { length: 255 }),
  sellerRating: varchar('seller_rating', { length: 50 }),
  contactInfo: varchar('contact_info', { length: 255 }),
  listingDate: timestamp('listing_date'),
  endDate: timestamp('end_date'),
  isSold: boolean('is_sold').default(false),
  soldPrice: integer('sold_price'),
  soldDate: timestamp('sold_date'),
  bidCount: integer('bid_count'),
  viewCount: integer('view_count'),
  metadata: jsonb('metadata'),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    sourceUrlUnique: unique().on(table.sourceUrl),
  };
});

// Zod schemas for validation
export const insertListingSchema = createInsertSchema(listings, {
  vehicleId: z.number().int().positive("Vehicle ID is required"),
  source: z.enum(['bring_a_trailer', 'rm_sothebys', 'gooding', 'bonhams', 'dupont_registry', 'autotrader', 'other']),
  sourceId: z.string().max(100).optional(),
  sourceUrl: z.string().url("Valid URL is required").max(500),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  price: z.number().int().optional(),
  currency: z.string().max(10).optional(),
  location: z.string().max(255).optional(),
  sellerType: z.string().max(50).optional(),
  sellerName: z.string().max(255).optional(),
  sellerRating: z.string().max(50).optional(),
  contactInfo: z.string().max(255).optional(),
  listingDate: z.date().optional(),
  endDate: z.date().optional(),
  isSold: z.boolean().optional(),
  soldPrice: z.number().int().optional(),
  soldDate: z.date().optional(),
  bidCount: z.number().int().optional(),
  viewCount: z.number().int().optional(),
  metadata: z.record(z.any()).optional(),
  rawData: z.record(z.any()).optional(),
});

export const selectListingSchema = createSelectSchema(listings);

// Type definitions
export type Listing = z.infer<typeof selectListingSchema>;
export type NewListing = z.infer<typeof insertListingSchema>; 