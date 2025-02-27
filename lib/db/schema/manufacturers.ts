import { pgTable, serial, varchar, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Manufacturers table
export const manufacturers = pgTable('manufacturers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  country: varchar('country', { length: 100 }),
  foundedYear: integer('founded_year'),
  description: text('description'),
  logoUrl: varchar('logo_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertManufacturerSchema = createInsertSchema(manufacturers, {
  name: z.string().min(1, "Manufacturer name is required").max(100),
  country: z.string().max(100).optional(),
  foundedYear: z.number().int().positive().optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

export const selectManufacturerSchema = createSelectSchema(manufacturers);

// Type definitions
export type Manufacturer = z.infer<typeof selectManufacturerSchema>;
export type NewManufacturer = z.infer<typeof insertManufacturerSchema>; 