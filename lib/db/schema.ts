import { pgTable, serial, text, timestamp, integer, varchar, boolean, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const vehicleConditionEnum = pgEnum('vehicle_condition', [
  'concours', 'excellent', 'good', 'fair', 'poor', 'project'
]);

export const vehicleSourceEnum = pgEnum('vehicle_source', [
  'bring_a_trailer', 'rm_sothebys', 'gooding', 'bonhams', 'dupont_registry', 'autotrader', 'other'
]);

// Tables
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  vin: varchar('vin', { length: 50 }),
  description: text('description'),
  condition: vehicleConditionEnum('condition'),
  mileage: integer('mileage'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  source: vehicleSourceEnum('source').notNull(),
  sourceUrl: varchar('source_url', { length: 500 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  price: integer('price'),
  currency: varchar('currency', { length: 10 }).default('USD'),
  listingDate: timestamp('listing_date'),
  endDate: timestamp('end_date'),
  isSold: boolean('is_sold').default(false),
  soldPrice: integer('sold_price'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  url: varchar('url', { length: 500 }).notNull(),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  price: integer('price').notNull(),
  currency: varchar('currency', { length: 10 }).default('USD'),
  date: timestamp('date').defaultNow().notNull(),
  source: vehicleSourceEnum('source'),
  sourceUrl: varchar('source_url', { length: 500 }),
  notes: text('notes'),
});

// Export all schema definitions
export * from './schema/vehicles';
export * from './schema/images';
export * from './schema/priceHistory';
export * from './schema/users';

// Export schema validation utilities
export * from './schema/validation'; 