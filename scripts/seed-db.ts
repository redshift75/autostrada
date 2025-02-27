import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('Seeding database...');
  
  // Create a postgres client using the connection string
  const connectionString = process.env.DATABASE_URL!;
  console.log('Using connection string:', connectionString);
  
  const pgClient = postgres(connectionString, { max: 1 });
  
  // Initialize Drizzle ORM
  const db = drizzle(pgClient);
  
  try {
    // Test database connection
    console.log('Testing database connection...');
    const versionResult = await pgClient`SELECT version()`;
    console.log(`✅ Successfully connected to the database: ${versionResult[0].version}`);
    
    // Get enum values from the database
    const vehicleConditionValues = await pgClient`
      SELECT enum_range(NULL::vehicle_condition) as values
    `;
    const conditionEnum = vehicleConditionValues[0]?.values || ['concours', 'excellent', 'good', 'fair', 'poor', 'project'];
    
    const vehicleSourceValues = await pgClient`
      SELECT enum_range(NULL::vehicle_source) as values
    `;
    const sourceEnum = vehicleSourceValues[0]?.values || ['bring_a_trailer', 'rm_sothebys', 'gooding', 'bonhams', 'dupont_registry', 'autotrader', 'other'];
    
    // Sample data for vehicles
    const sampleVehicles = [
      {
        make: 'Porsche',
        model: '911 Carrera',
        year: 1973,
        vin: 'ABC123456789',
        description: 'Classic Porsche 911 in excellent condition',
        condition: conditionEnum[1], // excellent
        mileage: 78500,
      },
      {
        make: 'Ferrari',
        model: '250 GT California',
        year: 1961,
        vin: 'XYZ987654321',
        description: 'Rare Ferrari California, fully restored',
        condition: conditionEnum[0], // concours
        mileage: 45200,
      },
      {
        make: 'Mercedes-Benz',
        model: '300SL Gullwing',
        year: 1955,
        vin: 'MBZ300SL12345',
        description: 'Iconic Mercedes Gullwing in original condition',
        condition: conditionEnum[2], // good
        mileage: 92100,
      },
    ];
    
    // Insert vehicles using raw SQL
    console.log('Inserting sample vehicles...');
    const insertedVehicles = [];
    
    for (const vehicle of sampleVehicles) {
      const result = await pgClient`
        INSERT INTO vehicles (make, model, year, vin, description, condition, mileage, created_at, updated_at)
        VALUES (${vehicle.make}, ${vehicle.model}, ${vehicle.year}, ${vehicle.vin}, ${vehicle.description}, ${vehicle.condition}, ${vehicle.mileage}, NOW(), NOW())
        RETURNING *
      `;
      insertedVehicles.push(result[0]);
    }
    
    console.log(`Inserted ${insertedVehicles.length} vehicles`);
    
    // Sample data for listings
    const sampleListings = [];
    for (let i = 0; i < insertedVehicles.length; i++) {
      const vehicle = insertedVehicles[i];
      const sources = [
        sourceEnum[0], // bring_a_trailer
        sourceEnum[1], // rm_sothebys
        sourceEnum[2], // gooding
      ];
      
      // Format the date as an ISO string
      const listingDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      
      sampleListings.push({
        vehicleId: vehicle.id,
        source: sources[i % 3],
        sourceUrl: `https://example.com/listing/${vehicle.id}`,
        title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        price: [325000, 1500000, 950000][i % 3],
        currency: 'USD',
        listingDate: listingDate,
        isSold: i % 2 === 0, // Alternate between sold and not sold
        soldPrice: i % 2 === 0 ? [310000, 1450000, 900000][i % 3] : null,
      });
    }
    
    // Insert listings
    console.log('Inserting sample listings...');
    const insertedListings = [];
    
    for (const listing of sampleListings) {
      const result = await pgClient`
        INSERT INTO listings (
          vehicle_id, source, source_url, title, price, currency, 
          listing_date, is_sold, sold_price, created_at, updated_at
        )
        VALUES (
          ${listing.vehicleId}, ${listing.source}, ${listing.sourceUrl}, 
          ${listing.title}, ${listing.price}, ${listing.currency}, 
          ${listing.listingDate}::timestamp, ${listing.isSold}, ${listing.soldPrice}, 
          NOW(), NOW()
        )
        RETURNING *
      `;
      insertedListings.push(result[0]);
    }
    
    console.log(`Inserted ${insertedListings.length} listings`);
    
    // Sample data for images
    const sampleImages = [];
    for (const vehicle of insertedVehicles) {
      // Add multiple images per vehicle
      for (let i = 0; i < 3; i++) {
        sampleImages.push({
          vehicleId: vehicle.id,
          url: `https://example.com/images/${vehicle.id}/${i + 1}.jpg`,
          isPrimary: i === 0, // First image is primary
        });
      }
    }
    
    // Insert images
    console.log('Inserting sample images...');
    const insertedImages = [];
    
    for (const image of sampleImages) {
      const result = await pgClient`
        INSERT INTO images (vehicle_id, url, is_primary, created_at)
        VALUES (${image.vehicleId}, ${image.url}, ${image.isPrimary}, NOW())
        RETURNING *
      `;
      insertedImages.push(result[0]);
    }
    
    console.log(`Inserted ${insertedImages.length} images`);
    
    // Sample data for price history
    const samplePriceHistory = [];
    for (const vehicle of insertedVehicles) {
      // Add multiple price points per vehicle
      for (let i = 0; i < 3; i++) {
        const basePrice = [300000, 1400000, 900000][vehicle.id % 3];
        const sources = [
          sourceEnum[0], // bring_a_trailer
          sourceEnum[1], // rm_sothebys
          sourceEnum[2], // gooding
        ];
        
        // Format the date as an ISO string
        const historyDate = new Date(Date.now() - (3 - i) * 365 * 24 * 60 * 60 * 1000).toISOString(); // Years ago
        
        samplePriceHistory.push({
          vehicleId: vehicle.id,
          price: basePrice + (i * 25000), // Increasing price over time
          currency: 'USD',
          date: historyDate,
          source: sources[i % 3],
          sourceUrl: `https://example.com/history/${vehicle.id}/${i + 1}`,
          notes: `Historical sale ${i + 1}`,
        });
      }
    }
    
    // Insert price history
    console.log('Inserting sample price history...');
    const insertedPriceHistory = [];
    
    for (const priceHistory of samplePriceHistory) {
      const result = await pgClient`
        INSERT INTO price_history (
          vehicle_id, price, currency, date, source, source_url, notes
        )
        VALUES (
          ${priceHistory.vehicleId}, ${priceHistory.price}, ${priceHistory.currency},
          ${priceHistory.date}::timestamp, ${priceHistory.source}, ${priceHistory.sourceUrl},
          ${priceHistory.notes}
        )
        RETURNING *
      `;
      insertedPriceHistory.push(result[0]);
    }
    
    console.log(`Inserted ${insertedPriceHistory.length} price history records`);
    
    // Close the postgres client
    await pgClient.end();
    
    console.log('Database seeding completed successfully');
    console.log('You can view the data in the Supabase dashboard:');
    if (process.env.SUPABASE_URL) {
      console.log(`${process.env.SUPABASE_URL}/project/default/database/tables`);
    }
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
}

main(); 