import { pgTable, serial, varchar, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { vehicles } from './vehicles';

// Features table
export const features = pgTable('features', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  category: varchar('category', { length: 50 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Vehicle features (many-to-many)
export const vehicleFeatures = pgTable('vehicle_features', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  featureId: integer('feature_id').references(() => features.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    vehicleFeatureUnique: unique().on(table.vehicleId, table.featureId),
  };
});

// Zod schemas for validation
export const insertFeatureSchema = createInsertSchema(features, {
  name: z.string().min(1, "Feature name is required").max(100),
  category: z.string().max(50).optional(),
  description: z.string().optional(),
});

export const selectFeatureSchema = createSelectSchema(features);

export const insertVehicleFeatureSchema = createInsertSchema(vehicleFeatures, {
  vehicleId: z.number().int().positive("Vehicle ID is required"),
  featureId: z.number().int().positive("Feature ID is required"),
});

export const selectVehicleFeatureSchema = createSelectSchema(vehicleFeatures);

// Type definitions
export type Feature = z.infer<typeof selectFeatureSchema>;
export type NewFeature = z.infer<typeof insertFeatureSchema>;
export type VehicleFeature = z.infer<typeof selectVehicleFeatureSchema>;
export type NewVehicleFeature = z.infer<typeof insertVehicleFeatureSchema>; 