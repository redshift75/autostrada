import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Drizzle instance with all schemas
export const db = drizzle(pool, { schema });

// Export schema for use in repositories
export * from './schema';

// Export repositories
export * from './schema/vehicles';
export * from './schema/listings';
export * from './schema/manufacturers';
export * from './schema/models';
export * from './schema/priceHistory';
export * from './schema/users';
export * from './schema/images';
export * from './schema/features'; 