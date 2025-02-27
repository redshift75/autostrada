import { pgTable, serial, text, timestamp, integer, varchar, boolean, pgEnum, jsonb, foreignKey, doublePrecision } from 'drizzle-orm/pg-core';
import { vehicles } from './vehicles';

// Market trends table
export const marketTrends = pgTable('market_trends', {
  id: serial('id').primaryKey(),
  manufacturerId: integer('manufacturer_id'),
  modelId: integer('model_id'),
  yearStart: integer('year_start'),
  yearEnd: integer('year_end'),
  period: varchar('period', { length: 50 }).notNull(), // monthly, quarterly, yearly
  date: timestamp('date').notNull(),
  averagePrice: integer('average_price'),
  medianPrice: integer('median_price'),
  minPrice: integer('min_price'),
  maxPrice: integer('max_price'),
  saleCount: integer('sale_count'),
  percentChange: doublePrecision('percent_change'),
  volumeChange: doublePrecision('volume_change'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Vehicle valuations
export const vehicleValuations = pgTable('vehicle_valuations', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  date: timestamp('date').defaultNow().notNull(),
  estimatedValue: integer('estimated_value').notNull(),
  currency: varchar('currency', { length: 10 }).default('USD'),
  confidenceScore: doublePrecision('confidence_score'),
  valuationMethod: varchar('valuation_method', { length: 100 }),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Comparable sales
export const comparableSales = pgTable('comparable_sales', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  comparableVehicleId: integer('comparable_vehicle_id').references(() => vehicles.id).notNull(),
  similarityScore: doublePrecision('similarity_score'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Market reports
export const marketReports = pgTable('market_reports', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  reportDate: timestamp('report_date').defaultNow().notNull(),
  reportType: varchar('report_type', { length: 100 }),
  manufacturerId: integer('manufacturer_id'),
  modelId: integer('model_id'),
  yearStart: integer('year_start'),
  yearEnd: integer('year_end'),
  content: text('content').notNull(),
  insights: text('insights'),
  recommendations: text('recommendations'),
  author: varchar('author', { length: 255 }),
  isPublished: boolean('is_published').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}); 