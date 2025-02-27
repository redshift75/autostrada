import { pgTable, serial, varchar, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { vehicles } from './vehicles';
import { listings } from './listings';

// Images table (expanded)
export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  listingId: integer('listing_id').references(() => listings.id),
  url: varchar('url', { length: 500 }).notNull(),
  caption: text('caption'),
  isPrimary: boolean('is_primary').default(false),
  sortOrder: integer('sort_order').default(0),
  width: integer('width'),
  height: integer('height'),
  size: integer('size'),
  format: varchar('format', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertImageSchema = createInsertSchema(images, {
  vehicleId: z.number().int().positive("Vehicle ID is required"),
  listingId: z.number().int().positive().optional(),
  url: z.string().url("Valid URL is required").max(500),
  caption: z.string().optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  size: z.number().int().positive().optional(),
  format: z.string().max(20).optional(),
});

export const selectImageSchema = createSelectSchema(images);

// Type definitions
export type Image = z.infer<typeof selectImageSchema>;
export type NewImage = z.infer<typeof insertImageSchema>; 