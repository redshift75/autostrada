import { pgTable, serial, varchar, text, timestamp, boolean, pgEnum, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { vehicles } from './vehicles';

// User roles enum
export const userRoleEnum = pgEnum('user_role', [
  'admin', 'editor', 'user'
]);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: userRoleEnum('role').default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLogin: timestamp('last_login'),
  profileImageUrl: varchar('profile_image_url', { length: 500 }),
  bio: text('bio'),
  preferences: text('preferences'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User saved searches
export const savedSearches = pgTable('saved_searches', {
  id: serial('id').primaryKey(),
  userId: serial('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  criteria: text('criteria').notNull(),
  isNotificationEnabled: boolean('is_notification_enabled').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User saved vehicles
export const savedVehicles = pgTable('saved_vehicles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  vehicleId: integer('vehicle_id').references(() => vehicles.id).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Valid email is required").max(255),
  name: z.string().max(255).optional(),
  passwordHash: z.string().max(255).optional(),
  role: z.enum(['admin', 'editor', 'user']).optional(),
  isActive: z.boolean().optional(),
  profileImageUrl: z.string().url().max(500).optional(),
  bio: z.string().optional(),
  preferences: z.string().optional(),
});

export const selectUserSchema = createSelectSchema(users, {
  // Exclude password hash from select schema for security
  passwordHash: z.string().optional().transform(() => undefined),
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches, {
  userId: z.number().int().positive("User ID is required"),
  name: z.string().min(1, "Search name is required").max(100),
  criteria: z.string().min(1, "Search criteria is required"),
  isNotificationEnabled: z.boolean().optional(),
});

export const selectSavedSearchSchema = createSelectSchema(savedSearches);

export const insertSavedVehicleSchema = createInsertSchema(savedVehicles, {
  userId: z.number().int().positive("User ID is required"),
  vehicleId: z.number().int().positive("Vehicle ID is required"),
  notes: z.string().optional(),
});

export const selectSavedVehicleSchema = createSelectSchema(savedVehicles);

// Type definitions
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;
export type SavedSearch = z.infer<typeof selectSavedSearchSchema>;
export type NewSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedVehicle = z.infer<typeof selectSavedVehicleSchema>;
export type NewSavedVehicle = z.infer<typeof insertSavedVehicleSchema>; 