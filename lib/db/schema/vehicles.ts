import { pgTable, serial, text, timestamp, integer, varchar, boolean, pgEnum, uuid, jsonb, foreignKey, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums
export const vehicleConditionEnum = pgEnum('vehicle_condition', [
  'concours', 'excellent', 'good', 'fair', 'poor', 'project'
]);

export const vehicleSourceEnum = pgEnum('vehicle_source', [
  'bring_a_trailer', 'rm_sothebys', 'gooding', 'bonhams', 'dupont_registry', 'autotrader', 'other'
]);

export const transmissionTypeEnum = pgEnum('transmission_type', [
  'manual', 'automatic', 'semi_automatic', 'cvt', 'unknown'
]);

export const drivetrainTypeEnum = pgEnum('drivetrain_type', [
  'rwd', 'fwd', 'awd', '4wd', 'unknown'
]);

export const fuelTypeEnum = pgEnum('fuel_type', [
  'gasoline', 'diesel', 'electric', 'hybrid', 'other', 'unknown'
]);

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

// Vehicles table
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  vin: varchar('vin', { length: 50 }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  condition: vehicleConditionEnum('condition'),
  mileage: integer('mileage'),
  exteriorColor: varchar('exterior_color', { length: 100 }),
  interiorColor: varchar('interior_color', { length: 100 }),
  engineSize: varchar('engine_size', { length: 100 }),
  engineType: varchar('engine_type', { length: 100 }),
  transmission: transmissionTypeEnum('transmission'),
  drivetrain: drivetrainTypeEnum('drivetrain'),
  fuelType: fuelTypeEnum('fuel_type'),
  horsepower: integer('horsepower'),
  torque: integer('torque'),
  originalMsrp: integer('original_msrp'),
  productionNumber: varchar('production_number', { length: 100 }),
  totalProduction: integer('total_production'),
  specialNotes: text('special_notes'),
  modifications: text('modifications'),
  serviceHistory: text('service_history'),
  ownerHistory: text('owner_history'),
  awards: text('awards'),
  documents: text('documents'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Vehicle features (many-to-many)
export const features = pgTable('features', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  category: varchar('category', { length: 50 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
export const insertVehicleSchema = createInsertSchema(vehicles, {
  make: z.string().min(1, "Make is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  year: z.number().int().min(1885, "Year must be at least 1885").max(new Date().getFullYear() + 1),
  vin: z.string().max(50).optional(),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  condition: z.enum(['concours', 'excellent', 'good', 'fair', 'poor', 'project']).optional(),
  mileage: z.number().int().nonnegative().optional(),
  exteriorColor: z.string().max(100).optional(),
  interiorColor: z.string().max(100).optional(),
  engineSize: z.string().max(100).optional(),
  engineType: z.string().max(100).optional(),
  transmission: z.enum(['manual', 'automatic', 'semi_automatic', 'cvt', 'unknown']).optional(),
  drivetrain: z.enum(['rwd', 'fwd', 'awd', '4wd', 'unknown']).optional(),
  fuelType: z.enum(['gasoline', 'diesel', 'electric', 'hybrid', 'other', 'unknown']).optional(),
  horsepower: z.number().int().positive().optional(),
  torque: z.number().int().positive().optional(),
  originalMsrp: z.number().int().positive().optional(),
  productionNumber: z.string().max(100).optional(),
  totalProduction: z.number().int().positive().optional(),
  specialNotes: z.string().optional(),
  modifications: z.string().optional(),
  serviceHistory: z.string().optional(),
  ownerHistory: z.string().optional(),
  awards: z.string().optional(),
  documents: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const selectVehicleSchema = createSelectSchema(vehicles);

// Type definitions
export type Vehicle = z.infer<typeof selectVehicleSchema>;
export type NewVehicle = z.infer<typeof insertVehicleSchema>;

export const insertListingSchema = createInsertSchema(listings);
export const selectListingSchema = createSelectSchema(listings); 