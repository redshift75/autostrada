import { pgTable, serial, varchar, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { manufacturers } from './manufacturers';

// Models table
export const models = pgTable('models', {
  id: serial('id').primaryKey(),
  manufacturerId: integer('manufacturer_id').references(() => manufacturers.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  startYear: integer('start_year'),
  endYear: integer('end_year'),
  category: varchar('category', { length: 50 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    manufacturerModelUnique: unique().on(table.manufacturerId, table.name),
  };
});

// Zod schemas for validation
export const insertModelSchema = createInsertSchema(models, {
  manufacturerId: z.number().int().positive("Manufacturer ID is required"),
  name: z.string().min(1, "Model name is required").max(100),
  startYear: z.number().int().positive().optional(),
  endYear: z.number().int().positive().optional(),
  category: z.string().max(50).optional(),
  description: z.string().optional(),
});

export const selectModelSchema = createSelectSchema(models);

// Type definitions
export type Model = z.infer<typeof selectModelSchema>;
export type NewModel = z.infer<typeof insertModelSchema>; 