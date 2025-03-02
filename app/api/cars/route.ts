import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Check if Supabase credentials are configured
const isSupabaseConfigured = supabaseUrl && supabaseKey;

// Create client only if credentials are available
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET(request: Request) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.error('Supabase environment variables are not configured');
      return NextResponse.json(
        { error: 'Database connection not configured. Check server environment variables.' }, 
        { status: 503 }
      );
    }

    // Get the query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const make = searchParams.get('make');
    const type = searchParams.get('type'); // 'makes' or 'models'

    if (!query) {
      return NextResponse.json([]);
    }

    // Determine if we're searching for makes or models
    const isSearchingMakes = type === 'makes';
    const field = isSearchingMakes ? 'Make' : 'baseModel';

    console.log(
      isSearchingMakes
        ? `Querying makes with: "${query}"`
        : `Querying models with: "${query}"${make ? ` for make: "${make}"` : ''}`
    );

    // Start building the query
    let supabaseQuery = supabase
      .from('allcars')
      .select(field)
      .ilike(field, `%${query}%`);

    // If searching for models and make is provided, filter by make as well
    if (!isSearchingMakes && make) {
      supabaseQuery = supabaseQuery.eq('Make', make);
    }

    // Execute the query
    const { data, error } = await supabaseQuery
      .order(field)
      .limit(20);

    if (error) {
      console.error(`Error fetching ${isSearchingMakes ? 'makes' : 'models'}:`, error);
      return NextResponse.json({ error: `Failed to fetch ${isSearchingMakes ? 'makes' : 'models'}` }, { status: 500 });
    }

    // If no results, return empty array instead of null
    if (!data || !Array.isArray(data)) {
      console.log(`No ${isSearchingMakes ? 'make' : 'model'} results found or invalid data format`);
      return NextResponse.json([]);
    }

    console.log(
      isSearchingMakes
        ? `Found ${data.length} makes matching "${query}"`
        : `Found ${data.length} models matching "${query}"${make ? ` for make: "${make}"` : ''}`
    );
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in cars API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 