-- Create table for completed auctions
CREATE TABLE IF NOT EXISTS bat_completed_auctions (
  id SERIAL PRIMARY KEY,
  listing_id TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  sold_price INTEGER,
  sold_date TIMESTAMP,
  bid_amount INTEGER,
  bid_date TIMESTAMP,
  status TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  source_file TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on make and model for faster queries
CREATE INDEX IF NOT EXISTS idx_completed_make_model ON bat_completed_auctions (make, model);
CREATE INDEX IF NOT EXISTS idx_completed_year ON bat_completed_auctions (year);
CREATE INDEX IF NOT EXISTS idx_completed_status ON bat_completed_auctions (status);
CREATE INDEX IF NOT EXISTS idx_completed_sold_price ON bat_completed_auctions (sold_price);

-- Create table for active auctions
CREATE TABLE IF NOT EXISTS bat_active_auctions (
  id SERIAL PRIMARY KEY,
  listing_id TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  current_bid INTEGER,
  current_bid_formatted TEXT,
  end_date TIMESTAMP,
  status TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  location TEXT,
  no_reserve BOOLEAN DEFAULT FALSE,
  premium BOOLEAN DEFAULT FALSE,
  source_file TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on make and model for faster queries
CREATE INDEX IF NOT EXISTS idx_active_make_model ON bat_active_auctions (make, model);
CREATE INDEX IF NOT EXISTS idx_active_year ON bat_active_auctions (year);
CREATE INDEX IF NOT EXISTS idx_active_status ON bat_active_auctions (status);
CREATE INDEX IF NOT EXISTS idx_active_end_date ON bat_active_auctions (end_date);
CREATE INDEX IF NOT EXISTS idx_active_current_bid ON bat_active_auctions (current_bid);

-- Create a view for all auctions (both active and completed)
CREATE OR REPLACE VIEW bat_all_auctions AS
SELECT 
  'completed' as source,
  listing_id,
  url,
  title,
  image_url,
  sold_price as price,
  sold_date as date,
  status,
  year,
  make,
  model,
  NULL as location,
  FALSE as no_reserve,
  FALSE as premium,
  created_at,
  updated_at
FROM 
  bat_completed_auctions
UNION ALL
SELECT 
  'active' as source,
  listing_id,
  url,
  title,
  image_url,
  current_bid as price,
  end_date as date,
  status,
  year,
  make,
  model,
  location,
  no_reserve,
  premium,
  created_at,
  updated_at
FROM 
  bat_active_auctions;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_bat_completed_auctions_updated_at
BEFORE UPDATE ON bat_completed_auctions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bat_active_auctions_updated_at
BEFORE UPDATE ON bat_active_auctions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 